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
  return `import{s as __toESM}from"./${chunkAsset}";
import{${reactExportName} as __reactFactory}from"./${reactAsset}";
import{n as __post}from"./${vscodeApiAsset}";
import{${settingsPageExportName} as SettingsPage}from"./${settingsPageAsset}";

var React=__toESM(__reactFactory(),1);
var h=React.createElement;
var COMMAND_KEY=${JSON.stringify(SETTINGS_COMMAND_KEY)};

function pretty(value){
  return JSON.stringify(value,null,2);
}

function parseProfile(value){
  try{
    var parsed=JSON.parse(value);
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;
  }catch{
    return null;
  }
}

function defaultProfile(){
  return {
    id:"desktop-qa",
    description:"Desktop QA environment",
    width:1280,
    height:800,
    cwd:"/workspace/project",
    mounts:[],
    network:{mode:"inherit_host"},
    require_enforced_policy:false,
    setup_commands:[],
    startup_apps:[]
  };
}

function button(label,disabled,onClick){
  return h("button",{
    type:"button",
    className:"rounded-md border border-token-border-default px-3 py-1.5 text-sm text-token-text-primary hover:bg-token-main-surface-secondary disabled:cursor-not-allowed disabled:opacity-50",
    disabled:!!disabled,
    onClick
  },label);
}

function field(label,value,onChange,placeholder){
  return h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},
    h("span",null,label),
    h("input",{
      className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary outline-none",
      value,
      onChange:function(event){onChange(event.target.value);},
      placeholder:placeholder||""
    })
  );
}

function resultView(result){
  if(!result)return null;
  var border=result.ok?"border-token-border-default":"border-token-error";
  return h("details",{
    className:"rounded-md border "+border+" bg-token-main-surface-secondary text-sm text-token-text-secondary"
  },
    h("summary",{className:"flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-token-text-primary"},
      h("span",null,result.ok===false?"Error":"Result"),
      h("span",{className:"truncate text-xs text-token-text-tertiary"},resultSummary(result))
    ),
    h("pre",{className:"max-h-[260px] overflow-auto border-t border-token-border-default p-3 text-xs text-token-text-secondary"},pretty(result.json??result))
  );
}

function workspaceId(workspace){
  return workspace?.id||workspace?.status?.id||workspace?.manifest?.id||workspace?.runtime_dir||"workspace";
}

function workspaceRunning(workspace){
  return workspace?.running===true||workspace?.status?.ready===true;
}

function workspaceSummary(workspace){
  var status=workspace?.status;
  if(typeof workspace?.profile_id==="string"&&workspace.profile_id)return workspace.profile_id;
  if(typeof workspace?.purpose==="string"&&workspace.purpose)return workspace.purpose;
  if(status&&typeof status==="object"){
    if(typeof status.profile_id==="string"&&status.profile_id)return status.profile_id;
    if(typeof status.purpose==="string"&&status.purpose)return status.purpose;
    if(typeof status.id==="string"&&status.id)return status.id;
    return status.ready?"ready":"workspace";
  }
  if(typeof status==="string"&&status)return status;
  return workspace?.running?"running":"workspace";
}

function workspacePrimary(workspace){
  var summary=workspaceSummary(workspace);
  return summary&&summary!=="workspace"?summary:workspaceId(workspace);
}

function workspaceSecondary(workspace){
  var id=workspaceId(workspace);
  var primary=workspacePrimary(workspace);
  return id&&id!==primary?id:null;
}

function workspaceDisplay(workspace){
  var display=workspace?.status?.display||workspace?.manifest?.display||workspace?.display||null;
  if(!display)return null;
  if(display===workspacePrimary(workspace)||display===workspaceId(workspace))return null;
  return display;
}

function profileId(profile){
  return profile?.id||profile?.profile_id||"profile";
}

function profileSummary(profile){
  return profile?.description||profile?.cwd||profile?.network?.mode||"Saved profile";
}

function profileNetwork(profile){
  return profile?.network?.mode||"inherit_host";
}

function resultSummary(result){
  if(result.ok===false)return result.message||result.stderr||"Command failed";
  if(Array.isArray(result.json?.workspaces)){
    var running=result.json.workspaces.filter(workspaceRunning).length;
    return "Workspace list: "+running+" active, "+(result.json.workspaces.length-running)+" stopped";
  }
  if(Array.isArray(result.json?.profiles))return "Profile list: "+result.json.profiles.length+" saved";
  if(result.action)return result.action+" complete";
  return "Command complete";
}

function statusPill(label,tone){
  var toneClass=tone==="active"?"border-green-500/40 text-green-700 dark:text-green-300":tone==="warn"?"border-yellow-500/40 text-yellow-700 dark:text-yellow-300":"border-token-border-default text-token-text-tertiary";
  return h("span",{className:"inline-flex h-6 items-center rounded-md border px-2 text-xs "+toneClass},label);
}

function AgentWorkspacesSettings(){
  var commandState=React.useState("");
  var command=commandState[0];
  var setCommand=commandState[1];
  var profileState=React.useState([]);
  var profiles=profileState[0];
  var setProfiles=profileState[1];
  var workspaceState=React.useState([]);
  var workspaces=workspaceState[0];
  var setWorkspaces=workspaceState[1];
  var selectedState=React.useState("");
  var selectedProfileId=selectedState[0];
  var setSelectedProfileId=selectedState[1];
  var profileJsonState=React.useState(function(){return pretty(defaultProfile());});
  var profileJson=profileJsonState[0];
  var setProfileJson=profileJsonState[1];
  var resultState=React.useState(null);
  var result=resultState[0];
  var setResult=resultState[1];
  var actionState=React.useState(null);
  var activeAction=actionState[0];
  var setActiveAction=actionState[1];
  var purposeState=React.useState("");
  var purpose=purposeState[0];
  var setPurpose=purposeState[1];
  var loadingState=React.useState(true);
  var loading=loadingState[0];
  var setLoading=loadingState[1];

  var callAgentWorkspace=React.useCallback(async function(action,params){
    setActiveAction(action);
    try{
      var response=await __post("linux-agent-workspace",{params:{action:action,...(params||{})}});
      setResult(response);
      return response;
    }catch(error){
      var response={ok:false,action:action,message:error instanceof Error?error.message:String(error)};
      setResult(response);
      return response;
    }finally{
      setActiveAction(null);
    }
  },[]);

  var refresh=React.useCallback(async function(){
    var responses=await Promise.all([
      callAgentWorkspace("profileList"),
      callAgentWorkspace("workspaceList")
    ]);
    if(Array.isArray(responses[0]?.json?.profiles))setProfiles(responses[0].json.profiles);
    if(Array.isArray(responses[1]?.json?.workspaces))setWorkspaces(responses[1].json.workspaces);
  },[callAgentWorkspace]);

  React.useEffect(function(){
    var alive=true;
    __post("get-global-state",{params:{key:COMMAND_KEY}})
      .then(function(response){if(alive)setCommand(response?.value??"");})
      .catch(function(){});
    refresh().finally(function(){if(alive)setLoading(false);});
    return function(){alive=false;};
  },[refresh]);

  var profile=parseProfile(profileJson);
  var runningWorkspaces=workspaces.filter(workspaceRunning);
  var activeWorkspace=runningWorkspaces[0]??null;
  var otherRunningWorkspaces=activeWorkspace?runningWorkspaces.slice(1):[];
  var stoppedWorkspaceCount=Math.max(0,workspaces.length-runningWorkspaces.length);
  var startDisabled=!profile||!!activeWorkspace||activeAction==="workspaceOpenProfile";

  async function saveCommand(){
    await __post("set-global-state",{params:{key:COMMAND_KEY,value:command.trim()||void 0}});
    await callAgentWorkspace("doctor");
  }

  function selectProfile(profileId){
    setSelectedProfileId(profileId);
    if(!profileId)return;
    callAgentWorkspace("profileGet",{profileId:profileId}).then(function(response){
      var loaded=response?.json?.profile??response?.json;
      if(loaded)setProfileJson(pretty(loaded));
    });
  }

  function setNetworkMode(mode){
    var next=parseProfile(profileJson)||defaultProfile();
    next.network={...(next.network||{}),mode:mode};
    setProfileJson(pretty(next));
  }

  function setMountMode(mode){
    var next=parseProfile(profileJson)||defaultProfile();
    next.mounts=(next.mounts||[]).map(function(mount){return {...mount,mode:mode};});
    setProfileJson(pretty(next));
  }

  async function saveProfile(replace){
    if(!profile){
      setResult({ok:false,message:"Profile JSON is invalid"});
      return;
    }
    var response=await callAgentWorkspace("profileSave",{profile:profile,replace:replace});
    if(response?.ok)refresh();
  }

  function previewStart(){
    if(!profile?.id)return;
    setSelectedProfileId(profile.id);
    callAgentWorkspace("workspaceOpenProfile",{
      profileId:profile.id,
      dryRun:true,
      purpose:purpose||"Codex agent workspace",
      runSetup:true,
      startupWaitWindow:true
    });
  }

  function startWorkspace(){
    if(!profile?.id||activeWorkspace)return;
    callAgentWorkspace("workspaceOpenProfile",{
      profileId:profile.id,
      ackHiddenWorkspace:true,
      ackUnenforcedPolicy:true,
      purpose:purpose||"Codex agent workspace",
      runSetup:true,
      startupWaitWindow:true
    }).then(refresh);
  }

  function stopWorkspace(workspaceId){
    callAgentWorkspace("workspaceStop",{workspaceId:workspaceId}).then(refresh);
  }

  return h(SettingsPage,{title:"Agent Workspaces",subtitle:"Linux agent environments"},
    h("div",{className:"flex max-w-5xl flex-col gap-5 p-1"},
      h("section",{className:"grid gap-3 md:grid-cols-[1fr_auto]"},
        field("Command",command,setCommand,"agent-workspace-linux"),
        h("div",{className:"flex items-end gap-2"},
          button("Save",activeAction==="doctor",saveCommand),
          button("Refresh",activeAction==="profileList"||loading,refresh)
        )
      ),

      h("section",{className:"flex flex-col gap-2"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Active workspace"),
          activeWorkspace?statusPill("Active","active"):statusPill("Idle","idle")
        ),
        activeWorkspace
          ? h("div",{className:"flex items-center justify-between gap-3 rounded-md border border-token-border-default p-3 text-sm"},
              h("div",{className:"min-w-0"},
                h("div",{className:"truncate text-token-text-primary"},workspacePrimary(activeWorkspace)),
                workspaceSecondary(activeWorkspace)?h("div",{className:"truncate text-token-text-tertiary"},workspaceSecondary(activeWorkspace)):null,
                workspaceDisplay(activeWorkspace)?h("div",{className:"mt-1 text-xs text-token-text-tertiary"},workspaceDisplay(activeWorkspace)):null
              ),
              h("div",{className:"flex shrink-0 gap-2"},
                button("Status",false,function(){callAgentWorkspace("workspaceStatus",{workspaceId:workspaceId(activeWorkspace)});}),
                button("Stop",false,function(){stopWorkspace(workspaceId(activeWorkspace));})
              )
            )
          : h("div",{className:"rounded-md border border-dashed border-token-border-default p-3 text-sm text-token-text-tertiary"},"No active workspace"),
        otherRunningWorkspaces.length>0
          ? h("details",{className:"rounded-md border border-yellow-500/30 bg-token-main-surface-secondary text-sm"},
              h("summary",{className:"cursor-pointer px-3 py-2 text-token-text-primary"},"Other running workspaces ("+otherRunningWorkspaces.length+")"),
              h("div",{className:"flex flex-col gap-2 border-t border-token-border-default p-2"},
                otherRunningWorkspaces.map(function(workspace){
                  var id=workspaceId(workspace);
                  return h("div",{key:id,className:"flex items-center justify-between gap-2 rounded-md border border-token-border-default p-2"},
                    h("div",{className:"min-w-0"},
                      h("div",{className:"truncate text-token-text-primary"},workspacePrimary(workspace)),
                      workspaceSecondary(workspace)?h("div",{className:"truncate text-token-text-tertiary"},workspaceSecondary(workspace)):null
                    ),
                    button("Stop",false,function(){stopWorkspace(id);})
                  );
                })
              )
            )
          : null,
        stoppedWorkspaceCount>0
          ? h("div",{className:"flex items-center justify-between rounded-md border border-token-border-default px-3 py-2 text-sm text-token-text-tertiary"},
              h("span",null,"Stopped workspaces: "+stoppedWorkspaceCount),
              button("Cleanup stale",activeAction==="workspaceCleanup",function(){callAgentWorkspace("workspaceCleanup",{dryRun:true});})
            )
          : null
      ),

      h("section",{className:"flex flex-col gap-3"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Saved profiles"),
          h("div",{className:"flex gap-2"},
            button("New",false,function(){setSelectedProfileId("");setProfileJson(pretty(defaultProfile()));}),
            button("Delete",!selectedProfileId,function(){callAgentWorkspace("profileDelete",{profileId:selectedProfileId}).then(refresh);})
          )
        ),
        profiles.length===0
          ? h("div",{className:"rounded-md border border-dashed border-token-border-default p-3 text-sm text-token-text-tertiary"},"No saved profiles")
          : h("div",{className:"grid gap-2 md:grid-cols-2"},
              profiles.map(function(savedProfile){
                var id=profileId(savedProfile);
                var selected=id===selectedProfileId;
                return h("button",{
                  key:id,
                  type:"button",
                  className:"rounded-md border p-3 text-left text-sm hover:bg-token-main-surface-secondary "+(selected?"border-token-border-strong bg-token-main-surface-secondary":"border-token-border-default"),
                  onClick:function(){selectProfile(id);}
                },
                  h("div",{className:"flex items-center justify-between gap-2"},
                    h("span",{className:"truncate font-medium text-token-text-primary"},id),
                    statusPill(profileNetwork(savedProfile),"idle")
                  ),
                  h("div",{className:"mt-1 truncate text-token-text-tertiary"},profileSummary(savedProfile))
                );
              })
            )
      ),

      h("section",{className:"flex flex-col gap-3"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Profile editor"),
          statusPill(selectedProfileId||"New","idle")
        ),
        h("div",{className:"grid gap-3 md:grid-cols-[1fr_220px]"},
          field("Purpose",purpose,setPurpose,"QA run"),
          h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},
            h("span",null,"Network"),
            h("select",{
              className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary",
              value:profile?.network?.mode||"inherit_host",
              onChange:function(event){setNetworkMode(event.target.value);}
            },
              ["inherit_host","local_only","disabled","allowlist"].map(function(mode){
                return h("option",{key:mode,value:mode},mode);
              })
            )
          )
        ),
        h("div",{className:"flex flex-wrap items-center justify-between gap-2"},
          h("div",{className:"flex flex-wrap gap-2"},
            button("Read only",!profile,function(){setMountMode("read_only");}),
            button("Read write",!profile,function(){setMountMode("read_write");})
          ),
          h("div",{className:"flex flex-wrap gap-2"},
            button("Validate",!profile,function(){callAgentWorkspace("profileSave",{profile:profile,dryRun:true,replace:true});}),
            button("Save",!profile,function(){saveProfile(false);}),
            button("Overwrite",!profile,function(){saveProfile(true);})
          )
        ),
        h("textarea",{
          className:"min-h-[220px] rounded-md border border-token-border-default bg-token-bg-primary p-3 font-mono text-xs text-token-text-primary outline-none",
          value:profileJson,
          onChange:function(event){setProfileJson(event.target.value);},
          spellCheck:false
        }),
        h("div",{className:"flex flex-wrap gap-2"},
          button("Preview start",!profile,previewStart),
          button("Start",startDisabled,startWorkspace)
        )
      ),

      resultView(result)
    )
  );
}

export{AgentWorkspacesSettings,AgentWorkspacesSettings as default};
//# sourceMappingURL=${SETTINGS_ASSET}.map
`;
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

function applyAgentWorkspaceSettingsPagePatch(currentSource) {
  let patchedSource = currentSource;

  if (
    !new RegExp(`[,{]"${SETTINGS_SLUG}":[A-Za-z_$][\\w$]*,worktrees`).test(patchedSource) &&
    /"local-environments":([A-Za-z_$][\w$]*),worktrees:/.test(patchedSource)
  ) {
    patchedSource = patchedSource.replace(
      /"local-environments":([A-Za-z_$][\w$]*),worktrees:/,
      `"local-environments":$1,"${SETTINGS_SLUG}":$1,worktrees:`,
    );
  }

  patchedSource = patchedSource.replaceAll(
    "`local-environments`,`worktrees`",
    "`local-environments`,`agent-workspaces`,`worktrees`",
  );

  if (!patchedSource.includes("case`local-environments`:case`agent-workspaces`:case`environments`:return")) {
    patchedSource = patchedSource.replace(
      "case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:case`environments`:return",
      "case`appearance`:case`git-settings`:case`worktrees`:case`local-environments`:case`agent-workspaces`:case`environments`:return",
    );
  }

  if (!patchedSource.includes("case`local-environments`:case`agent-workspaces`:case`worktrees`:case`environments`:")) {
    patchedSource = patchedSource.replace(
      "case`local-environments`:case`worktrees`:case`environments`:",
      "case`local-environments`:case`agent-workspaces`:case`worktrees`:case`environments`:",
    );
  }

  if (!patchedSource.includes(`\`${SETTINGS_SLUG}\``)) {
    throw new Error("could not add agent workspace settings navigation");
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
      ...patchRequiredAssets(
        extractedDir,
        /^settings-page-.*\.js$/,
        applyAgentWorkspaceSettingsPagePatch,
        "settings page bundle",
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
  applyAgentWorkspaceSettingsPagePatch,
  applyAgentWorkspaceSettingsSectionsPatch,
  applyAgentWorkspaceSettingsSharedPatch,
  buildAgentWorkspaceSettingsSource,
  patchAgentWorkspaceSettingsAssets,
};
