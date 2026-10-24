"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const descriptors = require("./patch.js");
const { applyUnifiedComputerUsePatch } = require("./unified.js");
const { findMainBundle } = require("../../scripts/patches/lib/assets.js");

const current = fs.readFileSync(path.join(__dirname, "fixtures/current-unified-runtime.js"), "utf8");

test("current signed Windows-aware unified contract patches and revalidates", () => {
  const sources = [current];
  if (process.env.CODEX_SIGNED_EXTRACTED_APP) {
    const main = findMainBundle(process.env.CODEX_SIGNED_EXTRACTED_APP);
    assert(main, "Expected the verified main-process bundle");
    const actual = fs.readFileSync(path.join(main.buildDir, main.mainBundle), "utf8");
    sources.push(actual);
    const native = descriptors.find(({ id }) => id === "native-applications");
    const patchedNative = native.apply(actual);
    assert.notEqual(patchedNative, actual);
    assert.equal(native.apply(patchedNative), patchedNative);
    assert.doesNotThrow(() => new vm.Script(patchedNative));
  }
  for (const source of sources) {
    const patched = applyUnifiedComputerUsePatch(source);
    assert.notEqual(patched, source);
    assert.doesNotThrow(() => new vm.Script(patched));
    assert.equal(applyUnifiedComputerUsePatch(patched), patched);
  }
});

test("native Settings presentation owner can live in the primary app bundle", () => {
  const descriptor = descriptors.find(({ id }) => id === "native-settings-visibility");
  const currentFilter = "function TAn(e,t,n){if(t.length===0&&!n)return e;let r=new Set(t);return e.filter(e=>(!n||!OFe(e.plugin.id))&&!r.has(e.plugin.id))}";
  assert.equal(descriptor.pattern.test("app-primary-f72ae5046334.js"), true);
  assert.equal(descriptor.assetMatch(currentFilter), true);
  assert.notEqual(descriptor.apply(currentFilter), currentFilter);
});

function runtime(platform, { principal = { id: "verified-principal" } } = {}) {
  const selection = {
    browserBackends: ["iab"], cuaReplSurfaces: ["browser", "computer"],
    desktopFeatureAvailability: { deferCuaTools: false },
  };
  const node = { command: "/node", env: { node: "/node", package: "/bundled", SKY_AUDIO_ATTACHMENTS: "1", NODE_REPL_JS_BANNER: "official-banner" } };
  const globals = {
    path: { default: path }, constants: {
      services: "services",
      pluginRoot: metadata => {
        assert.equal(metadata.pluginName, "unified-computer-use");
        assert.equal(metadata.localVersion, "verified-version");
        return "/trusted-plugin";
      },
    },
    process: { platform, env: { CODEX_LINUX_CUA_HOST_SOCKET: "/runtime/cua.sock" } },
    lookup: () => ({ plugin: { installed: true, localVersion: "verified-version", name: "unified-computer-use" }, marketplace: { name: "bundled" } }),
    cachedSelection: async () => ({ selection, cuaReplEnabled: true }),
    features: () => ({ browserUseTinysky: true }),
    nodeConfiguration: async () => ({ "mcp_servers.node_repl": structuredClone(node) }),
    normalizePrincipal: value => value?.id ?? null,
    selectForThread: () => { throw Error("Unexpected fallback instead of cached selection"); },
    disabledConfig: { "mcp_servers.cua_repl": { enabled: false } },
  };
  const functions = vm.runInNewContext(`${applyUnifiedComputerUsePatch(current)};({build:buildServices,resume:resumeSelection,sync:synchronizePlugin})`, globals);
  return { ...functions, selection, node, connection: { hostConfig: { kind: "local" }, getAuthenticatedPrincipal: async () => principal } };
}

test("current signed service builder retains Windows/macOS and audio configuration", () => {
  for (const platform of ["linux", "win32", "darwin"]) {
    const { build, selection, node } = runtime(platform);
    const config = build({ ...selection, surfaces: selection.cuaReplSurfaces, nodeRepl: node }, "/trusted-plugin");
    assert.equal(JSON.parse(config.env.services).sky, platform === "linux" ? "/trusted-plugin/scripts/native-service.mjs" : "@oai/sky/service");
    assert.equal(JSON.parse(config.env.services).browser, "@oai/browser-desktop/service");
    assert.equal(config.env.SKY_ENABLE_AUDIO, "1");
    assert.equal(config.env.SKY_AUDIO_ATTACHMENTS, "1");
    assert.equal(config.env.NODE_REPL_ENABLE_AUDIO, "0");
    assert.equal(config.env.NODE_REPL_JS_BANNER === "official-banner", platform !== "linux");
    assert.equal(Object.hasOwn(config.env, "CODEX_LINUX_CUA_HOST_SOCKET"), platform === "linux");
    if (platform !== "linux") assert.doesNotThrow(() => build({ ...selection, surfaces: selection.cuaReplSurfaces, nodeRepl: node }));
  }
});

test("current signed synchronization and authenticated resume carry verified plugin ownership", async () => {
  const state = runtime("linux");
  await state.sync({ ...state.selection, surfaces: state.selection.cuaReplSurfaces, codexHome: "/home/test", nodeRepl: state.node, codexLinuxCuaContext: state.selection });
  assert.equal(state.selection.codexLinuxCuaPluginRoot, "/trusted-plugin");
  const config = await state.resume({ appServerConnection: state.connection });
  assert.equal(JSON.parse(config["mcp_servers.cua_repl"].env.services).sky, "/trusted-plugin/scripts/native-service.mjs");
  assert.equal(config["mcp_servers.node_repl"].env.identity, "verified-principal");
  delete state.selection.codexLinuxCuaPluginRoot;
  await assert.rejects(state.resume({ appServerConnection: state.connection }), /trusted plugin root/);
});

test("current signed unauthenticated resume retains the official native-service guard", async () => {
  const state = runtime("linux", { principal: null });
  state.selection.codexLinuxCuaPluginRoot = "/trusted-plugin";
  state.node.env.SKY_AUDIO_ATTACHMENTS = "0";
  const config = await state.resume({ appServerConnection: state.connection });
  assert.equal(config["mcp_servers.cua_repl"], undefined);
});
