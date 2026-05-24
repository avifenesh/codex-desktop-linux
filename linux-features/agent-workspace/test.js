#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
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
  fs.writeFileSync(path.join(assetsDir, "chunk-test.js"), "export function s(e){return e}");
  fs.writeFileSync(path.join(assetsDir, "react-test.js"), 'import{s}from"./chunk-test.js";/* react.transitional.element */export{ReactFactory as t};function ReactFactory(){return{createElement(){return{}},useState(){return[null,()=>{}]},useCallback(e){return e},useEffect(){}}}');
  fs.writeFileSync(path.join(assetsDir, "jsx-runtime-test.js"), "/* react.transitional.element */export{j as t};function j(){return{jsx(){},jsxs(){}}}");
  fs.writeFileSync(path.join(assetsDir, "vscode-api-test.js"), "/* vscode://codex */export async function n(){return{}}");
  fs.writeFileSync(path.join(assetsDir, "settings-content-layout-test.js"), "export function t(){}");
  fs.writeFileSync(path.join(assetsDir, "app-test.png"), "");
  return { buildDir, assetsDir };
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
      ],
    );
  });
});

test("main bridge patch adds an allowlisted linux-agent-workspace handler", () => {
  const patched = applyAgentWorkspaceMainBridgePatch(syntheticMainBundle());
  assert.match(patched, /"linux-agent-workspace":async/);
  assert.match(patched, /"linux-agent-workspace-pick-app":async/);
  assert.match(patched, /"linux-agent-workspace-pick-mount":async/);
  assert.match(patched, /showOpenDialog/);
  assert.match(patched, new RegExp(SETTINGS_COMMAND_KEY));
  assert.match(patched, /\.local`\,`bin`\,`agent-workspace-linux`/);
  assert.match(patched, /CODEX_AGENT_WORKSPACE_BIN/);
  assert.match(patched, /startsWith\(`~\/`\)/);
  assert.match(patched, /case`workspaceOpenProfile`/);
  assert.match(patched, /case`workspaceStart`/);
  assert.match(patched, /case`workspaceObserve`/);
  assert.match(patched, /--include-hidden/);
  assert.match(patched, /data:image\/png;base64/);
  assert.match(patched, /execFile\(__codexCommand,__codexArgs/);
  assert.equal(applyAgentWorkspaceMainBridgePatch(patched), patched);

  const { value, warnings } = captureWarns(() => applyAgentWorkspaceMainBridgePatch("real bundle"));
  assert.equal(value, "real bundle");
  assert.match(warnings.join("\n"), /Could not find Node module aliases/);
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
  assert.match(source, /function profileAllowHosts/);
  assert.match(source, /function addNetworkHost/);
  assert.match(source, /function removeNetworkHost/);
  assert.match(source, /allow_hosts/);
  assert.match(source, /Allowed hosts/);
  assert.match(source, /Loopback hosts/);
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
  assert.match(source, /Edit saved/);
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
  assert.match(runtime, /codex-linux-agent-workspace-panel/);
  assert.match(runtime, /data_url/);
  assert.match(runtime, /function policySummary/);
  assert.match(runtime, /function appSummary/);
  assert.match(runtime, /profile /);
  assert.match(runtime, /network /);
  assert.match(runtime, /mount/);

  const patched = applyAgentWorkspaceConversationViewPatch("let thread=1;");
  assert.match(patched, new RegExp(CONVERSATION_RUNTIME_VERSION));
  assert.equal(applyAgentWorkspaceConversationViewPatch(patched), patched);
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
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:main-bridge" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:settings-page" && patch.status === "applied"));
        assert.ok(report.patches.some((patch) => patch.name === "feature:agent-workspace:conversation-view" && patch.status === "applied"));
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
    ],
  );
});
