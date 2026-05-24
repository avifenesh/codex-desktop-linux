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

function agentWorkspaceAppPickerBridgeSource({ fsVar, pathVar }) {
  return [
    `"linux-agent-workspace-pick-app":async()=>{let __codexElectron;try{__codexElectron=require("electron")}catch(e){return{ok:!1,action:"pickStartupApp",message:"file picker unavailable"}}`,
    `let __codexDesktopTokens=e=>{let t=[],n="",r=null,a=!1,o=String(e||"");for(let i=0;i<o.length;i++){let c=o[i];if(a){n+=c,a=!1;continue}if(c==="\\\\"){a=!0;continue}if(r){if(c===r)r=null;else n+=c;continue}if(c==="'"||c==='"'){r=c;continue}if(/\\s/.test(c)){if(n)t.push(n),n="";continue}n+=c}if(a)n+="\\\\";if(n)t.push(n);return t};`,
    `let __codexDesktopEntry=__codexPath=>{if(typeof __codexPath!=="string"||!__codexPath.endsWith(".desktop"))return null;try{let __codexText=${fsVar}.readFileSync(__codexPath,"utf8"),__codexInEntry=!1,__codexName=null,__codexExec=null;for(let __codexLine of __codexText.split(/\\r?\\n/)){let __codexTrimmed=__codexLine.trim();if(!__codexTrimmed||__codexTrimmed.startsWith("#"))continue;if(__codexTrimmed.startsWith("[")&&__codexTrimmed.endsWith("]")){__codexInEntry=__codexTrimmed==="[Desktop Entry]";continue}if(!__codexInEntry)continue;let __codexEquals=__codexTrimmed.indexOf("=");if(__codexEquals<1)continue;let __codexKey=__codexTrimmed.slice(0,__codexEquals),__codexValue=__codexTrimmed.slice(__codexEquals+1).trim();if((__codexKey==="Name"||__codexKey.startsWith("Name["))&&!__codexName)__codexName=__codexValue;else if(__codexKey==="Exec"&&!__codexExec)__codexExec=__codexValue}if(!__codexExec)return null;let __codexPercent="__CODEX_PERCENT__",__codexCleanExec=__codexExec.replace(/%%/g,__codexPercent).replace(/%[A-Za-z]/g,"").replace(new RegExp(__codexPercent,"g"),"%").trim(),__codexCommand=__codexDesktopTokens(__codexCleanExec);return __codexCommand.length?{name:__codexName||${pathVar}.basename(__codexPath,".desktop"),command:__codexCommand,desktop_file:__codexPath}:null}catch{return null}};`,
    `try{let e=await __codexElectron.dialog.showOpenDialog({title:"Choose startup app",properties:["openFile"]});let t=Array.isArray(e.filePaths)?e.filePaths:[],n=t[0]||null,r=__codexDesktopEntry(n);return{ok:!e.canceled&&t.length>0,action:"pickStartupApp",json:{canceled:!!e.canceled,path:n,paths:t,startup_app:r,desktop:!!r}}}catch(e){return{ok:!1,action:"pickStartupApp",message:e instanceof Error?e.message:String(e)}}}`,
  ].join("");
}

function agentWorkspaceBridgeSource({ childProcessVar, fsVar, pathVar }) {
  return `${agentWorkspaceAppPickerBridgeSource({ fsVar, pathVar })},"linux-agent-workspace":async({action:__codexAction,timeoutMs:__codexTimeoutMs,profileId:__codexProfileId,profile:__codexProfile,replace:__codexReplace,dryRun:__codexDryRun,workspaceId:__codexWorkspaceId,purpose:__codexPurpose,runSetup:__codexRunSetup,ackHiddenWorkspace:__codexAckHiddenWorkspace,ackUnenforcedPolicy:__codexAckUnenforcedPolicy,startupWaitWindow:__codexStartupWaitWindow,startupScreenshotWindow:__codexStartupScreenshotWindow,cleanupId:__codexCleanupId,outputPath:__codexOutputPath,observeScreenshot:__codexObserveScreenshot,includeHidden:__codexIncludeHidden,eventsTail:__codexEventsTail,templateKind:__codexTemplateKind,hostPath:__codexHostPath,browserPath:__codexBrowserPath,userDataDir:__codexUserDataDir}={})=>{let __codexHome=()=>typeof process.env.HOME===\`string\`&&process.env.HOME.trim().length>0?process.env.HOME.trim():null,__codexExpandCommand=e=>{if(typeof e!==\`string\`)return e;let t=e.trim(),n=__codexHome();return t.startsWith(\`~/\`)&&n?${pathVar}.join(n,t.slice(2)):t},__codexDefaultCommand=()=>{let e=process.env.CODEX_AGENT_WORKSPACE_BIN;if(typeof e===\`string\`&&e.trim().length>0)return __codexExpandCommand(e);let t=__codexHome();return t?${pathVar}.join(t,\`.local\`,\`bin\`,\`agent-workspace-linux\`):\`agent-workspace-linux\`},__codexCommand=this.globalState.get(\`${SETTINGS_COMMAND_KEY}\`)||__codexDefaultCommand();if(typeof __codexCommand!==\`string\`||__codexCommand.trim().length===0)__codexCommand=__codexDefaultCommand();__codexCommand=__codexExpandCommand(__codexCommand);let __codexArgs=[],__codexTempPath=null,__codexString=e=>typeof e===\`string\`&&e.trim().length>0?e.trim():null,__codexTomlString=e=>{let t=String(e||\`\`).trim();if(!t.startsWith(\`"\`))return null;try{return JSON.parse(t)}catch{return t.slice(1,-1)}},__codexTomlArray=e=>{let t=[];String(e||\`\`).replace(/"((?:\\\\.|[^"])*)"/g,(e,n)=>{try{t.push(JSON.parse(\`"\`+n+\`"\`))}catch{t.push(n)}});return t},__codexMcpConfig=(()=>{try{let e=process.env.CODEX_HOME,t=typeof e===\`string\`&&e.trim().length>0?__codexExpandCommand(e):(__codexHome()?${pathVar}.join(__codexHome(),\`.codex\`):null),n=t?${pathVar}.join(t,\`config.toml\`):null;if(!n||!${fsVar}.existsSync(n))return{configured:!1,restricted:!1,config_path:n,permissions_path:null,message:\`MCP config not found\`};let r=${fsVar}.readFileSync(n,\`utf8\`),m=r.match(/\\[mcp_servers(?:\\."agent-workspace-linux"|\\.agent-workspace-linux)\\]([\\s\\S]*?)(?=\\n\\[|$)/);if(!m)return{configured:!1,restricted:!1,config_path:n,permissions_path:null,message:\`agent-workspace-linux MCP server is not configured\`};let a=m[1],p=__codexTomlString((a.match(/^\\s*command\\s*=\\s*("[^"\\n]*(?:\\\\.[^"\\n]*)*")/m)||[])[1])||null,s=__codexTomlArray((a.match(/^\\s*args\\s*=\\s*\\[([^\\]]*)\\]/m)||[])[1]),c=null;for(let e=0;e<s.length;e++){let t=s[e];if(t===\`--permissions\`)c=s[e+1]||null;else if(typeof t===\`string\`&&t.startsWith(\`--permissions=\`))c=t.slice(14)}c=__codexString(c);c&&(c=__codexExpandCommand(c));let l=null,u=null;if(c)try{l=JSON.parse(${fsVar}.readFileSync(c,\`utf8\`))}catch(e){u=e instanceof Error?e.message:String(e)}let d=!!(l&&((l.network&&l.network.mode&&l.network.mode!==\`inherit_host\`)||(Array.isArray(l.mounts)&&l.mounts.length>0)||(Array.isArray(l.apps?.allow)&&l.apps.allow.length>0)));return{configured:!0,restricted:d,config_path:n,command:p,args:s,permissions_path:c||null,ceiling:l,error:u,message:c?d?\`MCP permission ceiling is active\`:\`MCP permissions file is configured but open\`:\`MCP server configured without a permission ceiling\`}}catch(e){return{configured:!1,restricted:!1,error:e instanceof Error?e.message:String(e),message:\`Failed to inspect MCP config\`}}})(),__codexPushId=(e,t)=>{let n=__codexString(t);if(n)__codexArgs.push(e,n)},__codexActionName=__codexString(__codexAction);try{switch(__codexActionName){case\`mcpConfig\`:return{ok:!0,action:__codexActionName,json:__codexMcpConfig};case\`doctor\`:__codexArgs=[\`doctor\`];break;case\`guardrails\`:__codexArgs=[\`guardrails\`];break;case\`profilePath\`:__codexArgs=[\`profile\`,\`path\`];break;case\`profileList\`:__codexArgs=[\`profile\`,\`list\`];break;case\`profileGet\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`get\`,e];break}case\`profileCheck\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`check\`,e];break}case\`profileDelete\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`delete\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexArgs.push(e);break}case\`profileExport\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`profile\`,\`export\`,e],__codexPushId(\`--output\`,__codexOutputPath),__codexReplace&&__codexArgs.push(\`--replace\`);break}case\`profileTemplate\`:{let e=__codexString(__codexTemplateKind)||\`project-dev\`;__codexArgs=[\`profile\`,\`template\`,e],__codexPushId(\`--id\`,__codexProfileId),__codexPushId(\`--host-path\`,__codexHostPath),__codexPushId(\`--browser-path\`,__codexBrowserPath),__codexPushId(\`--user-data-dir\`,__codexUserDataDir);break}case\`profileValidate\`:{if(!__codexProfile||typeof __codexProfile!==\`object\`||Array.isArray(__codexProfile))throw Error(\`profile object is required\`);let e=process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||\`/tmp\`,t=${fsVar}.mkdtempSync(${pathVar}.join(e,\`codex-agent-workspace-\`));__codexTempPath=${pathVar}.join(t,\`profile.json\`),${fsVar}.writeFileSync(__codexTempPath,JSON.stringify(__codexProfile,null,2)+\`\\n\`,{encoding:\`utf8\`,mode:384}),__codexArgs=[\`profile\`,\`validate\`,\`--json\`,__codexTempPath];break}case\`profileSave\`:{if(!__codexProfile||typeof __codexProfile!==\`object\`||Array.isArray(__codexProfile))throw Error(\`profile object is required\`);let e=process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||\`/tmp\`,t=${fsVar}.mkdtempSync(${pathVar}.join(e,\`codex-agent-workspace-\`));__codexTempPath=${pathVar}.join(t,\`profile.json\`),${fsVar}.writeFileSync(__codexTempPath,JSON.stringify(__codexProfile,null,2)+\`\\n\`,{encoding:\`utf8\`,mode:384}),__codexArgs=[\`profile\`,\`put\`,\`--json\`,__codexTempPath],__codexReplace&&__codexArgs.push(\`--replace\`),__codexDryRun&&__codexArgs.push(\`--dry-run\`);break}case\`workspaceList\`:__codexArgs=[\`workspace\`,\`list\`];break;case\`workspaceStatus\`:__codexArgs=[\`workspace\`,\`status\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceManifest\`:__codexArgs=[\`workspace\`,\`manifest\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceArtifacts\`:__codexArgs=[\`workspace\`,\`artifacts\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceOpenProfile\`:{let e=__codexString(__codexProfileId);if(!e)throw Error(\`profile id is required\`);__codexArgs=[\`workspace\`,\`open-profile\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexAckHiddenWorkspace&&__codexArgs.push(\`--ack-hidden-workspace\`),__codexAckUnenforcedPolicy&&__codexArgs.push(\`--ack-unenforced-policy\`),__codexArgs.push(\`--profile\`,e),__codexPushId(\`--id\`,__codexWorkspaceId),__codexPushId(\`--purpose\`,__codexPurpose),__codexRunSetup&&__codexArgs.push(\`--setup\`),__codexStartupWaitWindow&&__codexArgs.push(\`--startup-wait-window\`),__codexStartupScreenshotWindow&&__codexArgs.push(\`--startup-screenshot-window\`);break}case\`workspaceObserve\`:__codexArgs=[\`workspace\`,\`observe\`],__codexPushId(\`--id\`,__codexWorkspaceId),__codexObserveScreenshot!==!1&&__codexArgs.push(\`--screenshot\`),__codexIncludeHidden&&__codexArgs.push(\`--include-hidden\`),Number.isFinite(Number(__codexEventsTail))&&__codexArgs.push(\`--events-tail\`,String(Number(__codexEventsTail)));break;case\`workspaceStop\`:__codexArgs=[\`workspace\`,\`stop\`],__codexPushId(\`--id\`,__codexWorkspaceId);break;case\`workspaceCleanup\`:__codexArgs=[\`workspace\`,\`cleanup\`],__codexDryRun&&__codexArgs.push(\`--dry-run\`),__codexPushId(\`--id\`,__codexCleanupId);break;default:throw Error(\`unsupported agent workspace action\`)}}catch(e){return{ok:!1,action:__codexActionName,message:e instanceof Error?e.message:String(e)}}if(__codexMcpConfig?.permissions_path)__codexArgs=[\`--permissions\`,__codexMcpConfig.permissions_path,...__codexArgs];let __codexParse=e=>{let t=String(e||\`\`).trim();if(t.length===0)return null;try{return JSON.parse(t)}catch{return{raw:t}}},__codexAttachScreenshot=e=>{try{let t=e?.screenshot?.path;if(typeof t===\`string\`&&t.length>0&&${fsVar}.existsSync(t)){let n=${fsVar}.readFileSync(t);e.screenshot.data_url=\`data:image/png;base64,\${n.toString(\`base64\`)}\`}}catch{}};try{let e=await new Promise((e,t)=>{let n=${childProcessVar}.execFile(__codexCommand,__codexArgs,{encoding:\`utf8\`,timeout:Number.isFinite(Number(__codexTimeoutMs))?Number(__codexTimeoutMs):15e3,maxBuffer:8388608},(n,r,i)=>{n?(n.stdout=r,n.stderr=i,t(n)):e({stdout:r,stderr:i})})}),t=__codexParse(e.stdout);__codexAttachScreenshot(t);return{ok:!0,action:__codexActionName,command:__codexCommand,args:__codexArgs,stdout:e.stdout,stderr:e.stderr,json:t}}catch(e){let t=__codexParse(e?.stdout);__codexAttachScreenshot(t);return{ok:!1,action:__codexActionName,command:__codexCommand,args:__codexArgs,message:e instanceof Error?e.message:String(e),code:e?.code??null,stdout:e?.stdout??\`\`,stderr:e?.stderr??\`\`,json:t}}finally{if(__codexTempPath)try{${fsVar}.rmSync(${pathVar}.dirname(__codexTempPath),{recursive:!0,force:!0})}catch{}}}`;
}

function agentWorkspaceMountPickerBridgeSource() {
  return `"linux-agent-workspace-pick-mount":async()=>{let __codexElectron;try{__codexElectron=require(\`electron\`)}catch(e){return{ok:!1,action:\`pickMount\`,message:\`file picker unavailable\`}}try{let e=await __codexElectron.dialog.showOpenDialog({title:\`Choose file or folder to mount\`,properties:[\`openFile\`,\`openDirectory\`,\`multiSelections\`]});let t=Array.isArray(e.filePaths)?e.filePaths:[];return{ok:!e.canceled&&t.length>0,action:\`pickMount\`,json:{canceled:!!e.canceled,path:t[0]||null,paths:t}}}catch(e){return{ok:!1,action:\`pickMount\`,message:e instanceof Error?e.message:String(e)}}}`;
}

function agentWorkspaceBrowserDataPickerBridgeSource() {
  return `"linux-agent-workspace-pick-browser-data":async()=>{let __codexElectron;try{__codexElectron=require(\`electron\`)}catch(e){return{ok:!1,action:\`pickBrowserData\`,message:\`file picker unavailable\`}}try{let e=await __codexElectron.dialog.showOpenDialog({title:\`Choose browser data folder\`,properties:[\`openDirectory\`]});let t=Array.isArray(e.filePaths)?e.filePaths:[];return{ok:!e.canceled&&t.length>0,action:\`pickBrowserData\`,json:{canceled:!!e.canceled,path:t[0]||null,paths:t}}}catch(e){return{ok:!1,action:\`pickBrowserData\`,message:e instanceof Error?e.message:String(e)}}}`;
}

function agentWorkspaceBrowserDataCopyBridgeSource({ fsVar, pathVar }) {
  return `"linux-agent-workspace-copy-browser-data":async({sourcePath:__codexSourcePath,profileId:__codexProfileId}={})=>{let __codexString=e=>typeof e===\`string\`&&e.trim().length>0?e.trim():null,__codexHome=()=>typeof process.env.HOME===\`string\`&&process.env.HOME.trim().length>0?process.env.HOME.trim():null,__codexExpand=e=>{let t=__codexString(e),n=__codexHome();return t&&t.startsWith(\`~/\`)&&n?${pathVar}.join(n,t.slice(2)):t},__codexSafe=e=>String(e||\`browser-session\`).toLowerCase().replace(/[^a-z0-9._-]+/g,\`-\`).replace(/^-+|-+$/g,\`\`)||\`browser-session\`;try{let e=__codexExpand(__codexSourcePath);if(!e)return{ok:!1,action:\`copyBrowserData\`,message:\`browser data folder is required\`};if(!${fsVar}.existsSync(e)||!${fsVar}.statSync(e).isDirectory())return{ok:!1,action:\`copyBrowserData\`,message:\`browser data folder does not exist\`,json:{source_path:e}};let t=__codexSafe(__codexProfileId),n=__codexExpand(process.env.XDG_DATA_HOME)||(__codexHome()?${pathVar}.join(__codexHome(),\`.local\`,\`share\`):${pathVar}.join(process.env.TMPDIR||\`/tmp\`,\`codex-agent-workspace-data\`)),r=${pathVar}.join(n,\`agent-workspace-linux\`,\`browser-sessions\`,t);if(${fsVar}.existsSync(r))return{ok:!1,action:\`copyBrowserData\`,message:\`managed browser-session copy already exists\`,json:{source_path:e,path:r,profile_id:t}};${fsVar}.mkdirSync(${pathVar}.dirname(r),{recursive:!0,mode:448});let a=new Set([\`SingletonCookie\`,\`SingletonLock\`,\`SingletonSocket\`,\`lockfile\`,\`.parentlock\`]);await ${fsVar}.promises.cp(e,r,{recursive:!0,force:!1,errorOnExist:!0,filter:(e)=>{let t=${pathVar}.basename(e);return !a.has(t)&&!t.startsWith(\`Singleton\`)}});return{ok:!0,action:\`copyBrowserData\`,json:{source_path:e,path:r,profile_id:t,copied:!0,excluded_lock_files:!0}}}catch(e){return{ok:!1,action:\`copyBrowserData\`,message:e instanceof Error?e.message:String(e)}}}`;
}

function agentWorkspaceBridgeWithWorkspaceStartSource(args) {
  return agentWorkspaceBridgeSource(args)
    .replace(
      `},"linux-agent-workspace":async`,
      `},${agentWorkspaceMountPickerBridgeSource()},${agentWorkspaceBrowserDataPickerBridgeSource()},${agentWorkspaceBrowserDataCopyBridgeSource(args)},"linux-agent-workspace":async`,
    )
    .replace(
    "case`workspaceStop`:",
    "case`workspaceStart`:{__codexArgs=[`workspace`,`start`],__codexDryRun&&__codexArgs.push(`--dry-run`),__codexAckHiddenWorkspace&&__codexArgs.push(`--ack-hidden-workspace`),__codexAckUnenforcedPolicy&&__codexArgs.push(`--ack-unenforced-policy`),__codexPushId(`--profile`,__codexProfileId),__codexPushId(`--id`,__codexWorkspaceId),__codexPushId(`--purpose`,__codexPurpose);break}case`workspaceStop`:",
  );
}

function agentWorkspaceActionBridgeSource(args) {
  const fullSource = agentWorkspaceBridgeWithWorkspaceStartSource(args);
  const marker = `"linux-agent-workspace":async`;
  const index = fullSource.indexOf(marker);
  if (index === -1) {
    throw new Error("could not find generated agent workspace action bridge");
  }
  return fullSource.slice(index);
}

function ensureAgentWorkspaceBridgeEntry(currentSource, entrySource) {
  const match = entrySource.match(/^"([^"]+)":/);
  if (!match) {
    return currentSource;
  }
  const marker = `"${match[1]}":async`;
  if (currentSource.includes(marker)) {
    return currentSource;
  }
  return currentSource.replace(`"linux-agent-workspace":async`, `${entrySource},"linux-agent-workspace":async`);
}

function replaceAgentWorkspaceActionBridge(currentSource, actionBridgeSource) {
  const marker = `"linux-agent-workspace":async`;
  const start = currentSource.indexOf(marker);
  if (start === -1) {
    return currentSource;
  }

  const getGlobalStateIndex = currentSource.indexOf(`,"get-global-state":async`, start);
  if (getGlobalStateIndex !== -1) {
    return `${currentSource.slice(0, start)}${actionBridgeSource}${currentSource.slice(getGlobalStateIndex)}`;
  }

  const arrowBodyIndex = currentSource.indexOf("=>{", start);
  if (arrowBodyIndex === -1) {
    return currentSource;
  }
  const bodyStart = arrowBodyIndex + 2;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = bodyStart; index < currentSource.length; index += 1) {
    const char = currentSource[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return `${currentSource.slice(0, start)}${actionBridgeSource}${currentSource.slice(index + 1)}`;
      }
    }
  }
  return currentSource;
}

function applyAgentWorkspaceMainBridgePatch(currentSource) {
  const patchName = "agent workspace main bridge patch";
  if (currentSource.includes('"linux-agent-workspace":async')) {
    const childProcessVar = requireName(currentSource, "node:child_process");
    const fsVar = requireName(currentSource, "node:fs");
    const pathVar = requireName(currentSource, "node:path");
    if (childProcessVar == null || fsVar == null || pathVar == null) {
      warn("Could not find Node module aliases for agent workspace bridge upgrade", patchName);
      return currentSource;
    }
    const args = { childProcessVar, fsVar, pathVar };
    let patchedSource = currentSource;
    patchedSource = ensureAgentWorkspaceBridgeEntry(patchedSource, agentWorkspaceAppPickerBridgeSource(args));
    patchedSource = ensureAgentWorkspaceBridgeEntry(patchedSource, agentWorkspaceMountPickerBridgeSource());
    patchedSource = ensureAgentWorkspaceBridgeEntry(patchedSource, agentWorkspaceBrowserDataPickerBridgeSource());
    patchedSource = ensureAgentWorkspaceBridgeEntry(patchedSource, agentWorkspaceBrowserDataCopyBridgeSource(args));
    return replaceAgentWorkspaceActionBridge(patchedSource, agentWorkspaceActionBridgeSource(args));
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

const CONVERSATION_RUNTIME_VERSION = "agent-workspace-conversation-v10";

function agentWorkspaceConversationRuntimeSource() {
  return String.raw`
;(()=>{const VERSION=${JSON.stringify(CONVERSATION_RUNTIME_VERSION)};if(globalThis.codexLinuxAgentWorkspaceConversationVersion===VERSION)return;try{globalThis.codexLinuxAgentWorkspaceConversationCleanup?.()}catch{}globalThis.codexLinuxAgentWorkspaceConversationVersion=VERSION;
const METHOD="linux-agent-workspace",LAYOUT_KEY="codex-linux-agent-workspace-layout-v1",MIN_WIDTH=280,MIN_HEIGHT=220;let seq=0,pending=new Map,state={panel:null,viewport:null,media:null,head:null,title:null,meta:null,stop:null,revoke:null,refresh:null,resize:null,error:null,activeId:null,visible:false,pollTimer:null,viewTimer:null,viewObserver:null,busy:false,lastImage:"",layout:null,drag:null};
function onMessage(e){let t=e?.data;if(!t||typeof t!="object"||t.type!=="fetch-response")return;let n=pending.get(t.requestId);if(!n)return;pending.delete(t.requestId);clearTimeout(n.timer);if(t.responseType==="success"){let e=null;try{e=t.bodyJsonString?JSON.parse(t.bodyJsonString):null}catch{}n.resolve({status:t.status,body:e})}else n.reject(Error(t.error||"fetch failed"))}
window.addEventListener("message",onMessage);
function dispatch(payload){let bridge=window.electronBridge,event=new CustomEvent("codex-message-from-view",{detail:payload});if(bridge?.sendMessageFromView){event.__codexForwardedViaBridge=!0;bridge.sendMessageFromView(payload).catch(()=>{})}window.dispatchEvent(event)}
function post(params,timeoutMs=12000){let requestId="codex-linux-agent-workspace-"+ ++seq;let payload={type:"fetch",hostId:"local",requestId,method:"POST",url:"vscode://codex/"+METHOD,body:JSON.stringify(params??{})};return new Promise((resolve,reject)=>{let timer=setTimeout(()=>{pending.delete(requestId);reject(Error("timeout"))},timeoutMs);pending.set(requestId,{resolve,reject,timer});dispatch(payload)})}
function bridgeError(result){let body=result?.body;if(body?.ok===!1)return body.message||"agent workspace command failed";if(body?.json?.ok===!1)return body.json.message||"agent workspace command failed";return null}
function workspaceRunning(e){return e?.running===!0||e?.status?.ready===!0}
function workspaceId(e){return e?.id||e?.status?.id||e?.manifest?.id||"default"}
function workspaceLabel(e){return e?.status?.purpose||e?.manifest?.purpose||e?.status?.profile_id||e?.manifest?.profile_id||workspaceId(e)}
function shortText(value){return typeof value==="string"&&value.trim()?value.trim():null}
function runningApps(apps){return Array.isArray(apps)?apps.filter(e=>e?.running!==!1):[]}
function appLabel(app){let name=shortText(app?.name)||shortText(app?.id);if(name)return name;let command=Array.isArray(app?.command)?app.command:[];let first=shortText(command[0]);return first?first.split("/").filter(Boolean).pop():null}
function appSummary(apps){let count=runningApps(apps).length;if(count===0)return"No apps running";return count+" app"+(count===1?"":"s")+" running"}
function appDebugSummary(apps){let running=runningApps(apps),count=running.length;if(count===0)return"0 apps";let names=running.map(appLabel).filter(Boolean).slice(0,3).join(", "),extra=count>3?" +"+(count-3):"";return count+" app"+(count===1?"":"s")+(names?": "+names+extra:"")}
function policySummary(status){let policy=status?.applied_policy||{},profile=shortText(status?.profile_id)||shortText(policy?.profile_id),network=shortText(policy?.network?.mode),mountCount=Array.isArray(policy?.mounts)?policy.mounts.length:0,parts=[];profile&&parts.push("Profile "+profile);network&&network!=="inherit_host"&&parts.push("Network "+network.replaceAll("_","-"));mountCount>0&&parts.push(mountCount+" mount"+(mountCount===1?"":"s"));return parts.join(" · ")}
function statusText(status,apps){return ["Workspace active",policySummary(status),appSummary(apps)].filter(Boolean).join(" · ")}
function statusDetailText(status,apps){let display=status?.display?"Display "+status.display:"";return [display,policySummary(status),appDebugSummary(apps)].filter(Boolean).join(" · ")}
function inSettingsView(){let text=String(document.body?.innerText||document.body?.textContent||"").trim();return /^Back to app\s+App\s+General\s+Appearance\s+Connections\b/.test(text)}
function scheduleViewCheck(){if(state.viewTimer)clearTimeout(state.viewTimer);state.viewTimer=setTimeout(()=>{state.viewTimer=null;if(inSettingsView())hide();else if(!state.visible)refresh(!0)},80)}
function watchViewChanges(){if(state.viewObserver||typeof MutationObserver!="function"||!document.body)return;state.viewObserver=new MutationObserver(scheduleViewCheck);state.viewObserver.observe(document.body,{childList:!0,subtree:!0,characterData:!0})}
function storage(){try{return globalThis.localStorage||null}catch{return null}}
function finite(value,fallback){let number=Number(value);return Number.isFinite(number)?number:fallback}
function viewportSize(){let root=document.documentElement||{};return{width:Math.max(320,finite(window.innerWidth||root.clientWidth,1280)),height:Math.max(260,finite(window.innerHeight||root.clientHeight,800))}}
function defaultLayout(){let viewport=viewportSize(),width=Math.min(420,Math.max(MIN_WIDTH,viewport.width-36)),height=Math.min(320,Math.max(MIN_HEIGHT,viewport.height-36)),maxTop=Math.max(10,viewport.height-height-10);return{left:Math.max(10,viewport.width-width-18),top:Math.min(54,maxTop),width,height}}
function readLayout(){let store=storage();if(!store)return null;try{let value=store.getItem(LAYOUT_KEY);return value?JSON.parse(value):null}catch{return null}}
function saveLayout(){let store=storage();if(!store||!state.layout)return;try{store.setItem(LAYOUT_KEY,JSON.stringify(state.layout))}catch{}}
function clampLayout(layout){let base=defaultLayout(),viewport=viewportSize(),maxWidth=Math.max(MIN_WIDTH,viewport.width-20),maxHeight=Math.max(MIN_HEIGHT,viewport.height-20),width=Math.min(maxWidth,Math.max(MIN_WIDTH,finite(layout?.width,base.width))),height=Math.min(maxHeight,Math.max(MIN_HEIGHT,finite(layout?.height,base.height))),maxLeft=Math.max(10,viewport.width-width-10),maxTop=Math.max(10,viewport.height-height-10),left=Math.min(maxLeft,Math.max(10,finite(layout?.left,base.left))),top=Math.min(maxTop,Math.max(10,finite(layout?.top,base.top)));return{left,top,width,height}}
function setPanelLayout(layout,persist=false){state.layout=clampLayout(layout);if(state.panel){state.panel.style.left=state.layout.left+"px";state.panel.style.top=state.layout.top+"px";state.panel.style.width=state.layout.width+"px";state.panel.style.height=state.layout.height+"px";state.panel.style.right="auto";state.panel.style.bottom="auto"}if(persist)saveLayout()}
function eventPoint(event){return{x:finite(event?.clientX,event?.touches?.[0]?.clientX??0),y:finite(event?.clientY,event?.touches?.[0]?.clientY??0)}}
function beginInteraction(kind,event){if(event?.button!=null&&event.button!==0)return;if(kind==="move"&&event?.target?.closest?.("button"))return;let point=eventPoint(event),layout=state.layout||defaultLayout();state.drag={kind,startX:point.x,startY:point.y,layout:{...layout}};event?.preventDefault?.();try{event?.currentTarget?.setPointerCapture?.(event.pointerId)}catch{}window.addEventListener("pointermove",onPointerMove);window.addEventListener("pointerup",endInteraction,{once:!0});window.addEventListener("pointercancel",endInteraction,{once:!0})}
function onPointerMove(event){if(!state.drag)return;let point=eventPoint(event),dx=point.x-state.drag.startX,dy=point.y-state.drag.startY,next={...state.drag.layout};if(state.drag.kind==="move"){next.left+=dx;next.top+=dy}else{next.width+=dx;next.height+=dy}setPanelLayout(next,!1)}
function endInteraction(){if(!state.drag)return;state.drag=null;saveLayout();window.removeEventListener?.("pointermove",onPointerMove);window.removeEventListener?.("pointerup",endInteraction);window.removeEventListener?.("pointercancel",endInteraction)}
function workspaceViewerThemeOverrides(){return"/* codex-linux-agent-workspace-theme-v10 */"+
".codex-linux-agent-workspace-panel{border:1px solid var(--color-token-border-default,var(--color-token-border,var(--token-border-default,var(--token-border,rgba(127,127,127,.28)))));border-radius:var(--radius-lg,8px);background:var(--color-token-bg-fog,var(--color-background-elevated-secondary,var(--color-token-main-surface-secondary,var(--token-main-surface-secondary,#3f424b))));color:var(--color-token-text-primary,var(--color-token-foreground,var(--text-primary,var(--token-foreground,#f4f4f5))));box-shadow:0 12px 28px rgba(0,0,0,.18);font:var(--text-sm,12px) var(--font-sans,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif)}"+
".codex-linux-agent-workspace-head{padding:7px 8px;border-bottom:1px solid var(--color-token-border-default,var(--token-border-default,rgba(127,127,127,.22)));background:var(--color-token-bg-fog,var(--color-background-elevated-secondary,var(--token-main-surface-secondary,rgba(127,127,127,.10))));color:var(--color-token-text-primary,var(--color-token-foreground,var(--text-primary,var(--token-foreground,#f4f4f5))))}"+
".codex-linux-agent-workspace-title{font-size:var(--text-sm,12px);font-weight:500}.codex-linux-agent-workspace-dot{width:7px;height:7px;box-shadow:0 0 0 2px color-mix(in srgb,#22c55e 18%,transparent)}"+
".codex-linux-agent-workspace-actions{align-items:center;gap:4px;padding:2px;border:1px solid var(--color-token-border-default,var(--token-border-default,rgba(127,127,127,.20)));border-radius:var(--radius-lg,8px);background:color-mix(in srgb,var(--color-token-main-surface-primary,var(--token-main-surface-primary,#fff)) 82%,transparent)}"+
".codex-linux-agent-workspace-actions button{height:24px;min-width:52px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--radius-md,6px);border:1px solid transparent;background:transparent;color:var(--color-token-text-secondary,var(--color-token-description-foreground,var(--text-secondary,var(--token-description-foreground,#b9b9b9))));padding:0 8px;font-weight:500;line-height:1;transition:background-color .12s ease,color .12s ease,border-color .12s ease,transform .12s ease}"+
".codex-linux-agent-workspace-actions button:hover{background:var(--color-token-list-hover-background,var(--token-list-hover-background,rgba(127,127,127,.14)));color:var(--color-token-text-primary,var(--color-token-foreground,var(--text-primary,var(--token-foreground,#fff))))}.codex-linux-agent-workspace-actions button:active{transform:translateY(1px)}.codex-linux-agent-workspace-actions [data-action=stop]{color:var(--color-token-text-primary,var(--text-primary,currentColor))}.codex-linux-agent-workspace-actions [data-action=revoke]{border-color:color-mix(in srgb,var(--color-red-500,#ef4444) 22%,transparent);color:var(--color-token-text-primary,var(--text-primary,currentColor))}.codex-linux-agent-workspace-actions [data-action=revoke]:hover{background:color-mix(in srgb,var(--color-red-500,#ef4444) 13%,transparent);border-color:color-mix(in srgb,var(--color-red-500,#ef4444) 38%,transparent)}"+
".codex-linux-agent-workspace-viewport{padding:6px;background:var(--color-token-main-surface-primary,var(--color-background-elevated-primary,var(--token-main-surface-primary,rgba(20,20,20,.08))))}.codex-linux-agent-workspace-shot{border:1px solid var(--color-token-border-default,var(--token-border-default,rgba(127,127,127,.24)));border-radius:var(--radius-md,6px);background:var(--color-background-surface-under,var(--color-token-main-surface-secondary,#111))}"+
".codex-linux-agent-workspace-empty{color:var(--color-token-text-secondary,var(--color-token-description-foreground,var(--text-secondary,var(--token-description-foreground,#aaa))))}.codex-linux-agent-workspace-meta{margin:6px 8px 8px;padding:6px 30px 6px 9px;border:1px solid var(--color-token-border-default,var(--token-border-default,rgba(127,127,127,.18)));border-radius:var(--radius-md,6px);background:color-mix(in srgb,var(--color-token-bg-fog,var(--color-background-elevated-secondary,var(--token-main-surface-secondary,#202124))) 88%,transparent);box-shadow:0 1px 0 color-mix(in srgb,var(--color-token-main-surface-primary,var(--token-main-surface-primary,#fff)) 18%,transparent) inset,0 6px 14px rgba(0,0,0,.10);backdrop-filter:blur(8px) saturate(1.05);color:var(--color-token-text-secondary,var(--color-token-description-foreground,var(--text-secondary,var(--token-description-foreground,#aaa))));font-size:var(--text-xs,11px);line-height:1.25;letter-spacing:0}.codex-linux-agent-workspace-error{margin:0 8px 8px;padding:7px 9px;border:1px solid color-mix(in srgb,var(--color-red-500,#ef4444) 28%,transparent);border-radius:var(--radius-md,6px);background:color-mix(in srgb,var(--color-red-500,#ef4444) 10%,transparent);color:var(--color-token-text-primary,var(--text-primary,#fff));white-space:normal}"+
".codex-linux-agent-workspace-resize{right:8px;bottom:10px;border-radius:var(--radius-sm,5px);color:var(--color-token-text-secondary,var(--color-token-description-foreground,var(--text-secondary,var(--token-description-foreground,#888))));opacity:.72;transition:background-color .12s ease,color .12s ease,opacity .12s ease}.codex-linux-agent-workspace-resize:hover{background:var(--color-token-list-hover-background,var(--token-list-hover-background,rgba(127,127,127,.14)));color:var(--color-token-text-primary,var(--color-token-foreground,var(--text-primary,var(--token-foreground,#fff))));opacity:1}"}
function installInteractions(){let style=document.getElementById("codex-linux-agent-workspace-style");if(style&&!style.textContent.includes("codex-linux-agent-workspace-theme-v10"))style.textContent+=workspaceViewerThemeOverrides();state.head?.addEventListener("pointerdown",event=>beginInteraction("move",event));state.resize?.addEventListener("pointerdown",event=>beginInteraction("resize",event));window.addEventListener("resize",()=>{if(state.layout)setPanelLayout(state.layout,!0)})}
function removeOldPanels(){let panels=[];try{panels=Array.from(document.body?.querySelectorAll?.(".codex-linux-agent-workspace-panel")||[])}catch{}if(panels.length===0){let existing=document.body?.querySelector?.(".codex-linux-agent-workspace-panel");existing&&panels.push(existing)}for(let panel of panels)panel?.remove?.()}
function ensureUi(){if(state.panel||typeof document==="undefined"||!document.body)return;removeOldPanels();let style=document.getElementById("codex-linux-agent-workspace-style");if(!style){style=document.createElement("style");style.id="codex-linux-agent-workspace-style";document.head?.appendChild?.(style)}style.textContent=".codex-linux-agent-workspace-panel{position:fixed;z-index:2147482600;min-width:280px;min-height:220px;max-width:calc(100vw - 20px);max-height:calc(100vh - 20px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--token-border,var(--token-border-default,rgba(127,127,127,.32)));border-radius:8px;background:var(--token-bg-primary,var(--token-main-surface-primary,var(--token-surface-primary,#111)));color:var(--text-primary,var(--token-foreground,var(--token-text-primary,#111)));box-shadow:0 12px 38px rgba(0,0,0,.24);font:12px system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}.codex-linux-agent-workspace-panel[hidden]{display:none}.codex-linux-agent-workspace-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-bottom:1px solid var(--token-border,var(--token-border-default,rgba(127,127,127,.22)));background:var(--token-main-surface-secondary,var(--token-list-hover-background,rgba(127,127,127,.08)));cursor:grab;user-select:none}.codex-linux-agent-workspace-head:active{cursor:grabbing}.codex-linux-agent-workspace-title{min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.codex-linux-agent-workspace-dot{width:8px;height:8px;border-radius:999px;background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.14);flex:0 0 auto}.codex-linux-agent-workspace-actions{display:flex;gap:6px;flex-shrink:0}.codex-linux-agent-workspace-actions button{height:24px;border-radius:6px;border:1px solid var(--token-border,var(--token-border-default,rgba(127,127,127,.32)));background:transparent;color:inherit;padding:0 7px;cursor:pointer}.codex-linux-agent-workspace-actions button:hover{background:var(--token-list-hover-background,var(--token-main-surface-secondary,rgba(127,127,127,.10)))}.codex-linux-agent-workspace-actions [data-action=revoke]{color:var(--token-error-foreground,#b91c1c);border-color:color-mix(in srgb,currentColor 35%,transparent)}.codex-linux-agent-workspace-viewport{position:relative;flex:1;min-height:120px;display:flex;align-items:center;justify-content:center;background:var(--token-main-surface-secondary,var(--token-list-hover-background,rgba(127,127,127,.08)))}.codex-linux-agent-workspace-shot{display:block;width:100%;height:100%;object-fit:contain;background:#050505}.codex-linux-agent-workspace-empty{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:16px;color:var(--text-secondary,var(--token-description-foreground,var(--token-text-secondary,#666)));text-align:center}.codex-linux-agent-workspace-meta,.codex-linux-agent-workspace-error{flex:0 0 auto;padding:7px 10px;color:var(--text-secondary,var(--token-description-foreground,var(--token-text-secondary,#555)));border-top:1px solid var(--token-border,var(--token-border-default,rgba(127,127,127,.18)));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.codex-linux-agent-workspace-error{color:var(--token-error-foreground,#b91c1c);white-space:normal}.codex-linux-agent-workspace-resize{position:absolute;right:2px;bottom:2px;width:18px;height:18px;border:0;background:transparent;color:var(--text-secondary,var(--token-description-foreground,var(--token-text-secondary,#777)));cursor:nwse-resize}.codex-linux-agent-workspace-resize:before,.codex-linux-agent-workspace-resize:after{content:\"\";position:absolute;right:4px;bottom:4px;border-right:1px solid currentColor;border-bottom:1px solid currentColor}.codex-linux-agent-workspace-resize:before{width:10px;height:10px;opacity:.55}.codex-linux-agent-workspace-resize:after{width:5px;height:5px;opacity:.85}@media (max-width:640px){.codex-linux-agent-workspace-panel{min-width:240px}.codex-linux-agent-workspace-actions button{padding:0 6px}}";let panel=document.createElement("section");panel.className="codex-linux-agent-workspace-panel";panel.hidden=true;panel.innerHTML='<div class="codex-linux-agent-workspace-head" title="Drag workspace viewer"><span class="codex-linux-agent-workspace-dot" aria-hidden="true"></span><div class="codex-linux-agent-workspace-title"></div><div class="codex-linux-agent-workspace-actions"><button type="button" data-action="refresh" title="Refresh workspace view">Refresh</button><button type="button" data-action="stop" title="Stop workspace">Stop</button><button type="button" data-action="revoke" title="Stop workspace and remove its runtime files">Revoke</button></div></div><div class="codex-linux-agent-workspace-viewport"><div class="codex-linux-agent-workspace-empty">Workspace is running. No windows yet.</div></div><div class="codex-linux-agent-workspace-meta"></div><div class="codex-linux-agent-workspace-error" hidden></div><button type="button" class="codex-linux-agent-workspace-resize" aria-label="Resize workspace viewer" title="Resize workspace viewer"></button>';document.body.appendChild(panel);state.panel=panel;state.head=panel.querySelector(".codex-linux-agent-workspace-head");state.viewport=panel.querySelector(".codex-linux-agent-workspace-viewport");state.media=panel.querySelector(".codex-linux-agent-workspace-empty");state.title=panel.querySelector(".codex-linux-agent-workspace-title");state.meta=panel.querySelector(".codex-linux-agent-workspace-meta");state.error=panel.querySelector(".codex-linux-agent-workspace-error");state.refresh=panel.querySelector("[data-action='refresh']");state.stop=panel.querySelector("[data-action='stop']");state.revoke=panel.querySelector("[data-action='revoke']");state.resize=panel.querySelector(".codex-linux-agent-workspace-resize");setPanelLayout(readLayout()||defaultLayout(),!1);installInteractions();state.refresh?.addEventListener("click",e=>{e.preventDefault();refresh(!0)});state.stop?.addEventListener("click",e=>{e.preventDefault();stopActive()});state.revoke?.addEventListener("click",e=>{e.preventDefault();revokeActive()})}
function showError(message){ensureUi();if(state.error){state.error.hidden=!message;state.error.textContent=message||""}}
function hide(){ensureUi();state.visible=false;state.activeId=null;state.lastImage="";if(state.panel)state.panel.hidden=true;showError("")}
function setImage(dataUrl){if(!state.panel||!dataUrl||dataUrl===state.lastImage)return;let img=document.createElement("img");img.className="codex-linux-agent-workspace-shot";img.alt="Agent workspace screenshot";img.src=dataUrl;if(state.media)state.media.replaceWith(img);else state.viewport?.appendChild?.(img);state.media=img;state.lastImage=dataUrl}
function render(workspace,observe){if(inSettingsView()){hide();return}ensureUi();let status=observe?.json?.status||workspace?.status||workspace?.manifest||{},apps=Array.isArray(status.apps)?status.apps:workspace?.status?.apps||[],id=workspaceId(workspace),meta=statusText(status,apps)||"Workspace active",detail=statusDetailText(status,apps)||id;state.visible=true;state.activeId=id;if(state.panel)state.panel.hidden=false;if(state.title)state.title.textContent=workspaceLabel(workspace);if(state.meta){state.meta.textContent=meta;state.meta.title=detail}setImage(observe?.json?.screenshot?.data_url);showError("")}
async function activeWorkspace(){let list=await post({action:"workspaceList"},10000),error=bridgeError(list);if(error)throw Error(error);let workspaces=list?.body?.json?.workspaces||[];return workspaces.find(workspaceRunning)||null}
async function refresh(force=false){if(state.busy&&!force)return;state.busy=true;try{let workspace=await activeWorkspace();if(!workspace){hide();return}let id=workspaceId(workspace);let observe=await post({action:"workspaceObserve",workspaceId:id,observeScreenshot:true,includeHidden:true,eventsTail:8},15000),error=bridgeError(observe);if(error)throw Error(error);render(workspace,observe?.body)}catch(e){state.visible?showError(e instanceof Error?e.message:String(e)):hide()}finally{state.busy=false}}
async function stopActive(){let id=state.activeId;if(!id)return;try{let result=await post({action:"workspaceStop",workspaceId:id},15000),error=bridgeError(result);if(error){showError(error);return}}catch(e){showError(e instanceof Error?e.message:String(e));return}hide();setTimeout(()=>refresh(!0),600)}
async function revokeActive(){let id=state.activeId;if(!id)return;try{let stopped=await post({action:"workspaceStop",workspaceId:id},15000),stopError=bridgeError(stopped);if(stopError){showError(stopError);return}let cleaned=await post({action:"workspaceCleanup",cleanupId:id},15000),cleanupError=bridgeError(cleaned);if(cleanupError){showError(cleanupError);return}}catch(e){showError(e instanceof Error?e.message:String(e));return}hide();setTimeout(()=>refresh(!0),600)}
function cleanup(){state.pollTimer&&globalThis.clearInterval?.(state.pollTimer);state.viewTimer&&globalThis.clearTimeout?.(state.viewTimer);state.viewObserver?.disconnect?.();state.pollTimer=null;state.viewTimer=null;state.viewObserver=null;state.panel?.remove?.();state.panel=null;removeOldPanels()}
globalThis.codexLinuxAgentWorkspaceConversationCleanup=cleanup;
function start(){if(state.pollTimer)return;watchViewChanges();refresh(!0);state.pollTimer=setInterval(()=>refresh(!1),4000)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();})();
`;
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
var NETWORK_MODE_OPTIONS=[
  {value:"disabled",label:"Closed"},
  {value:"local_only",label:"Local"},
  {value:"inherit_host",label:"Open"}
];

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

function responseOk(response){
  return response?.ok!==false&&response?.json?.ok!==false;
}

function profileFromResponse(response){
  var candidate=response?.json?.profile??response?.json;
  return responseOk(response)&&candidate&&typeof candidate==="object"&&!Array.isArray(candidate)&&typeof candidate.id==="string"?candidate:null;
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
  return "Local hosts";
}

function networkHostPlaceholder(mode){
  return "localhost:3000";
}

function cleanupProcessActionCount(cleanup){
  var entries=[cleanup?.removed,cleanup?.candidates,cleanup?.skipped].flatMap(function(value){return Array.isArray(value)?value:[];});
  return entries.reduce(function(count,entry){return count+(Array.isArray(entry?.process_cleanup)?entry.process_cleanup.length:0);},0);
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
    var processActions=cleanupProcessActionCount(result.json);
    var processText=processActions>0?", "+processActions+" process action"+(processActions===1?"":"s"):"";
    return result.json.dry_run?"Cleanup preview: "+candidates+" stale"+processText:"Cleanup: "+removed+" removed, "+skipped+" skipped"+processText;
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

function mcpConfigView(config){
  if(!config)return null;
  var locked=config.restricted===true;
  var configured=config.configured===true;
  var label=config.configured==null?"Checking":locked?"MCP locked":configured?"MCP open":"MCP not configured";
  var detail=config.permissions_path||config.message||config.config_path||"No permission ceiling";
  return h("div",{className:"rounded-md border border-token-border-default bg-token-bg-primary p-3 text-sm"},
    h("div",{className:"mb-1 flex items-center justify-between gap-2"},
      h("span",{className:"font-medium text-token-text-primary"},"MCP permissions"),
      statusPill(label,locked?"warn":configured?"idle":"stopped")
    ),
    h("div",{className:"truncate text-token-text-tertiary",title:String(detail||"")},detail),
    locked?h("div",{className:"mt-2 text-xs text-token-text-secondary"},"This page reuses the configured permission file for CLI workspace actions. Restart Codex after changing MCP config."):null,
    config.error?h("div",{className:"mt-2 text-xs text-red-600 dark:text-red-300"},config.error):null
  );
}

function permissionsPathFromArgs(args){
  if(!Array.isArray(args))return null;
  for(var index=0;index<args.length;index+=1){
    var value=args[index];
    if(value==="--permissions"&&typeof args[index+1]==="string"&&args[index+1].trim())return args[index+1].trim();
    if(typeof value==="string"&&value.startsWith("--permissions=")){
      var path=value.slice("--permissions=".length).trim();
      if(path)return path;
    }
  }
  return null;
}

function mcpConfigFromResponses(mcpResponse,commandResponse){
  if(mcpResponse?.json&&typeof mcpResponse.json==="object")return mcpResponse.json;
  var permissionsPath=permissionsPathFromArgs(commandResponse?.args);
  if(permissionsPath)return{
    configured:true,
    restricted:true,
    permissions_path:permissionsPath,
    message:"MCP permission ceiling is active for workspace actions"
  };
  if(mcpResponse&&mcpResponse.ok===false)return{
    configured:false,
    restricted:false,
    message:mcpResponse.message||"MCP permissions could not be inspected",
    error:mcpResponse.message||null
  };
  return null;
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
  var mcpConfigState=React.useState({configured:null,restricted:false,message:"Inspecting MCP permissions"});
  var mcpConfig=mcpConfigState[0];
  var setMcpConfig=mcpConfigState[1];
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
  var browserSessionState=React.useState(null);
  var browserSessionDraft=browserSessionState[0];
  var setBrowserSessionDraft=browserSessionState[1];

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
      callAgentWorkspace("mcpConfig"),
      callAgentWorkspace("profileList"),
      callAgentWorkspace("workspaceList")
    ]);
    var nextMcpConfig=mcpConfigFromResponses(responses[0],responses[2]);
    setMcpConfig(nextMcpConfig||{configured:false,restricted:false,message:"No MCP permission ceiling detected"});
    if(Array.isArray(responses[1]?.json?.profiles))setProfiles(responses[1].json.profiles);
    if(Array.isArray(responses[2]?.json?.workspaces))setWorkspaces(responses[2].json.workspaces);
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
  var showNetworkHosts=networkMode==="local_only";
  var networkModeOptions=NETWORK_MODE_OPTIONS.some(function(option){return option.value===networkMode;})
    ? NETWORK_MODE_OPTIONS
    : [{value:networkMode,label:"Advanced: "+networkMode.replaceAll("_"," ")}].concat(NETWORK_MODE_OPTIONS);
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
      var loaded=profileFromResponse(response);
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

  function uniqueProfileId(base){
    var existing=new Set(profiles.map(profileId));
    if(!existing.has(base))return base;
    var index=2;
    while(existing.has(base+"-"+index))index+=1;
    return base+"-"+index;
  }

  async function createProjectProfile(){
    try{
      var pick=await __post("linux-agent-workspace-pick-mount",{params:{}});
      setResult(pick);
      var hostPath=pick?.json?.path;
      if(!pick?.ok||!hostPath)return;
      var base=hostPath.split(/[\\/]+/).filter(Boolean).pop()||"project-dev";
      var id=uniqueProfileId(base.toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"project-dev");
      var response=await callAgentWorkspace("profileTemplate",{templateKind:"project-dev",profileId:id,hostPath:hostPath});
      var template=profileFromResponse(response);
      openCreateProfileTemplate(template);
    }catch(error){
      setResult({ok:false,action:"pickMount",message:error instanceof Error?error.message:String(error)});
    }
  }

  async function createRestrictedChromeProfile(){
    var id=uniqueProfileId("restricted-chrome");
    var response=await callAgentWorkspace("profileTemplate",{templateKind:"restricted-chrome",profileId:id});
    var template=profileFromResponse(response);
    openCreateProfileTemplate(template);
  }

  async function createBrowserSessionProfile(){
    try{
      var pick=await __post("linux-agent-workspace-pick-browser-data",{params:{}});
      setResult(pick);
      var dataDir=pick?.json?.path;
      if(!pick?.ok||!dataDir)return;
      setBrowserSessionDraft({sourcePath:dataDir,profileId:uniqueProfileId("browser-session"),useCopy:true});
      setEditingProfile(false);
    }catch(error){
      setResult({ok:false,action:"pickBrowserData",message:error instanceof Error?error.message:String(error)});
    }
  }

  function updateBrowserSessionDraft(mutator){
    setBrowserSessionDraft(function(current){
      if(!current)return current;
      var next={...current};
      mutator(next);
      return next;
    });
  }

  async function finishBrowserSessionProfile(){
    if(!browserSessionDraft?.sourcePath||!browserSessionDraft?.profileId)return;
    var dataDir=browserSessionDraft.sourcePath;
    if(browserSessionDraft.useCopy){
      var copy=await __post("linux-agent-workspace-copy-browser-data",{params:{sourcePath:browserSessionDraft.sourcePath,profileId:browserSessionDraft.profileId}});
      setResult(copy);
      if(!copy?.ok||!copy?.json?.path)return;
      dataDir=copy.json.path;
    }else if(!window.confirm("Use this browser data folder directly? Close the host browser first to avoid profile locks or corruption.")){
      return;
    }
    var response=await callAgentWorkspace("profileTemplate",{templateKind:"browser-session",profileId:browserSessionDraft.profileId,userDataDir:dataDir});
    var template=profileFromResponse(response);
    if(template&&browserSessionDraft.useCopy){
      template.description=(template.description||"Browser session profile")+" Managed copy from "+browserSessionDraft.sourcePath+".";
    }
    if(template){
      setBrowserSessionDraft(null);
      openCreateProfileTemplate(template);
    }
  }

  function openCreateProfileTemplate(template){
    if(template){
      setFormMode("create");
      setSelectedProfileId("");
      setProfileJson(pretty(template));
      setPurpose("");
      setManualApp("");
      setNetworkHost("");
      setAdvancedOpen(false);
      setEditingProfile(true);
    }
  }

  function setNetworkMode(mode){
    updateProfile(function(next){
      next.network={...(next.network||{}),mode:mode};
      if(mode!=="local_only")delete next.network.allow_hosts;
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
      if(response?.ok&&response?.json?.startup_app)addStartupApp(response.json.startup_app);
      else if(response?.ok&&response?.json?.path)addStartupApp(startupAppFromPath(response.json.path));
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
        ),
        mcpConfig?mcpConfigView(mcpConfig):null
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
          h("div",{className:"flex gap-2"},
            button("Project template",activeAction==="profileTemplate",createProjectProfile),
            button("Chrome template",activeAction==="profileTemplate",createRestrictedChromeProfile),
            button("Browser session",activeAction==="profileTemplate",createBrowserSessionProfile),
            button("Create new",false,createProfile)
          )
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

      browserSessionDraft
        ? h("div",{className:"fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4",role:"presentation"},
          h("section",{className:"mx-auto flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col gap-3 overflow-y-auto rounded-md border border-token-border-default bg-token-bg-primary p-3 shadow-xl",role:"dialog","aria-modal":true},
            h("div",{className:"flex items-center justify-between gap-2"},
              h("div",{className:"text-sm font-medium text-token-text-primary"},"Prepare browser session"),
              statusPill("Account data","warn")
            ),
            h("div",{className:"rounded-md border border-yellow-500/30 bg-token-main-surface-secondary p-3 text-sm text-token-text-secondary"},"Browser profiles contain cookies and logged-in sessions. Copying the folder is safer for profile locks; direct use is for cases where you already made a dedicated browser profile."),
            field("Workspace name",browserSessionDraft.profileId,function(value){updateBrowserSessionDraft(function(next){next.profileId=value;});},"browser-session"),
            h("div",{className:"rounded-md border border-token-border-default p-3 text-sm"},
              h("div",{className:"mb-1 text-xs text-token-text-tertiary"},"Selected folder"),
              h("div",{className:"truncate text-token-text-primary",title:browserSessionDraft.sourcePath},browserSessionDraft.sourcePath)
            ),
            h("div",{className:"grid gap-2 md:grid-cols-2"},
              h("button",{
                type:"button",
                className:"rounded-md border p-3 text-left text-sm hover:bg-token-main-surface-secondary "+(browserSessionDraft.useCopy?"border-token-border-strong bg-token-main-surface-secondary":"border-token-border-default"),
                "aria-pressed":browserSessionDraft.useCopy,
                onClick:function(){updateBrowserSessionDraft(function(next){next.useCopy=true;});}
              },
                h("div",{className:"font-medium text-token-text-primary"},"Copy profile"),
                h("div",{className:"mt-1 text-xs text-token-text-secondary"},"Creates a managed copy under Agent Workspace data and skips browser lock files.")
              ),
              h("button",{
                type:"button",
                className:"rounded-md border p-3 text-left text-sm hover:bg-token-main-surface-secondary "+(!browserSessionDraft.useCopy?"border-token-border-strong bg-token-main-surface-secondary":"border-token-border-default"),
                "aria-pressed":!browserSessionDraft.useCopy,
                onClick:function(){updateBrowserSessionDraft(function(next){next.useCopy=false;});}
              },
                h("div",{className:"font-medium text-token-text-primary"},"Use folder directly"),
                h("div",{className:"mt-1 text-xs text-token-text-secondary"},"Mounts the selected folder read-write. Close the host browser first.")
              )
            ),
            h("div",{className:"flex flex-wrap justify-end gap-2"},
              button("Cancel",false,function(){setBrowserSessionDraft(null);}),
              button(browserSessionDraft.useCopy?"Create from copy":"Create direct",!browserSessionDraft.profileId?.trim()||activeAction==="profileTemplate",finishBrowserSessionProfile)
            )
          )
          )
        : null,

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
                  networkModeOptions.map(function(option){
                    return h("option",{key:option.value,value:option.value},option.label);
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
                button("Validate",!profile||profileFormLocked,function(){callAgentWorkspace("profileValidate",{profile:profile});}),
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

function agentWorkspaceApprovalEntriesHelperSource() {
  return `
function codexLinuxAgentWorkspaceApprovalEntries(params){
  if(!params||typeof params!="object"||Array.isArray(params))return null;
  if(params.params&&typeof params.params=="object"&&!Array.isArray(params.params))params=params.params;
  const keys=Object.keys(params);
  const marker=new Set(["acknowledge_hidden_workspace","acknowledge_unenforced_policy","ackHiddenWorkspace","ackUnenforcedPolicy","run_setup","runSetup","startup_wait_window","startupWaitWindow","startup_screenshot_window","startupScreenshotWindow","wait_window","waitWindow","screenshot_window","screenshotWindow","kill_on_timeout","killOnTimeout","timeout_ms","timeoutMs","tail_bytes","tailBytes","observe_screenshot","observeScreenshot","include_hidden","includeHidden","events_tail","eventsTail","cleanup_id","cleanupId","user_data_dir","userDataDir","browser_path","browserPath","host_path","hostPath","mounts","network","setup_commands","setupCommands","startup_apps","startupApps","require_enforced_policy","requireEnforcedPolicy","dry_run","dryRun","replace","purpose"]);
  const action=typeof params.action=="string"?params.action:"";
  const looksLikeAgentWorkspace=/^(workspace|profile)/i.test(action)||keys.some(key=>marker.has(key))||(Array.isArray(params.command)&&keys.some(key=>["id","profile","cwd","name","timeout_ms","timeoutMs","tail_bytes","tailBytes","kill_on_timeout","killOnTimeout","wait_window","waitWindow","screenshot_window","screenshotWindow"].includes(key)))||(params.profile&&typeof params.profile=="object"&&!Array.isArray(params.profile));
  if(!looksLikeAgentWorkspace)return null;
  const rows=[];
  const consumed=new Set();
  const add=(name,value,displayName)=>{
    consumed.add(name);
    if(value===void 0||value===null||value===""||(Array.isArray(value)&&value.length===0))return;
    rows.push({name,displayName,value:codexLinuxAgentWorkspaceApprovalValue(value)});
  };
  add("action",action,"Action");
  const profile=params.profile&&typeof params.profile=="object"&&!Array.isArray(params.profile)?params.profile:null;
  if(profile){
    add("profile",profile.id||"(inline profile)","Profile");
    add("description",profile.description,"Description");
    add("cwd",profile.cwd,"Working folder");
    add("network",profile.network,"Network");
    add("mounts",Array.isArray(profile.mounts)?profile.mounts.length+" mount"+(profile.mounts.length===1?"":"s"):null,"File access");
    add("setup_commands",profile.setup_commands||profile.setupCommands,"Setup commands");
    add("startup_apps",profile.startup_apps||profile.startupApps,"Startup apps");
    add("require_enforced_policy",profile.require_enforced_policy??profile.requireEnforcedPolicy,"Require enforcement");
  }else{
    add("profile",params.profile??params.profile_id??params.profileId,"Profile");
  }
  add("id",params.id??params.workspace_id??params.workspaceId,"Workspace");
  add("name",params.name,"App name");
  add("purpose",params.purpose,"Purpose");
  add("command",params.command,"Command");
  add("cwd",params.cwd,"Working folder");
  add("network",params.network,"Network");
  add("mounts",Array.isArray(params.mounts)?params.mounts.length+" mount"+(params.mounts.length===1?"":"s"):params.mounts,"File access");
  add("setup_commands",params.setup_commands??params.setupCommands,"Setup commands");
  add("startup_apps",params.startup_apps??params.startupApps,"Startup apps");
  add("host_path",params.host_path??params.hostPath,"Host path");
  add("browser_path",params.browser_path??params.browserPath,"Browser");
  add("user_data_dir",params.user_data_dir??params.userDataDir,"Browser data");
  add("dry_run",params.dry_run??params.dryRun,"Preview only");
  add("replace",params.replace,"Overwrite saved profile");
  add("run_setup",params.run_setup??params.runSetup,"Run setup");
  add("startup_wait_window",params.startup_wait_window??params.startupWaitWindow,"Wait for startup window");
  add("startup_screenshot_window",params.startup_screenshot_window??params.startupScreenshotWindow,"Screenshot startup window");
  add("wait_window",params.wait_window??params.waitWindow,"Wait for window");
  add("screenshot_window",params.screenshot_window??params.screenshotWindow,"Screenshot window");
  add("observe_screenshot",params.observe_screenshot??params.observeScreenshot,"Capture screenshot");
  add("include_hidden",params.include_hidden??params.includeHidden,"Include hidden windows");
  add("events_tail",params.events_tail??params.eventsTail,"Recent events");
  add("timeout_ms",params.timeout_ms!=null?params.timeout_ms+" ms":params.timeoutMs!=null?params.timeoutMs+" ms":null,"Timeout");
  add("tail_bytes",params.tail_bytes??params.tailBytes,"Log tail");
  add("kill_on_timeout",params.kill_on_timeout??params.killOnTimeout,"Kill on timeout");
  add("acknowledge_hidden_workspace",params.acknowledge_hidden_workspace??params.ackHiddenWorkspace,"Hidden workspace acknowledged");
  add("acknowledge_unenforced_policy",params.acknowledge_unenforced_policy??params.ackUnenforcedPolicy,"Unenforced policy acknowledged");
  const aliases=new Set(["profile_id","profileId","workspace_id","workspaceId","timeoutMs","tailBytes","killOnTimeout","ackHiddenWorkspace","ackUnenforcedPolicy","dryRun","runSetup","startupWaitWindow","startupScreenshotWindow","waitWindow","screenshotWindow","observeScreenshot","includeHidden","eventsTail","hostPath","browserPath","userDataDir","setupCommands","startupApps","requireEnforcedPolicy"]);
  const extra=keys.filter(key=>!consumed.has(key)&&!aliases.has(key)&&params[key]!=null);
  if(extra.length>0)rows.push({name:"other_options",displayName:"Other options",value:extra.join(", ")});
  return rows.length>0?rows:null;
}
function codexLinuxAgentWorkspaceApprovalValue(value){
  if(typeof value=="boolean")return value?"Yes":"No";
  if(typeof value=="number")return String(value);
  if(typeof value=="string")return value;
  if(Array.isArray(value)){
    if(value.every(item=>["string","number","boolean"].includes(typeof item)))return codexLinuxAgentWorkspaceApprovalCommand(value);
    if(value.every(item=>item&&typeof item=="object"&&Array.isArray(item.command)))return value.map(item=>item.name||codexLinuxAgentWorkspaceApprovalCommand(item.command)).join("; ");
    return value.length+" item"+(value.length===1?"":"s");
  }
  if(value&&typeof value=="object"){
    if(typeof value.mode=="string")return value.allow_hosts&&Array.isArray(value.allow_hosts)&&value.allow_hosts.length>0?value.mode+" ("+value.allow_hosts.join(", ")+")":value.mode;
    const keys=Object.keys(value).filter(key=>value[key]!=null);
    return keys.length>0?keys.join(", "):"configured";
  }
  return String(value);
}
function codexLinuxAgentWorkspaceApprovalCommand(command){
  return command.map(part=>codexLinuxAgentWorkspaceApprovalQuote(String(part))).join(" ");
}
function codexLinuxAgentWorkspaceApprovalQuote(value){
  return /^[A-Za-z0-9_./:=@%+-]+$/.test(value)?value:JSON.stringify(value);
}`;
}

function applyAgentWorkspaceApprovalRenderingPatch(currentSource) {
  const needle =
    "function sU(e,t){return t??(e==null?[]:Object.entries(e).map(([e,t])=>({name:e,value:t,displayName:(0,YH.default)(e.trim())})))}";
  const patchedNeedle = needle.replace(
    "return t??(",
    "let n=codexLinuxAgentWorkspaceApprovalEntries(e);return n??t??(",
  );

  if (currentSource.includes("codexLinuxAgentWorkspaceApprovalEntries")) {
    const helperStart = currentSource.indexOf("function codexLinuxAgentWorkspaceApprovalEntries(params){");
    const nextFunction = helperStart < 0 ? -1 : currentSource.indexOf("function cU", helperStart);
    if (helperStart >= 0) {
      const replaceEnd = nextFunction > helperStart ? nextFunction : currentSource.length;
      const prefix = currentSource.slice(0, helperStart);
      const helper = prefix.endsWith("\n")
        ? agentWorkspaceApprovalEntriesHelperSource().replace(/^\n/, "")
        : agentWorkspaceApprovalEntriesHelperSource();
      return `${prefix}${helper}${patchedNeedle}${currentSource.slice(replaceEnd)}`;
    }
    return currentSource;
  }

  if (!currentSource.includes(needle)) {
    return currentSource;
  }

  return currentSource.replace(
    needle,
    `${agentWorkspaceApprovalEntriesHelperSource()}${patchedNeedle}`,
  );
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
    {
      id: "approval-rendering",
      phase: "webview-asset",
      order: 20_830,
      ciPolicy: "optional",
      pattern: /^composer-.*\.js$/,
      missingDescription: "composer bundle",
      skipDescription: "agent workspace approval rendering patch",
      apply: applyAgentWorkspaceApprovalRenderingPatch,
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
  applyAgentWorkspaceApprovalRenderingPatch,
  buildAgentWorkspaceSettingsSource,
  patchAgentWorkspaceSettingsAssets,
};
