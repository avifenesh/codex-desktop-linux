"use strict";

const { escapeRegExp, findMatchingBrace } = require("../../scripts/patches/lib/minified-js.js");

const ID = "[A-Za-z_$][\\w$]*";
const ROOT_KEY = "codexLinuxCuaPluginRoot";
const ROOT_PLACEHOLDER = "\u0000ROOT\u0000";
// rspack chunk modules: `exports.modules={123(e,t,r){...},456(e){...}}`.
const MODULE_HEADER = /(?:modules=\{|\},)\d+\([\w$]+(?:,[\w$]+){0,2}\)\{/g;

function drift(description) {
  return new Error(`Linux unified Computer Use contract drift: ${description}`);
}

function uniqueMatch(source, pattern, description) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) throw drift(description);
  return matches[0];
}

function requireUsages(source, name, expected) {
  // Include bare references as well as calls so an added alias/export fails
  // closed. Property accesses such as constants.Aa and private class members
  // such as #Aa are different bindings.
  // Current rspack modules also embed large serialized tables. Scan JavaScript
  // tokens so identifier-shaped data in strings, comments, and regexes does
  // not look like a consumer of a short minified binding.
  let uses = 0;
  let previousToken = null;
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (/\s/u.test(char)) { index += 1; continue; }
    if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) break;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      index = source.indexOf("*/", index + 2);
      if (index < 0) break;
      index += 2;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") index += 2;
        else if (source[index++] === quote) break;
      }
      previousToken = "literal";
      continue;
    }
    const regexPrefix = previousToken == null || /^(?:return|throw|case|delete|void|typeof|instanceof|in)$/u.test(previousToken) ||
      /^[([{,:;=!?&|+*%^~<>-]$/u.test(previousToken);
    if (char === "/" && regexPrefix) {
      let inClass = false;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") index += 2;
        else if (source[index] === "[") { inClass = true; index += 1; }
        else if (source[index] === "]") { inClass = false; index += 1; }
        else if (source[index] === "/" && !inClass) { index += 1; break; }
        else index += 1;
      }
      while (/[a-z]/iu.test(source[index] ?? "")) index += 1;
      previousToken = "literal";
      continue;
    }
    if (/[A-Za-z_$]/u.test(char)) {
      const start = index++;
      while (/[\w$]/u.test(source[index] ?? "")) index += 1;
      const token = source.slice(start, index);
      let next = index;
      while (/\s/u.test(source[next] ?? "")) next += 1;
      const property = source[start - 1] === "." || source[start - 1] === "#" || source[next] === ":";
      if (token === name && !property) uses += 1;
      previousToken = token;
      continue;
    }
    previousToken = char;
    index += 1;
  }
  if (uses !== expected) throw drift(`unexpected ${name} consumers`);
}

// Minified names are module scoped. Restrict every relationship check to the
// rspack module that owns the selector; plain fixtures are one module.
function moduleBounds(source, index) {
  let start = 0;
  let end = source.length;
  for (const header of source.matchAll(MODULE_HEADER)) {
    if (header.index < index) {
      start = header.index;
    } else {
      end = header.index;
      break;
    }
  }
  return { start, end };
}

function rootGuard(name) {
  return `if(typeof ${name}!==\`string\`||${name}.length===0)throw Error(\`Linux Computer Use trusted plugin root is unavailable\`);`;
}

// Chunk files are CommonJS modules, so injected code uses Node's require
// instead of a module-local rspack path alias.
function pluginFile(root, file) {
  return `require("node:path").join(${root},"scripts","${file}")`;
}

function bannerExpression(root) {
  return `'await import("@oai/cua/tinyskyAlt");await(await import('+JSON.stringify(${pluginFile(root, "native-client.mjs")})+")).installLinuxComputerUse(cua);"`;
}

function rootPattern(source) {
  return escapeRegExp(source).replace(escapeRegExp(ROOT_PLACEHOLDER), `(?<pluginRoot>${ID})`);
}

// The signed package writes the shared plugin's .mcp.json through one writer
// used by plugin synchronization and by executor plugin copies, and builds the
// same config again for each resumed local thread. Every consumer must receive
// the plugin root that its trusted service and banner point into.
function lifecycleContract(source, builder) {
  const writer = uniqueMatch(source, new RegExp(
    `async function (?<name>${ID})\\((?<root>${ID}),(?<options>${ID})(?<rootParam>,(?<writerRoot>${ID})=\\k<root>)?\\)\\{` +
    `let ${ID}=${ID}\\(\\)\\.join\\(\\k<root>,"\\.mcp\\.json"\\)`, "g"),
  "expected one shared plugin config writer");
  const writerOwner = enclosingFunction(source, writer.index);
  if (writerOwner == null || writerOwner.start !== writer.index) throw drift("expected one shared plugin config writer");
  const writerSource = source.slice(writerOwner.start, writerOwner.end);
  const writerCall = uniqueMatch(writerSource, new RegExp(
    `Object\\.assign\\(${ID}\\.mcpServers\\.cua_repl,${escapeRegExp(builder)}\\(\\{\\.\\.\\.${escapeRegExp(writer.groups.options)},sharedPlugin:!0\\}` +
    `(?<rootArg>,(?<pluginRoot>${ID}))?\\)\\)`, "g"), "expected one shared plugin config builder call");
  requireUsages(source, builder, 3); // declaration, shared plugin writer, thread configuration
  requireUsages(source, writer.groups.name, 3); // declaration, plugin synchronization, executor copy

  // Plugin synchronization resolves the root from verified installed plugin
  // metadata and caches the synchronized selection for thread configuration.
  const sync = uniqueMatch(source, new RegExp(
    `(?<enabled>${ID})=await async function\\((?<argument>${ID})\\)\\{let (?<entry>${ID})=${ID}\\(\\{marketplaceName:\\k<argument>\\.marketplaceName,` +
    `marketplaces:\\k<argument>\\.marketplaces,pluginName:${ID}\\.${ID}\\}\\);if\\(!\\k<entry>\\?\\.plugin\\.installed\\)return!1;` +
    `let (?<pluginRoot>${ID})=\\(0,${ID}\\.${ID}\\)\\(\\{codexHome:\\k<argument>\\.codexHome,localVersion:\\k<entry>\\.plugin\\.localVersion,` +
    `marketplaceName:\\k<entry>\\.marketplace\\.name,pluginName:\\k<entry>\\.plugin\\.name\\}\\);return (?<publish>(?<selection>${ID})\\.${ROOT_KEY}=\\k<pluginRoot>,)?` +
    `await ${escapeRegExp(writer.groups.name)}\\(\\k<pluginRoot>,\\k<argument>\\),`, "g"),
  "expected plugin root derived from verified installed plugin metadata");
  const syncOwner = enclosingFunction(source, sync.index);
  if (syncOwner == null) throw drift("expected a plugin synchronization owner");
  const syncOwnerSource = source.slice(syncOwner.start, syncOwner.end);
  const cached = uniqueMatch(syncOwnerSource, new RegExp(
    `\\{selection:(?<selection>${ID}),cuaReplEnabled:${escapeRegExp(sync.groups.enabled)},executorLaunch:${ID},confirmationPolicyConfig:${ID}\\}`, "g"),
  "expected synchronized selection to be cached with CUA enabled state");
  uniqueMatch(syncOwnerSource, new RegExp(`(?:let |,)${escapeRegExp(cached.groups.selection)}=await ${ID}\\(\\{`, "g"),
    "expected cached selection to belong to plugin initialization");
  if (sync.groups.publish != null && sync.groups.selection !== cached.groups.selection) {
    throw drift("plugin root receiver is not the cached selection");
  }
  // The injected assignment runs inside the inline synchronization function;
  // a binding there with the selection's name would shadow it.
  const inlineOpen = sync.index + sync[0].indexOf("){") + 1;
  const inlineSource = source.slice(inlineOpen, findMatchingBrace(source, inlineOpen) + 1);
  requireUsages(inlineSource, cached.groups.selection, sync.groups.publish == null ? 0 : 1);

  // Executor plugin copies are written in a staging directory and then renamed
  // to their content-addressed directory, which is the root the copy runs from.
  const executor = uniqueMatch(source, new RegExp(
    `await \\(0,${ID}\\.cp\\)\\(${ID}\\.path,(?<staging>${ID}),\\{recursive:!0\\}\\),` +
    `await ${escapeRegExp(writer.groups.name)}\\(\\k<staging>,${ID}(?<rootArg>,(?<finalRoot>${ID}))?\\);` +
    `try\\{await \\(0,${ID}\\.rename\\)\\(\\k<staging>,(?<final>${ID})\\)`, "g"),
  "expected one executor plugin copy");
  if (executor.groups.rootArg != null && executor.groups.finalRoot !== executor.groups.final) {
    throw drift("executor plugin copy root is not its final directory");
  }

  const resume = uniqueMatch(source, new RegExp(
    `(?<![\\w$.#])${escapeRegExp(builder)}\\(\\{browserBackends:(?<selection>${ID})\\.browserBackends,` +
    `deferTools:\\k<selection>\\.desktopFeatureAvailability\\.deferCuaTools,` +
    `confirmationPolicyConfig:(?<cache>${ID})\\.confirmationPolicyConfig,` +
    `omitCuaConfirmationPolicyBySku:\\k<selection>\\.desktopFeatureAvailability\\.omitCuaConfirmationPolicyBySku,` +
    `surfaces:\\k<selection>\\.cuaReplSurfaces,` +
    `nodeRepl:${ID}\\}(?<root>,\\k<selection>\\.${ROOT_KEY})?\\)`, "g"),
  "expected one thread configuration builder call");
  const resumeOwner = enclosingFunction(source, resume.index);
  if (resumeOwner == null) throw drift("expected a thread configuration owner");
  const resumeSource = source.slice(resumeOwner.start, resumeOwner.end);
  const selection = escapeRegExp(resume.groups.selection);
  uniqueMatch(resumeSource, new RegExp(
    `(?<cached>${ID})=${ID}\\.browserUseTinysky\\?${ID}:null,` +
    `${ID}=${ID}\\?await ${ID}\\.getAuthenticatedPrincipal\\(\\)\\.catch\\(\\(\\)=>null\\):null,` +
    `${selection}=\\k<cached>\\?\\.selection\\?\\?await ${ID}\\(`, "g"),
  "expected thread configuration to reuse the cached selection");
  // The resumed builder call is guarded by the cached enabled state, so its
  // selection is the cached one that carries the published root.
  if (!resumeSource.includes(`${resume.groups.cache}?.cuaReplEnabled&&`)) {
    throw drift("thread configuration is not guarded by the cached CUA state");
  }
  // The per-thread selection may only be widened by copying the cached
  // selection, which keeps the published trusted root.
  const reassignments = [...resumeSource.matchAll(new RegExp(`(?<![\\w$.#])${selection}=(?!=)`, "g"))];
  const copies = [...resumeSource.matchAll(new RegExp(`(?<![\\w$.#])${selection}=\\{\\.\\.\\.${selection},`, "g"))];
  if (reassignments.length !== 1 + copies.length) {
    throw drift("thread configuration replaces the cached selection");
  }
  return { writer, writerSource, writerCall, sync, executor, resume, selection: cached.groups.selection };
}

function enclosingFunction(source, targetIndex) {
  const functions = /(?:async )?function [A-Za-z_$][\w$]*\([^)]*\)\{/gu;
  let owner = null;
  for (const candidate of source.matchAll(functions)) {
    if (candidate.index > targetIndex) break;
    const open = candidate.index + candidate[0].length - 1;
    const close = findMatchingBrace(source, open);
    if (close >= targetIndex) owner = { start: candidate.index, end: close + 1 };
  }
  return owner;
}

function freshBuilderRoot(source) {
  const identifiers = new Set(source.match(/[A-Za-z_$][\w$]*/g));
  const base = ROOT_KEY;
  let name = base;
  for (let suffix = 1; identifiers.has(name); suffix += 1) name = `${base}${suffix}`;
  return name;
}

function selectorPattern() {
  return /(?<native>[\w$]+)=(?<ready>[\w$]+)&&(?<features>[\w$]+)\.computerUse&&(?<legacy>[\w$]+)\.enabled&&\("win32"===(?<runtime>[\w$]+)\.platform\|\|"darwin"===\k<runtime>\.platform&&null!=\k<legacy>\.paths\.serviceAppPath\)(?<linux>\|\|\k<ready>&&"linux"===\k<runtime>\.platform&&\k<features>\.computerUse&&\k<legacy>\.enabled)?,(?<mode>[\w$]+)=(?<modeLinux>"linux"===\k<runtime>\.platform\?\k<native>:)?(?<modeValue>\k<features>\.computerUse&&\(!\k<features>\.browserUseTinysky\|\|"darwin"!==\k<runtime>\.platform\|\|\k<legacy>\.enabled\))(?=,)/g;
}

function applyUnifiedComputerUsePatch(chunk) {
  if (!chunk.includes("cuaReplSurfaces")) {
    // The rspack main process spans several chunks; only one owns CUA setup.
    console.warn("WARN: Could not find the unified Computer Use surface selector - skipping Linux unified Computer Use patch");
    return chunk;
  }
  // Match the current selector, including variable relationships. Both pristine
  // and patched forms must have exactly one owner; drift must abort the build.
  const ownersPattern = /[\w$]+=[\w$]+&&[\w$]+\.computerUse&&[\w$]+\.enabled&&\("win32"===[\w$]+\.platform\|\|"darwin"===[\w$]+\.platform&&null!=[\w$]+\.paths\.serviceAppPath/g;
  const chunkSelectors = [...chunk.matchAll(selectorPattern())];
  if (chunkSelectors.length !== 1 || [...chunk.matchAll(ownersPattern)].length !== 1 || !chunk.includes("cuaReplSurfaces:")) {
    throw drift("expected one native surface selector");
  }
  const bounds = moduleBounds(chunk, chunkSelectors[0].index);
  const source = chunk.slice(bounds.start, bounds.end);
  const patchedModule = applyUnifiedComputerUseModulePatch(source);
  return patchedModule === source ? chunk : chunk.slice(0, bounds.start) + patchedModule + chunk.slice(bounds.end);
}

function applyUnifiedComputerUseModulePatch(source) {
  const match = uniqueMatch(source, selectorPattern(), "expected one native surface selector");
  const { native, ready, runtime, features, legacy, mode, modeValue, linux, modeLinux } = match.groups;
  if (Boolean(linux) !== Boolean(modeLinux)) throw drift("partial native selector patch");
  // One config builder serves the shared plugin writer and per-thread
  // configuration. It receives the trusted plugin root as an extra argument.
  const builder = uniqueMatch(source, new RegExp(
    `function (?<builder>[\\w$]+)\\(\\{browserBackends:(?<backends>[\\w$]+),deferTools:(?<defer>[\\w$]+),` +
      `confirmationPolicyConfig:[\\w$]+="\\{\\}",omitCuaConfirmationPolicyBySku:[\\w$]+,` +
      `surfaces:(?<surfaces>[\\w$]+),nodeRepl:(?<nodeRepl>[\\w$]+),` +
      `sharedPlugin:[\\w$]+=!1\\}(?<rootParam>,(?<pluginRoot>[\\w$]+))?\\)\\{`,
    "g",
  ), "expected one native config builder");
  const builderOwner = enclosingFunction(source, builder.index);
  if (builderOwner == null || builderOwner.start !== builder.index) throw drift("expected one native config builder");
  const builderSource = source.slice(builderOwner.start, builderOwner.end);
  const { surfaces, nodeRepl } = builder.groups;
  const currentServices = [...builderSource.matchAll(new RegExp(
    `${surfaces}\\.includes\\("computer"\\)&&\\((?<services>[\\w$]+)\\.sky="@oai/sky/service"\\)`, "g"))];
  const patchedServices = [...builderSource.matchAll(new RegExp(
    `${surfaces}\\.includes\\("computer"\\)&&\\((?<services>[\\w$]+)\\.sky=` +
      `${rootPattern(pluginFile(ROOT_PLACEHOLDER, "native-service.mjs"))}\\)`, "g"))];
  // Audio environment block; carried through unchanged.
  const audioEnvironmentPattern =
    `(?<audio>\\.\\.\\.${nodeRepl}\\?\\.env\\.SKY_[A-Z_]+==="1"\\?\\{` +
    `SKY_ENABLE_AUDIO:${surfaces}\\.includes\\("computer"\\)\\?"1":"0",` +
    `[^{}]*\\}:\\{\\},)`;
  const environmentPrefix =
    `\\{(?<prefix>\\.\\.\\.${nodeRepl}\\?\\.env,(?:[^{}]|\\{[^{}]*\\}){0,500}?)` +
    `CUA_REPL_ENABLED_SURFACES:${surfaces}\\.join\\(","\\),`;
  const servicesEnvironment = `\\[(?<constants>[\\w$]+)\\.(?<constant>[\\w$]+)\\]:JSON\\.stringify\\((?<services>[\\w$]+)\\)`;
  const currentBanners = [...builderSource.matchAll(new RegExp(
    environmentPrefix + audioEnvironmentPattern + servicesEnvironment, "g"))];
  const patchedBanners = [...builderSource.matchAll(new RegExp(
    environmentPrefix + "CODEX_LINUX_CUA_HOST_SOCKET:process\\.env\\.CODEX_LINUX_CUA_HOST_SOCKET," +
      `NODE_REPL_JS_BANNER:${rootPattern(bannerExpression(ROOT_PLACEHOLDER))},` +
      audioEnvironmentPattern + servicesEnvironment, "g"))];
  // The packaged cua-repl instructions path rebuilds the environment but keeps
  // caller-provided trusted services and banner; anything else drops the bridge.
  const bannerKeys = builderSource.split("NODE_REPL_JS_BANNER:").length - 1;
  const serviceKeys = builderSource.split("NODE_REPL_TRUSTED_SERVICES:").length - 1;
  const bannerFallback = [...builderSource.matchAll(new RegExp(
    `NODE_REPL_JS_BANNER:(${ID})\\.NODE_REPL_JS_BANNER\\?\\?`, "g"))];
  const serviceFallback = [...builderSource.matchAll(new RegExp(
    `NODE_REPL_TRUSTED_SERVICES:(${ID})\\.NODE_REPL_TRUSTED_SERVICES\\?\\?`, "g"))];
  if (bannerFallback.length !== 1 || serviceFallback.length !== 1 || serviceKeys !== 1 ||
      bannerKeys !== 1 + patchedBanners.length) {
    throw drift("packaged cua-repl environment no longer preserves the native bridge");
  }
  // Token scan: the builder also passes a "--require-browser-access" literal.
  // Only the injected node:path calls may reference require.
  try {
    requireUsages(builderSource, "require", builderSource.split('require("node:path")').length - 1);
  } catch {
    throw drift("native config builder shadows require");
  }
  const lifecycle = lifecycleContract(source, builder.groups.builder);
  const { writer, writerSource, writerCall, sync, executor, resume } = lifecycle;
  const serviceCurrent = currentServices.length === 1 && patchedServices.length === 0;
  const servicePatched = currentServices.length === 0 && patchedServices.length === 1;
  const bannerCurrent = currentBanners.length === 1 && patchedBanners.length === 0;
  const bannerPatched = currentBanners.length === 0 && patchedBanners.length === 1;
  const current = !linux && builder.groups.rootParam == null && serviceCurrent && bannerCurrent &&
    writer.groups.rootParam == null && writerCall.groups.rootArg == null && sync.groups.publish == null &&
    executor.groups.rootArg == null && resume.groups.root == null;
  const patched = Boolean(linux) && builder.groups.rootParam != null && servicePatched && bannerPatched &&
    writer.groups.rootParam != null && writerCall.groups.rootArg != null && sync.groups.publish != null &&
    executor.groups.rootArg != null && resume.groups.root != null;
  if (!current && !patched) throw drift("expected one native trusted service selector");
  const service = current ? currentServices[0] : patchedServices[0];
  const banner = current ? currentBanners[0] : patchedBanners[0];
  if (banner.groups.services !== service.groups.services) throw drift("changed native banner relationship");
  if (patched) {
    if (service.groups.pluginRoot !== builder.groups.pluginRoot ||
        banner.groups.pluginRoot !== builder.groups.pluginRoot ||
        writerCall.groups.pluginRoot !== writer.groups.writerRoot) {
      throw drift("changed native service path relationship");
    }
    if (!builderSource.startsWith(builder[0] + rootGuard(builder.groups.pluginRoot))) {
      throw drift("incomplete trusted root propagation");
    }
    return source;
  }
  // Caller and helper have independent minified scopes. A caller alias can be
  // an existing destructured parameter or local in the helper. Use a fresh
  // helper binding, including nested scopes that capture the injected value.
  const builderRoot = freshBuilderRoot(builderSource);
  const writerRoot = freshBuilderRoot(writerSource);
  const writerParams = writer.index + writer[0].indexOf("){");
  const writerCallEnd = writer.index + writerSource.indexOf(writerCall[0]) + writerCall[0].length - 2;
  const executorCallEnd = executor.index + executor[0].indexOf(");try{");
  const edits = [
    {
      index: match.index,
      length: match[0].length,
      replacement:
        `${native}=${ready}&&${features}.computerUse&&${legacy}.enabled&&("win32"===${runtime}.platform||"darwin"===${runtime}.platform&&null!=${legacy}.paths.serviceAppPath)` +
        `||${ready}&&"linux"===${runtime}.platform&&${features}.computerUse&&${legacy}.enabled,` +
        `${mode}="linux"===${runtime}.platform?${native}:${modeValue}`,
    },
    {
      index: builderOwner.start + service.index,
      length: service[0].length,
      replacement: `${surfaces}.includes("computer")&&(${service.groups.services}.sky=${pluginFile(builderRoot, "native-service.mjs")})`,
    },
    {
      index: builderOwner.start + banner.index,
      length: banner[0].length,
      replacement:
        `{${banner.groups.prefix}CUA_REPL_ENABLED_SURFACES:${surfaces}.join(","),` +
        "CODEX_LINUX_CUA_HOST_SOCKET:process.env.CODEX_LINUX_CUA_HOST_SOCKET," +
        `NODE_REPL_JS_BANNER:${bannerExpression(builderRoot)},` +
        banner.groups.audio +
        `[${banner.groups.constants}.${banner.groups.constant}]:JSON.stringify(${banner.groups.services})`,
    },
    {
      index: builder.index + builder[0].length - 2,
      length: 0,
      replacement: `,${builderRoot}`,
    },
    {
      index: builder.index + builder[0].length,
      length: 0,
      replacement: rootGuard(builderRoot),
    },
    // The writer defaults to the directory it writes; executor copies pass
    // their final directory instead of the staging directory.
    { index: writerParams, length: 0, replacement: `,${writerRoot}=${writer.groups.root}` },
    { index: writerCallEnd, length: 0, replacement: `,${writerRoot}` },
    { index: executorCallEnd, length: 0, replacement: `,${executor.groups.final}` },
    {
      index: sync.index + sync[0].lastIndexOf("await "),
      length: 0,
      replacement: `${lifecycle.selection}.${ROOT_KEY}=${sync.groups.pluginRoot},`,
    },
    {
      index: resume.index + resume[0].length - 1,
      length: 0,
      replacement: `,${resume.groups.selection}.${ROOT_KEY}`,
    },
  ];
  let patchedSource = source;
  for (const edit of edits.sort((left, right) => right.index - left.index)) {
    patchedSource = patchedSource.slice(0, edit.index) + edit.replacement +
      patchedSource.slice(edit.index + edit.length);
  }
  return patchedSource;
}

module.exports = { applyUnifiedComputerUsePatch };
