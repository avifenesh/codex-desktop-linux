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
  return `"linux-agent-workspace-pick-app":async()=>{let __codexElectron;try{__codexElectron=require(\`electron\`)}catch(e){return{ok:!1,action:\`pickStartupApp\`,message:\`file picker unavailable\`}}try{let e=await __codexElectron.dialog.showOpenDialog({title:\`Choose startup app\`,properties:[\`openFile\`]});let t=Array.isArray(e.filePaths)?e.filePaths:[];return{ok:!e.canceled&&t.length>0,action:\`pickStartupApp\`,json:{canceled:!!e.canceled,path:t[0]||null,paths:t}}}catch(e){return{ok:!1,action:\`pickStartupApp\`,message:e instanceof Error?e.message:String(e)}}},"linux-agent-workspace":async({action:__codexAction,timeoutMs:__codexTimeoutMs,profileId:__codexProfileId,profile:__codexProfile,replace:__codexReplace,dryRun:__codexDryRun,workspaceId:__codexWorkspaceId,purpose:__codexPurpose,runSetup:__codexRunSetup,ackHiddenWorkspace:__codexAckHiddenWorkspace,ackUnenforcedPolicy:__codexAckUnenforcedPolicy,startupWaitWindow:__codexStartupWaitWindow,startupScreenshotWindow:__codexStartupScreenshotWindow,cleanupId:__codexCleanupId,outputPath:__codexOutputPath}={})=>{let __codexHome=()=>typeof process.env.HOME===\`string\`&&process.env.HOME.trim().length>0?process.env.HOME.trim():null,__codexExpandCommand=e=>{if(typeof e!==\`string\`)return e;let t=e.trim(),n=__codexHome();return t.startsWith(\`~/\`)&&n?${pathVar}.join(n,t.slice(2)):t},__codexDefaultCommand=()=>{let e=process.env.CODEX_AGENT_WORKSPACE_BIN;if(typeof e===\`string\`&&e.trim().length>0)return __codexExpandCommand(e);let t=__codexHome();return t?${pathVar}.join(t,\`.local\`,\`bin\`,\`agent-workspace-linux\`):\`agent-workspace-linux\`},__codexCommand=this.globalState.get(\`${SETTINGS_COMMAND_KEY}\`)||__codexDefaultCommand();if(typeof __codexCommand!==\`string\`||__codexCommand.trim().length===0)__codexCommand=__codexDefaultCommand();__codexCommand=__codexExpandCommand(__codexCommand);let __codexArgs=[],__codexTempPath=null,__codexString=e=>typeof e===\`string\`&&e.trim().length>0?e.trim():null,__codexPushId=(e,t)=>{let n=__codexString(t);if(n)__codexArgs.push(e,n)},__codexActionName=__codexString(__codexAction);try{switch(__codexActionName){case\`doctor\`:__codexArgs=[\`doctor\`];break;case\`guardrails\`:__codexArgs=[\`guardrails\`];break;case\`profilePath\`:__codexArgs=[\`profile\`,\`path\`];break;case\`profileList\`:__codexArgs=[\`profile\`,\`list\`];break;case\`profileGet\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`get\`,e];break}case\`profileCheck\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`check\`,e];break}case\`profileDelete\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`delete\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexArgs.push(e);break}case\`profileExport\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`export\`,e],__codexPushId(\`--output\`,__codexOutputPath),__codexReplace&&__codexArgs.push(\`--replace\`);break}case\`profileSave\`:{if(!__codexProfile||typeof __codexProfile!==\`object\`||Array.isArray(__codexProfile))throw Error(\`profile object is required\`);let e=process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||\`/tmp\`,t=${fsVar}.mkdtempSync(${pathVar}.join(e,\`codex-agent-workspace-\`));__codexTempPath=${pathVar}.join(t,\`profile.json\`),${fsVar}.writeFileSync(__codexTempPath,JSON.stringify(__codexProfile,null,2)+\`\\n\`,{encoding:\`utf8\`,mode:384}),__codexArgs=[\`profile\`,\`put\`,\`--json\`,__codexTempPath],__codexReplace&&__codexArgs.push(\`--replace\`),__codexDryRun&&__codexArgs.push(\`--dry-run\`);break}case\`workspaceList\`:__codexArgs=[\`workspace\`,\`list\`];break;case\`workspaceStatus\`:__codexArgs=[\`workspace\`,\`status\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceManifest\`:__codexArgs=[\`workspace\`,\`manifest\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceArtifacts\`:__codexArgs=[\`workspace\`,\`artifacts\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceOpenProfile\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`workspace\`,\`open-profile\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexAckHiddenWorkspace&&__codexArgs.push(\`--ack-hidden-workspace\`),__codexAckUnenforcedPolicy&&__codexArgs.push(\`--ack-unenforced-policy\`),__codexArgs.push(\`--profile\`,e),__codexPushId(\`--id\`,__codexWorkspaceId),__codexPushId(\`--purpose\`,__codexPurpose),__codexRunSetup&&__codexArgs.push(\`--setup\`),__codexStartupWaitWindow&&__codexArgs.push(\`--startup-wait-window\`),__codexStartupScreenshotWindow&&__codexArgs.push(\`--startup-screenshot-window\`);break}case\`workspaceStop\`:__codexArgs=[\`workspace\`,\`stop\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceCleanup\`:__codexArgs=[\`workspace\`,\`cleanup\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexPushId(\`--id\`,__codexCleanupId);break;default:throw Error(\`unsupported agent workspace action\`)}}catch(e){return{ok:!1,action:__codexActionName,message:e instanceof Error?e.message:String(e)}}let __codexParse=e=>{let t=String(e||\`\`).trim();if(t.length===0)return null;try{return JSON.parse(t)}catch{return{raw:t}}};try{let e=await new Promise((e,t)=>{let n=${childProcessVar}.execFile(__codexCommand,__codexArgs,{encoding:\`utf8\`,timeout:Number.isFinite(Number(__codexTimeoutMs))?Number(__codexTimeoutMs):15e3,maxBuffer:8388608},(n,r,i)=>{n?(n.stdout=r,n.stderr=i,t(n)):e({stdout:r,stderr:i})})});return{ok:!0,action:__codexActionName,command:__codexCommand,args:__codexArgs,stdout:e.stdout,stderr:e.stderr,json:__codexParse(e.stdout)}}catch(e){return{ok:!1,action:__codexActionName,command:__codexCommand,args:__codexArgs,message:e instanceof Error?e.message:String(e),code:e?.code??null,stdout:e?.stdout??\`\`,stderr:e?.stderr??\`\`,json:__codexParse(e?.stdout)}}finally{if(__codexTempPath)try{${fsVar}.rmSync(${pathVar}.dirname(__codexTempPath),{recursive:!0,force:!0})}catch{}}}`;
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
var DEFAULT_COMMAND_LABEL="~/.local/bin/agent-workspace-linux";

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

function toggleButton(label,selected,disabled,onClick,tone){
  var selectedClass=selected
    ? tone==="readonly"
      ? "border-yellow-500/60 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200"
      : "border-token-border-strong bg-token-main-surface-secondary text-token-text-primary"
    : "border-token-border-default text-token-text-primary";
  return h("button",{
    type:"button",
    className:"rounded-md border px-3 py-1.5 text-sm hover:bg-token-main-surface-secondary disabled:cursor-not-allowed disabled:opacity-50 "+selectedClass,
    disabled:!!disabled,
    "aria-pressed":!!selected,
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

function commandText(command){
  return Array.isArray(command)?command.join(" "):"";
}

function baseName(filePath){
  var value=String(filePath||"").split("/").filter(Boolean).pop()||"app";
  return value.endsWith(".desktop")?value.slice(0,-8):value;
}

function startupAppFromPath(filePath){
  var name=baseName(filePath);
  if(String(filePath||"").endsWith(".desktop"))return {name:name,command:["gtk-launch",name]};
  return {name:name,command:[filePath]};
}

function startupAppFromManual(command){
  return {name:command.trim().split(/\\s+/)[0]||"app",command:["sh","-lc",command.trim()]};
}

function profileStartupApps(profile){
  return Array.isArray(profile?.startup_apps)?profile.startup_apps:[];
}

function profileMountMode(profile){
  var mounts=Array.isArray(profile?.mounts)?profile.mounts:[];
  if(mounts.length===0)return "inactive";
  var readOnly=mounts.some(function(mount){return mount?.mode==="read_only"||mount?.mode==null;});
  var readWrite=mounts.some(function(mount){return mount?.mode==="read_write";});
  if(readOnly&&!readWrite)return "read_only";
  if(readWrite&&!readOnly)return "read_write";
  return "mixed";
}

function mountModeLabel(mode){
  if(mode==="read_only")return "Read only";
  if(mode==="read_write")return "Read write";
  if(mode==="mixed")return "Mixed";
  return "No mounts";
}

function workspaceStatusObject(result){
  return result?.status??result?.json?.status??result?.json??result;
}

function workspaceStatusView(detail){
  var status=workspaceStatusObject(detail);
  if(!status||typeof status!=="object")return null;
  var apps=Array.isArray(status.apps)?status.apps:[];
  return h("section",{className:"rounded-md border border-token-border-default bg-token-main-surface-secondary p-3 text-sm"},
    h("div",{className:"mb-2 flex items-center justify-between gap-2"},
      h("div",{className:"font-medium text-token-text-primary"},"Workspace status"),
      status.ready?statusPill("Ready","active"):statusPill("Stopped","stopped")
    ),
    h("div",{className:"grid gap-2 text-token-text-secondary md:grid-cols-2"},
      h("div",null,"Display: "+(status.display||"unknown")),
      h("div",null,"Apps: "+apps.length),
      h("div",null,"Size: "+((status.width||"?")+" x "+(status.height||"?"))),
      h("div",{className:"truncate"},"Socket: "+(status.socket_path||"unknown"))
    )
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

function workspaceDetailId(detail){
  var status=workspaceStatusObject(detail);
  return status&&typeof status==="object"?workspaceId(status):null;
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
  if(Array.isArray(result.json?.removed)||Array.isArray(result.json?.candidates)){
    var removed=Array.isArray(result.json.removed)?result.json.removed.length:0;
    var candidates=Array.isArray(result.json.candidates)?result.json.candidates.length:0;
    var skipped=Array.isArray(result.json.skipped)?result.json.skipped.length:0;
    return result.json.dry_run?"Cleanup preview: "+candidates+" stale":"Cleanup: "+removed+" removed, "+skipped+" skipped";
  }
  if(result.action)return result.action+" complete";
  return "Command complete";
}

function statusPill(label,tone,showDot){
  var toneClass=tone==="active"?"border-green-500/40 text-green-700 dark:text-green-300":tone==="stopped"?"border-red-500/40 text-red-700 dark:text-red-300":tone==="readonly"||tone==="warn"?"border-yellow-500/40 text-yellow-700 dark:text-yellow-300":"border-token-border-default text-token-text-tertiary";
  return h("span",{className:"inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs "+toneClass},showDot?statusDot(tone):null,label);
}

function statusDot(tone){
  var dotClass=tone==="active"?"bg-green-500":tone==="stopped"?"bg-red-500":tone==="readonly"||tone==="warn"?"bg-yellow-400":"bg-gray-400";
  return h("span",{className:"inline-block h-2.5 w-2.5 shrink-0 rounded-full "+dotClass,"aria-hidden":true});
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
  var editingState=React.useState(false);
  var editingProfile=editingState[0];
  var setEditingProfile=editingState[1];
  var manualAppState=React.useState("");
  var manualApp=manualAppState[0];
  var setManualApp=manualAppState[1];
  var detailState=React.useState(null);
  var workspaceDetail=detailState[0];
  var setWorkspaceDetail=detailState[1];

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
  var startupApps=profileStartupApps(profile);
  var mountMode=profileMountMode(profile);
  var runningWorkspaces=workspaces.filter(workspaceRunning);
  var activeWorkspace=runningWorkspaces[0]??null;
  var otherRunningWorkspaces=activeWorkspace?runningWorkspaces.slice(1):[];
  var stoppedWorkspaceCount=Math.max(0,workspaces.length-runningWorkspaces.length);
  var startDisabled=!profile||!!activeWorkspace||activeAction==="workspaceOpenProfile";

  async function saveCommand(){
    await __post("set-global-state",{params:{key:COMMAND_KEY,value:command.trim()||void 0}});
    await callAgentWorkspace("doctor");
  }

  function updateProfile(mutator){
    var next=parseProfile(profileJson)||defaultProfile();
    mutator(next);
    setProfileJson(pretty(next));
  }

  function selectProfile(profileId,openEditor){
    setSelectedProfileId(profileId);
    if(openEditor)setEditingProfile(true);
    if(!profileId)return;
    callAgentWorkspace("profileGet",{profileId:profileId}).then(function(response){
      var loaded=response?.json?.profile??response?.json;
      if(loaded)setProfileJson(pretty(loaded));
    });
  }

  function createProfile(){
    setSelectedProfileId("");
    setProfileJson(pretty(defaultProfile()));
    setPurpose("");
    setManualApp("");
    setEditingProfile(true);
  }

  function setNetworkMode(mode){
    updateProfile(function(next){next.network={...(next.network||{}),mode:mode};});
  }

  function setMountMode(mode){
    updateProfile(function(next){next.mounts=(next.mounts||[]).map(function(mount){return {...mount,mode:mode};});});
  }

  function setProfileTextField(key,value){
    updateProfile(function(next){
      if(value.trim())next[key]=value;
      else delete next[key];
    });
  }

  function addStartupApp(app){
    if(!app?.command?.length)return;
    updateProfile(function(next){next.startup_apps=[...profileStartupApps(next),app];});
  }

  function removeStartupApp(index){
    updateProfile(function(next){next.startup_apps=profileStartupApps(next).filter(function(_,appIndex){return appIndex!==index;});});
  }

  async function pickStartupApp(){
    try{
      var response=await __post("linux-agent-workspace-pick-app",{params:{}});
      setResult(response);
      if(response?.ok&&response?.json?.path)addStartupApp(startupAppFromPath(response.json.path));
    }catch(error){
      setResult({ok:false,action:"pickStartupApp",message:error instanceof Error?error.message:String(error)});
    }
  }

  function addManualStartupApp(){
    if(!manualApp.trim())return;
    addStartupApp(startupAppFromManual(manualApp));
    setManualApp("");
  }

  async function saveProfile(replace){
    if(!profile){
      setResult({ok:false,message:"Profile JSON is invalid"});
      return;
    }
    var response=await callAgentWorkspace("profileSave",{profile:profile,replace:replace});
    if(response?.ok){
      setSelectedProfileId(profile.id||"");
      setEditingProfile(false);
      refresh();
    }
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
    callAgentWorkspace("workspaceStop",{workspaceId:workspaceId}).then(function(){
      setWorkspaceDetail(null);
      refresh();
    });
  }

  function showWorkspaceStatus(workspaceId){
    if(workspaceDetailId(workspaceDetail)===workspaceId){
      setWorkspaceDetail(null);
      return;
    }
    callAgentWorkspace("workspaceStatus",{workspaceId:workspaceId}).then(function(response){
      if(response?.ok)setWorkspaceDetail(response);
    });
  }

  function cleanupStale(){
    if(!window.confirm("Remove stopped workspace runtime directories? Running workspaces are skipped."))return;
    callAgentWorkspace("workspaceCleanup",{dryRun:false}).then(function(){
      setWorkspaceDetail(null);
      refresh();
    });
  }

  return h(SettingsPage,{title:"Agent Workspaces",subtitle:"Linux agent environments"},
    h("div",{className:"flex max-w-5xl flex-col gap-5 p-1"},
      h("section",{className:"flex flex-col gap-2"},
        h("div",{className:"flex items-center justify-between gap-2"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Workspace control"),
          button("Refresh",activeAction==="profileList"||loading,refresh)
        ),
        h("details",{className:"rounded-md border border-token-border-default bg-token-main-surface-secondary text-sm"},
          h("summary",{className:"flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-token-text-primary"},
            h("span",null,"Connection"),
            h("span",{className:"truncate text-xs text-token-text-tertiary"},command.trim()?"Custom command":DEFAULT_COMMAND_LABEL)
          ),
          h("div",{className:"grid gap-3 border-t border-token-border-default p-3 md:grid-cols-[1fr_auto]"},
            field("Command",command,setCommand,DEFAULT_COMMAND_LABEL),
            h("div",{className:"flex items-end"},button("Save",activeAction==="doctor",saveCommand))
          )
        )
      ),

      h("section",{className:"flex flex-col gap-2"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Active workspace"),
          activeWorkspace?statusPill("Active","active",true):statusPill("Idle","idle")
        ),
        activeWorkspace
          ? h("div",{className:"flex items-center justify-between gap-3 rounded-md border border-token-border-default p-3 text-sm"},
              h("div",{className:"min-w-0"},
                h("div",{className:"truncate text-token-text-primary"},workspacePrimary(activeWorkspace)),
                workspaceSecondary(activeWorkspace)?h("div",{className:"truncate text-token-text-tertiary"},workspaceSecondary(activeWorkspace)):null,
                workspaceDisplay(activeWorkspace)?h("div",{className:"mt-1 text-xs text-token-text-tertiary"},workspaceDisplay(activeWorkspace)):null
              ),
              h("div",{className:"flex shrink-0 gap-2"},
                toggleButton(workspaceDetailId(workspaceDetail)===workspaceId(activeWorkspace)?"Hide status":"Status",workspaceDetailId(workspaceDetail)===workspaceId(activeWorkspace),false,function(){showWorkspaceStatus(workspaceId(activeWorkspace));}),
                button("Stop",false,function(){stopWorkspace(workspaceId(activeWorkspace));})
              )
            )
          : h("div",{className:"rounded-md border border-dashed border-token-border-default p-3 text-sm text-token-text-tertiary"},"No active workspace"),
        workspaceStatusView(workspaceDetail),
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
              h("span",{className:"flex items-center gap-2"},statusDot("stopped"),"Stopped workspaces: "+stoppedWorkspaceCount),
              button("Remove stale",activeAction==="workspaceCleanup",cleanupStale)
            )
          : null
      ),

      h("section",{className:"flex flex-col gap-3"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Saved profiles"),
          button("Create profile",false,createProfile)
        ),
        profiles.length===0
          ? h("div",{className:"rounded-md border border-dashed border-token-border-default p-3 text-sm text-token-text-tertiary"},"No saved profiles")
          : h("div",{className:"grid gap-2 md:grid-cols-2"},
              profiles.map(function(savedProfile){
                var id=profileId(savedProfile);
                var selected=id===selectedProfileId;
                return h("div",{
                  key:id,
                  className:"rounded-md border p-3 text-sm "+(selected?"border-token-border-strong bg-token-main-surface-secondary":"border-token-border-default")
                },
                  h("div",{className:"flex items-center justify-between gap-2"},
                    h("span",{className:"truncate font-medium text-token-text-primary"},id),
                    statusPill(profileNetwork(savedProfile),"idle")
                  ),
                  h("div",{className:"mt-1 truncate text-token-text-tertiary"},profileSummary(savedProfile)),
                  h("div",{className:"mt-3 flex gap-2"},
                    button("Edit profile",false,function(){selectProfile(id,true);}),
                    button("Delete",false,function(){
                      if(window.confirm("Delete profile "+id+"?"))callAgentWorkspace("profileDelete",{profileId:id}).then(refresh);
                    })
                  )
                );
              })
            )
      ),

      editingProfile
        ? h("section",{className:"flex flex-col gap-3 rounded-md border border-token-border-default p-3"},
            h("div",{className:"flex items-center justify-between"},
              h("div",{className:"text-sm font-medium text-token-text-primary"},selectedProfileId?"Edit profile":"Create profile"),
              statusPill(selectedProfileId||"New","idle")
            ),
            h("div",{className:"grid gap-3 md:grid-cols-3"},
              field("Profile name",profile?.id||"",function(value){setProfileTextField("id",value);},"desktop-qa"),
              field("Description",profile?.description||"",function(value){setProfileTextField("description",value);},"Desktop QA"),
              field("Working folder",profile?.cwd||"",function(value){setProfileTextField("cwd",value);},"/workspace/project")
            ),
            h("div",{className:"grid gap-3 md:grid-cols-[220px_1fr]"},
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
              ),
              h("div",{className:"flex flex-col justify-end gap-2"},
                h("div",{className:"text-sm text-token-text-secondary"},"File access: "+mountModeLabel(mountMode)),
                h("div",{className:"flex flex-wrap gap-2"},
                  toggleButton("Read only",mountMode==="read_only",!profile||mountMode==="inactive",function(){setMountMode("read_only");},"readonly"),
                  toggleButton("Read write",mountMode==="read_write",!profile||mountMode==="inactive",function(){setMountMode("read_write");})
                )
              )
            ),
            h("div",{className:"flex flex-col gap-2 rounded-md border border-token-border-default p-3"},
              h("div",{className:"flex items-center justify-between gap-2"},
                h("div",{className:"text-sm font-medium text-token-text-primary"},"Startup apps"),
                button("Pick app",!profile,pickStartupApp)
              ),
              startupApps.length===0
                ? h("div",{className:"text-sm text-token-text-tertiary"},"No startup apps")
                : h("div",{className:"flex flex-col gap-2"},
                    startupApps.map(function(app,index){
                      return h("div",{key:String(index),className:"flex items-center justify-between gap-2 rounded-md border border-token-border-default p-2 text-sm"},
                        h("div",{className:"min-w-0"},
                          h("div",{className:"truncate text-token-text-primary"},app.name||commandText(app.command)),
                          h("div",{className:"truncate text-token-text-tertiary"},commandText(app.command))
                        ),
                        button("Remove",false,function(){removeStartupApp(index);})
                      );
                    })
                  ),
              h("div",{className:"grid gap-2 md:grid-cols-[1fr_auto]"},
                field("Manual app command",manualApp,setManualApp,"firefox"),
                h("div",{className:"flex items-end"},button("Add manually",!manualApp.trim(),addManualStartupApp))
              )
            ),
            field("Workspace purpose",purpose,setPurpose,"QA run"),
            h("details",{className:"rounded-md border border-token-border-default bg-token-main-surface-secondary text-sm"},
              h("summary",{className:"cursor-pointer px-3 py-2 text-token-text-primary"},"Advanced settings"),
              h("textarea",{
                className:"min-h-[220px] w-full border-t border-token-border-default bg-token-bg-primary p-3 font-mono text-xs text-token-text-primary outline-none",
                value:profileJson,
                onChange:function(event){setProfileJson(event.target.value);},
                spellCheck:false
              })
            ),
            h("div",{className:"flex flex-wrap justify-between gap-2"},
              h("div",{className:"flex flex-wrap gap-2"},
                button("Validate",!profile,function(){callAgentWorkspace("profileSave",{profile:profile,dryRun:true,replace:true});}),
                button("Save",!profile,function(){saveProfile(false);}),
                button("Overwrite",!profile,function(){saveProfile(true);}),
                button("Cancel",false,function(){setEditingProfile(false);})
              ),
              h("div",{className:"flex flex-wrap gap-2"},
                button("Preview start",!profile,previewStart),
                button("Start",startDisabled,startWorkspace)
              )
            )
          )
        : null,

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
