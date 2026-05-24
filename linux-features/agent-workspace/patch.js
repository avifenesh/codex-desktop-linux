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
  return `"linux-agent-workspace-pick-app":async()=>{let __codexElectron;try{__codexElectron=require(\`electron\`)}catch(e){return{ok:!1,action:\`pickStartupApp\`,message:\`file picker unavailable\`}}try{let e=await __codexElectron.dialog.showOpenDialog({title:\`Choose startup app\`,properties:[\`openFile\`]});let t=Array.isArray(e.filePaths)?e.filePaths:[];return{ok:!e.canceled&&t.length>0,action:\`pickStartupApp\`,json:{canceled:!!e.canceled,path:t[0]||null,paths:t}}}catch(e){return{ok:!1,action:\`pickStartupApp\`,message:e instanceof Error?e.message:String(e)}}},"linux-agent-workspace":async({action:__codexAction,timeoutMs:__codexTimeoutMs,profileId:__codexProfileId,profile:__codexProfile,replace:__codexReplace,dryRun:__codexDryRun,workspaceId:__codexWorkspaceId,purpose:__codexPurpose,runSetup:__codexRunSetup,ackHiddenWorkspace:__codexAckHiddenWorkspace,ackUnenforcedPolicy:__codexAckUnenforcedPolicy,startupWaitWindow:__codexStartupWaitWindow,startupScreenshotWindow:__codexStartupScreenshotWindow,cleanupId:__codexCleanupId,outputPath:__codexOutputPath,observeScreenshot:__codexObserveScreenshot,includeHidden:__codexIncludeHidden,eventsTail:__codexEventsTail}={})=>{let __codexHome=()=>typeof process.env.HOME===\`string\`&&process.env.HOME.trim().length>0?process.env.HOME.trim():null,__codexExpandCommand=e=>{if(typeof e!==\`string\`)return e;let t=e.trim(),n=__codexHome();return t.startsWith(\`~/\`)&&n?${pathVar}.join(n,t.slice(2)):t},__codexDefaultCommand=()=>{let e=process.env.CODEX_AGENT_WORKSPACE_BIN;if(typeof e===\`string\`&&e.trim().length>0)return __codexExpandCommand(e);let t=__codexHome();return t?${pathVar}.join(t,\`.local\`,\`bin\`,\`agent-workspace-linux\`):\`agent-workspace-linux\`},__codexCommand=this.globalState.get(\`${SETTINGS_COMMAND_KEY}\`)||__codexDefaultCommand();if(typeof __codexCommand!==\`string\`||__codexCommand.trim().length===0)__codexCommand=__codexDefaultCommand();__codexCommand=__codexExpandCommand(__codexCommand);let __codexArgs=[],__codexTempPath=null,__codexString=e=>typeof e===\`string\`&&e.trim().length>0?e.trim():null,__codexPushId=(e,t)=>{let n=__codexString(t);if(n)__codexArgs.push(e,n)},__codexActionName=__codexString(__codexAction);try{switch(__codexActionName){case\`doctor\`:__codexArgs=[\`doctor\`];break;case\`guardrails\`:__codexArgs=[\`guardrails\`];break;case\`profilePath\`:__codexArgs=[\`profile\`,\`path\`];break;case\`profileList\`:__codexArgs=[\`profile\`,\`list\`];break;case\`profileGet\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`get\`,e];break}case\`profileCheck\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`check\`,e];break}case\`profileDelete\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`delete\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexArgs.push(e);break}case\`profileExport\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`export\`,e],__codexPushId(\`--output\`,__codexOutputPath),__codexReplace&&__codexArgs.push(\`--replace\`);break}case\`profileSave\`:{if(!__codexProfile||typeof __codexProfile!==\`object\`||Array.isArray(__codexProfile))throw Error(\`profile object is required\`);let e=process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||\`/tmp\`,t=${fsVar}.mkdtempSync(${pathVar}.join(e,\`codex-agent-workspace-\`));__codexTempPath=${pathVar}.join(t,\`profile.json\`),${fsVar}.writeFileSync(__codexTempPath,JSON.stringify(__codexProfile,null,2)+\`\\n\`,{encoding:\`utf8\`,mode:384}),__codexArgs=[\`profile\`,\`put\`,\`--json\`,__codexTempPath],__codexReplace&&__codexArgs.push(\`--replace\`),__codexDryRun&&__codexArgs.push(\`--dry-run\`);break}case\`workspaceList\`:__codexArgs=[\`workspace\`,\`list\`];break;case\`workspaceStatus\`:__codexArgs=[\`workspace\`,\`status\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceManifest\`:__codexArgs=[\`workspace\`,\`manifest\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceArtifacts\`:__codexArgs=[\`workspace\`,\`artifacts\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceOpenProfile\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`workspace\`,\`open-profile\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexAckHiddenWorkspace&&__codexArgs.push(\`--ack-hidden-workspace\`),__codexAckUnenforcedPolicy&&__codexArgs.push(\`--ack-unenforced-policy\`),__codexArgs.push(\`--profile\`,e),__codexPushId(\`--id\`,__codexWorkspaceId),__codexPushId(\`--purpose\`,__codexPurpose),__codexRunSetup&&__codexArgs.push(\`--setup\`),__codexStartupWaitWindow&&__codexArgs.push(\`--startup-wait-window\`),__codexStartupScreenshotWindow&&__codexArgs.push(\`--startup-screenshot-window\`);break}case\`workspaceObserve\`:__codexArgs=[\`workspace\`,\`observe\`],__codexPushId(\`--id\`,__codexWorkspaceId),__codexObserveScreenshot!==!1&&__codexArgs.push(\`--screenshot\`),__codexIncludeHidden&&__codexArgs.push(\`--include-hidden\`),Number.isFinite(Number(__codexEventsTail))&&__codexArgs.push(\`--events-tail\`,String(Number(__codexEventsTail)));break;case\`workspaceStop\`:__codexArgs=[\`workspace\`,\`stop\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceCleanup\`:__codexArgs=[\`workspace\`,\`cleanup\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexPushId(\`--id\`,__codexCleanupId);break;default:throw Error(\`unsupported agent workspace action\`)}}catch(e){return{ok:!1,action:__codexActionName,message:e instanceof Error?e.message:String(e)}}let __codexParse=e=>{let t=String(e||\`\`).trim();if(t.length===0)return null;try{return JSON.parse(t)}catch{return{raw:t}}},__codexAttachScreenshot=e=>{try{let t=e?.screenshot?.path;if(typeof t===\`string\`&&t.length>0&&${fsVar}.existsSync(t)){let n=${fsVar}.readFileSync(t);e.screenshot.data_url=\`data:image/png;base64,\${n.toString(\`base64\`)}\`}}catch{}};try{let e=await new Promise((e,t)=>{let n=${childProcessVar}.execFile(__codexCommand,__codexArgs,{encoding:\`utf8\`,timeout:Number.isFinite(Number(__codexTimeoutMs))?Number(__codexTimeoutMs):15e3,maxBuffer:8388608},(n,r,i)=>{n?(n.stdout=r,n.stderr=i,t(n)):e({stdout:r,stderr:i})})}),t=__codexParse(e.stdout);__codexAttachScreenshot(t);return{ok:!0,action:__codexActionName,command:__codexCommand,args:__codexArgs,stdout:e.stdout,stderr:e.stderr,json:t}}catch(e){let t=__codexParse(e?.stdout);__codexAttachScreenshot(t);return{ok:!1,action:__codexActionName,command:__codexCommand,args:__codexArgs,message:e instanceof Error?e.message:String(e),code:e?.code??null,stdout:e?.stdout??\`\`,stderr:e?.stderr??\`\`,json:t}}finally{if(__codexTempPath)try{${fsVar}.rmSync(${pathVar}.dirname(__codexTempPath),{recursive:!0,force:!0})}catch{}}}`;
}

function agentWorkspaceMountPickerBridgeSource() {
  return `"linux-agent-workspace-pick-mount":async()=>{let __codexElectron;try{__codexElectron=require(\`electron\`)}catch(e){return{ok:!1,action:\`pickMount\`,message:\`file picker unavailable\`}}try{let e=await __codexElectron.dialog.showOpenDialog({title:\`Choose file or folder to mount\`,properties:[\`openFile\`,\`openDirectory\`,\`multiSelections\`]});let t=Array.isArray(e.filePaths)?e.filePaths:[];return{ok:!e.canceled&&t.length>0,action:\`pickMount\`,json:{canceled:!!e.canceled,path:t[0]||null,paths:t}}}catch(e){return{ok:!1,action:\`pickMount\`,message:e instanceof Error?e.message:String(e)}}}`;
}

function agentWorkspaceBridgeWithWorkspaceStartSource(args) {
  return agentWorkspaceBridgeSource(args)
    .replace(
      `},"linux-agent-workspace":async`,
      `},${agentWorkspaceMountPickerBridgeSource()},"linux-agent-workspace":async`,
    )
    .replace(
    "case`workspaceStop`:",
    "case`workspaceStart`:{__codexArgs=[`workspace`,`start`],__codexDryRun&&__codexArgs.push(`--dry-run`),__codexAckHiddenWorkspace&&__codexArgs.push(`--ack-hidden-workspace`),__codexAckUnenforcedPolicy&&__codexArgs.push(`--ack-unenforced-policy`),__codexPushId(`--profile`,__codexProfileId),__codexPushId(`--id`,__codexWorkspaceId),__codexPushId(`--purpose`,__codexPurpose);break}case`workspaceStop`:",
  );
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
    `${agentWorkspaceBridgeWithWorkspaceStartSource({ childProcessVar, fsVar, pathVar })},${handlerNeedle}`,
  );
}

const CONVERSATION_RUNTIME_VERSION = "agent-workspace-conversation-v1";

function agentWorkspaceConversationRuntimeSource() {
  return [
    `;(()=>{const VERSION=${JSON.stringify(CONVERSATION_RUNTIME_VERSION)};if(globalThis.codexLinuxAgentWorkspaceConversationVersion===VERSION)return;globalThis.codexLinuxAgentWorkspaceConversationVersion=VERSION;`,
    `const METHOD="linux-agent-workspace";let seq=0,pending=new Map,state={panel:null,media:null,title:null,meta:null,stop:null,refresh:null,error:null,activeId:null,visible:false,pollTimer:null,screenshotTimer:null,busy:false,lastImage:""};`,
    `function onMessage(e){let t=e?.data;if(!t||typeof t!="object"||t.type!=="fetch-response")return;let n=pending.get(t.requestId);if(!n)return;pending.delete(t.requestId);clearTimeout(n.timer);if(t.responseType==="success"){let e=null;try{e=t.bodyJsonString?JSON.parse(t.bodyJsonString):null}catch{}n.resolve({status:t.status,body:e})}else n.reject(Error(t.error||"fetch failed"))}`,
    `window.addEventListener("message",onMessage);`,
    `function dispatch(payload){let bridge=window.electronBridge,event=new CustomEvent("codex-message-from-view",{detail:payload});if(bridge?.sendMessageFromView){event.__codexForwardedViaBridge=!0;bridge.sendMessageFromView(payload).catch(()=>{})}window.dispatchEvent(event)}`,
    `function post(params,timeoutMs=12000){let requestId="codex-linux-agent-workspace-"+ ++seq;let payload={type:"fetch",hostId:"local",requestId,method:"POST",url:"vscode://codex/"+METHOD,body:JSON.stringify(params??{})};return new Promise((resolve,reject)=>{let timer=setTimeout(()=>{pending.delete(requestId);reject(Error("timeout"))},timeoutMs);pending.set(requestId,{resolve,reject,timer});dispatch(payload)})}`,
    `function workspaceRunning(e){return e?.running===!0||e?.status?.ready===!0}`,
    `function workspaceId(e){return e?.id||e?.status?.id||e?.manifest?.id||"default"}`,
    `function workspaceLabel(e){return e?.status?.purpose||e?.manifest?.purpose||e?.status?.profile_id||e?.manifest?.profile_id||workspaceId(e)}`,
    `function statusText(status,apps){let display=status?.display||"",count=Array.isArray(apps)?apps.filter(e=>e?.running!==!1).length:0;return [display,count+" app"+(count===1?"":"s")].filter(Boolean).join(" - ")}`,
    `function ensureUi(){if(state.panel||typeof document==="undefined"||!document.body)return;let style=document.getElementById("codex-linux-agent-workspace-style");if(!style){style=document.createElement("style");style.id="codex-linux-agent-workspace-style";style.textContent=".codex-linux-agent-workspace-panel{position:fixed;right:18px;bottom:18px;width:min(380px,calc(100vw - 36px));max-height:min(420px,calc(100vh - 36px));z-index:2147482600;border:1px solid var(--token-border-default,rgba(120,120,120,.35));border-radius:8px;background:var(--token-bg-primary,#fff);box-shadow:0 16px 42px rgba(0,0,0,.22);overflow:hidden;color:var(--token-text-primary,#111);font:12px system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.codex-linux-agent-workspace-panel[hidden]{display:none}.codex-linux-agent-workspace-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;border-bottom:1px solid var(--token-border-default,rgba(120,120,120,.24))}.codex-linux-agent-workspace-title{min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.codex-linux-agent-workspace-dot{width:9px;height:9px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.15)}.codex-linux-agent-workspace-actions{display:flex;gap:6px;flex-shrink:0}.codex-linux-agent-workspace-actions button{height:26px;border-radius:6px;border:1px solid var(--token-border-default,rgba(120,120,120,.35));background:transparent;color:inherit;padding:0 8px;cursor:pointer}.codex-linux-agent-workspace-actions button:hover{background:var(--token-main-surface-secondary,rgba(120,120,120,.10))}.codex-linux-agent-workspace-shot{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#111}.codex-linux-agent-workspace-empty{display:flex;align-items:center;justify-content:center;width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,#151515,#262626);color:#ddd}.codex-linux-agent-workspace-meta,.codex-linux-agent-workspace-error{padding:8px 10px;color:var(--token-text-secondary,#555);border-top:1px solid var(--token-border-default,rgba(120,120,120,.2));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codex-linux-agent-workspace-error{color:#b91c1c;white-space:normal}@media (max-width:640px){.codex-linux-agent-workspace-panel{right:10px;left:10px;bottom:10px;width:auto}}";document.head?.appendChild?.(style)}let panel=document.createElement("section");panel.className="codex-linux-agent-workspace-panel";panel.hidden=true;panel.innerHTML='<div class="codex-linux-agent-workspace-head"><span class="codex-linux-agent-workspace-dot" aria-hidden="true"></span><div class="codex-linux-agent-workspace-title"></div><div class="codex-linux-agent-workspace-actions"><button type="button" data-action="refresh" title="Refresh workspace view">Refresh</button><button type="button" data-action="stop" title="Stop workspace">Stop</button></div></div><div class="codex-linux-agent-workspace-empty">No screenshot yet</div><div class="codex-linux-agent-workspace-meta"></div><div class="codex-linux-agent-workspace-error" hidden></div>';document.body.appendChild(panel);state.panel=panel;state.media=panel.querySelector(".codex-linux-agent-workspace-empty");state.title=panel.querySelector(".codex-linux-agent-workspace-title");state.meta=panel.querySelector(".codex-linux-agent-workspace-meta");state.error=panel.querySelector(".codex-linux-agent-workspace-error");state.refresh=panel.querySelector("[data-action='refresh']");state.stop=panel.querySelector("[data-action='stop']");state.refresh?.addEventListener("click",e=>{e.preventDefault();refresh(!0)});state.stop?.addEventListener("click",e=>{e.preventDefault();stopActive()})}`,
    `function showError(message){ensureUi();if(state.error){state.error.hidden=!message;state.error.textContent=message||""}}`,
    `function hide(){ensureUi();state.visible=false;state.activeId=null;state.lastImage="";if(state.panel)state.panel.hidden=true;showError("")}`,
    `function setImage(dataUrl){if(!state.panel)return;if(!dataUrl)return;if(dataUrl===state.lastImage)return;let img=document.createElement("img");img.className="codex-linux-agent-workspace-shot";img.alt="Agent workspace screenshot";img.src=dataUrl;state.media?.replaceWith(img);state.media=img;state.lastImage=dataUrl}`,
    `function render(workspace,observe){ensureUi();let status=observe?.json?.status||workspace?.status||workspace?.manifest||{},apps=Array.isArray(status.apps)?status.apps:workspace?.status?.apps||[];state.visible=true;state.activeId=workspaceId(workspace);if(state.panel)state.panel.hidden=false;if(state.title)state.title.textContent=workspaceLabel(workspace);if(state.meta)state.meta.textContent=statusText(status,apps)||state.activeId;setImage(observe?.json?.screenshot?.data_url);showError("")}`,
    `async function activeWorkspace(){let list=await post({action:"workspaceList"},10000);let workspaces=list?.body?.json?.workspaces||[];return workspaces.find(workspaceRunning)||null}`,
    `async function refresh(force=false){if(state.busy&&!force)return;state.busy=true;try{let workspace=await activeWorkspace();if(!workspace){hide();return}let id=workspaceId(workspace);let observe=await post({action:"workspaceObserve",workspaceId:id,observeScreenshot:true,includeHidden:true,eventsTail:8},15000);render(workspace,observe?.body)}catch(e){state.visible?showError(e instanceof Error?e.message:String(e)):hide()}finally{state.busy=false}}`,
    `async function stopActive(){let id=state.activeId;if(!id)return;try{await post({action:"workspaceStop",workspaceId:id},15000)}catch(e){showError(e instanceof Error?e.message:String(e));return}hide();setTimeout(()=>refresh(!0),600)}`,
    `function start(){if(state.pollTimer)return;refresh(!0);state.pollTimer=setInterval(()=>refresh(!1),4000)}`,
    `if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();})();`,
  ].join("");
}

function applyAgentWorkspaceConversationViewPatch(currentSource) {
  if (currentSource.includes(CONVERSATION_RUNTIME_VERSION)) {
    return currentSource;
  }
  return `${currentSource}\n${agentWorkspaceConversationRuntimeSource()}`;
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

function field(label,value,onChange,placeholder,disabled){
  return h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},
    h("span",null,label),
    h("input",{
      className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary outline-none disabled:cursor-not-allowed disabled:opacity-60",
      value,
      onChange:function(event){onChange(event.target.value);},
      placeholder:placeholder||"",
      disabled:!!disabled
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

function profileMounts(profile){
  return Array.isArray(profile?.mounts)?profile.mounts:[];
}

function profileMountMode(profile){
  var mounts=profileMounts(profile);
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

function mountAccess(mount){
  return mount?.mode==="read_write"?"read_write":"read_only";
}

function safeWorkspacePathSegment(filePath){
  return (baseName(filePath).toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"mount");
}

function defaultMountWorkspacePath(profile,filePath){
  var mounts=profileMounts(profile);
  var used=new Set(mounts.map(function(mount){return mount?.workspace_path;}).filter(Boolean));
  if(mounts.length===0&&typeof profile?.cwd==="string"&&profile.cwd.startsWith("/workspace/")&&!used.has(profile.cwd))return profile.cwd;
  var base="/workspace/"+safeWorkspacePathSegment(filePath);
  if(!used.has(base))return base;
  for(var index=2;index<100;index++){
    var candidate=base+"-"+index;
    if(!used.has(candidate))return candidate;
  }
  return base+"-"+Date.now();
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

function resultView(result,open,setOpen){
  if(!result)return null;
  var border=result.ok?"border-token-border-default":"border-token-error";
  return h("details",{
    open:!!open,
    onToggle:function(event){setOpen(event.currentTarget.open);},
    className:"rounded-md border "+border+" bg-token-main-surface-secondary text-sm text-token-text-secondary"
  },
    h("summary",{className:"flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-token-text-primary"},
      h("span",null,result.ok===false?"Error":"Result"),
      h("span",{className:"truncate text-xs text-token-text-tertiary"},resultSummary(result))
    ),
    open?h("pre",{className:"max-h-[260px] overflow-auto border-t border-token-border-default p-3 text-xs text-token-text-secondary"},pretty(result.json??result)):null
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

function workspaceProfileId(workspace){
  return workspace?.profile_id||workspace?.status?.profile_id||workspace?.manifest?.profile_id||null;
}

function workspacePurpose(workspace){
  return workspace?.purpose||workspace?.status?.purpose||workspace?.manifest?.purpose||workspacePrimary(workspace);
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

function profileAllowHosts(profile){
  return Array.isArray(profile?.network?.allow_hosts)?profile.network.allow_hosts:[];
}

function networkHostListLabel(mode){
  return mode==="local_only"?"Loopback hosts":"Allowed hosts";
}

function networkHostPlaceholder(mode){
  return mode==="local_only"?"localhost:3000":"example.com";
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

function activeWorkspaceFromList(workspaces){
  return (Array.isArray(workspaces)?workspaces:[]).find(workspaceRunning)||null;
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
  var resultOpenState=React.useState(false);
  var resultOpen=resultOpenState[0];
  var setResultOpen=resultOpenState[1];
  var advancedOpenState=React.useState(false);
  var advancedOpen=advancedOpenState[0];
  var setAdvancedOpen=advancedOpenState[1];
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
  var networkHostState=React.useState("");
  var networkHost=networkHostState[0];
  var setNetworkHost=networkHostState[1];
  var formModeState=React.useState("create");
  var formMode=formModeState[0];
  var setFormMode=formModeState[1];
  var detailState=React.useState(null);
  var workspaceDetail=detailState[0];
  var setWorkspaceDetail=detailState[1];

  var callAgentWorkspace=React.useCallback(async function(action,params){
    setActiveAction(action);
    try{
      var response=await __post("linux-agent-workspace",{params:{action:action,...(params||{})}});
      setResult(response);
      setResultOpen(false);
      return response;
    }catch(error){
      var response={ok:false,action:action,message:error instanceof Error?error.message:String(error)};
      setResult(response);
      setResultOpen(false);
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
  var mounts=profileMounts(profile);
  var mountMode=profileMountMode(profile);
  var networkMode=profileNetwork(profile);
  var networkHosts=profileAllowHosts(profile);
  var showNetworkHosts=networkMode==="allowlist"||networkMode==="local_only";
  var runningWorkspaces=workspaces.filter(workspaceRunning);
  var activeWorkspace=activeWorkspaceFromList(workspaces);
  var otherRunningWorkspaces=activeWorkspace?runningWorkspaces.slice(1):[];
  var stoppedWorkspaces=workspaces.filter(function(workspace){return !workspaceRunning(workspace);});
  var stoppedWorkspaceCount=stoppedWorkspaces.length;
  var editingSaved=formMode==="edit"&&!!selectedProfileId;
  var selectedProfileActive=editingSaved&&runningWorkspaces.some(function(workspace){return workspaceProfileId(workspace)===selectedProfileId||workspacePrimary(workspace)===selectedProfileId;});
  var profileFormLocked=selectedProfileActive;
  var startDisabled=!profile||!!activeWorkspace||activeAction==="workspaceOpenProfile"||activeAction==="workspaceStart";

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
    if(openEditor){
      setFormMode("edit");
      setAdvancedOpen(false);
      setEditingProfile(true);
    }
    if(!profileId)return;
    callAgentWorkspace("profileGet",{profileId:profileId}).then(function(response){
      var loaded=response?.json?.profile??response?.json;
      if(loaded)setProfileJson(pretty(loaded));
    });
  }

  function createProfile(){
    setFormMode("create");
    setSelectedProfileId("");
    setProfileJson(pretty(defaultProfile()));
    setPurpose("");
    setManualApp("");
    setNetworkHost("");
    setAdvancedOpen(false);
    setEditingProfile(true);
  }

  function setNetworkMode(mode){
    updateProfile(function(next){
      next.network={...(next.network||{}),mode:mode};
      if(mode!=="allowlist"&&mode!=="local_only")delete next.network.allow_hosts;
    });
  }

  function addMountsFromPaths(paths){
    var selected=(Array.isArray(paths)?paths:[paths]).filter(function(filePath){return typeof filePath==="string"&&filePath.trim().length>0;});
    if(selected.length===0)return;
    updateProfile(function(next){
      var nextMounts=profileMounts(next);
      selected.forEach(function(filePath){
        if(nextMounts.some(function(mount){return mount?.host_path===filePath;}))return;
        var workspacePath=defaultMountWorkspacePath({...next,mounts:nextMounts},filePath);
        nextMounts=[...nextMounts,{host_path:filePath,workspace_path:workspacePath,mode:"read_only"}];
        if(!next.cwd)next.cwd=workspacePath;
      });
      next.mounts=nextMounts;
    });
  }

  function setMountMode(index,mode){
    updateProfile(function(next){
      next.mounts=profileMounts(next).map(function(mount,mountIndex){
        return mountIndex===index?{...mount,mode:mode}:mount;
      });
    });
  }

  function removeMount(index){
    updateProfile(function(next){next.mounts=profileMounts(next).filter(function(_,mountIndex){return mountIndex!==index;});});
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

  function addNetworkHost(){
    var host=networkHost.trim();
    if(!host)return;
    updateProfile(function(next){
      var network=next.network||{};
      var hosts=Array.isArray(network.allow_hosts)?network.allow_hosts:[];
      next.network={...network,allow_hosts:hosts.includes(host)?hosts:[...hosts,host]};
    });
    setNetworkHost("");
  }

  function removeNetworkHost(index){
    updateProfile(function(next){
      var network=next.network||{};
      var hosts=Array.isArray(network.allow_hosts)?network.allow_hosts:[];
      next.network={...network,allow_hosts:hosts.filter(function(_,hostIndex){return hostIndex!==index;})};
    });
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

  async function pickMount(){
    try{
      var response=await __post("linux-agent-workspace-pick-mount",{params:{}});
      setResult(response);
      if(response?.ok)addMountsFromPaths(Array.isArray(response?.json?.paths)?response.json.paths:response?.json?.path);
    }catch(error){
      setResult({ok:false,action:"pickMount",message:error instanceof Error?error.message:String(error)});
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
    if(profileFormLocked){
      setResult({ok:false,message:"Stop the active workspace before editing this saved profile"});
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

  function startSavedWorkspace(savedProfile){
    var id=profileId(savedProfile);
    if(!id||activeWorkspace)return;
    callAgentWorkspace("workspaceOpenProfile",{
      profileId:id,
      ackHiddenWorkspace:true,
      ackUnenforcedPolicy:true,
      purpose:profileSummary(savedProfile)||"Codex agent workspace",
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

  function startStoppedWorkspace(workspace){
    if(activeWorkspace)return;
    callAgentWorkspace("workspaceStart",{
      workspaceId:workspaceId(workspace),
      profileId:workspaceProfileId(workspace),
      purpose:workspacePurpose(workspace)||"Codex agent workspace",
      ackHiddenWorkspace:true,
      ackUnenforcedPolicy:true
    }).then(refresh);
  }

  function deleteStoppedWorkspace(workspace){
    var id=workspaceId(workspace);
    if(!window.confirm("Delete stopped workspace "+id+"?"))return;
    callAgentWorkspace("workspaceCleanup",{cleanupId:id,dryRun:false}).then(function(){
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
          ? h("details",{className:"rounded-md border border-token-border-default bg-token-main-surface-secondary text-sm"},
              h("summary",{className:"flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-token-text-primary"},
                h("span",{className:"flex items-center gap-2"},statusDot("stopped"),"Stopped workspaces ("+stoppedWorkspaceCount+")"),
                h("span",{className:"text-xs text-token-text-tertiary"},"Open")
              ),
              h("div",{className:"flex flex-col gap-2 border-t border-token-border-default p-2"},
                stoppedWorkspaces.map(function(workspace){
                  var id=workspaceId(workspace);
                  return h("div",{key:id,className:"flex items-center justify-between gap-2 rounded-md border border-token-border-default p-2"},
                    h("div",{className:"min-w-0"},
                      h("div",{className:"truncate text-token-text-primary"},workspacePrimary(workspace)),
                      workspaceSecondary(workspace)?h("div",{className:"truncate text-token-text-tertiary"},workspaceSecondary(workspace)):null,
                      workspaceDisplay(workspace)?h("div",{className:"mt-1 text-xs text-token-text-tertiary"},workspaceDisplay(workspace)):null
                    ),
                    h("div",{className:"flex shrink-0 gap-2"},
                      button("Start",!!activeWorkspace||activeAction==="workspaceStart"||activeAction==="workspaceOpenProfile",function(){startStoppedWorkspace(workspace);}),
                      button("Delete",activeAction==="workspaceCleanup",function(){deleteStoppedWorkspace(workspace);})
                    )
                  );
                }),
                h("div",{className:"flex justify-end"},button("Delete stale",activeAction==="workspaceCleanup",cleanupStale))
              )
            )
          : null
      ),

      h("section",{className:"flex flex-col gap-3"},
        h("div",{className:"flex items-center justify-between"},
          h("div",{className:"text-sm font-medium text-token-text-primary"},"Saved workspaces"),
          button("Create new",false,createProfile)
        ),
        profiles.length===0
          ? h("div",{className:"rounded-md border border-dashed border-token-border-default p-3 text-sm text-token-text-tertiary"},"No saved workspaces")
          : h("div",{className:"grid gap-2 md:grid-cols-2"},
              profiles.map(function(savedProfile){
                var id=profileId(savedProfile);
                var selected=id===selectedProfileId;
                var activeForProfile=runningWorkspaces.some(function(workspace){return workspaceProfileId(workspace)===id||workspacePrimary(workspace)===id;});
                return h("div",{
                  key:id,
                  className:"rounded-md border p-3 text-sm "+(selected?"border-token-border-strong bg-token-main-surface-secondary":"border-token-border-default")
                },
                  h("div",{className:"flex items-center justify-between gap-2"},
                    h("span",{className:"truncate font-medium text-token-text-primary"},id),
                    activeForProfile?statusPill("Active","active",true):statusPill(profileNetwork(savedProfile),"idle")
                  ),
                  h("div",{className:"mt-1 truncate text-token-text-tertiary"},profileSummary(savedProfile)),
                  h("div",{className:"mt-3 flex gap-2"},
                    button(activeForProfile?"Running":"Start",!!activeWorkspace||activeAction==="workspaceOpenProfile",function(){startSavedWorkspace(savedProfile);}),
                    button(activeForProfile?"Stop to edit":"Edit saved",activeForProfile,function(){selectProfile(id,true);}),
                    button("Delete",activeForProfile,function(){
                      if(window.confirm("Delete profile "+id+"?"))callAgentWorkspace("profileDelete",{profileId:id}).then(refresh);
                    })
                  )
                );
              })
            )
      ),

      editingProfile
        ? h("div",{className:"fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4",role:"presentation"},
          h("section",{className:"mx-auto flex max-h-[calc(100vh-2rem)] max-w-4xl flex-col gap-3 overflow-y-auto rounded-md border border-token-border-default bg-token-bg-primary p-3 shadow-xl",role:"dialog","aria-modal":true},
            h("div",{className:"flex items-center justify-between"},
              h("div",{className:"text-sm font-medium text-token-text-primary"},editingSaved?"Edit saved":"Create new"),
              profileFormLocked?statusPill("Active - locked","warn"):statusPill(editingSaved?selectedProfileId:"New","idle")
            ),
            profileFormLocked
              ? h("div",{className:"rounded-md border border-yellow-500/30 bg-token-main-surface-secondary p-2 text-sm text-token-text-secondary"},"Stop the active workspace before changing this saved profile.")
              : null,
            h("div",{className:"grid gap-3 md:grid-cols-3"},
              field("Workspace name",profile?.id||"",function(value){setProfileTextField("id",value);},"desktop-qa",profileFormLocked),
              field("Description",profile?.description||"",function(value){setProfileTextField("description",value);},"Desktop QA",profileFormLocked),
              field("Working folder",profile?.cwd||"",function(value){setProfileTextField("cwd",value);},"/workspace/project",profileFormLocked)
            ),
            h("div",{className:"grid gap-3 md:grid-cols-[220px_1fr]"},
              h("label",{className:"flex flex-col gap-1 text-sm text-token-text-secondary"},
                h("span",null,"Network"),
                h("select",{
                  className:"h-9 rounded-md border border-token-border-default bg-token-bg-primary px-2 text-token-text-primary disabled:cursor-not-allowed disabled:opacity-60",
                  value:networkMode,
                  onChange:function(event){setNetworkMode(event.target.value);},
                  disabled:profileFormLocked
                },
                  ["inherit_host","local_only","disabled","allowlist"].map(function(mode){
                    return h("option",{key:mode,value:mode},mode);
                  })
                )
              )
            ),
            h("div",{className:"flex flex-col gap-2 rounded-md border border-token-border-default p-3"},
              h("div",{className:"flex items-center justify-between gap-2"},
                h("div",{className:"min-w-0"},
                  h("div",{className:"text-sm font-medium text-token-text-primary"},"File access"),
                  h("div",{className:"truncate text-xs text-token-text-tertiary"},mounts.length===0?"No files or folders mounted":mountModeLabel(mountMode))
                ),
                button("Add file/folder",!profile||profileFormLocked,pickMount)
              ),
              mounts.length===0
                ? h("div",{className:"rounded-md border border-dashed border-token-border-default p-2 text-sm text-token-text-tertiary"},"Add a file or folder before choosing read-only or read-write access.")
                : h("div",{className:"flex flex-col gap-2"},
                    mounts.map(function(mount,index){
                      return h("div",{key:String(index),className:"flex items-center justify-between gap-2 rounded-md border border-token-border-default p-2 text-sm"},
                        h("div",{className:"min-w-0"},
                          h("div",{className:"truncate text-token-text-primary"},mount?.host_path||"Mounted path"),
                          h("div",{className:"truncate text-token-text-tertiary"},mount?.workspace_path||"/workspace/mount")
                        ),
                        h("div",{className:"flex shrink-0 flex-wrap gap-2"},
                          toggleButton("Read only",mountAccess(mount)==="read_only",profileFormLocked,function(){setMountMode(index,"read_only");},"readonly"),
                          toggleButton("Read write",mountAccess(mount)==="read_write",profileFormLocked,function(){setMountMode(index,"read_write");}),
                          button("Remove",profileFormLocked,function(){removeMount(index);})
                        )
                      );
                    })
                  )
            ),
            showNetworkHosts
              ? h("div",{className:"flex flex-col gap-2 rounded-md border border-token-border-default p-3"},
                  h("div",{className:"flex items-center justify-between gap-2"},
                    h("div",{className:"text-sm font-medium text-token-text-primary"},networkHostListLabel(networkMode)),
                    statusPill(networkHosts.length+" host"+(networkHosts.length===1?"":"s"),"idle")
                  ),
                  networkHosts.length===0
                    ? h("div",{className:"text-sm text-token-text-tertiary"},"No hosts")
                    : h("div",{className:"flex flex-col gap-2"},
                        networkHosts.map(function(host,index){
                          return h("div",{key:host+"-"+index,className:"flex items-center justify-between gap-2 rounded-md border border-token-border-default p-2 text-sm"},
                            h("div",{className:"truncate text-token-text-primary"},host),
                            button("Remove",profileFormLocked,function(){removeNetworkHost(index);})
                          );
                        })
                      ),
                  h("div",{className:"grid gap-2 md:grid-cols-[1fr_auto]"},
                    field("Host",networkHost,setNetworkHost,networkHostPlaceholder(networkMode),profileFormLocked),
                    h("div",{className:"flex items-end"},button("Add host",!networkHost.trim()||profileFormLocked,addNetworkHost))
                  )
                )
              : null,
            h("div",{className:"flex flex-col gap-2 rounded-md border border-token-border-default p-3"},
              h("div",{className:"flex items-center justify-between gap-2"},
                h("div",{className:"text-sm font-medium text-token-text-primary"},"Startup apps"),
                button("Pick app",!profile||profileFormLocked,pickStartupApp)
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
                        button("Remove",profileFormLocked,function(){removeStartupApp(index);})
                      );
                    })
                  ),
              h("div",{className:"grid gap-2 md:grid-cols-[1fr_auto]"},
                field("Manual app command",manualApp,setManualApp,"firefox",profileFormLocked),
                h("div",{className:"flex items-end"},button("Add manually",!manualApp.trim()||profileFormLocked,addManualStartupApp))
              )
            ),
            editingSaved?field("Workspace purpose",purpose,setPurpose,"QA run",profileFormLocked):null,
            h("details",{
              className:"rounded-md border border-token-border-default bg-token-main-surface-secondary text-sm",
              open:advancedOpen,
              onToggle:function(event){setAdvancedOpen(event.currentTarget.open);}
            },
              h("summary",{className:"cursor-pointer px-3 py-2 text-token-text-primary"},"Advanced settings"),
              advancedOpen?h("textarea",{
                className:"min-h-[220px] w-full border-t border-token-border-default bg-token-bg-primary p-3 font-mono text-xs text-token-text-primary outline-none disabled:cursor-not-allowed disabled:opacity-60",
                value:profileJson,
                onChange:function(event){setProfileJson(event.target.value);},
                spellCheck:false,
                disabled:profileFormLocked
              }):null
            ),
            h("div",{className:"flex flex-wrap justify-between gap-2"},
              h("div",{className:"flex flex-wrap gap-2"},
                button("Validate",!profile||profileFormLocked,function(){callAgentWorkspace("profileSave",{profile:profile,dryRun:true,replace:editingSaved});}),
                editingSaved?button("Save changes",!profile||profileFormLocked,function(){saveProfile(true);}):button("Create",!profile||profileFormLocked,function(){saveProfile(false);}),
                button("Cancel",false,function(){setEditingProfile(false);})
              ),
              editingSaved
                ? h("div",{className:"flex flex-wrap gap-2"},
                    button("Preview start",!profile||profileFormLocked,previewStart),
                    button("Start",startDisabled||profileFormLocked,startWorkspace)
                  )
                : null
            )
          )
          )
        : null,

      resultView(result,resultOpen,setResultOpen)
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

function agentWorkspaceSettingsNavIconSource() {
  return `codexLinuxAgentWorkspaceSettingsIcon=e=>(0,Z.jsxs)(\`svg\`,{width:16,height:16,viewBox:\`0 0 16 16\`,fill:\`none\`,xmlns:\`http://www.w3.org/2000/svg\`,...e,children:[(0,Z.jsx)(\`rect\`,{x:2.25,y:3.25,width:11.5,height:8.5,rx:1.4,stroke:\`currentColor\`,strokeWidth:1.2}),(0,Z.jsx)(\`path\`,{d:\`M5 13.25h6\`,stroke:\`currentColor\`,strokeWidth:1.2,strokeLinecap:\`round\`}),(0,Z.jsx)(\`path\`,{d:\`M6 6.25 7.45 8 6 9.75\`,stroke:\`currentColor\`,strokeWidth:1.2,strokeLinecap:\`round\`,strokeLinejoin:\`round\`}),(0,Z.jsx)(\`path\`,{d:\`M9 8h2.25\`,stroke:\`currentColor\`,strokeWidth:1.2,strokeLinecap:\`round\`})]})`;
}

function applyAgentWorkspaceSettingsPagePatch(currentSource) {
  let patchedSource = currentSource;

  if (!patchedSource.includes("codexLinuxAgentWorkspaceSettingsIcon=e=>")) {
    const iconSource = agentWorkspaceSettingsNavIconSource();
    if (patchedSource.includes(",pe={")) {
      patchedSource = patchedSource.replace(",pe={", `,${iconSource},pe={`);
    } else if (patchedSource.includes("var pe={")) {
      patchedSource = patchedSource.replace("var pe={", `${iconSource};var pe={`);
    }
  }

  patchedSource = patchedSource.replace(
    new RegExp(`"${SETTINGS_SLUG}":[A-Za-z_$][\\w$]*`),
    `"${SETTINGS_SLUG}":codexLinuxAgentWorkspaceSettingsIcon`,
  );

  if (
    !new RegExp(`[,{]"${SETTINGS_SLUG}":[A-Za-z_$][\\w$]*,worktrees`).test(patchedSource) &&
    /"local-environments":([A-Za-z_$][\w$]*),worktrees:/.test(patchedSource)
  ) {
    patchedSource = patchedSource.replace(
      /"local-environments":([A-Za-z_$][\w$]*),worktrees:/,
      `"local-environments":$1,"${SETTINGS_SLUG}":codexLinuxAgentWorkspaceSettingsIcon,worktrees:`,
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
    {
      id: "conversation-view",
      phase: "webview-asset",
      order: 20_820,
      ciPolicy: "optional",
      pattern: /^(index|local-conversation-thread)-.*\.js$/,
      missingDescription: "conversation thread bundle",
      skipDescription: "agent workspace conversation visibility patch",
      apply: applyAgentWorkspaceConversationViewPatch,
    },
  ],
  CONVERSATION_RUNTIME_VERSION,
  SETTINGS_ASSET,
  SETTINGS_COMMAND_KEY,
  SETTINGS_SLUG,
  agentWorkspaceConversationRuntimeSource,
  applyAgentWorkspaceMainBridgePatch,
  applyAgentWorkspaceConversationViewPatch,
  applyAgentWorkspaceSettingsIndexPatch,
  applyAgentWorkspaceSettingsPagePatch,
  applyAgentWorkspaceSettingsSectionsPatch,
  applyAgentWorkspaceSettingsSharedPatch,
  buildAgentWorkspaceSettingsSource,
  patchAgentWorkspaceSettingsAssets,
};
