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
  CONVERSATION_RUNTIME_VERSION,
  SETTINGS_ASSET,
  SETTINGS_COMMAND_KEY,
  SETTINGS_SLUG,
  agentWorkspaceConversationRuntimeSource,
  applyAgentWorkspaceConversationViewPatch,
  applyAgentWorkspaceApprovalRenderingPatch,
  applyAgentWorkspaceMainBridgePatch,
  applyAgentWorkspaceSettingsIndexPatch,
  applyAgentWorkspaceSettingsPagePatch,
  applyAgentWorkspaceSettingsSectionsPatch,
  applyAgentWorkspaceSettingsSharedPatch,
  buildAgentWorkspaceSettingsSource,
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

function buildBridgeHarness({ env = {}, globalState = new Map(), execFile, electron = null } = {}) {
  const patched = applyAgentWorkspaceMainBridgePatch(syntheticMainBundle());
  const execCalls = [];
  const childProcess = {
    execFile:
      execFile ||
      ((command, args, options, callback) => {
        execCalls.push({ command, args, options });
        callback(null, '{"profiles":[]}\n', "");
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
  return { handlers: host.handlers(), execCalls };
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
  fs.writeFileSync(path.join(assetsDir, "local-conversation-thread-test.js"), "let thread=1;");
  fs.writeFileSync(path.join(assetsDir, "composer-test.js"), syntheticComposerBundle());
  fs.writeFileSync(path.join(assetsDir, "chunk-test.js"), "export function s(e){return e}");
  fs.writeFileSync(path.join(assetsDir, "react-test.js"), 'import{s}from"./chunk-test.js";/* react.transitional.element */export{ReactFactory as t};function ReactFactory(){return{createElement(){return{}},useState(){return[null,()=>{}]},useCallback(e){return e},useEffect(){}}}');
  fs.writeFileSync(path.join(assetsDir, "jsx-runtime-test.js"), "/* react.transitional.element */export{j as t};function j(){return{jsx(){},jsxs(){}}}");
  fs.writeFileSync(path.join(assetsDir, "vscode-api-test.js"), "/* vscode://codex */export async function n(){return{}}");
  fs.writeFileSync(path.join(assetsDir, "settings-content-layout-test.js"), "export function t(){}");
  fs.writeFileSync(path.join(assetsDir, "app-test.png"), "");
  return { buildDir, assetsDir };
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this._textContent = "";
    this._hidden = false;
    this.className = "";
    this.id = "";
    this.src = "";
    this.alt = "";
    this.title = "";
    this.style = {};
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) this.ownerDocument.byId.set(child.id, child);
    return child;
  }

  replaceWith(next) {
    const siblings = this.parentNode?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    if (index >= 0) {
      next.parentNode = this.parentNode;
      siblings[index] = next;
      this.parentNode = null;
    }
  }

  remove() {
    const siblings = this.parentNode?.children;
    if (!siblings) return;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }

  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  click() {
    for (const callback of this.listeners.get("click") || []) {
      callback({ preventDefault() {} });
    }
  }

  set hidden(value) {
    this._hidden = !!value;
  }

  get hidden() {
    return this._hidden;
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
  }

  get textContent() {
    return this._textContent;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "id") {
      this.id = String(value);
      this.ownerDocument.byId.set(this.id, this);
    }
    if (name === "class") this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  set innerHTML(value) {
    this._innerHTML = String(value ?? "");
    if (this.className !== "codex-linux-agent-workspace-panel") return;
    this.children = [];

    const head = this.ownerDocument.createElement("div");
    head.className = "codex-linux-agent-workspace-head";
    const dot = this.ownerDocument.createElement("span");
    dot.className = "codex-linux-agent-workspace-dot";
    const title = this.ownerDocument.createElement("div");
    title.className = "codex-linux-agent-workspace-title";
    const actions = this.ownerDocument.createElement("div");
    actions.className = "codex-linux-agent-workspace-actions";
    const refresh = this.ownerDocument.createElement("button");
    refresh.setAttribute("data-action", "refresh");
    const stop = this.ownerDocument.createElement("button");
    stop.setAttribute("data-action", "stop");
    const revoke = this.ownerDocument.createElement("button");
    revoke.setAttribute("data-action", "revoke");
    actions.appendChild(refresh);
    actions.appendChild(stop);
    actions.appendChild(revoke);
    head.appendChild(dot);
    head.appendChild(title);
    head.appendChild(actions);

    const empty = this.ownerDocument.createElement("div");
    empty.className = "codex-linux-agent-workspace-empty";
    empty.textContent = "Workspace is running. No windows yet.";
    const viewport = this.ownerDocument.createElement("div");
    viewport.className = "codex-linux-agent-workspace-viewport";
    viewport.appendChild(empty);
    const meta = this.ownerDocument.createElement("div");
    meta.className = "codex-linux-agent-workspace-meta";
    const error = this.ownerDocument.createElement("div");
    error.className = "codex-linux-agent-workspace-error";
    error.hidden = true;
    const resize = this.ownerDocument.createElement("button");
    resize.className = "codex-linux-agent-workspace-resize";

    this.appendChild(head);
    this.appendChild(viewport);
    this.appendChild(meta);
    this.appendChild(error);
    this.appendChild(resize);
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  querySelector(selector) {
    return findElement(this, selector);
  }

  querySelectorAll(selector) {
    return findElements(this, selector);
  }
}

function findElements(root, selector) {
  const matches = (element) => {
    if (selector.startsWith(".")) {
      return String(element.className || "").split(/\s+/).includes(selector.slice(1));
    }
    const dataAction = selector.match(/^\[data-action='([^']+)'\]$/);
    if (dataAction) {
      return element.getAttribute("data-action") === dataAction[1];
    }
    return false;
  };
  const found = [];
  const stack = [...root.children];
  while (stack.length > 0) {
    const element = stack.shift();
    if (matches(element)) found.push(element);
    stack.unshift(...element.children);
  }
  return found;
}

function findElement(root, selector) {
  const [first] = findElements(root, selector);
  return first || null;
}

function appendStaleWorkspacePanel(document) {
  const panel = document.createElement("section");
  panel.className = "codex-linux-agent-workspace-panel";
  panel.hidden = true;
  document.body.appendChild(panel);
  return panel;
}

function createFakeDocument() {
  const document = {
    readyState: "complete",
    byId: new Map(),
    body: null,
    head: null,
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    getElementById(id) {
      return document.byId.get(id) || null;
    },
    addEventListener() {},
  };
  document.body = document.createElement("body");
  document.head = document.createElement("head");
  return document;
}

function waitFor(condition, message) {
  const deadline = Date.now() + 1000;
  return new Promise((resolve, reject) => {
    function tick() {
      if (condition()) return resolve();
      if (Date.now() > deadline) return reject(new Error(message));
      setTimeout(tick, 5);
    }
    tick();
  });
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
        ["feature:agent-workspace:conversation-view", "webview-asset", "optional"],
        ["feature:agent-workspace:approval-rendering", "webview-asset", "optional"],
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
  assert.match(patched, /case`workspaceStart`/);
  assert.match(patched, /case`workspaceObserve`/);
  assert.match(patched, /--include-hidden/);
  assert.match(patched, /data:image\/png;base64/);
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

    const { handlers, execCalls } = buildBridgeHarness({
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
  assert.match(source, /MCP permissions/);
  assert.match(source, /MCP locked/);
  assert.match(source, /Inspecting MCP permissions/);
  assert.match(source, /No MCP permission ceiling detected/);
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
  assert.match(source, /File access/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /Stopped workspaces \(/);
  assert.match(source, /var stoppedWorkspaces=workspaces\.filter/);
  assert.match(source, /stoppedWorkspaces\.map\(function\(workspace\)/);
  assert.match(source, /function startStoppedWorkspace/);
  assert.match(source, /function deleteStoppedWorkspace/);
  assert.match(source, /function startSavedWorkspace/);
  assert.match(source, /startSavedWorkspace\(savedProfile\)/);
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

test("conversation visibility runtime is valid script and idempotent", () => {
  const runtime = agentWorkspaceConversationRuntimeSource();
  const check = spawnSync(process.execPath, ["--check"], {
    encoding: "utf8",
    input: `let source=1;\n${runtime}`,
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(runtime, new RegExp(CONVERSATION_RUNTIME_VERSION));
  assert.match(runtime, /workspaceObserve/);
  assert.match(runtime, /workspaceStop/);
  assert.match(runtime, /workspaceCleanup/);
  assert.match(runtime, /bridgeError/);
  assert.match(runtime, /codex-linux-agent-workspace-panel/);
  assert.match(runtime, /data-action="revoke"/);
  assert.match(runtime, /Revoke/);
  assert.match(runtime, /data_url/);
  assert.match(runtime, /function policySummary/);
  assert.match(runtime, /function appSummary/);
  assert.match(runtime, /function inSettingsView/);
  assert.match(runtime, /function scheduleViewCheck/);
  assert.match(runtime, /MutationObserver/);
  assert.match(runtime, /localStorage/);
  assert.match(runtime, /function beginInteraction/);
  assert.match(runtime, /pointerdown/);
  assert.match(runtime, /codex-linux-agent-workspace-resize/);
  assert.match(runtime, /codex-linux-agent-workspace-theme-v10/);
  assert.match(runtime, /function removeOldPanels/);
  assert.match(runtime, /codexLinuxAgentWorkspaceConversationCleanup/);
  assert.match(runtime, /--color-token-main-surface-primary/);
  assert.match(runtime, /88%,transparent/);
  assert.match(runtime, /backdrop-filter:blur\(8px\) saturate\(1\.05\)/);
  assert.match(runtime, /--color-token-bg-fog/);
  assert.match(runtime, /--color-token-border-default/);
  assert.match(runtime, /Drag workspace viewer/);
  assert.match(runtime, /Resize workspace viewer/);
  assert.match(runtime, /Profile /);
  assert.match(runtime, /Network /);
  assert.match(runtime, /mount/);

  const patched = applyAgentWorkspaceConversationViewPatch("let thread=1;");
  assert.match(patched, new RegExp(CONVERSATION_RUNTIME_VERSION));
  assert.equal(applyAgentWorkspaceConversationViewPatch(patched), patched);
});

test("approval renderer formats agent workspace params without affecting generic MCP params", () => {
  const patched = applyAgentWorkspaceApprovalRenderingPatch(syntheticComposerBundle());
  assert.match(patched, /codexLinuxAgentWorkspaceApprovalEntries/);
  assert.match(patched, /Hidden workspace acknowledged/);
  assert.match(patched, /let n=codexLinuxAgentWorkspaceApprovalEntries\(e\);return n\?\?t\?\?\(/);
  assert.equal(applyAgentWorkspaceApprovalRenderingPatch(patched), patched);
  const stalePatched = patched
    .replace("if(params.params&&typeof params.params==\"object\"&&!Array.isArray(params.params))params=params.params;\n", "")
    .replace(
      "let n=codexLinuxAgentWorkspaceApprovalEntries(e);return n??t??(",
      "return t??codexLinuxAgentWorkspaceApprovalEntries(e)??(",
    );
  assert.match(applyAgentWorkspaceApprovalRenderingPatch(stalePatched), /if\(params\.params&&typeof params\.params=="object"/);
  assert.match(
    applyAgentWorkspaceApprovalRenderingPatch(stalePatched),
    /let n=codexLinuxAgentWorkspaceApprovalEntries\(e\);return n\?\?t\?\?\(/,
  );

  const check = spawnSync(process.execPath, ["--check"], {
    encoding: "utf8",
    input: patched,
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  const sandbox = {};
  vm.runInNewContext(`${patched};this.render=sU;`, sandbox);

  const rows = sandbox.render(
    {
      id: "mcp-visible",
      profile: "dogfood-network-disabled",
      command: ["python3", "-c", "print(1)"],
      network: { mode: "local_only", allow_hosts: ["localhost:3000"] },
      dry_run: true,
      timeout_ms: 10000,
      kill_on_timeout: true,
      acknowledge_hidden_workspace: true,
    },
    null,
  );
  assert.deepEqual(
    Array.from(rows, (row) => row.displayName),
    [
      "Profile",
      "Workspace",
      "Command",
      "Network",
      "Preview only",
      "Timeout",
      "Kill on timeout",
      "Hidden workspace acknowledged",
    ],
  );
  assert.equal(rows.find((row) => row.displayName === "Command").value, 'python3 -c "print(1)"');
  assert.equal(rows.find((row) => row.displayName === "Network").value, "local_only (localhost:3000)");
  assert.equal(rows.find((row) => row.displayName === "Preview only").value, "Yes");

  const explicitDisplayRows = sandbox.render(
    {
      params: {
        action: "workspaceOpenProfile",
        profileId: "desktop-qa",
        runSetup: true,
        startupWaitWindow: true,
        ackHiddenWorkspace: true,
      },
    },
    [{ name: "params", displayName: "Params", value: { raw: "json" } }],
  );
  assert.deepEqual(
    Array.from(explicitDisplayRows, (row) => row.displayName),
    ["Action", "Profile", "Run setup", "Wait for startup window", "Hidden workspace acknowledged"],
  );
  assert.equal(explicitDisplayRows.find((row) => row.displayName === "Action").value, "workspaceOpenProfile");

  const approvalBundleRows = sandbox.render(
    {
      start_preview: {
        id: "approval-preview-ui",
        purpose: "Approval UI dogfood",
        message: "workspace start would require hidden-workspace acknowledgement",
        approval: {
          action: "workspace_start",
          subject: "workspace approval-preview-ui",
          approved: false,
          blocked: false,
          would_execute: false,
          requires_user_approval: true,
          required_acknowledgements: [
            {
              id: "hidden_workspace",
              label: "Hidden workspace",
              description: "User acknowledges that the agent will run in a separate workspace environment.",
              acknowledged: false,
              cli_flag: "--ack-hidden-workspace",
              mcp_parameter: { name: "acknowledge_hidden_workspace", value: true },
            },
          ],
          missing_acknowledgements: [
            {
              id: "hidden_workspace",
              label: "Hidden workspace",
              description: "User acknowledges that the agent will run in a separate workspace environment.",
              acknowledged: false,
              cli_flag: "--ack-hidden-workspace",
              mcp_parameter: { name: "acknowledge_hidden_workspace", value: true },
            },
          ],
          approve_cli_flags: ["--ack-hidden-workspace"],
          approve_mcp_parameters: [{ name: "acknowledge_hidden_workspace", value: true }],
        },
      },
    },
    [{ name: "params", displayName: "Params", value: { raw: "json" } }],
  );
  assert.equal(approvalBundleRows.find((row) => row.displayName === "Action").value, "workspace_start");
  assert.equal(
    approvalBundleRows.find((row) => row.displayName === "Workspace request").value,
    "workspace approval-preview-ui",
  );
  assert.equal(approvalBundleRows.find((row) => row.displayName === "Approval").value, "Needs approval");
  assert.equal(
    approvalBundleRows.find((row) => row.displayName === "Needs user approval").value,
    "Hidden workspace",
  );
  assert.equal(
    approvalBundleRows.find((row) => row.displayName === "Approve by setting").value,
    "acknowledge_hidden_workspace=true",
  );
  assert.equal(
    approvalBundleRows.find((row) => row.displayName === "Preview").value,
    "workspace start would require hidden-workspace acknowledgement",
  );
  assert.equal(approvalBundleRows.some((row) => row.displayName === "Params"), false);

  const genericRows = sandbox.render({ query: "abc" }, null);
  assert.deepEqual(
    Array.from(genericRows, (row) => ({ name: row.name, value: row.value, displayName: row.displayName })),
    [{ name: "query", value: "abc", displayName: "query" }],
  );
});

test("conversation visibility runtime renders and stops an active workspace", async () => {
  const document = createFakeDocument();
  const calls = [];
  const listeners = new Map();
  let stopFails = true;
  const activeStatus = {
    id: "qa-live",
    ready: true,
    display: ":90",
    purpose: "QA live view",
    profile_id: "desktop-qa",
    applied_policy: {
      profile_id: "desktop-qa",
      network: { mode: "disabled" },
      mounts: [{}, {}],
    },
    apps: [{ id: "app-1", name: "chrome", running: true }],
  };
  const window = {
    document,
    innerWidth: 1000,
    innerHeight: 700,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      listeners.set(type, callbacks.filter((candidate) => candidate !== callback));
    },
    dispatchEvent(event) {
      const payload = event.detail;
      if (payload?.type !== "fetch") return true;
      const params = JSON.parse(payload.body);
      calls.push(params);
      let response;
      if (params.action === "workspaceList") {
        response = { json: { workspaces: [{ id: "qa-live", running: true, status: activeStatus }] } };
      } else if (params.action === "workspaceObserve") {
        response = { json: { status: activeStatus, screenshot: { data_url: "data:image/png;base64,abc" } } };
      } else if (params.action === "workspaceStop") {
        if (stopFails) {
          response = { ok: false, message: "stop failed", json: { ok: false, message: "stop failed" } };
        } else {
          activeStatus.ready = false;
          response = { ok: true, json: { ok: true, status: activeStatus } };
        }
      } else if (params.action === "workspaceCleanup") {
        response = { ok: true, json: { ok: true, removed: [{ id: params.cleanupId }], skipped: [] } };
      } else {
        response = { json: { ok: false } };
      }
      setTimeout(() => {
        for (const callback of listeners.get("message") || []) {
          callback({
            data: {
              type: "fetch-response",
              requestId: payload.requestId,
              responseType: "success",
              status: 200,
              bodyJsonString: JSON.stringify(response),
            },
          });
        }
      }, 0);
      return true;
    },
  };
  const localStore = new Map();
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    clearTimeout,
    console,
    document,
    globalThis: null,
    localStorage: {
      getItem(key) {
        return localStore.get(key) || null;
      },
      setItem(key, value) {
        localStore.set(key, String(value));
      },
    },
    setInterval() {
      return 1;
    },
    setTimeout,
    window,
  });
  context.globalThis = context;

  appendStaleWorkspacePanel(document);
  appendStaleWorkspacePanel(document);
  assert.equal(document.body.querySelectorAll(".codex-linux-agent-workspace-panel").length, 2);

  vm.runInContext(agentWorkspaceConversationRuntimeSource(), context);
  await waitFor(
    () => document.body.querySelector(".codex-linux-agent-workspace-panel")?.hidden === false,
    "workspace panel should become visible",
  );

  const panel = document.body.querySelector(".codex-linux-agent-workspace-panel");
  assert.equal(document.body.querySelectorAll(".codex-linux-agent-workspace-panel").length, 1);
  const title = panel.querySelector(".codex-linux-agent-workspace-title");
  const meta = panel.querySelector(".codex-linux-agent-workspace-meta");
  const error = panel.querySelector(".codex-linux-agent-workspace-error");
  const image = panel.querySelector(".codex-linux-agent-workspace-shot");
  const resize = panel.querySelector(".codex-linux-agent-workspace-resize");
  const head = panel.querySelector(".codex-linux-agent-workspace-head");
  assert.ok(panel.querySelector("[data-action='revoke']"));
  assert.ok(resize);
  assert.ok(head);
  assert.equal(title.textContent, "QA live view");
  assert.match(meta.textContent, /Workspace active/);
  assert.doesNotMatch(meta.textContent, /:90/);
  assert.match(meta.textContent, /Profile desktop-qa/);
  assert.match(meta.textContent, /Network disabled/);
  assert.match(meta.textContent, /2 mounts/);
  assert.match(meta.textContent, /1 app running/);
  assert.match(meta.title, /Hidden display :90/);
  assert.match(meta.title, /1 app running/);
  assert.doesNotMatch(meta.title, /chrome/);
  assert.equal(image.src, "data:image/png;base64,abc");
  assert.equal(panel.style.width, "420px");
  assert.equal(panel.style.height, "320px");

  const initialLeft = Number.parseFloat(panel.style.left);
  const initialTop = Number.parseFloat(panel.style.top);
  head.listeners.get("pointerdown")[0]({
    button: 0,
    clientX: 100,
    clientY: 100,
    currentTarget: head,
    target: head,
    preventDefault() {},
  });
  for (const callback of listeners.get("pointermove") || []) callback({ clientX: 70, clientY: 75 });
  assert.equal(Number.parseFloat(panel.style.left), initialLeft - 30);
  assert.equal(Number.parseFloat(panel.style.top), initialTop - 25);
  for (const callback of listeners.get("pointerup") || []) callback({});
  assert.ok(localStore.get("codex-linux-agent-workspace-layout-v1"));

  const widthAfterDrag = Number.parseFloat(panel.style.width);
  const heightAfterDrag = Number.parseFloat(panel.style.height);
  resize.listeners.get("pointerdown")[0]({
    button: 0,
    clientX: 200,
    clientY: 200,
    currentTarget: resize,
    target: resize,
    preventDefault() {},
  });
  for (const callback of listeners.get("pointermove") || []) callback({ clientX: 260, clientY: 240 });
  assert.equal(Number.parseFloat(panel.style.width), widthAfterDrag + 60);
  assert.equal(Number.parseFloat(panel.style.height), heightAfterDrag + 40);
  for (const callback of listeners.get("pointerup") || []) callback({});

  panel.querySelector("[data-action='stop']").click();
  await waitFor(
    () => calls.some((call) => call.action === "workspaceStop" && call.workspaceId === "qa-live"),
    "stop action should be sent for active workspace",
  );
  await waitFor(() => error.hidden === false, "failed stop should show an error");
  assert.equal(panel.hidden, false);
  assert.equal(error.textContent, "stop failed");

  stopFails = false;
  panel.querySelector("[data-action='revoke']").click();
  await waitFor(
    () => calls.some((call) => call.action === "workspaceCleanup" && call.cleanupId === "qa-live"),
    "cleanup action should be sent for revoked workspace",
  );
  await waitFor(() => panel.hidden === true, "workspace panel should hide after revoke");
});

test("conversation visibility runtime hides on settings pages", async () => {
  const document = createFakeDocument();
  document.body.textContent = "Back to app\nApp\nGeneral\nAppearance\nConnections\nAgent Workspaces";
  const listeners = new Map();
  const activeStatus = { id: "qa-live", ready: true, display: ":90", purpose: "QA live view", apps: [] };
  const window = {
    document,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    dispatchEvent(event) {
      const payload = event.detail;
      if (payload?.type !== "fetch") return true;
      const params = JSON.parse(payload.body);
      const response =
        params.action === "workspaceList"
          ? { json: { workspaces: [{ id: "qa-live", running: true, status: activeStatus }] } }
          : { json: { status: activeStatus, screenshot: { data_url: "data:image/png;base64,abc" } } };
      setTimeout(() => {
        for (const callback of listeners.get("message") || []) {
          callback({
            data: {
              type: "fetch-response",
              requestId: payload.requestId,
              responseType: "success",
              status: 200,
              bodyJsonString: JSON.stringify(response),
            },
          });
        }
      }, 0);
      return true;
    },
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    clearTimeout,
    console,
    document,
    globalThis: null,
    setInterval() {
      return 1;
    },
    setTimeout,
    window,
  });
  context.globalThis = context;

  vm.runInContext(agentWorkspaceConversationRuntimeSource(), context);
  await waitFor(
    () => document.body.querySelector(".codex-linux-agent-workspace-panel")?.hidden === true,
    "workspace panel should stay hidden in settings",
  );
});

test("conversation visibility runtime hides immediately after settings navigation", async () => {
  const document = createFakeDocument();
  const listeners = new Map();
  const observers = [];
  const activeStatus = { id: "qa-live", ready: true, display: ":90", purpose: "QA live view", apps: [] };
  const window = {
    document,
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(callback);
      listeners.set(type, callbacks);
    },
    dispatchEvent(event) {
      const payload = event.detail;
      if (payload?.type !== "fetch") return true;
      const params = JSON.parse(payload.body);
      const response =
        params.action === "workspaceList"
          ? { json: { workspaces: [{ id: "qa-live", running: true, status: activeStatus }] } }
          : { json: { status: activeStatus, screenshot: { data_url: "data:image/png;base64,abc" } } };
      setTimeout(() => {
        for (const callback of listeners.get("message") || []) {
          callback({
            data: {
              type: "fetch-response",
              requestId: payload.requestId,
              responseType: "success",
              status: 200,
              bodyJsonString: JSON.stringify(response),
            },
          });
        }
      }, 0);
      return true;
    },
  };
  const context = vm.createContext({
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    MutationObserver: class MutationObserver {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe() {}
    },
    clearTimeout,
    console,
    document,
    globalThis: null,
    setInterval() {
      return 1;
    },
    setTimeout,
    window,
  });
  context.globalThis = context;

  vm.runInContext(agentWorkspaceConversationRuntimeSource(), context);
  await waitFor(
    () => document.body.querySelector(".codex-linux-agent-workspace-panel")?.hidden === false,
    "workspace panel should become visible before settings navigation",
  );
  const panel = document.body.querySelector(".codex-linux-agent-workspace-panel");

  document.body.textContent = "Back to app\nApp\nGeneral\nAppearance\nConnections\nAgent Workspaces";
  for (const observer of observers) observer.callback([]);

  await waitFor(() => panel.hidden === true, "workspace panel should hide after settings navigation");
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
        assert.match(
          fs.readFileSync(path.join(assetsDir, "local-conversation-thread-test.js"), "utf8"),
          new RegExp(CONVERSATION_RUNTIME_VERSION),
        );
        assert.match(fs.readFileSync(path.join(assetsDir, "composer-test.js"), "utf8"), /codexLinuxAgentWorkspaceApprovalEntries/);
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:main-bridge" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:settings-page" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:conversation-view" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:approval-rendering" && patch.status === "applied"));
      } finally {
        fs.rmSync(tempApp, { recursive: true, force: true });
      }
    });
  });
});

test("feature patch list is intentionally small", () => {
  assert.deepEqual(
    featurePatches.map((patch) => [patch.id, patch.phase]),
    [
      ["main-bridge", "main-bundle"],
      ["settings-page", "extracted-app"],
      ["conversation-view", "webview-asset"],
      ["approval-rendering", "webview-asset"],
    ],
  );
});
