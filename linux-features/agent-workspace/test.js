#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {
  enabledLinuxFeatureIds,
  loadLinuxFeaturePatchDescriptors,
} = require("../../scripts/lib/linux-features.js");
const {
  createPatchReport,
  patchExtractedApp,
} = require("../../scripts/patch-linux-window-ui.js");
const {
  SETTINGS_ASSET,
  SETTINGS_COMMAND_KEY,
  SETTINGS_SLUG,
  applyAgentWorkspaceMainBridgePatch,
  applyAgentWorkspaceSettingsIndexPatch,
  applyAgentWorkspaceSettingsPagePatch,
  applyAgentWorkspaceSettingsSectionsPatch,
  applyAgentWorkspaceSettingsSharedPatch,
  buildAgentWorkspaceSettingsSource,
  patchAgentWorkspaceSettingsAssets,
  patches: featurePatches,
} = require("./patch.js");

function withTempFeatureConfig(enabled, fn) {
  const originalConfig = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const root = path.resolve(__dirname, "..");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-feature-"));
  process.env.CODEX_LINUX_FEATURES_CONFIG = path.join(tempDir, "features.json");
  try {
    fs.writeFileSync(process.env.CODEX_LINUX_FEATURES_CONFIG, JSON.stringify({ enabled }, null, 2));
    return fn(root);
  } finally {
    if (originalConfig == null) {
      delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    } else {
      process.env.CODEX_LINUX_FEATURES_CONFIG = originalConfig;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function withLinuxFeatureRootEnv(root, fn) {
  const originalRoot = process.env.CODEX_LINUX_FEATURES_ROOT;
  process.env.CODEX_LINUX_FEATURES_ROOT = root;
  try {
    return fn();
  } finally {
    if (originalRoot == null) {
      delete process.env.CODEX_LINUX_FEATURES_ROOT;
    } else {
      process.env.CODEX_LINUX_FEATURES_ROOT = originalRoot;
    }
  }
}

function captureWarns(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    return { value: fn(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function syntheticMainBundle() {
  return [
    "let c=require(`node:child_process`),o=require(`node:fs`),i=require(`node:path`);",
    "class Host{handlers(){return {",
    '"get-global-state":async({key:t})=>({value:this.globalState.get(t)}),',
    '"set-global-state":async({key:t,value:n})=>(this.globalState.set(t,n),{success:!0})',
    "}}}",
  ].join("");
}

function buildBridgeHarness({ env = {}, globalState = new Map(), execFile, spawn, electron = null } = {}) {
  const patched = applyAgentWorkspaceMainBridgePatch(syntheticMainBundle());
  const execCalls = [];
  const spawnCalls = [];
  const childProcess = {
    execFile:
      execFile ||
      ((command, args, options, callback) => {
        execCalls.push({ command, args, options });
        callback(null, '{"profiles":[]}\n', "");
      }),
    spawn:
      spawn ||
      ((command, args, options) => {
        const call = { command, args, options, unref: false };
        spawnCalls.push(call);
        return {
          pid: 4242,
          unref() {
            call.unref = true;
          },
        };
      }),
  };
  const sandbox = {
    require(name) {
      if (name === "node:child_process") return childProcess;
      if (name === "node:fs") return fs;
      if (name === "node:path") return path;
      if (name === "electron" && electron) return electron;
      throw new Error(`unexpected require ${name}`);
    },
    process: { env: { ...process.env, ...env } },
    Buffer,
    clearTimeout,
    setTimeout,
  };
  vm.runInNewContext(`${patched};this.Host=Host;`, sandbox);
  const host = new sandbox.Host();
  host.globalState = {
    get(key) {
      return globalState.get(key);
    },
    set(key, value) {
      globalState.set(key, value);
    },
  };
  return { handlers: host.handlers(), execCalls, spawnCalls };
}

function syntheticSettingsSections() {
  return "var e=`general-settings`,t={},n=[{slug:`general-settings`},{slug:`appearance`},{slug:`local-environments`},{slug:`worktrees`}];export{n,t as r,e as t};";
}

function syntheticSettingsShared() {
  return [
    "var c=r({",
    '"general-settings":{id:`settings.nav.general-settings`,defaultMessage:`General`,description:`Title for general settings section`},',
    '"local-environments":{id:`settings.nav.local-environments`,defaultMessage:`Environments`,description:`Title for environments settings section`},',
    "worktrees:{id:`settings.nav.worktrees`,defaultMessage:`Worktrees`,description:`Title for worktrees settings section`}",
    "});",
    "function m(e){let t=(0,u.c)(3),{slug:r}=e;switch(r){",
    "case`general-settings`:{return (0,d.jsx)(n,{id:`settings.section.general-settings`,defaultMessage:`General`})}",
    "case`local-environments`:{return (0,d.jsx)(n,{id:`settings.section.local-environments`,defaultMessage:`Environments`})}",
    "case`worktrees`:{return (0,d.jsx)(n,{id:`settings.section.worktrees`,defaultMessage:`Worktrees`})}",
    "}}",
  ].join("");
}

function syntheticSettingsSharedWithSlugAliasCollision() {
  return [
    "var c=r({",
    '"local-environments":{id:`settings.nav.local-environments`,defaultMessage:`Environments`,description:`Title for environments settings section`},',
    "worktrees:{id:`settings.nav.worktrees`,defaultMessage:`Worktrees`,description:`Title for worktrees settings section`}",
    "});",
    "function m(e){let t=(0,u.c)(3),{slug:n}=e;switch(n){",
    "case`local-environments`:{return (0,d.jsx)(r,{id:`settings.section.local-environments`,defaultMessage:`Environments`})}",
    "case`worktrees`:{return (0,d.jsx)(r,{id:`settings.section.worktrees`,defaultMessage:`Worktrees`})}",
    "}}",
  ].join("");
}

function syntheticIndex() {
  return [
    "var i_e={\"general-settings\":(0,Z.lazy)(()=>s(()=>import(`./general-settings.js`),[],import.meta.url)),appearance:(0,Z.lazy)(()=>s(()=>import(`./appearance.js`),[],import.meta.url))};",
    "let Kge={\"general-settings\":Icon,appearance:Icon};",
    "let qge=[`general-settings`,`appearance`,`local-environments`,`worktrees`],Jge=[{key:`connection`,heading:null,slugs:[`agent`,`local-environments`,`worktrees`]}];",
    "function Qge(){let l=`electron`,e=e=>{switch(e.slug){case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:case`data-controls`:case`environments`:return l===`electron`;case`account`:case`general-settings`:case`agent`:case`personalization`:case`mcp-settings`:return!0}};if(O)bb0:switch(D.slug){case`appearance`:case`general-settings`:case`agent`:case`git-settings`:case`account`:case`data-controls`:case`personalization`:k=!1;break bb0;case`local-environments`:case`worktrees`:case`environments`:case`mcp-settings`:case`connections`:case`plugins-settings`:case`skills-settings`:k=!1}}",
  ].join("");
}

function syntheticSettingsPage() {
  return [
    'var pe={"general-settings":G,"browser-use":de,"computer-use":oe,"read-aloud-settings":codexLinuxReadAloudSettingsIcon,"local-environments":q,worktrees:W,"data-controls":U};',
    "var me=[`general-settings`,`appearance`,`agent`,`personalization`,`mcp-settings`,`hooks-settings`,`connections`,`git-settings`,`local-environments`,`worktrees`,`browser-use`,`computer-use`,`read-aloud-settings`,`data-controls`];",
    "var he=[{key:`app`,heading:Q.appHeading,slugs:[`general-settings`,`appearance`,`connections`,`git-settings`,`usage`]},{key:`connection`,heading:Q.hostHeading,slugs:[`agent`,`personalization`,`mcp-settings`,`hooks-settings`,`browser-use`,`computer-use`,`read-aloud-settings`,`local-environments`,`worktrees`,`data-controls`]}];",
    "function visible(e){switch(e.slug){case`read-aloud-settings`:return a;case`computer-use`:return A;case`browser-use`:return j;case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:case`environments`:return!0;case`data-controls`:return!0;}}",
    "if(R)bb0:switch(L.slug){case`computer-use`:z=k.isLoading||m.isLoading;break bb0;case`browser-use`:z=f.isLoading||m.isLoading||_;break bb0;case`local-environments`:case`worktrees`:case`environments`:case`mcp-settings`:case`connections`:z=!1}",
  ].join("");
}

function syntheticAppMainRouteRegistry() {
  return [
    "function render(e){return routeMap[e.slug]}",
    "var routeMap={\"general-settings\":(0,Q.lazy)(()=>Mr(()=>import(`./general-settings.js`).then(e=>({default:e.GeneralSettings})),__vite__mapDeps([1,2]),import.meta.url)),",
    "\"keyboard-shortcuts\":(0,Q.lazy)(()=>Mr(()=>import(`./keyboard-shortcuts-settings.js`).then(e=>({default:e.KeyboardShortcutsSettings})),__vite__mapDeps([3]),import.meta.url))};",
  ].join("");
}

function syntheticComposerBundle() {
  return "const YH={default:e=>e};function sU(e,t){return t??(e==null?[]:Object.entries(e).map(([e,t])=>({name:e,value:t,displayName:(0,YH.default)(e.trim())})))}";
}

function staleConversationMonitorBundle() {
  return [
    "let thread=1;",
    ';(()=>{const VERSION="agent-workspace-conversation-v12";if(globalThis.codexLinuxAgentWorkspaceConversationVersion===VERSION)return;try{globalThis.codexLinuxAgentWorkspaceConversationCleanup?.()}catch{}globalThis.codexLinuxAgentWorkspaceConversationVersion=VERSION;function start(){document.body?.insertAdjacentHTML?.("beforeend","<section class=\\"codex-linux-agent-workspace-panel\\"></section>")}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();})();',
    "",
  ].join("\n");
}

function writeSyntheticExtractedApp(root) {
  const buildDir = path.join(root, ".vite", "build");
  const assetsDir = path.join(root, "webview", "assets");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(buildDir, "main.js"), syntheticMainBundle());
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "codex" }));
  fs.writeFileSync(path.join(assetsDir, "settings-sections-test.js"), syntheticSettingsSections());
  fs.writeFileSync(path.join(assetsDir, "settings-shared-test.js"), syntheticSettingsShared());
  fs.writeFileSync(path.join(assetsDir, "settings-page-test.js"), syntheticSettingsPage());
  fs.writeFileSync(path.join(assetsDir, "index-test.js"), syntheticIndex());
  fs.writeFileSync(path.join(assetsDir, "local-conversation-thread-test.js"), staleConversationMonitorBundle());
  fs.writeFileSync(path.join(assetsDir, "composer-test.js"), syntheticComposerBundle());
  fs.writeFileSync(path.join(assetsDir, "chunk-test.js"), "export function s(e){return e}");
  fs.writeFileSync(path.join(assetsDir, "react-test.js"), 'import{s}from"./chunk-test.js";/* react.transitional.element */export{ReactFactory as t};function ReactFactory(){return{createElement(){return{}},useState(){return[null,()=>{}]},useCallback(e){return e},useEffect(){}}}');
  fs.writeFileSync(path.join(assetsDir, "jsx-runtime-test.js"), "/* react.transitional.element */export{j as t};function j(){return{jsx(){},jsxs(){}}}");
  fs.writeFileSync(path.join(assetsDir, "vscode-api-test.js"), "/* vscode://codex */export async function n(){return{}}");
  fs.writeFileSync(path.join(assetsDir, "settings-content-layout-test.js"), "export function t(){}");
  fs.writeFileSync(path.join(assetsDir, "app-test.png"), "");
  return { buildDir, assetsDir };
}

function writeModernCodexRequestAsset(assetsDir) {
  fs.rmSync(path.join(assetsDir, "vscode-api-test.js"), { force: true });
  fs.writeFileSync(
    path.join(assetsDir, "setting-storage-test.js"),
    "async function send(e,t,n,r,i){return fetch(`vscode://codex/${e}`)}async function request(...e){let[t,n]=e,{params:r,select:i,signal:a,source:o}=n??{};return send(t,r,i,a,o)}export{request as l};",
  );
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildSettingsVmSource() {
  return buildAgentWorkspaceSettingsSource({
    chunkAsset: "chunk-test.js",
    reactAsset: "react-test.js",
    reactExportName: "t",
    settingsPageAsset: "settings-content-layout-test.js",
    settingsPageExportName: "t",
    vscodeApiAsset: "vscode-api-test.js",
  })
    .replace('import{s as __toESM}from"./chunk-test.js";\n', "")
    .replace('import{t as __reactFactory}from"./react-test.js";\n', "")
    .replace('import{n as __post}from"./vscode-api-test.js";\n', "")
    .replace('import{t as SettingsPage}from"./settings-content-layout-test.js";\n', "")
    .replace("export{AgentWorkspacesSettings,AgentWorkspacesSettings as default};", "globalThis.AgentWorkspacesSettings=AgentWorkspacesSettings;");
}

function createSettingsRenderHarness(post) {
  const state = [];
  let hookIndex = 0;
  let effects = [];
  const react = {
    createElement(type, props, ...children) {
      return { type, props: props || {}, children: children.flat(Infinity).filter((child) => child != null && child !== false) };
    },
    useCallback(callback) {
      return callback;
    },
    useEffect(callback) {
      effects.push(callback);
    },
    useState(initialValue) {
      const index = hookIndex;
      hookIndex += 1;
      if (state.length <= index) {
        state[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      }
      return [
        state[index],
        (nextValue) => {
          state[index] = typeof nextValue === "function" ? nextValue(state[index]) : nextValue;
        },
      ];
    },
  };
  const context = vm.createContext({
    __post: post,
    __reactFactory: () => react,
    __toESM: (value) => value,
    console,
    globalThis: null,
    SettingsPage: function SettingsPage(props) {
      return props?.children || null;
    },
    window: {
      confirm() {
        return true;
      },
    },
  });
  context.globalThis = context;
  vm.runInContext(buildSettingsVmSource(), context);
  function render() {
    hookIndex = 0;
    effects = [];
    const tree = context.AgentWorkspacesSettings();
    return { tree, effects: [...effects] };
  }
  return { render };
}

function nodeText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  return (node.children || []).map(nodeText).join("");
}

function findNode(root, predicate) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.shift();
    if (!node || typeof node !== "object") continue;
    if (predicate(node)) return node;
    stack.unshift(...(node.children || []));
  }
  return null;
}

test("agent-workspace feature stays disabled until listed in features.json", () => {
  withTempFeatureConfig([], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), []);
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: root }), []);
  });
});

test("agent-workspace feature exposes optional bridge and settings descriptors when enabled", () => {
  withTempFeatureConfig(["agent-workspace"], (root) => {
    assert.deepEqual(enabledLinuxFeatureIds({ featuresRoot: root }), ["agent-workspace"]);
    assert.deepEqual(
      loadLinuxFeaturePatchDescriptors({ featuresRoot: root }).map((patch) => [patch.name, patch.phase, patch.ciPolicy]),
      [
        ["feature:agent-workspace:main-bridge", "main-bundle", "optional"],
        ["feature:agent-workspace:settings-page", "extracted-app", "optional"],
      ],
    );
  });
});

test("main bridge patch adds an allowlisted linux-agent-workspace handler", () => {
  const patched = applyAgentWorkspaceMainBridgePatch(syntheticMainBundle());
  assert.match(patched, /"linux-agent-workspace":async/);
  assert.match(patched, /"linux-agent-workspace-pick-app":async/);
  assert.match(patched, /"linux-agent-workspace-pick-mount":async/);
  assert.match(patched, /"linux-agent-workspace-pick-browser-data":async/);
  assert.match(patched, /"linux-agent-workspace-copy-browser-data":async/);
  assert.match(patched, /showOpenDialog/);
  assert.match(patched, /Desktop Entry/);
  assert.match(patched, /startup_app/);
  assert.match(patched, /desktop_file/);
  assert.match(patched, /browser-sessions/);
  assert.match(patched, /SingletonLock/);
  assert.match(patched, new RegExp(SETTINGS_COMMAND_KEY));
  assert.match(patched, /\.local`\,`bin`\,`agent-workspace-linux`/);
  assert.match(patched, /CODEX_AGENT_WORKSPACE_BIN/);
  assert.match(patched, /startsWith\(`~\/`\)/);
  assert.match(patched, /case`mcpConfig`/);
  assert.match(patched, /config\.toml/);
  assert.match(patched, /--permissions/);
  assert.match(patched, /__codexMcpConfig\?\.permissions_path/);
  assert.match(patched, /case`profileValidate`/);
  assert.match(patched, /\[`profile`,`validate`,`--json`,__codexTempPath\]/);
  assert.match(patched, /case`profileTemplate`/);
  assert.match(patched, /--browser-path/);
  assert.match(patched, /--user-data-dir/);
  assert.match(patched, /case`workspaceOpenProfile`/);
  assert.match(patched, /case`workspaceOpenViewer`/);
  assert.match(patched, /--always-on-top/);
  assert.match(patched, /spawn\(__codexCommand,__codexArgs/);
  assert.match(patched, /detached:!0/);
  assert.match(patched, /stdio:`ignore`/);
  assert.match(patched, /unref\?\.\(\)/);
  assert.match(patched, /case`workspaceStart`/);
  assert.doesNotMatch(patched, /case`workspaceObserve`/);
  assert.doesNotMatch(patched, /--include-hidden/);
  assert.doesNotMatch(patched, /__codexAttachScreenshot/);
  assert.doesNotMatch(patched, /data:image\/png;base64/);
  assert.match(patched, /execFile\(__codexCommand,__codexArgs/);
  assert.equal(applyAgentWorkspaceMainBridgePatch(patched), patched);
  const stalePatched = patched.replace(
    '"linux-agent-workspace-copy-browser-data":async',
    '"linux-agent-workspace-copy-browser-data-old":async',
  );
  assert.match(applyAgentWorkspaceMainBridgePatch(stalePatched), /"linux-agent-workspace-copy-browser-data":async/);

  const { value, warnings } = captureWarns(() => applyAgentWorkspaceMainBridgePatch("real bundle"));
  assert.equal(value, "real bundle");
  assert.match(warnings.join("\n"), /Could not find Node module aliases/);
});

test("main bridge generator does not carry removed conversation monitor observe code", () => {
  const patchSource = fs.readFileSync(path.join(__dirname, "patch.js"), "utf8");
  assert.doesNotMatch(patchSource, /case\\`workspaceObserve\\`/);
  assert.doesNotMatch(patchSource, /__codexAttachScreenshot/);
  assert.doesNotMatch(patchSource, /data:image\/png;base64/);
  assert.doesNotMatch(patchSource, /codexLinuxAgentWorkspaceConversationCleanup=cleanup/);
  assert.doesNotMatch(patchSource, /codex-linux-agent-workspace-panel/);
});

test("main bridge patch upgrades stale installed agent workspace handlers", () => {
  const legacyHandler = [
    '"linux-agent-workspace-copy-browser-data":async()=>({ok:true,action:`copyBrowserData`}),',
    '"linux-agent-workspace":async({action:__codexAction}={})=>{let __codexActionName=__codexAction;',
    'try{switch(__codexActionName){case`profileList`:return{ok:true,json:{profiles:[]}};',
    'case`workspaceList`:return{ok:true,json:{workspaces:[]}};',
    'default:throw Error(`unsupported agent workspace action`)}}',
    'catch(e){return{ok:false,action:__codexActionName,message:e instanceof Error?e.message:String(e)}}},',
  ].join("");
  const legacy = syntheticMainBundle().replace('"get-global-state":async({key:t})=>', `${legacyHandler}"get-global-state":async({key:t})=>`);

  const upgraded = applyAgentWorkspaceMainBridgePatch(legacy);
  assert.match(upgraded, /"linux-agent-workspace-pick-app":async/);
  assert.match(upgraded, /"linux-agent-workspace-pick-mount":async/);
  assert.match(upgraded, /"linux-agent-workspace-pick-browser-data":async/);
  assert.match(upgraded, /"linux-agent-workspace-copy-browser-data":async/);
  assert.match(upgraded, /case`mcpConfig`/);
  assert.match(upgraded, /__codexMcpConfig/);
  assert.match(upgraded, /case`workspaceOpenViewer`/);
  assert.match(upgraded, /case`workspaceStart`/);
  assert.match(upgraded, /case`profileTemplate`/);
  assert.doesNotMatch(upgraded, /case`profileList`:return\{ok:true,json:\{profiles:\[\]\}\}/);
  assert.equal(applyAgentWorkspaceMainBridgePatch(upgraded), upgraded);
});

test("app picker converts desktop launchers into startup app commands", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-desktop-app-"));
  try {
    const desktopPath = path.join(tempDir, "canva.desktop");
    fs.writeFileSync(
      desktopPath,
      [
        "[Desktop Entry]",
        "Name=Canva",
        'Exec="/opt/Canva/canva" --new-window %U',
        "Type=Application",
        "",
      ].join("\n"),
    );

    const { handlers } = buildBridgeHarness({
      electron: {
        dialog: {
          showOpenDialog: async () => ({ canceled: false, filePaths: [desktopPath] }),
        },
      },
    });

    const response = await handlers["linux-agent-workspace-pick-app"]();
    assert.equal(response.ok, true);
    assert.equal(response.json.desktop, true);
    assert.equal(response.json.startup_app.name, "Canva");
    assert.equal(response.json.startup_app.desktop_file, desktopPath);
    assert.deepEqual(Array.from(response.json.startup_app.command), ["/opt/Canva/canva", "--new-window"]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("browser data copy bridge creates a managed copy without lock files", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-browser-copy-"));
  try {
    const home = path.join(tempDir, "home");
    const source = path.join(tempDir, "chrome-user-data");
    fs.mkdirSync(path.join(source, "Default"), { recursive: true });
    fs.writeFileSync(path.join(source, "Default", "Cookies"), "cookie-db");
    fs.writeFileSync(path.join(source, "SingletonLock"), "lock");

    const { handlers } = buildBridgeHarness({
      env: {
        HOME: home,
        XDG_DATA_HOME: path.join(tempDir, "data"),
      },
    });

    const response = await handlers["linux-agent-workspace-copy-browser-data"]({
      sourcePath: source,
      profileId: "Browser Session!",
    });

    assert.equal(response.ok, true);
    assert.equal(response.action, "copyBrowserData");
    assert.match(response.json.path, /browser-sessions\/browser-session/);
    assert.equal(fs.readFileSync(path.join(response.json.path, "Default", "Cookies"), "utf8"), "cookie-db");
    assert.equal(fs.existsSync(path.join(response.json.path, "SingletonLock")), false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("main bridge reads MCP permission config and applies it to CLI calls", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-mcp-config-"));
  try {
    const codexHome = path.join(tempDir, "codex-home");
    const permissionsPath = path.join(tempDir, "permissions.json");
    fs.mkdirSync(codexHome, { recursive: true });
    fs.writeFileSync(
      path.join(codexHome, "config.toml"),
      [
        "[mcp_servers.agent-workspace-linux]",
        'command = "/tmp/agent-workspace-linux"',
        `args = ["mcp", "--permissions", "${permissionsPath}"]`,
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      permissionsPath,
      JSON.stringify({ network: { mode: "disabled" }, apps: { allow: ["sh"] } }, null, 2),
    );

    const { handlers, execCalls, spawnCalls } = buildBridgeHarness({
      env: {
        CODEX_HOME: codexHome,
        CODEX_AGENT_WORKSPACE_BIN: "/tmp/agent-workspace-linux",
      },
    });

    const config = await handlers["linux-agent-workspace"]({ action: "mcpConfig" });
    assert.equal(config.ok, true);
    assert.equal(config.json.configured, true);
    assert.equal(config.json.restricted, true);
    assert.equal(config.json.permissions_path, permissionsPath);
    assert.equal(config.json.ceiling.network.mode, "disabled");

    const response = await handlers["linux-agent-workspace"]({ action: "profileList" });
    assert.equal(response.ok, true);
    assert.deepEqual(Array.from(execCalls[0].args.slice(0, 4)), ["--permissions", permissionsPath, "profile", "list"]);

    const template = await handlers["linux-agent-workspace"]({
      action: "profileTemplate",
      templateKind: "browser-session",
      profileId: "browser-session",
      browserPath: "/usr/bin/google-chrome",
      userDataDir: "/tmp/browser-profile",
    });
    assert.equal(template.ok, true);
    assert.deepEqual(Array.from(execCalls[1].args.slice(0, 5)), [
      "--permissions",
      permissionsPath,
      "profile",
      "template",
      "browser-session",
    ]);
    assert.match(execCalls[1].args.join("\n"), /--user-data-dir\n\/tmp\/browser-profile/);

    const viewer = await handlers["linux-agent-workspace"]({
      action: "workspaceOpenViewer",
      workspaceId: "default",
      alwaysOnTop: true,
    });
    assert.equal(viewer.ok, true);
    assert.equal(viewer.json.id, "default");
    assert.equal(viewer.json.pid, 4242);
    assert.equal(viewer.json.always_on_top, true);
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(Array.from(spawnCalls[0].args.slice(0, 5)), [
      "--permissions",
      permissionsPath,
      "viewer",
      "--id",
      "default",
    ]);
    assert.match(spawnCalls[0].args.join("\n"), /--always-on-top/);
    assert.equal(spawnCalls[0].options.detached, true);
    assert.equal(spawnCalls[0].options.stdio, "ignore");
    assert.equal(spawnCalls[0].unref, true);
    assert.equal(execCalls.length, 2);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("main bridge opens viewer in clean default mode without adding a ceiling or topmost state", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-clean-viewer-"));
  try {
    const { handlers, execCalls, spawnCalls } = buildBridgeHarness({
      env: {
        CODEX_HOME: path.join(tempDir, "codex-home"),
        CODEX_AGENT_WORKSPACE_BIN: "/tmp/agent-workspace-linux",
      },
    });

    const config = await handlers["linux-agent-workspace"]({ action: "mcpConfig" });
    assert.equal(config.ok, true);
    assert.equal(config.json.configured, false);
    assert.equal(config.json.restricted, false);
    assert.equal(config.json.permissions_path, null);

    const profiles = await handlers["linux-agent-workspace"]({ action: "profileList" });
    assert.equal(profiles.ok, true);
    assert.equal(execCalls.length, 1);
    assert.deepEqual(Array.from(execCalls[0].args), ["profile", "list"]);

    const viewer = await handlers["linux-agent-workspace"]({
      action: "workspaceOpenViewer",
      workspaceId: "qa-live",
    });
    assert.equal(viewer.ok, true);
    assert.equal(viewer.json.id, "qa-live");
    assert.equal(viewer.json.always_on_top, false);
    assert.equal(execCalls.length, 1);
    assert.equal(spawnCalls.length, 1);
    assert.deepEqual(Array.from(spawnCalls[0].args), ["viewer", "--id", "qa-live"]);
    assert.equal(spawnCalls[0].options.detached, true);
    assert.equal(spawnCalls[0].options.stdio, "ignore");
    assert.equal(spawnCalls[0].unref, true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("main bridge reports detached viewer spawn errors without exec fallback", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-viewer-error-"));
  const calls = [];
  try {
    const { handlers, execCalls } = buildBridgeHarness({
      env: {
        CODEX_HOME: path.join(tempDir, "codex-home"),
        CODEX_AGENT_WORKSPACE_BIN: "/tmp/missing-agent-workspace-linux",
      },
      spawn(command, args, options) {
        const call = { command, args, options, unref: false };
        calls.push(call);
        return {
          pid: null,
          once(event, callback) {
            if (event === "error") {
              process.nextTick(() => callback(new Error("spawn ENOENT")));
            }
            return this;
          },
          unref() {
            call.unref = true;
          },
        };
      },
    });

    const viewer = await handlers["linux-agent-workspace"]({
      action: "workspaceOpenViewer",
      workspaceId: "qa-live",
    });
    assert.equal(viewer.ok, false);
    assert.equal(viewer.action, "workspaceOpenViewer");
    assert.match(viewer.message, /spawn ENOENT/);
    assert.equal(execCalls.length, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(Array.from(calls[0].args), ["viewer", "--id", "qa-live"]);
    assert.equal(calls[0].unref, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("generated agent workspace settings module is valid ESM syntax", () => {
  const source = buildAgentWorkspaceSettingsSource({
    chunkAsset: "chunk-test.js",
    reactAsset: "react-test.js",
    reactExportName: "t",
    settingsPageAsset: "settings-content-layout-test.js",
    settingsPageExportName: "t",
    vscodeApiAsset: "vscode-api-test.js",
  });
  const check = spawnSync(process.execPath, ["--input-type=module", "--check"], {
    encoding: "utf8",
    input: source,
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(source, /export\{AgentWorkspacesSettings,AgentWorkspacesSettings as default\}/);
  assert.match(source, /function resultSummary/);
  assert.match(source, /function mcpConfigView/);
  assert.match(source, /function permissionsPathFromArgs/);
  assert.match(source, /function mcpConfigFromResponses/);
  assert.match(source, /function approvalPreviewView/);
  assert.match(source, /function approvalBundleFromResponse/);
  assert.match(source, /function approvalAckParams/);
  assert.match(source, /approve_cli_flags/);
  assert.match(source, /--ack-unenforced-policy/);
  assert.match(source, /--ack-hidden-workspace/);
  assert.match(source, /MCP permissions/);
  assert.match(source, /MCP locked/);
  assert.match(source, /Host controlled/);
  assert.doesNotMatch(source, /MCP open/);
  assert.match(source, /Inspecting MCP permissions/);
  assert.match(source, /No MCP permission ceiling detected; Codex session permissions apply/);
  assert.match(source, /No MCP ceiling is active\. Codex session permissions apply after hidden-workspace approval\./);
  assert.match(source, /callAgentWorkspace\("mcpConfig"\)/);
  assert.match(source, /MCP permission ceiling is active for workspace actions/);
  assert.match(source, /h\("details",[\s\S]*?\)\s*,\s*mcpConfig\?mcpConfigView\(mcpConfig\):null/);
  assert.match(source, /function responseOk/);
  assert.match(source, /function profileFromResponse/);
  assert.match(source, /function cleanupProcessActionCount/);
  assert.match(source, /process_cleanup/);
  assert.match(source, /process action/);
  assert.match(source, /function resultView\(result,open,setOpen\)/);
  assert.match(source, /function workspaceRunning/);
  assert.match(source, /function workspaceSummary/);
  assert.match(source, /function workspacePrimary/);
  assert.match(source, /function workspaceSecondary/);
  assert.match(source, /function statusDot/);
  assert.match(source, /function profileMountMode/);
  assert.match(source, /function profileMounts/);
  assert.match(source, /function addMountsFromPaths/);
  assert.match(source, /function pickMount/);
  assert.match(source, /startup_app/);
  assert.match(source, /function profileAllowHosts/);
  assert.match(source, /function addNetworkHost/);
  assert.match(source, /function removeNetworkHost/);
  assert.match(source, /allow_hosts/);
  assert.match(source, /NETWORK_MODE_OPTIONS/);
  assert.match(source, /Closed/);
  assert.match(source, /Local/);
  assert.match(source, /Open/);
  assert.match(source, /Local hosts/);
  assert.doesNotMatch(source, /\["inherit_host","local_only","disabled","allowlist"\]/);
  assert.doesNotMatch(source, /Allowed hosts/);
  assert.match(source, /Add host/);
  assert.match(source, /DEFAULT_COMMAND_LABEL="~\/\.local\/bin\/agent-workspace-linux"/);
  assert.match(source, /Custom command/);
  assert.match(source, /Active workspace/);
  assert.match(source, /statusPill\("Active","active",true\)/);
  assert.match(source, /statusPill\("Idle","idle"\)/);
  assert.doesNotMatch(source, /statusDot\(mountMode/);
  assert.match(source, /Workspace control/);
  assert.match(source, /Connection/);
  assert.match(source, /Saved workspaces/);
  assert.match(source, /Workspace name/);
  assert.doesNotMatch(source, /Saved profiles/);
  assert.match(source, /Create new/);
  assert.match(source, /Project template/);
  assert.match(source, /Chrome template/);
  assert.match(source, /Browser session/);
  assert.match(source, /Prepare browser session/);
  assert.match(source, /Copy profile/);
  assert.match(source, /Use folder directly/);
  assert.match(source, /profile locks/);
  assert.match(source, /Create from copy/);
  assert.match(source, /Create direct/);
  assert.match(source, /function createProjectProfile/);
  assert.match(source, /templateKind:"project-dev"/);
  assert.match(source, /function createRestrictedChromeProfile/);
  assert.match(source, /function createBrowserSessionProfile/);
  assert.match(source, /function finishBrowserSessionProfile/);
  assert.match(source, /linux-agent-workspace-pick-browser-data/);
  assert.match(source, /linux-agent-workspace-copy-browser-data/);
  assert.match(source, /profileFromResponse\(response\)/);
  assert.match(source, /profileTemplate/);
  assert.match(source, /restricted-chrome/);
  assert.match(source, /browser-session/);
  assert.match(source, /userDataDir/);
  assert.match(source, /Edit saved/);
  assert.match(source, /profileValidate/);
  assert.match(source, /Save changes/);
  assert.match(source, /Stop to edit/);
  assert.match(source, /profileFormLocked/);
  assert.match(source, /editingSaved/);
  assert.match(source, /advancedOpen/);
  assert.match(source, /resultOpen/);
  assert.match(source, /fixed inset-0 z-50 overflow-y-auto/);
  assert.match(source, /max-h-\[calc\(100vh-2rem\)\]/);
  assert.match(source, /resultView\(result,resultOpen,setResultOpen\)/);
  assert.doesNotMatch(source, /Overwrite/);
  assert.doesNotMatch(source, /Create profile/);
  assert.match(source, /Advanced settings/);
  assert.match(source, /Pick app/);
  assert.match(source, /Add file\/folder/);
  assert.match(source, /Add a file or folder before choosing read-only or read-write access/);
  assert.match(source, /Workspace status/);
  assert.match(source, /Hide status/);
  assert.match(source, /function openWorkspaceViewer/);
  assert.match(source, /workspaceOpenViewer/);
  assert.match(source, /function openWorkspaceViewer\(workspaceId\)\{\s*callAgentWorkspace\("workspaceOpenViewer",\{workspaceId:workspaceId\}\);\s*\}/);
  assert.match(source, /Open Viewer/);
  assert.match(source, /File access/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /Stopped workspaces \(/);
  assert.match(source, /var stoppedWorkspaces=workspaces\.filter/);
  assert.match(source, /stoppedWorkspaces\.map\(function\(workspace\)/);
  assert.match(source, /function startStoppedWorkspace/);
  assert.match(source, /function deleteStoppedWorkspace/);
  assert.match(source, /function startSavedWorkspace/);
  assert.match(source, /startSavedWorkspace\(savedProfile\)/);
  assert.match(source, /var pendingApprovalState=React\.useState\(null\)/);
  assert.match(source, /function requestStartApproval/);
  assert.match(source, /callAgentWorkspace\(action,\{\.\.\.params,dryRun:true\}\)/);
  assert.match(source, /Approve hidden workspace/);
  assert.match(source, /Approval required/);
  assert.match(source, /Codex wants to start an agent-controlled Linux workspace/);
  assert.match(source, /Approve and start/);
  assert.match(source, /approvalPreviewView\(pendingApproval,approvePendingStart/);
  assert.match(source, /workspaceStart/);
  assert.match(source, /Delete stale/);
  assert.doesNotMatch(source, /workspaceDisplay\(activeWorkspace\)/);
  assert.doesNotMatch(source, /workspaceDisplay\(workspace\)/);
  assert.match(source, /h\("details"/);
  assert.match(source, /function activeWorkspaceFromList/);
  assert.match(source, /var activeWorkspace=activeWorkspaceFromList\(workspaces\)/);
  assert.doesNotMatch(source, /workspace\.profile_id\|\|workspace\.purpose\|\|workspace\.status/);
  assert.doesNotMatch(source, /workspaces\.map\(function\(workspace\)/);
  assert.doesNotMatch(source, /Cleanup stale/);
  assert.doesNotMatch(source, /workspaceCleanup",\{dryRun:true\}/);
});

test("generated settings UI opens the GPUI viewer with the clean default action shape", async () => {
  const calls = [];
  const post = async (method, request = {}) => {
    const params = request.params || {};
    calls.push({ method, params });
    if (method === "get-global-state") return { value: "" };
    if (method !== "linux-agent-workspace") return { ok: true };
    if (params.action === "mcpConfig") {
      return {
        ok: true,
        json: {
          configured: false,
          restricted: false,
          permissions_path: null,
          message: "MCP config not found",
        },
      };
    }
    if (params.action === "profileList") return { ok: true, json: { profiles: [] } };
    if (params.action === "workspaceList") {
      return {
        ok: true,
        json: {
          workspaces: [
            {
              id: "qa-live",
              running: true,
              status: {
                id: "qa-live",
                ready: true,
                purpose: "QA live view",
                apps: [],
              },
            },
          ],
        },
      };
    }
    if (params.action === "workspaceOpenViewer") {
      return {
        ok: true,
        json: {
          ok: true,
          id: params.workspaceId,
          always_on_top: !!params.alwaysOnTop,
        },
      };
    }
    return { ok: true, json: { ok: true } };
  };

  const harness = createSettingsRenderHarness(post);
  const firstRender = harness.render();
  for (const effect of firstRender.effects) effect();
  await flushPromises();
  await flushPromises();

  const { tree } = harness.render();
  const openViewerButton = findNode(
    tree,
    (node) => node.type === "button" && nodeText(node) === "Open Viewer",
  );
  assert.ok(openViewerButton, "Open Viewer button should render for the active workspace");
  assert.equal(openViewerButton.props.disabled, false);

  openViewerButton.props.onClick();
  await flushPromises();
  const viewerCall = calls.find((call) => call.params.action === "workspaceOpenViewer");
  assert.deepEqual(JSON.parse(JSON.stringify(viewerCall)), {
    method: "linux-agent-workspace",
    params: {
      action: "workspaceOpenViewer",
      workspaceId: "qa-live",
    },
  });
});

test("settings asset patches add navigation, route, visibility, and title", () => {
  const sections = applyAgentWorkspaceSettingsSectionsPatch(syntheticSettingsSections());
  assert.match(sections, new RegExp(`slug:\`${SETTINGS_SLUG}\``));
  assert.equal(applyAgentWorkspaceSettingsSectionsPatch(sections), sections);

  const shared = applyAgentWorkspaceSettingsSharedPatch(syntheticSettingsShared());
  assert.match(shared, new RegExp(`settings\\.nav\\.${SETTINGS_SLUG}`));
  assert.match(shared, new RegExp(`settings\\.section\\.${SETTINGS_SLUG}`));
  assert.equal(applyAgentWorkspaceSettingsSharedPatch(shared), shared);

  const sharedWithCollision = applyAgentWorkspaceSettingsSharedPatch(syntheticSettingsSharedWithSlugAliasCollision());
  assert.match(sharedWithCollision, /case`agent-workspaces`:\{return \(0,d\.jsx\)\(r,\{id:`settings\.section\.agent-workspaces`/);
  assert.doesNotMatch(sharedWithCollision, /case`agent-workspaces`:\{return \(0,d\.jsx\)\(n,\{id:`settings\.section\.agent-workspaces`/);

  const index = applyAgentWorkspaceSettingsIndexPatch(syntheticIndex());
  assert.match(index, new RegExp(SETTINGS_ASSET));
  assert.match(index, new RegExp(`"${SETTINGS_SLUG}":Icon`));
  assert.match(index, /case`local-environments`:case`agent-workspaces`:case`data-controls`:case`environments`:return l===`electron`/);
  assert.match(index, /case`local-environments`:case`agent-workspaces`:case`worktrees`/);
  assert.equal(applyAgentWorkspaceSettingsIndexPatch(index), index);

  const appMain = applyAgentWorkspaceSettingsIndexPatch(syntheticAppMainRouteRegistry());
  assert.match(appMain, new RegExp(SETTINGS_ASSET));
  assert.doesNotMatch(appMain, new RegExp(`"${SETTINGS_SLUG}":Icon`));
  assert.equal(applyAgentWorkspaceSettingsIndexPatch(appMain), appMain);

  const settingsPage = applyAgentWorkspaceSettingsPagePatch(syntheticSettingsPage());
  assert.match(settingsPage, /codexLinuxAgentWorkspaceSettingsIcon=e=>/);
  assert.match(settingsPage, new RegExp(`"${SETTINGS_SLUG}":codexLinuxAgentWorkspaceSettingsIcon`));
  assert.doesNotMatch(settingsPage, new RegExp(`"${SETTINGS_SLUG}":q`));
  assert.match(settingsPage, /`local-environments`,`agent-workspaces`,`worktrees`/);
  assert.match(settingsPage, /case`local-environments`:case`agent-workspaces`:case`environments`:return!0/);
  assert.match(settingsPage, /case`local-environments`:case`agent-workspaces`:case`worktrees`:case`environments`/);
  assert.equal(applyAgentWorkspaceSettingsPagePatch(settingsPage), settingsPage);
});

test("agent-workspace feature participates in ASAR patching and reports", () => {
  withTempFeatureConfig(["agent-workspace"], (featuresRoot) => {
    withLinuxFeatureRootEnv(featuresRoot, () => {
      const tempApp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-app-"));
      try {
        const { buildDir, assetsDir } = writeSyntheticExtractedApp(tempApp);
        const report = createPatchReport();
        const { warnings } = captureWarns(() => patchExtractedApp(tempApp, { report }));

        assert.ok(
          warnings.every((warning) => !warning.includes("Agent Workspaces")),
          warnings.join("\n"),
        );
        assert.match(fs.readFileSync(path.join(buildDir, "main.js"), "utf8"), /"linux-agent-workspace":async/);
        assert.ok(fs.existsSync(path.join(assetsDir, SETTINGS_ASSET)));
        assert.match(fs.readFileSync(path.join(assetsDir, SETTINGS_ASSET), "utf8"), /AgentWorkspacesSettings/);
        assert.match(fs.readFileSync(path.join(assetsDir, "settings-sections-test.js"), "utf8"), /agent-workspaces/);
        assert.match(fs.readFileSync(path.join(assetsDir, "settings-shared-test.js"), "utf8"), /Agent Workspaces/);
        assert.match(fs.readFileSync(path.join(assetsDir, "settings-page-test.js"), "utf8"), /agent-workspaces/);
        assert.match(fs.readFileSync(path.join(assetsDir, "index-test.js"), "utf8"), new RegExp(SETTINGS_ASSET));
        assert.equal(
          fs.readFileSync(path.join(assetsDir, "local-conversation-thread-test.js"), "utf8"),
          staleConversationMonitorBundle(),
        );
        assert.equal(fs.readFileSync(path.join(assetsDir, "composer-test.js"), "utf8"), syntheticComposerBundle());
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:main-bridge" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:settings-page" && patch.status === "applied"));
        assert.equal(report.patches.some((patch) => patch.name === "feature:agent-workspace:conversation-view"), false);
        assert.equal(report.patches.some((patch) => patch.name === "feature:agent-workspace:stale-runtime-cleanup"), false);
        assert.equal(report.patches.some((patch) => patch.name === "feature:agent-workspace:approval-rendering"), false);
      } finally {
        fs.rmSync(tempApp, { recursive: true, force: true });
      }
    });
  });
});

test("agent-workspace settings resolve latest upstream request API asset", () => {
  const tempApp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-agent-workspace-modern-api-"));
  try {
    const { assetsDir } = writeSyntheticExtractedApp(tempApp);
    writeModernCodexRequestAsset(assetsDir);

    const { value: result, warnings } = captureWarns(() => patchAgentWorkspaceSettingsAssets(tempApp));

    assert.equal(result.matched, true);
    assert.ok(
      warnings.every((warning) => !warning.includes("Agent Workspaces")),
      warnings.join("\n"),
    );
    const settingsSource = fs.readFileSync(path.join(assetsDir, SETTINGS_ASSET), "utf8");
    assert.match(settingsSource, /import\{l as __post\}from"\.\/setting-storage-test\.js"/);
    assert.match(settingsSource, /AgentWorkspacesSettings/);
    assert.match(fs.readFileSync(path.join(assetsDir, "index-test.js"), "utf8"), new RegExp(SETTINGS_ASSET));
  } finally {
    fs.rmSync(tempApp, { recursive: true, force: true });
  }
});

test("feature patch list is intentionally small", () => {
  assert.deepEqual(
    featurePatches.map((patch) => [patch.id, patch.phase]),
    [
      ["main-bridge", "main-bundle"],
      ["settings-page", "extracted-app"],
    ],
  );
});
