"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { escapeRegExp } = require("../../scripts/patches/lib/minified-js.js");

const IDENT = "[A-Za-z_$][\\w$]*";
const MARKER = "codexLinuxUsageLimitSendAttempt";
const COMPOSER = new RegExp(
  `let\\{agentMode:${IDENT},permissionProfileId:${IDENT},shouldSendPermissionOverrides:${IDENT}\\}`,
);
const LOCAL_USAGE_GATE = new RegExp(
  `(?<flag>${IDENT})=\\(0,${IDENT}\\.${IDENT}\\)\\("local"===${IDENT}&&${IDENT}\\.${IDENT}\\)`,
  "g",
);

function usageLimitReasonContract(source, gate) {
  const after = source.slice(gate.index + gate[0].length, gate.index + gate[0].length + 20000);
  const flag = escapeRegExp(gate.groups.flag);
  const reason = [...after.matchAll(new RegExp(
    `(?<name>${IDENT})=${flag}&&"usage-limit";`,
    "g",
  ))];
  if (reason.length !== 1) return false;
  const reasonName = escapeRegExp(reason[0].groups.name);
  const reasons = [...after.matchAll(new RegExp(
    `(?<name>${IDENT})=\\[[^\\]]{0,1500}(?:^|,)${reasonName}\\]\\.filter\\(Boolean\\)`,
    "g",
  ))];
  if (reasons.length !== 1) return false;
  const reasonsName = escapeRegExp(reasons[0].groups.name);
  const joined = [...after.matchAll(new RegExp(
    `let (?<name>${IDENT})=${reasonsName}\\.join\\(","\\);`,
    "g",
  ))];
  return joined.length === 1 &&
    after.split(`submitDisabledReasons:${joined[0].groups.name}`).length === 2;
}

function applyUsageLimitSendAttemptPatch(source) {
  if (source.includes(MARKER)) return source;

  // Match the local Codex composer and the complete semantic path from the
  // account usage gate through its disabled-reason list and rendered prop.
  const rawGates = [...source.matchAll(LOCAL_USAGE_GATE)];
  if (rawGates.length !== 1) return source;
  const gates = rawGates.filter((gate) => {
    const before = source.slice(Math.max(0, gate.index - 1200), gate.index);
    if (!COMPOSER.test(before)) return false;

    return usageLimitReasonContract(source, gate);
  });
  if (gates.length !== 1) return source;

  const gate = gates[0];
  return source.slice(0, gate.index) + `${gate.groups.flag}=!1/*${MARKER}*/` +
    source.slice(gate.index + gate[0].length);
}

// 26.1117 moved the local usage gate out of the composer into a shared rspack
// module whose atom family joins the composer's account disabled reasons.
const SHARED_REASONS = new RegExp(
  `,(?<key>[\\w$]+):\\(function\\(${IDENT},(?<exports>${IDENT}),(?<require>${IDENT})\\)\\{` +
  `[^{}]{0,1500}?let (?<flag>${IDENT})=\\(0,${IDENT}\\.${IDENT}\\)\\(${IDENT}\\.${IDENT},\\(\\{get:${IDENT}\\}\\)=>\\{[\\s\\S]{0,2000}?\\}\\),` +
  `(?<reasons>${IDENT})=\\(0,${IDENT}\\.${IDENT}\\)\\(${IDENT}\\.${IDENT},\\((?<scope>${IDENT}),\\{get:(?<get>${IDENT})\\}\\)=>\\[[^\\]]{0,500}?` +
  `(?<gate>"local"===\\k<scope>&&\\k<get>\\(\\k<flag>\\))&&"usage-limit"\\]\\.filter\\(Boolean\\)\\.join\\(","\\)\\);` +
  `\\k<require>\\.d\\(\\k<exports>,\\{\\},\\{(?<names>(?:[\\w$]+:${IDENT},?){2})\\}\\)\\}\\)`,
  "g",
);

function sharedUsageReasons(source) {
  const matches = [...source.matchAll(SHARED_REASONS)].filter((match) => {
    const exported = new Map(match.groups.names.split(",").map((entry) => entry.split(":").reverse()));
    return exported.has(match.groups.flag) && exported.has(match.groups.reasons);
  });
  if (matches.length !== 1) return null;
  const match = matches[0];
  const names = new Map(match.groups.names.split(",").map((entry) => entry.split(":").reverse()));
  return { match, key: match.groups.key, reasonsExport: names.get(match.groups.reasons) };
}

function applySharedUsageReasonsPatch(source) {
  if (source.includes(MARKER)) return source;
  const shared = sharedUsageReasons(source);
  if (shared == null) return source;
  const { match } = shared;
  const gate = match.index + match[0].indexOf(match.groups.gate);
  return source.slice(0, gate) + `!1/*${MARKER}*/` + source.slice(gate + match.groups.gate.length);
}

function composerReadsSharedReasons(source, { key, reasonsExport }) {
  const aliases = [...source.matchAll(new RegExp(`(${IDENT})=${IDENT}\\("${escapeRegExp(key)}"\\)`, "g"))];
  return aliases.some((alias) => new RegExp(
    `\\(0,${IDENT}\\.${IDENT}\\)\\(${escapeRegExp(alias[1])}\\.${escapeRegExp(reasonsExport)},`,
  ).test(source));
}

function applyUsageLimitSendAttemptAppPatch(extractedDir) {
  const assets = path.join(extractedDir, "webview", "assets", "async");
  if (!fs.existsSync(assets)) return { changed: 0, reason: "webview composer assets missing" };
  const candidates = [];
  const sharedComposers = [];
  const sharedModules = [];
  for (const name of fs.readdirSync(assets)) {
    if (!name.endsWith(".js")) continue;
    const file = path.join(assets, name);
    const source = fs.readFileSync(file, "utf8");
    if (source.includes('&&"usage-limit"].filter(Boolean).join(",")')) {
      const shared = sharedUsageReasons(source);
      if (shared == null) return { changed: 0, reason: "shared local Codex usage gate changed" };
      sharedModules.push({ file, source, shared });
    }
    if (!COMPOSER.test(source) || !source.includes("submitDisabledReasons:")) continue;
    if (!source.includes('"usage-limit"')) {
      sharedComposers.push(source);
      continue;
    }
    const patched = applyUsageLimitSendAttemptPatch(source);
    if (patched === source) {
      return { changed: 0, reason: "local Codex composer usage gate changed" };
    }
    candidates.push({ file, patched });
  }
  if (sharedComposers.length > 0) {
    if (sharedModules.length !== 1) return { changed: 0, reason: "shared local Codex usage gate changed" };
    const [{ file, source, shared }] = sharedModules;
    if (!sharedComposers.every((composer) => composerReadsSharedReasons(composer, shared))) {
      return { changed: 0, reason: "local Codex composer usage gate changed" };
    }
    const patched = applySharedUsageReasonsPatch(source);
    if (patched === source) return { changed: 0, reason: "shared local Codex usage gate changed" };
    candidates.push({ file, patched });
  }
  if (candidates.length === 0) return { changed: 0, reason: "local Codex composer usage gate changed" };
  for (const { file, patched } of candidates) fs.writeFileSync(file, patched);
  return {
    changed: candidates.length,
    targets: candidates.map(({ file }) => path.relative(extractedDir, file)),
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
  applySharedUsageReasonsPatch,
  descriptors,
};
