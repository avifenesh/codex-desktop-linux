"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const url = require("node:url");
const vm = require("node:vm");
const { findMainProcessChunks } = require("../../scripts/patches/lib/assets.js");
const { escapeRegExp, findMatchingBrace } = require("../../scripts/patches/lib/minified-js.js");
const { applyUnifiedComputerUsePatch } = require("./unified.js");

const IDENT = "[A-Za-z_$][\\w$]*";

function only(source, pattern) {
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `Expected one official contract: ${pattern}`);
  return matches[0];
}

function oneAlias(source, pattern) {
  const aliases = new Set([...source.matchAll(pattern)].map(match => match[1]));
  assert.equal(aliases.size, 1, `Expected one official module alias: ${pattern}`);
  return [...aliases][0];
}

function owner(source, index) {
  let found;
  for (const match of source.matchAll(/(?:async )?function [A-Za-z_$][\w$]*\([^)]*\)\{/g)) {
    if (match.index > index) break;
    const end = findMatchingBrace(source, match.index + match[0].length - 1) + 1;
    if (end > index) found = source.slice(match.index, end);
  }
  assert(found, "Expected a function owning the official contract");
  return found;
}

// The rspack main process spreads code over CommonJS chunks; exactly one owns
// the unified Computer Use setup.
function signedChunks() {
  const mainProcess = findMainProcessChunks(process.env.CODEX_SIGNED_EXTRACTED_APP);
  assert(mainProcess, "Expected the official main-process chunks");
  return mainProcess.chunks.map(name => ({
    name, source: fs.readFileSync(path.join(mainProcess.buildDir, name), "utf8"),
  }));
}

function trustedServicesConstant(chunks, exportName) {
  // Resolve the cross-chunk constant export used as the trusted-services key.
  const entry = only(chunks.find(({ name }) => name === "early-bootstrap.js").source,
    new RegExp(`[,{]${escapeRegExp(exportName)}:\\(\\)=>${IDENT}\\.(${IDENT})[,}]`, "g"));
  const values = chunks.flatMap(({ source }) => [...source.matchAll(
    new RegExp(`[,{]${escapeRegExp(entry[1])}:"(NODE_REPL_[A-Z_]+)"[,}]`, "g"))]);
  assert.equal(values.length, 1);
  return values[0][1];
}

// Inert dependencies for the actual packaged config builder. No Electron,
// app-server, profile, or network is used.
function builderDependencies(source, trustedServicesKey, state) {
  const builder = only(source, new RegExp(
    `function (${IDENT})\\(\\{browserBackends:(${IDENT}),deferTools:${IDENT},` +
    `confirmationPolicyConfig:${IDENT}="\\{\\}",omitCuaConfirmationPolicyBySku:${IDENT},surfaces:${IDENT},` +
    `nodeRepl:${IDENT},sharedPlugin:${IDENT}=!1\\}`,
    "g",
  ));
  const buildSource = owner(source, builder.index);
  const packageRoot = only(buildSource, new RegExp(
    `(${IDENT})\\(\\)\\.join\\((${IDENT})\\.env\\[(${IDENT})\\.(${IDENT})\\],"@oai/cua-repl"\\)`, "g"));
  const services = only(buildSource, new RegExp(`\\[(${IDENT})\\.(${IDENT})\\]:JSON\\.stringify\\(${IDENT}\\)`, "g"));
  const backends = only(buildSource, new RegExp(`\\[(${IDENT})\\.(${IDENT})\\]:${builder[2]}\\.join\\(","\\)`, "g"));
  // The confirmation policy keys are appended to an env-list constant.
  const envList = only(buildSource, new RegExp(`\\[(${IDENT})\\]:\\[${IDENT}\\?\\.env\\[\\1\\],`, "g"));
  const executable = only(buildSource, new RegExp(`command:${packageRoot[2]}\\.env\\[${packageRoot[3]}\\.(${IDENT})\\]`, "g"));
  const files = oneAlias(buildSource, new RegExp(`\\(0,(${IDENT})\\.readFileSync\\)\\(new URL`, "g"));
  const fileUrls = oneAlias(buildSource, new RegExp(`\\(0,(${IDENT})\\.pathToFileURL\\)`, "g"));
  const platforms = only(buildSource, new RegExp(`(${IDENT})\\[${IDENT}\\];if\\(!${IDENT}\\)throw Error\\(\`unsupported cua_repl platform`, "g"));
  assert.equal(services[1], packageRoot[3]);
  const constants = new Proxy({}, {
    get: (_, key) => key === services[2] ? trustedServicesKey : String(key),
  });
  const globals = {
    [packageRoot[1]]: () => path,
    [packageRoot[3]]: constants,
    [backends[1]]: constants,
    [envList[1]]: "NODE_REPL_ENV_LIST",
    [files]: {
      readFileSync: file => {
        // The packaged fallback checks `instanceof Error` in its own realm.
        if (!state.instructions) throw Object.assign(new (vm.runInContext("Error", globals))(`missing ${file}`), { code: "ENOENT" });
        return file.pathname.endsWith("banner.js") ? 'await import("@oai/cua/tinyskyAlt");' : "instructions";
      },
    },
    [fileUrls]: { pathToFileURL: url.pathToFileURL },
    [platforms[1]]: { linux: "linux" },
    URL,
    require: name => {
      assert.equal(name, "node:path");
      return path;
    },
    process: { platform: "linux", execPath: "/electron", env: { CODEX_LINUX_CUA_HOST_SOCKET: "/runtime/cua.sock" } },
  };
  return {
    builder: builder[1], buildSource, globals, trustedServicesModule: services[1],
    nodeReplEnv: { [packageRoot[4]]: "/bundled", [executable[1]]: "/node" },
  };
}

// Run the actual packaged helper and per-thread override function.
function resumeHarness(source, trustedServicesKey) {
  const state = { cached: undefined, instructions: true };
  const deps = builderDependencies(source, trustedServicesKey, state);
  const call = only(source, new RegExp(
    `(${IDENT})\\[\`mcp_servers\\.\\$\\{(${IDENT})\\.(${IDENT})\\}\`\\]=${escapeRegExp(deps.builder)}\\(\\{browserBackends:(${IDENT})\\.browserBackends,`, "g"));
  const resumeSource = owner(source, call.index);
  const selection = call[4];
  assert.equal(deps.trustedServicesModule, call[2]);
  const local = only(resumeSource, new RegExp(
    `(${IDENT})="local"===(${IDENT})\\.hostConfig\\.kind`,
    "g",
  ));
  const features = only(resumeSource, new RegExp(
    `(${IDENT})=${local[1]}\\?(${IDENT})\\(\\):${IDENT}\\.desktopFeatureAvailability`,
    "g",
  ));
  const cache = only(resumeSource, new RegExp(
    `(${IDENT})=${local[1]}\\?await (${IDENT})\\(${local[2]},\\{waitForReconcile:${features[1]}\\.browserUseTinysky\\}\\):null`,
    "g",
  ));
  const posture = only(resumeSource, new RegExp(
    `(${IDENT})=${features[1]}\\.browserUseTinysky\\?${cache[1]}:null`,
    "g",
  ));
  const select = only(resumeSource, new RegExp(
    `${posture[1]}\\?\\.selection\\?\\?await (${IDENT})\\(`,
    "g",
  ));
  const config = only(resumeSource, new RegExp(
    `let ${IDENT}=await (${IDENT})\\(\\{\\.\\.\\.(${IDENT}),selection:${selection},` +
    `verifyBrowserService:${local[1]}&&null==${cache[1]}\\}\\)`,
    "g",
  ));
  const principal = only(resumeSource, new RegExp(
    `(${IDENT})=${local[1]}\\?await ${local[2]}\\.getAuthenticatedPrincipal\\(\\)\\.catch\\(\\(\\)=>null\\):null`,
    "g",
  ));
  const identity = only(resumeSource, new RegExp(`=${local[1]}\\?(${IDENT})\\(${principal[1]}\\)\\?\\?(${IDENT}):null`, "g"));
  const env = only(resumeSource, new RegExp(
    `Object\\.assign\\(${IDENT}\\.env,\\{\\[(${IDENT})\\.${IDENT}\\]:${IDENT},\\[\\1\\.${IDENT}\\]:(${IDENT})\\(\\)\\.env\\[(${IDENT})\\]\\?\\?"",`, "g"));
  const fallback = only(resumeSource, new RegExp(`:\\{\\.\\.\\.${IDENT},\\.\\.\\.(${IDENT})\\}\\}$`, "g"));
  const cleanup = only(resumeSource, new RegExp(`\\)\\),(${IDENT})\\(${IDENT}\\["mcp_servers\\.node_repl"\\],${selection}\\.cuaReplSurfaces\\)`, "g"));

  const globals = Object.assign(deps.globals, {
    [env[1]]: new Proxy({}, { get: (_, key) => String(key) }),
    [cache[2]]: async () => state.cached,
    [features[2]]: () => ({ browserUseTinysky: true }),
    [select[1]]: () => { throw Error("Unexpected fallback instead of cached selection"); },
    [config[1]]: async () => ({
      "mcp_servers.node_repl": { command: "/node", args: [], env: { ...deps.nodeReplEnv } },
    }),
    [identity[1]]: () => "test-identity",
    [identity[2]]: "api-key",
    [env[2]]: () => ({ env: { CODEX_APP_SERVER_USE_LOCAL_DAEMON: "1" } }),
    [env[3]]: "browserIdentity",
    [fallback[1]]: { "mcp_servers.cua_repl": { enabled: false } },
    [cleanup[1]]: () => {},
  });
  // Function declarations need a shared lexical scope for the builder call.
  vm.createContext(globals);
  const sharedResume = vm.runInContext(`${deps.buildSource}\n(${resumeSource})`, globals);
  return async (selectionValue, { enabled = true, instructions = true } = {}) => {
    state.cached = { selection: selectionValue, cuaReplEnabled: enabled, confirmationPolicyConfig: "{}" };
    state.instructions = instructions;
    const result = await sharedResume({
      appServerConnection: {
        hostConfig: { kind: "local" },
        getAuthenticatedPrincipal: async () => ({}),
      },
    });
    return result[`mcp_servers.${call[3]}`];
  };
}

// Run the actual shared plugin .mcp.json writer used by plugin synchronization
// and executor plugin copies, capturing the file it writes.
function writerHarness(source, trustedServicesKey) {
  const state = { instructions: true };
  const deps = builderDependencies(source, trustedServicesKey, state);
  const writer = only(source, new RegExp(
    `async function (${IDENT})\\((${IDENT}),${IDENT},${IDENT}=\\2\\)\\{let ${IDENT}=(${IDENT})\\(\\)\\.join\\(\\2,"\\.mcp\\.json"\\),` +
    `${IDENT}=await \\(0,(${IDENT})\\.readFile\\)\\(${IDENT},"utf8"\\),${IDENT}=(${IDENT})\\.parse\\(`, "g"));
  const writerSource = owner(source, writer.index);
  const uuid = oneAlias(writerSource, new RegExp(`\\(0,(${IDENT})\\.randomUUID\\)`, "g"));
  const files = new Map();
  const globals = Object.assign(deps.globals, {
    [writer[3]]: () => path,
    [writer[4]]: {
      readFile: async file => files.get(file),
      writeFile: async (file, text) => files.set(file, text),
      rename: async (from, to) => { files.set(to, files.get(from)); files.delete(from); },
    },
    [writer[5]]: { parse: value => value },
    [uuid]: { randomUUID: () => "uuid" },
  });
  vm.createContext(globals);
  const write = vm.runInContext(`${deps.buildSource}\n(${writerSource})`, globals);
  return async (directory, options, ...root) => {
    const file = path.join(directory, ".mcp.json");
    files.set(file, JSON.stringify({ mcpServers: { cua_repl: { command: "node", args: [], enabled: false } } }));
    await write(directory, {
      ...options, nodeRepl: { command: "/node", args: [], env: { ...deps.nodeReplEnv } },
    }, ...root);
    return JSON.parse(files.get(file)).mcpServers.cua_repl;
  };
}

function patchedSigned(chunks) {
  const owners = chunks.filter(({ source }) => source.includes("cuaReplSurfaces:"));
  assert.equal(owners.length, 1, "Expected one chunk owning unified Computer Use");
  const source = owners[0].source;
  const patched = applyUnifiedComputerUsePatch(source);
  assert.notEqual(patched, source);
  assert.equal(applyUnifiedComputerUsePatch(patched), patched);
  assert.doesNotThrow(() => new vm.Script(patched));
  const builderStart = patched.search(new RegExp(
    `function ${IDENT}\\(\\{browserBackends:${IDENT},deferTools:${IDENT},confirmationPolicyConfig:`,
  ));
  const builderServices = only(owner(patched, builderStart),
    new RegExp(`\\[${IDENT}\\.(${IDENT})\\]:JSON\\.stringify\\(${IDENT}\\)`, "g"));
  const trustedServicesKey = trustedServicesConstant(chunks, builderServices[1]);
  assert.equal(trustedServicesKey, "NODE_REPL_TRUSTED_SERVICES");
  return { patched, trustedServicesKey };
}

function assertNative(cua, root, surfaces) {
  assert.equal(cua.enabled, true);
  assert.equal(cua.env.CUA_REPL_ENABLED_SURFACES, surfaces.join(","));
  assert.equal(cua.env.CODEX_LINUX_CUA_HOST_SOCKET, "/runtime/cua.sock");
  assert.equal(cua.env.NODE_REPL_JS_BANNER,
    `await import("@oai/cua/tinyskyAlt");await(await import("${root}/scripts/native-client.mjs")).installLinuxComputerUse(cua);`);
  assert.equal(JSON.parse(cua.env.NODE_REPL_TRUSTED_SERVICES).sky,
    surfaces.includes("computer") ? `${root}/scripts/native-service.mjs` : undefined);
}

test("official per-thread CUA overrides carry the trusted root when resuming chats", {
  skip: !process.env.CODEX_SIGNED_EXTRACTED_APP,
}, async () => {
  const { patched, trustedServicesKey } = patchedSigned(signedChunks());
  const resume = resumeHarness(patched, trustedServicesKey);
  for (const instructions of [true, false]) {
    for (const surfaces of [["computer"], ["browser"], ["browser", "computer"]]) {
      const cua = await resume({
        browserBackends: ["iab"], desktopFeatureAvailability: { deferCuaTools: false },
        cuaReplSurfaces: surfaces, codexLinuxCuaPluginRoot: "/trusted-plugin",
      }, { instructions });
      assertNative(cua, "/trusted-plugin", surfaces);
      // Both the packaged instructions path and its ENOENT fallback keep the bridge.
      assert.equal(cua.env.NODE_REPL_TOOL_OVERRIDES != null, instructions);
    }
  }
  await assert.rejects(resume({
    browserBackends: ["iab"], desktopFeatureAvailability: { deferCuaTools: false }, cuaReplSurfaces: ["computer"],
  }), /Linux Computer Use trusted plugin root is unavailable/);
});

test("official shared plugin config carries the trusted root for plugin sync and executor copies", {
  skip: !process.env.CODEX_SIGNED_EXTRACTED_APP,
}, async () => {
  const { patched, trustedServicesKey } = patchedSigned(signedChunks());
  const write = writerHarness(patched, trustedServicesKey);
  const writerName = only(patched, new RegExp(`async function (${IDENT})\\((${IDENT}),${IDENT},${IDENT}=\\2\\)`, "g"))[1];
  // Plugin synchronization publishes the verified installed root on the
  // cached selection and writes the installed plugin's own config.
  only(patched, new RegExp(
    `return ${IDENT}\\.codexLinuxCuaPluginRoot=(${IDENT}),await ${escapeRegExp(writerName)}\\(\\1,${IDENT}\\),`, "g"));
  // Executor copies are written in staging and run from the renamed directory.
  only(patched, new RegExp(
    `await ${escapeRegExp(writerName)}\\((${IDENT}),${IDENT},(${IDENT})\\);try\\{await \\(0,${IDENT}\\.rename\\)\\(\\1,\\2\\)`, "g"));
  const options = {
    browserBackends: ["iab"], deferTools: false, confirmationPolicyConfig: "{}",
    omitCuaConfirmationPolicyBySku: [], surfaces: ["browser", "computer"],
  };
  const synced = await write("/installed-plugin", options);
  assertNative(synced, "/installed-plugin", options.surfaces);
  assert.ok(synced.args.includes("--require-browser-access"));
  const executor = await write("/executor/.staging-1", options, "/executor/hash");
  assertNative(executor, "/executor/hash", options.surfaces);
  await assert.rejects(write("/installed-plugin", options, ""), /Linux Computer Use trusted plugin root is unavailable/);
});
