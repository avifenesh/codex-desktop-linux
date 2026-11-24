"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");
const path = require("node:path");
const test = require("node:test");
const descriptors = require("./patch.js");

// The current rspack shape: the surface selector (unified prerequisites,
// platform, feature flag, Windows/macOS service availability, then independent
// browser selection), the shared plugin .mcp.json writer used by plugin
// synchronization and executor plugin copies, the config builder that mirrors
// the packaged cua-repl instructions path (it rebuilds the environment while
// keeping caller-provided services and banner), and per-thread configuration.
const selector = [
  'function select(f,l,t,u){let p=f&&t.computerUse&&u.enabled&&("win32"===l.platform||"darwin"===l.platform&&null!=u.paths.serviceAppPath),m=t.computerUse&&(!t.browserUseTinysky||"darwin"!==l.platform||u.enabled),h=[];return f&&t.browser&&h.push("browser"),p&&h.push("computer"),{computerUse:m,cuaReplSurfaces:h}}',
  'async function write(e,t){let r=ei().join(e,".mcp.json"),n=await fsp.readFile(r),i=JSON.parse(n);Object.assign(i.mcpServers.cua_repl,build({...t,sharedPlugin:!0}));return sink(e,i)}',
  'function build({browserBackends:b,deferTools:d,confirmationPolicyConfig:c="{}",omitCuaConfirmationPolicyBySku:o,surfaces:s,nodeRepl:n,sharedPlugin:a=!1}){let l={};s.includes("browser")&&(l.browser="@oai/browser-desktop/service"),s.includes("computer")&&(l.sky="@oai/sky/service");let x={...n?.env,CUA_REPL_CONFIRMATION_POLICY_CONFIG:c,CUA_REPL_ENABLED_SURFACES:s.join(","),...n?.env.SKY_ENABLE_AUDIO==="1"?{SKY_ENABLE_AUDIO:s.includes("computer")?"1":"0",NODE_REPL_ENABLE_AUDIO:"0"}:{},[constants.Il]:JSON.stringify(l)};return{args:a?["--require-browser-access"]:[],env:function({env:e}){let t={};return t.sky="@oai/sky/service",{...e,NODE_REPL_TRUSTED_SERVICES:e.NODE_REPL_TRUSTED_SERVICES??JSON.stringify(t),NODE_REPL_JS_BANNER:e.NODE_REPL_JS_BANNER??"await import(\\"@oai/cua/tinyskyAlt\\");"}}({env:x})}}',
  'async function initialize(e){let selection=await resolveSelection({...e}),policy="{}",enabled=!1,launch=null,t={browserBackends:selection.browserBackends,deferTools:selection.desktopFeatureAvailability.deferCuaTools,confirmationPolicyConfig:policy,omitCuaConfirmationPolicyBySku:!1,surfaces:selection.cuaReplSurfaces,nodeRepl:selection.nodeRepl};launch=(enabled=await async function(e){let t=lookup({marketplaceName:e.marketplaceName,marketplaces:e.marketplaces,pluginName:constants.Pn});if(!t?.plugin.installed)return!1;let r=(0,constants.Kt)({codexHome:e.codexHome,localVersion:t.plugin.localVersion,marketplaceName:t.marketplace.name,pluginName:t.plugin.name});return await write(r,e),null!=e.nodeRepl&&e.surfaces.length>0}({...t,codexHome:selection.codexHome,marketplaceName:selection.marketplaceName,marketplaces:e.marketplaces}))?structuredClone(t):null;return{selection:selection,cuaReplEnabled:enabled,executorLaunch:launch,confirmationPolicyConfig:policy}}',
  'async function stageExecutor(e,n){let s=e.dir,a="hash",o=ei().join(s,a),l=ei().join(s,".staging-1");try{await (0,fsp.cp)(e.path,l,{recursive:!0}),await write(l,n);try{await (0,fsp.rename)(l,o)}catch(e){}return o}finally{}}',
  'async function threadConfig(e){let connection=e.connection,local=null!=connection,cached=e.cached,features=e.features,posture=features.browserUseTinysky?cached:null,principal=local?await connection.getAuthenticatedPrincipal().catch(()=>null):null,selection=posture?.selection??await selectForThread(e);selection={...selection,browserServicePluginVersion:null};let node=e.nodeRepl??selection.nodeRepl;return posture?.cuaReplEnabled&&node?build({browserBackends:selection.browserBackends,deferTools:selection.desktopFeatureAvailability.deferCuaTools,confirmationPolicyConfig:posture.confirmationPolicyConfig,omitCuaConfirmationPolicyBySku:selection.desktopFeatureAvailability.omitCuaConfirmationPolicyBySku,surfaces:selection.cuaReplSurfaces,nodeRepl:node}):{enabled:!1}}',
].join("");
const SERVICES = "NODE_REPL_TRUSTED_SERVICES";
const BANNER = root =>
  `await import("@oai/cua/tinyskyAlt");await(await import("${root}/scripts/native-client.mjs")).installLinuxComputerUse(cua);`;
const unified = descriptors.find(d => d.id === "unified-runtime").apply;
function patch(source) {
  return descriptors.filter(d => ["ui-feature", "unified-runtime"].includes(d.id))
    .reduce((s, d) => d.apply(s), source);
}
function context(extra = {}) {
  const written = {};
  return {
    written,
    lookup: () => ({ plugin: { installed: true, localVersion: "verified-version", name: "cua" }, marketplace: { name: "bundled" } }),
    resolveSelection: async ({ selection }) => selection,
    sink: (root, config) => { written[root] = config.mcpServers.cua_repl; return config; },
    fsp: {
      readFile: async () => JSON.stringify({ mcpServers: { cua_repl: { command: "node", args: [] } } }),
      cp: async () => {},
      rename: async () => {},
    },
    structuredClone,
    ei: () => path,
    require: name => {
      assert.equal(name, "node:path");
      return path;
    },
    constants: { Il: SERVICES, Kt: () => "/trusted-plugin", Pn: "unified-computer-use" },
    process: { env: { CODEX_LINUX_CUA_HOST_SOCKET: "/runtime/cua.sock" } },
    ...extra,
  };
}
function load(source, extra) {
  const globals = context(extra);
  const fns = vm.runInNewContext(`${source};({initialize,stageExecutor,threadConfig})`, globals);
  return { ...fns, written: globals.written };
}
function selectionFor(surfaces, extra = {}) {
  return {
    browserBackends: ["native"], cuaReplSurfaces: surfaces, nodeRepl: { env: {} },
    desktopFeatureAvailability: { deferCuaTools: true, omitCuaConfirmationPolicyBySku: false }, ...extra,
  };
}
function surfaces(source, platform, { ready = true, enabled = true, legacy = false, nativeEnabled = true } = {}) {
  const select = vm.runInNewContext(`(${source.slice(0, source.indexOf("async function write"))})`);
  return Array.from(select(ready, { platform }, { computerUse: enabled, browser: true },
    { enabled: platform === "linux" ? nativeEnabled : legacy, paths: { serviceAppPath: legacy ? "/service" : null } }).cuaReplSurfaces);
}
function assertNative(config, root, { computer = true } = {}) {
  assert.equal(JSON.parse(config.env[SERVICES]).sky,
    computer ? path.join(root, "scripts/native-service.mjs") : undefined);
  assert.equal(config.env.CODEX_LINUX_CUA_HOST_SOCKET, "/runtime/cua.sock");
  assert.equal(config.env.NODE_REPL_JS_BANNER, BANNER(root));
}

test("unified Linux native selection uses the native setting and retains browser control", () => {
  assert.deepEqual(surfaces(selector, "linux"), ["browser"]);
  const patched = patch(selector);
  assert.deepEqual(surfaces(patched, "linux"), ["browser", "computer"]);
  assert.match(patched, /async function write\(e,t,codexLinuxCuaPluginRoot=e\)/);
  assert.match(patched, /build\(\{\.\.\.t,sharedPlugin:!0\},codexLinuxCuaPluginRoot\)/);
  assert.match(patched, /sharedPlugin:a=!1\},codexLinuxCuaPluginRoot\)\{/);
  assert.match(patched, /return selection\.codexLinuxCuaPluginRoot=r,await write\(r,e\)/);
  assert.match(patched, /await write\(l,n,o\);try\{await \(0,fsp\.rename\)\(l,o\)/);
  assert.match(patched, /nodeRepl:node\},selection\.codexLinuxCuaPluginRoot\)/);
  assert.match(patched, /\.sky=require\("node:path"\)\.join\(codexLinuxCuaPluginRoot,"scripts","native-service\.mjs"\)/);
  assert.match(patched, /NODE_REPL_JS_BANNER:.*native-client\.mjs/);
  assert.match(patched, /CODEX_LINUX_CUA_HOST_SOCKET:process\.env\.CODEX_LINUX_CUA_HOST_SOCKET/);
});

test("unified prerequisites, native feature flag, and other platforms retain their gates", () => {
  const result = patch(selector);
  assert.deepEqual(surfaces(result, "linux", { ready: false }), []);
  assert.deepEqual(surfaces(result, "linux", { enabled: false }), ["browser"]);
  assert.deepEqual(surfaces(result, "linux", { nativeEnabled: false }), ["browser"]);
  assert.deepEqual(surfaces(result, "darwin"), ["browser"]);
  assert.deepEqual(surfaces(result, "darwin", { legacy: true }), ["browser", "computer"]);
  assert.deepEqual(surfaces(result, "win32", { legacy: true }), ["browser", "computer"]);
  assert.equal(patch(result), result);
});

test("unified selector drift and ambiguous owners fail the build", () => {
  for (const changed of [
    selector.replace("null!=u.paths.serviceAppPath", "u.paths.serviceAppPath"),
    selector + selector,
    selector.replace('(l.sky="@oai/sky/service")', '(l.sky="@oai/sky/changed")'),
    selector.replace("CUA_REPL_ENABLED_SURFACES:s", "CUA_REPL_ENABLED_SURFACES:other"),
    // The retired builder that took a browser-access bootstrap path.
    selector.replace("sharedPlugin:a=!1}", "accessBootstrapPath:a}"),
  ]) {
    assert.notEqual(changed, selector);
    assert.throws(() => patch(changed), /unified.*contract/i);
  }
});

test("unified patch rejects a packaged environment that would drop the native bridge", () => {
  for (const changed of [
    selector.replace("NODE_REPL_JS_BANNER:e.NODE_REPL_JS_BANNER??", "NODE_REPL_JS_BANNER:"),
    selector.replace("NODE_REPL_TRUSTED_SERVICES:e.NODE_REPL_TRUSTED_SERVICES??", "NODE_REPL_TRUSTED_SERVICES:"),
    selector.replace("NODE_REPL_JS_BANNER:e.", "NODE_REPL_JS_BANNER:`x`,NODE_REPL_JS_BANNER:e."),
  ]) {
    assert.notEqual(changed, selector);
    assert.throws(() => patch(changed), /unified.*contract/i);
  }
});

test("chunks without the CUA selector are left unchanged with a diagnostic", (t) => {
  const warnings = [];
  t.mock.method(console, "warn", message => warnings.push(message));
  const chunk = 'exports.ids=[87],exports.modules={1(e,t,r){"use strict";e.exports=1}};';
  assert.equal(unified(chunk), chunk);
  assert.match(warnings.join("\n"), /unified Computer Use surface selector/);
});

test("unified relationships are scoped to the rspack module owning the selector", () => {
  // Another module may reuse the same minified names, including private members.
  const other = 'let build=Symbol("jobs"),write=Symbol("done");class Q{#build;[write](){this[build]+=1,this.#build=write}}';
  const chunk = `exports.ids=[916],exports.modules={61071(e,t,r){"use strict";${selector}},82751(e,t,r){"use strict";${other}}};`;
  const patched = unified(chunk);
  assert.notEqual(patched, chunk);
  assert.ok(patched.endsWith(`},82751(e,t,r){"use strict";${other}}};`));
  assert.doesNotThrow(() => new vm.Script(patched));
  assert.equal(unified(patched), patched);
  assert.throws(() => unified(chunk.replace(`"use strict";${selector}`, `"use strict";${selector}build(extra);`)),
    /unified.*contract/i);
});

test("disabled native access does not leave a second native Node REPL service enabled", () => {
  const patched = patch(selector);
  const select = vm.runInNewContext(`(${patched.slice(0, patched.indexOf("async function write"))})`);
  assert.equal(select(true, { platform: "linux" }, { computerUse: true },
    { enabled: false, paths: {} }).computerUse, false);
});

test("unified mode rejects appended gates and changed companion selectors", () => {
  for (const source of [selector, patch(selector)]) {
    const changed = source.replace(",h=[]", "&&t.newRequiredGate,h=[]");
    assert.throws(() => patch(changed), /unified.*contract/i);
    assert.throws(() => patch(selector + changed), /unified.*contract/i);
  }
});

test("unified service patch scopes the plugin root and current env-key alias to its owner", () => {
  const current =
    'function unrelated(){let other=ei().join(otherRoot,".mcp.json");return other}' +
    selector.replace("[constants.Il]", "[constants.Gl]");
  const patched = patch(current);

  assert.match(patched, /require\("node:path"\)\.join\(codexLinuxCuaPluginRoot,"scripts","native-service\.mjs"\)/u);
  assert.match(patched, /\[constants\.Gl\]:JSON\.stringify\(l\)/u);
  assert.doesNotMatch(patched, /join\(otherRoot,"scripts","native-service\.mjs"\)/u);
  assert.equal(patch(patched), patched);
});

test("unified banner patch edits only the validated service owner", () => {
  const unrelatedBanner =
    'function unrelated(e){let constants={},l={};return{env:{...e?.env,CUA_REPL_ENABLED_SURFACES:e.surfaces.join(","),[constants.Il]:JSON.stringify(l)}}}';
  const current = unrelatedBanner + selector;
  const patched = patch(current);

  assert.equal(patched.slice(0, unrelatedBanner.length), unrelatedBanner);
  assert.equal((patched.match(/NODE_REPL_JS_BANNER:'/gu) ?? []).length, 1);
});

test("unified banner patch rejects duplicate banners inside the service owner", () => {
  const environment = '{...n?.env,CUA_REPL_CONFIRMATION_POLICY_CONFIG:c,CUA_REPL_ENABLED_SURFACES:s.join(","),...n?.env.SKY_ENABLE_AUDIO==="1"?{SKY_ENABLE_AUDIO:s.includes("computer")?"1":"0",NODE_REPL_ENABLE_AUDIO:"0"}:{},[constants.Il]:JSON.stringify(l)}';
  const duplicate = selector.replace(`x=${environment}`, `x=${environment},duplicate=${environment}`);
  assert.notEqual(duplicate, selector);
  assert.throws(() => patch(duplicate), /unified.*contract/i);
});

test("plugin sync, executor copies, and resumed threads each carry their trusted root", async () => {
  const patched = patch(selector);
  const { initialize, stageExecutor, threadConfig, written } = load(patched);
  const cached = await initialize({ selection: selectionFor(["browser", "computer"]), marketplaces: [] });
  assert.equal(cached.cuaReplEnabled, true);
  assert.equal(cached.selection.codexLinuxCuaPluginRoot, "/trusted-plugin");
  // Plugin synchronization writes the installed plugin's own root.
  assertNative(written["/trusted-plugin"], "/trusted-plugin");
  assert.deepEqual(Array.from(written["/trusted-plugin"].args), ["--require-browser-access"]);
  // An executor copy is written in staging but runs from its final directory.
  const final = await stageExecutor({ dir: "/executor", path: "/bundled" }, cached.executorLaunch);
  assert.equal(final, "/executor/hash");
  assertNative(written["/executor/.staging-1"], "/executor/hash");
  // A resumed thread reuses the cached root.
  assertNative(await threadConfig({ cached, features: { browserUseTinysky: true } }), "/trusted-plugin");
});

test("unified helper uses a fresh binding across minified parameter and local collisions", async () => {
  // The helpers destructure parameters in separate minified scopes. Copying
  // the caller's root alias into their formal lists can duplicate a binding,
  // while a local collision can shadow or redeclare the injected root.
  for (const root of ["b", "d", "s", "n", "l", "o"]) {
    const current = selector.replace("let r=(0,constants.Kt)", `let ${root}=(0,constants.Kt)`)
      .replace("return await write(r,e)", `return await write(${root},e)`);
    assert.notEqual(current, selector);
    assert.doesNotThrow(() => new vm.Script(current));
    const patched = patch(current);
    assert.doesNotThrow(() => new vm.Script(patched));
    assert.equal(patch(patched), patched);
    const { initialize, threadConfig, written } = load(patched);
    const selection = selectionFor(["computer"]);
    const cached = await initialize({ selection, marketplaces: [] });
    assert.equal(cached.cuaReplEnabled, true);
    assert.equal(cached.selection, selection);
    assert.equal(selection.codexLinuxCuaPluginRoot, "/trusted-plugin");
    assertNative(written["/trusted-plugin"], "/trusted-plugin");
    const result = await threadConfig({ cached, features: { browserUseTinysky: true } });
    assert.equal(result.env.CUA_REPL_ENABLED_SURFACES, "computer");
    assertNative(result, "/trusted-plugin");
  }
});

test("unified helper avoids existing generated names in locals and nested scopes", () => {
  const current = selector.replace("let l={};s.includes",
    "let codexLinuxCuaPluginRoot=1;function nested(codexLinuxCuaPluginRoot1){return codexLinuxCuaPluginRoot1}let l={};s.includes");
  assert.notEqual(current, selector);
  const patched = patch(current);
  assert.match(patched, /sharedPlugin:a=!1\},codexLinuxCuaPluginRoot2\)/);
  assert.doesNotThrow(() => new vm.Script(patched));
  assert.equal(patch(patched), patched);
});

test("unified helper validates caller and helper root relationships separately", () => {
  const patched = patch(selector);
  for (const [from, to] of [
    ["sharedPlugin:!0},codexLinuxCuaPluginRoot)", "sharedPlugin:!0},other)"],
    ['join(codexLinuxCuaPluginRoot,"scripts","native-service.mjs")', 'join(other,"scripts","native-service.mjs")'],
    ['join(codexLinuxCuaPluginRoot,"scripts","native-client.mjs")', 'join(other,"scripts","native-client.mjs")'],
    ["await write(l,n,o)", "await write(l,n,l)"],
    ["return selection.codexLinuxCuaPluginRoot=r,", "return other.codexLinuxCuaPluginRoot=r,"],
  ]) {
    assert.ok(patched.includes(from));
    assert.throws(() => patch(patched.replace(from, to)), /unified.*contract/i);
  }
});

test("unified thread configuration retains the trusted root per cached connection", async () => {
  const resolutions = [];
  const { initialize, threadConfig } = load(patch(selector), {
    constants: { Il: SERVICES, Pn: "unified-computer-use", Kt: metadata => {
      resolutions.push(metadata);
      return path.join(metadata.codexHome, "trusted-plugin");
    } },
  });
  const cache = [];
  for (const home of ["/first", "/second"]) {
    const selection = selectionFor(["browser", "computer"], {
      codexHome: home, marketplaceName: "bundled", nodeRepl: { env: { existing: "kept" } },
    });
    cache.push(await initialize({ selection, marketplaces: [] }));
  }
  assert.equal(resolutions.length, 2);
  assert.equal(resolutions[0].localVersion, "verified-version");
  for (const cached of cache.reverse()) {
    const config = await threadConfig({ cached, features: { browserUseTinysky: true }, nodeRepl: { env: { perThread: "private-env" } } });
    const expectedRoot = path.join(cached.selection.codexHome, "trusted-plugin");
    assertNative(config, expectedRoot);
    assert.equal(JSON.parse(config.env[SERVICES]).browser, "@oai/browser-desktop/service");
    assert.equal(config.env.perThread, "private-env");
  }
  assert.equal(resolutions.length, 2, "thread resumes reuse verified metadata without another lookup");
  delete cache[0].selection.codexLinuxCuaPluginRoot;
  await assert.rejects(threadConfig({ cached: cache[0], features: { browserUseTinysky: true } }),
    /Linux Computer Use trusted plugin root is unavailable/);
});

test("unified browser-only thread configuration receives its banner root", async () => {
  const { initialize, threadConfig } = load(patch(selector));
  const selection = selectionFor(["browser"]);
  const cached = await initialize({ selection, marketplaces: [] });
  assertNative(await threadConfig({ cached, features: { browserUseTinysky: true } }), "/trusted-plugin", { computer: false });
  cached.cuaReplEnabled = false;
  delete selection.codexLinuxCuaPluginRoot;
  assert.equal((await threadConfig({ cached, features: { browserUseTinysky: true } })).enabled, false);
});

test("unified propagation rejects missing, ambiguous, or changed builder consumers", () => {
  for (const changed of [
    selector + "build(extra)",
    selector + "const alias=build;",
    selector + "write(extra)",
    selector.replace("return{selection:selection", "return{selection:other"),
    selector.replace("selection=posture?.selection", "selection=other?.selection"),
    // A thread configuration that replaces the cached selection loses its root.
    selector.replace("selection={...selection,", "selection={"),
    // A thread configuration that is not gated by the cached CUA state.
    selector.replace("posture?.cuaReplEnabled&&", "!0&&"),
    selector.replace("principal=local?await connection.getAuthenticatedPrincipal().catch(()=>null):null,", ""),
    // An executor copy that no longer renames its staging directory.
    selector.replace("await (0,fsp.rename)(l,o)", "await (0,fsp.symlink)(l,o)"),
    // A synchronization root that no longer comes from installed plugin metadata.
    selector.replace("localVersion:t.plugin.localVersion,", ""),
    // A synchronization binding that would shadow the cached selection.
    selector.replace("let r=(0,constants.Kt)", "let selection,r=(0,constants.Kt)"),
  ]) {
    assert.notEqual(changed, selector);
    assert.throws(() => patch(changed), /unified.*contract/i);
  }
  assert.doesNotThrow(() => patch(selector + "function unrelated(){return constants.build(extra)}"));
  assert.doesNotThrow(() => patch(selector +
    'const serialized="build ap";const entities={ap:"approximately"};'));
  const patched = patch(selector);
  for (const changed of [
    patched.replace("selection.codexLinuxCuaPluginRoot=r,", ""),
    patched.replace(",selection.codexLinuxCuaPluginRoot)", ")"),
    patched.replace("await write(l,n,o)", "await write(l,n)"),
    patched.replace("(e,t,codexLinuxCuaPluginRoot=e)", "(e,t)"),
  ]) {
    assert.notEqual(changed, patched);
    assert.throws(() => patch(changed), /unified.*contract/i);
  }
});

test("unified builder patch fails closed when its bindings shadow require", () => {
  for (const binding of ["b", "d", "s", "n", "a"]) {
    const start = selector.indexOf("function build(");
    const end = selector.indexOf("async function initialize(");
    const builder = selector.slice(start, end).replace(new RegExp(`\\b${binding}\\b`, "g"), "require");
    const shadowed = selector.slice(0, start) + builder + selector.slice(end);
    assert.throws(() => patch(shadowed), /native config builder shadows require/);
  }
});
