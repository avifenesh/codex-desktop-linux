"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { escapeRegExp } = require("../../scripts/patches/lib/minified-js.js");

const IDENT = "[A-Za-z_$][\\w$]*";
const MARKER = "codexLinuxUsageLimitSendAttempt";

// The account usage module derives the host's submit-disabled reasons in one
// atom family: [..., "local"===host&&get(usageExhausted)&&"usage-limit"]
// .filter(Boolean).join(","). Only the local host entry is neutralized; other
// reasons in the same list (such as "reserve-limit") keep applying.
const USAGE_REASONS = new RegExp(
  `(?<atom>${IDENT})=\\(0,${IDENT}\\.${IDENT}\\)\\(${IDENT}\\.${IDENT},\\((?<host>${IDENT}),\\{get:(?<get>${IDENT})\\}\\)=>` +
    `\\[[^\\[\\]]{0,400}?(?<gate>"local"===\\k<host>&&\\k<get>\\(${IDENT}\\)&&"usage-limit")\\]` +
    `\\.filter\\(Boolean\\)\\.join\\(","\\)\\)`,
  "g",
);
const MODULE_HEADER = /(?:^|[,{])"?(?<id>[\w$]+)"?(?::\(function|)\([\w$]+(?:,[\w$]+){0,2}\)\{/g;

// Returns the unique usage-reason atom with its module ID and export name, or
// null when the shape is missing, ambiguous or not exported.
function findUsageReasonAtom(source) {
  const matches = [...source.matchAll(USAGE_REASONS)];
  if (matches.length !== 1) return null;
  const [match] = matches;
  const end = match.index + match[0].length;
  const exported = new RegExp(
    `^;${IDENT}\\.d\\(${IDENT},\\{\\},\\{(?:[^{}]*,)?(?<name>${IDENT}):${escapeRegExp(match.groups.atom)}(?:,[^{}]*)?\\}\\)`,
  ).exec(source.slice(end, end + 400));
  if (exported == null) return null;
  let moduleId = null;
  for (const header of source.slice(0, match.index).matchAll(MODULE_HEADER)) moduleId = header.groups.id;
  if (moduleId == null) return null;
  const gateIndex = match.index + match[0].indexOf(match.groups.gate);
  return { gateIndex, gate: match.groups.gate, moduleId, exportName: exported.groups.name };
}

// A local Codex composer reads the atom for its host and spreads the value into
// the reason list that becomes its submitDisabledReasons prop.
function consumesUsageReasons(source, { moduleId, exportName }) {
  if (!source.includes("shouldSendPermissionOverrides:") || !source.includes("submitDisabledReasons:")) return false;
  const modules = [...source.matchAll(new RegExp(`(?<name>${IDENT})=${IDENT}\\("${escapeRegExp(moduleId)}"\\)`, "g"))];
  if (modules.length !== 1) return false;
  const reads = [...source.matchAll(new RegExp(
    `(?<name>${IDENT})=\\(0,${IDENT}\\.${IDENT}\\)\\(${escapeRegExp(modules[0].groups.name)}\\.${escapeRegExp(exportName)},${IDENT}\\)`,
    "g",
  ))];
  if (reads.length !== 1) return false;
  const reason = escapeRegExp(reads[0].groups.name);
  const lists = [...source.matchAll(new RegExp(
    `(?<name>${IDENT})=\\[(?:[^\\[\\]]{0,1500},)?${reason}(?:,[^\\[\\]]{0,1500})?\\]\\.filter\\(Boolean\\)`,
    "g",
  ))];
  if (lists.length !== 1) return false;
  const joined = [...source.matchAll(new RegExp(
    `let (?<name>${IDENT})=${escapeRegExp(lists[0].groups.name)}\\.join\\(","\\);`,
    "g",
  ))];
  return joined.length === 1 && source.split(`submitDisabledReasons:${joined[0].groups.name}`).length === 2;
}

// Any module that binds the usage module and passes the reasons atom to a
// reader call, such as (0,x.get)(binding.o,host) or store.get(binding.o,host).
// The composers are among them; other local-host surfaces read the same list.
// Minified chunks reuse short binding names across modules, so a plain
// binding.o elsewhere (a different module's function export) does not count.
function readsUsageReasons(source, { moduleId, exportName }) {
  return [...source.matchAll(new RegExp(`(?<name>${IDENT})=${IDENT}\\("${escapeRegExp(moduleId)}"\\)`, "g"))]
    .some(({ groups }) => new RegExp(`\\(${escapeRegExp(groups.name)}\\.${escapeRegExp(exportName)},`).test(source));
}

function applyUsageLimitSendAttemptPatch(source) {
  if (source.includes(MARKER)) return source;
  const atom = findUsageReasonAtom(source);
  if (atom == null) return source;
  return source.slice(0, atom.gateIndex) + `!1/*${MARKER}*/` + source.slice(atom.gateIndex + atom.gate.length);
}

function applyUsageLimitSendAttemptAppPatch(extractedDir) {
  const drift = { changed: 0, reason: "local Codex composer usage gate changed" };
  const assets = path.join(extractedDir, "webview", "assets", "async");
  if (!fs.existsSync(assets)) return { changed: 0, reason: "webview composer assets missing" };
  const sources = fs.readdirSync(assets).filter((name) => name.endsWith(".js"))
    .map((name) => ({ file: path.join(assets, name), source: fs.readFileSync(path.join(assets, name), "utf8") }));
  const owners = sources.filter(({ source }) =>
    source.includes('"usage-limit"') && [...source.matchAll(USAGE_REASONS)].length > 0);
  if (owners.length !== 1) return drift;
  const [owner] = owners;
  const atom = findUsageReasonAtom(owner.source);
  if (atom == null) return drift;
  const consumers = sources.filter(({ source }) => consumesUsageReasons(source, atom));
  if (consumers.length === 0) return drift;
  // A composer that builds its own "usage-limit" reason would keep blocking
  // Send after this patch, so the patch fails closed.
  if (sources.some(({ source }) => /"usage-limit"/.test(source) && /submitDisabledReasons:/.test(source))) return drift;
  const patched = applyUsageLimitSendAttemptPatch(owner.source);
  if (patched === owner.source) return drift;
  fs.writeFileSync(owner.file, patched);
  return {
    changed: 1,
    targets: [path.relative(extractedDir, owner.file)],
    consumers: consumers.map(({ file }) => path.relative(extractedDir, file)),
    readers: sources.filter(({ source }) => readsUsageReasons(source, atom)).map(({ file }) => path.relative(extractedDir, file)),
  };
}

const descriptors = [{
  id: "usage-limit-send-attempt-ui",
  phase: "extracted-app:post-webview",
  order: 20560,
  ciPolicy: "optional",
  apply: applyUsageLimitSendAttemptAppPatch,
  status: (result) => result.changed > 0 ? "applied" : { status: "skipped-optional", reason: result.reason },
}];

module.exports = {
  applyUsageLimitSendAttemptPatch,
  applyUsageLimitSendAttemptAppPatch,
  consumesUsageReasons,
  findUsageReasonAtom,
  descriptors,
};
