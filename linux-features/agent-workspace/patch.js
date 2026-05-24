"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  findImportedAsset,
  findRequiredWebviewAsset,
  requireName,
} = require("../../scripts/patches/shared.js");

const SETTINGS_ASSET = "agent-workspaces-linux.js";
const SETTINGS_SLUG = "agent-workspaces";
const SETTINGS_COMMAND_KEY = "codex-linux-agent-workspace-command";

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

function agentWorkspaceBridgeSource({ childProcessVar, fsVar, pathVar }) {
  return `"linux-agent-workspace":async({action:__codexAction,timeoutMs:__codexTimeoutMs,profileId:__codexProfileId,profile:__codexProfile,replace:__codexReplace,dryRun:__codexDryRun,workspaceId:__codexWorkspaceId,purpose:__codexPurpose,runSetup:__codexRunSetup,ackHiddenWorkspace:__codexAckHiddenWorkspace,ackUnenforcedPolicy:__codexAckUnenforcedPolicy,startupWaitWindow:__codexStartupWaitWindow,startupScreenshotWindow:__codexStartupScreenshotWindow,cleanupId:__codexCleanupId,outputPath:__codexOutputPath}={})=>{let __codexCommand=this.globalState.get(\`${SETTINGS_COMMAND_KEY}\`)||process.env.CODEX_AGENT_WORKSPACE_BIN||\`agent-workspace-linux\`;if(typeof __codexCommand!==\`string\`||__codexCommand.trim().length===0)__codexCommand=\`agent-workspace-linux\`;__codexCommand=__codexCommand.trim();let __codexArgs=[],__codexTempPath=null,__codexString=e=>typeof e===\`string\`&&e.trim().length>0?e.trim():null,__codexPushId=(e,t)=>{let n=__codexString(t);if(n)__codexArgs.push(e,n)},__codexActionName=__codexString(__codexAction);try{switch(__codexActionName){case\`doctor\`:__codexArgs=[\`doctor\`];break;case\`guardrails\`:__codexArgs=[\`guardrails\`];break;case\`profilePath\`:__codexArgs=[\`profile\`,\`path\`];break;case\`profileList\`:__codexArgs=[\`profile\`,\`list\`];break;case\`profileGet\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`get\`,e];break}case\`profileCheck\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`check\`,e];break}case\`profileDelete\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`delete\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexArgs.push(e);break}case\`profileExport\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`export\`,e],__codexPushId(\`--output\`,__codexOutputPath),__codexReplace&&__codexArgs.push(\`--replace\`);break}case\`profileSave\`:{if(!__codexProfile||typeof __codexProfile!==\`object\`||Array.isArray(__codexProfile))throw Error(\`profile object is required\`);let e=process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||\`/tmp\`,t=${fsVar}.mkdtempSync(${pathVar}.join(e,\`codex-agent-workspace-\`));__codexTempPath=${pathVar}.join(t,\`profile.json\`),${fsVar}.writeFileSync(__codexTempPath,JSON.stringify(__codexProfile,null,2)+\`\\n\`,{encoding:\`utf8\`,mode:384}),__codexArgs=[\`profile\`,\`put\`,\`--json\`,__codexTempPath],__codexReplace&&__codexArgs.push(\`--replace\`),__codexDryRun&&__codexArgs.push(\`--dry-run\`);break}case\`workspaceList\`:__codexArgs=[\`workspace\`,\`list\`];break;case\`workspaceStatus\`:__codexArgs=[\`workspace\`,\`status\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceManifest\`:__codexArgs=[\`workspace\`,\`manifest\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceArtifacts\`:__codexArgs=[\`workspace\`,\`artifacts\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceOpenProfile\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`workspace\`,\`open-profile\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexAckHiddenWorkspace&&__codexArgs.push(\`--ack-hidden-workspace\`),__codexAckUnenforcedPolicy&&__codexArgs.push(\`--ack-unenforced-policy\`),__codexArgs.push(\`--profile\`,e),__codexPushId(\`--id\`,__codexWorkspaceId),__codexPushId(\`--purpose\`,__codexPurpose),__codexRunSetup&&__codexArgs.push(\`--setup\`),__codexStartupWaitWindow&&__codexArgs.push(\`--startup-wait-window\`),__codexStartupScreenshotWindow&&__codexArgs.push(\`--startup-screenshot-window\`);break}case\`workspaceStop\`:__codexArgs=[\`workspace\`,\`stop\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceCleanup\`:__codexArgs=[\`workspace\`,\`cleanup\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexPushId(\`--id\`,__codexCleanupId);break;default:throw Error(\`unsupported agent workspace action\`)}}catch(e){return{ok:!1,action:__codexActionName,message:e instanceof Error?e.message:String(e)}}let __codexParse=e=>{let t=String(e||\`\`).trim();if(t.length===0)return null;try{return JSON.parse(t)}catch{return{raw:t}}};try{let e=await new Promise((e,t)=>{let n=${childProcessVar}.execFile(__codexCommand,__codexArgs,{encoding:\`utf8\`,timeout:Number.isFinite(Number(__codexTimeoutMs))?Number(__codexTimeoutMs):15e3,maxBuffer:8388608},(n,r,i)=>{n?(n.stdout=r,n.stderr=i,t(n)):e({stdout:r,stderr:i})})});return{ok:!0,action:__codexActionName,command:__codexCommand,args:__codexArgs,stdout:e.stdout,stderr:e.stderr,json:__codexParse(e.stdout)}}catch(e){return{ok:!1,action:__codexActionName,command:__codexCommand,args:__codexArgs,message:e instanceof Error?e.message:String(e),code:e?.code??null,stdout:e?.stdout??\`\`,stderr:e?.stderr??\`\`,json:__codexParse(e?.stdout)}}finally{if(__codexTempPath)try{${fsVar}.rmSync(${pathVar}.dirname(__codexTempPath),{recursive:!0,force:!0})}catch{}}}`;
}

function applyAgentWorkspaceMainBridgePatch(currentSource) {
  const patchName = "agent workspace main bridge patch";
  if (currentSource.includes('"linux-agent-workspace":async')) {
    return currentSource;
  }

  const childProcessVar = requireName(currentSource, "node:child_process");
  const fsVar = requireName(currentSource, "node:fs");
  const pathVar = requireName(currentSource, "node:path");
  if (childProcessVar == null || fsVar == null || pathVar == null) {
    warn("Could not find Node module aliases", patchName);
    return currentSource;
  }

  const handlerNeedle = `"get-global-state":async({key:`;
  if (!currentSource.includes(handlerNeedle)) {
    warn("Could not find global-state handler insertion point", patchName);
    return currentSource;
  }

  return currentSource.replace(
    handlerNeedle,
    `${agentWorkspaceBridgeSource({ childProcessVar, fsVar, pathVar })},${handlerNeedle}`,
  );
}

function buildAgentWorkspaceSettingsSource({
  chunkAsset,
  reactAsset,
  reactExportName = "t",
  settingsPageAsset,
  settingsPageExportName = "t",
  vscodeApiAsset,
}) {
  return `import{s as __toESM}from"./${chunkAsset}";import{${reactExportName} as __reactFactory}from"./${reactAsset}";import{n as __post}from"./${vscodeApiAsset}";import{${settingsPageExportName} as SettingsPage}from"./${settingsPageAsset}";var React=__toESM(__reactFactory(),1),h=React.createElement,COMMAND_KEY=${JSON.stringify(SETTINGS_COMMAND_KEY)};function pretty(e){return JSON.stringify(e,null,2)}function parseProfile(e){try{let t=JSON.parse(e);return t&&typeof t=="object"&&!Array.isArray(t)?t:null}catch{return null}}function defaultProfile(){return{id:"desktop-qa",description:"Desktop QA environment",width:1280,height:800,cwd:"/workspace/project",mounts:[],network:{mode:"inherit_host"},require_enforced_policy:false,setup_commands:[],startup_apps:[]}}function button(e,t,n,r){return h("button",{type:"button",className:"rounded-md border border-token-border-default px-3 py-1.5 text-sm text-token-text-primary hover:bg-token-main-surface-secondary disabled:cursor-not-allowed disabled:opacity-50",disabled:n,onClick:r},e)}function field(e,t,n,r){return h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},h("span",null,e),h("input",{className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary outline-none",value:t,onChange:e=>n(e.target.value),placeholder:r||""}))}function resultView(e){if(!e)return null;let t=e.ok?"border-token-border-default":"border-token-error";return h("pre",{className:"max-h-[260px] overflow-auto rounded-md border "+t+" bg-token-main-surface-secondary p-3 text-xs text-token-text-secondary"},pretty(e.json??e))}function AgentWorkspacesSettings(){let[e,t]=React.useState(""),[n,r]=React.useState([]),[i,a]=React.useState([]),[o,s]=React.useState(""),[c,l]=React.useState(()=>pretty(defaultProfile())),[u,d]=React.useState(null),[f,p]=React.useState(null),[m,g]=React.useState(""),[_,v]=React.useState(!0),y=React.useCallback(async(e,t={})=>{p(e);try{let n=await __post("linux-agent-workspace",{params:{action:e,...t}});d(n);return n}catch(t){let n={ok:!1,action:e,message:t instanceof Error?t.message:String(t)};d(n);return n}finally{p(null)}},[]),b=React.useCallback(async()=>{let[e,t]=await Promise.all([y("profileList"),y("workspaceList")]);Array.isArray(e?.json?.profiles)&&r(e.json.profiles),Array.isArray(t?.json?.workspaces)&&a(t.json.workspaces)},[y]);React.useEffect(()=>{let e=!0;__post("get-global-state",{params:{key:COMMAND_KEY}}).then(n=>{e&&t(n?.value??"")}).catch(()=>{}),b().finally(()=>{e&&v(!1)});return()=>{e=!1}},[b]);let x=parseProfile(c),S=async()=>{await __post("set-global-state",{params:{key:COMMAND_KEY,value:e.trim()||void 0}}),await y("doctor")},C=e=>{s(e);e&&y("profileGet",{profileId:e}).then(e=>{let t=e?.json?.profile??e?.json;t&&l(pretty(t))})},w=e=>{let t=parseProfile(c)||defaultProfile();t.network={...(t.network||{}),mode:e},l(pretty(t))},T=e=>{let t=parseProfile(c)||defaultProfile();t.mounts=(t.mounts||[]).map(t=>({...t,mode:e})),l(pretty(t))},E=async e=>{if(!x){d({ok:!1,message:"Profile JSON is invalid"});return}let t=await y("profileSave",{profile:x,replace:e});t?.ok&&b()},D=()=>{x?.id&&(s(x.id),y("workspaceOpenProfile",{profileId:x.id,dryRun:!0,purpose:m||"Codex agent workspace",runSetup:!0,startupWaitWindow:!0}))},O=()=>{x?.id&&y("workspaceOpenProfile",{profileId:x.id,ackHiddenWorkspace:!0,ackUnenforcedPolicy:!0,purpose:m||"Codex agent workspace",runSetup:!0,startupWaitWindow:!0}).then(b)},k=e=>y("workspaceStop",{workspaceId:e}).then(b);return h(SettingsPage,{title:"Agent Workspaces",subtitle:"Linux agent environments"},h("div",{className:"flex max-w-5xl flex-col gap-5 p-1"},h("section",{className:"flex flex-col gap-3"},h("div",{className:"grid gap-3 md:grid-cols-[1fr_auto]"},field("Command",e,t,"agent-workspace-linux"),h("div",{className:"flex items-end gap-2"},button("Save",f==="doctor",f==="doctor",S),button("Refresh",f==="profileList"||_,_,b))),h("div",{className:"grid gap-3 md:grid-cols-3"},h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},h("span",null,"Profiles"),h("select",{className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary",value:o,onChange:e=>C(e.target.value)},h("option",{value:""},"New profile"),n.map(e=>h("option",{key:e.id,value:e.id},e.id)))),field("Purpose",m,g,"QA run"),h("div",{className:"flex items-end gap-2"},button("New",!1,!1,()=>{s("");l(pretty(defaultProfile()))}),button("Delete",!o,!o,()=>y("profileDelete",{profileId:o}).then(b))))),h("section",{className:"grid gap-3 md:grid-cols-[220px_220px_1fr]"},h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},h("span",null,"Network"),h("select",{className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary",value:x?.network?.mode||"inherit_host",onChange:e=>w(e.target.value)},["inherit_host","local_only","disabled","allowlist"].map(e=>h("option",{key:e,value:e},e)))),h("div",{className:"flex items-end gap-2"},button("Read only",!x,!x,()=>T("read_only")),button("Read write",!x,!x,()=>T("read_write"))),h("div",{className:"flex items-end justify-end gap-2"},button("Validate",!x,!x,()=>y("profileSave",{profile:x,dryRun:!0,replace:!0})),button("Save",!x,!x,()=>E(!1)),button("Overwrite",!x,!x,()=>E(!0))))),h("textarea",{className:"min-h-[280px] rounded-md border border-token-border-default bg-token-bg-primary p-3 font-mono text-xs text-token-text-primary outline-none",value:c,onChange:e=>l(e.target.value),spellCheck:!1}),h("section",{className:"flex flex-wrap gap-2"},button("Preview start",!x,!x,D),button("Start",!x,!x,O),button("Cleanup stale",!1,!1,()=>y("workspaceCleanup",{dryRun:!0}))),h("section",{className:"flex flex-col gap-2"},h("div",{className:"text-sm font-medium text-token-text-primary"},"Active"),i.length===0?h("div",{className:"text-sm text-token-text-tertiary"},"None"):i.map(e=>h("div",{key:e.id,className:"flex items-center justify-between rounded-md border border-token-border-default p-2 text-sm"},h("div",{className:"min-w-0"},h("div",{className:"truncate text-token-text-primary"},e.id),h("div",{className:"truncate text-token-text-tertiary"},e.profile_id||e.purpose||e.status||"workspace")),h("div",{className:"flex gap-2"},button("Status",!1,!1,()=>y("workspaceStatus",{workspaceId:e.id})),button("Stop",!1,!1,()=>k(e.id)))))),resultView(u))) }export{AgentWorkspacesSettings,AgentWorkspacesSettings as default};\n//# sourceMappingURL=${SETTINGS_ASSET}.map\n`;
}

function webviewAssetsDir(extractedDir) {
  return path.join(extractedDir, "webview", "assets");
}

function resolveAgentWorkspaceSettingsAsset(extractedDir) {
  const assetsDir = webviewAssetsDir(extractedDir);
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`missing webview assets directory ${assetsDir}`);
  }

  const jsxRuntimeAsset = findRequiredWebviewAsset(
    assetsDir,
    /^jsx-runtime-.*\.js$/,
    "react.transitional.element",
    "JSX runtime asset",
  );
  const jsxRuntimeSource = fs.readFileSync(path.join(assetsDir, jsxRuntimeAsset), "utf8");
  const jsxExportsReactFactory = /export\{[^}]*\bn\b/.test(jsxRuntimeSource);
  const reactAsset = jsxExportsReactFactory
    ? jsxRuntimeAsset
    : findRequiredWebviewAsset(assetsDir, /^react-.*\.js$/, "react.transitional.element", "React asset");
  const reactExportName = jsxExportsReactFactory ? "n" : "t";
  const chunkAsset = findImportedAsset(assetsDir, reactAsset, "React shared chunk asset");
  const vscodeApiAsset = findRequiredWebviewAsset(assetsDir, /^vscode-api-.*\.js$/, "vscode://codex", "VS Code API asset");
  const settingsPageAsset = findRequiredWebviewAsset(
    assetsDir,
    /^settings-content-layout-.*\.js$/,
    null,
    "settings content layout asset",
  );

  return {
    filePath: path.join(assetsDir, SETTINGS_ASSET),
    source: buildAgentWorkspaceSettingsSource({
      chunkAsset,
      reactAsset,
      reactExportName,
      settingsPageAsset,
      settingsPageExportName: "t",
      vscodeApiAsset,
    }),
  };
}

function patchRequiredAssets(extractedDir, filenamePattern, patchFn, description) {
  const assetsDir = webviewAssetsDir(extractedDir);
  const candidates = fs
    .readdirSync(assetsDir)
    .filter((name) => filenamePattern.test(name))
    .sort();
  if (candidates.length === 0) {
    throw new Error(`could not find ${description}`);
  }

  return candidates.map((candidate) => {
    const filePath = path.join(assetsDir, candidate);
    const currentSource = fs.readFileSync(filePath, "utf8");
    return {
      filePath,
      currentSource,
      patchedSource: patchFn(currentSource),
    };
  });
}

function applyAgentWorkspaceSettingsSectionsPatch(currentSource) {
  if (currentSource.includes(`slug:\`${SETTINGS_SLUG}\``)) {
    return currentSource;
  }

  const preferredNeedle = "{slug:`local-environments`},{slug:`worktrees`}";
  if (currentSource.includes(preferredNeedle)) {
    return currentSource.replace(
      preferredNeedle,
      `{slug:\`local-environments\`},{slug:\`${SETTINGS_SLUG}\`},{slug:\`worktrees\`}`,
    );
  }

  const fallbackNeedle = "n=[{slug:`general-settings`},";
  if (currentSource.includes(fallbackNeedle)) {
    return currentSource.replace(
      fallbackNeedle,
      `n=[{slug:\`general-settings\`},{slug:\`${SETTINGS_SLUG}\`},`,
    );
  }

  throw new Error("could not add agent workspace settings section");
}

function applyAgentWorkspaceSettingsSharedPatch(currentSource) {
  let patchedSource = currentSource;
  if (!patchedSource.includes(`settings.nav.${SETTINGS_SLUG}`)) {
    const navNeedle =
      '"local-environments":{id:`settings.nav.local-environments`,defaultMessage:`Environments`,description:`Title for environments settings section`},';
    if (!patchedSource.includes(navNeedle)) {
      throw new Error("could not add agent workspace nav label");
    }
    patchedSource = patchedSource.replace(
      navNeedle,
      `${navNeedle}"${SETTINGS_SLUG}":{id:\`settings.nav.${SETTINGS_SLUG}\`,defaultMessage:\`Agent Workspaces\`,description:\`Title for Agent Workspaces settings section\`},`,
    );
  }

  if (!patchedSource.includes(`settings.section.${SETTINGS_SLUG}`)) {
    const sectionNeedle = "case`worktrees`:{";
    if (!patchedSource.includes(sectionNeedle)) {
      throw new Error("could not add agent workspace section title");
    }
    const sectionRendererMatch = patchedSource.match(
      /case`worktrees`:\{[\s\S]*?\(0,([A-Za-z_$][\w$]*)\.jsx\)\(([A-Za-z_$][\w$]*),\{id:`settings\.section\.worktrees`/,
    );
    const jsxAlias = sectionRendererMatch?.[1] ?? "d";
    const messageComponent = sectionRendererMatch?.[2] ?? "n";
    patchedSource = patchedSource.replace(
      sectionNeedle,
      `case\`${SETTINGS_SLUG}\`:{return (0,${jsxAlias}.jsx)(${messageComponent},{id:\`settings.section.${SETTINGS_SLUG}\`,defaultMessage:\`Agent Workspaces\`,description:\`Title for Agent Workspaces settings section\`})}${sectionNeedle}`,
    );
  }
  return patchedSource;
}

function applyAgentWorkspaceSettingsIndexPatch(currentSource) {
  let patchedSource = currentSource;

  if (!patchedSource.includes(SETTINGS_ASSET)) {
    const routePattern = /"general-settings":(?=\(0,([A-Za-z_$][\w$]*)\.lazy\)\(\(\)=>([A-Za-z_$][\w$]*)\()/;
    if (!routePattern.test(patchedSource)) {
      throw new Error("could not add agent workspace settings route");
    }
    patchedSource = patchedSource.replace(
      routePattern,
      (_match, lazyAlias, preloadAlias) =>
        `"${SETTINGS_SLUG}":(0,${lazyAlias}.lazy)(()=>${preloadAlias}(()=>import(\`./${SETTINGS_ASSET}\`),[],import.meta.url)),"general-settings":`,
    );
  }

  const iconPattern = /([,{])"general-settings":([A-Za-z_$][\w$]*),/;
  if (
    !new RegExp(`[,{]"${SETTINGS_SLUG}":[A-Za-z_$][\\w$]*,"general-settings":`).test(patchedSource) &&
    iconPattern.test(patchedSource)
  ) {
    patchedSource = patchedSource.replace(
      iconPattern,
      (_match, prefix, icon) => `${prefix}"${SETTINGS_SLUG}":${icon},"general-settings":${icon},`,
    );
  }

  const hasLegacyVisibilityGate =
    patchedSource.includes("case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:") ||
    patchedSource.includes("case`local-environments`:case`worktrees`:case`environments`:");
  patchedSource = patchedSource.replaceAll(
    "`local-environments`,`worktrees`",
    "`local-environments`,`agent-workspaces`,`worktrees`",
  );
  if (!patchedSource.includes("case`local-environments`:case`agent-workspaces`:case`data-controls`:case`environments`:return")) {
    patchedSource = patchedSource.replace(
      "case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:",
      "case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:case`agent-workspaces`:",
    );
  }
  if (!patchedSource.includes("case`local-environments`:case`agent-workspaces`:case`worktrees`:case`environments`:")) {
    patchedSource = patchedSource.replace(
      "case`local-environments`:case`worktrees`:case`environments`:",
      "case`local-environments`:case`agent-workspaces`:case`worktrees`:case`environments`:",
    );
  }

  if (hasLegacyVisibilityGate && !patchedSource.includes(`case\`${SETTINGS_SLUG}\``)) {
    throw new Error("could not add agent workspace settings visibility");
  }

  return patchedSource;
}

function patchAgentWorkspaceRouteAssets(extractedDir) {
  const assetsDir = webviewAssetsDir(extractedDir);
  const candidates = fs
    .readdirSync(assetsDir)
    .filter((name) => /^(app-main|index)-.*\.js$/.test(name))
    .sort();
  let lastError = null;
  const patches = [];

  for (const candidate of candidates) {
    const filePath = path.join(assetsDir, candidate);
    const currentSource = fs.readFileSync(filePath, "utf8");
    if (!currentSource.includes(SETTINGS_ASSET) && !currentSource.includes('"general-settings":(0,')) {
      continue;
    }

    try {
      patches.push({
        filePath,
        currentSource,
        patchedSource: applyAgentWorkspaceSettingsIndexPatch(currentSource),
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (patches.length === 0) {
    throw lastError ?? new Error("could not find webview settings route bundle");
  }

  return patches;
}

function patchAgentWorkspaceSettingsAssets(extractedDir) {
  try {
    const settingsAsset = resolveAgentWorkspaceSettingsAsset(extractedDir);
    const previousSettingsSource = fs.existsSync(settingsAsset.filePath)
      ? fs.readFileSync(settingsAsset.filePath, "utf8")
      : null;
    const patches = [
      ...patchRequiredAssets(
        extractedDir,
        /^settings-sections-.*\.js$/,
        applyAgentWorkspaceSettingsSectionsPatch,
        "settings sections bundle",
      ),
      ...patchRequiredAssets(
        extractedDir,
        /^settings-shared-.*\.js$/,
        applyAgentWorkspaceSettingsSharedPatch,
        "settings shared bundle",
      ),
      ...patchAgentWorkspaceRouteAssets(extractedDir),
    ];

    fs.writeFileSync(settingsAsset.filePath, settingsAsset.source, "utf8");
    let changed = previousSettingsSource !== settingsAsset.source ? 1 : 0;
    for (const patch of patches) {
      if (patch.patchedSource !== patch.currentSource) {
        fs.writeFileSync(patch.filePath, patch.patchedSource, "utf8");
        changed += 1;
      }
    }
    return { matched: true, changed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN: Agent Workspaces settings patch skipped: ${message}`);
    return { matched: false, changed: 0, reason: message };
  }
}

module.exports = {
  patches: [
    {
      id: "main-bridge",
      phase: "main-bundle",
      order: 20_800,
      ciPolicy: "optional",
      apply: applyAgentWorkspaceMainBridgePatch,
    },
    {
      id: "settings-page",
      phase: "extracted-app",
      order: 20_810,
      ciPolicy: "optional",
      apply: (extractedDir) => patchAgentWorkspaceSettingsAssets(extractedDir),
      status: (result, warnings) => {
        if (result?.matched === false) {
          return { status: "skipped-optional", reason: result.reason ?? warnings[0] ?? null };
        }
        if ((result?.changed ?? 0) > 0) {
          return "applied";
        }
        return "already-applied";
      },
    },
  ],
  SETTINGS_ASSET,
  SETTINGS_COMMAND_KEY,
  SETTINGS_SLUG,
  applyAgentWorkspaceMainBridgePatch,
  applyAgentWorkspaceSettingsIndexPatch,
  applyAgentWorkspaceSettingsSectionsPatch,
  applyAgentWorkspaceSettingsSharedPatch,
  buildAgentWorkspaceSettingsSource,
  patchAgentWorkspaceSettingsAssets,
};
