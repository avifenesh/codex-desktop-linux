"use strict";

const { escapeRegExp, requireName } = require("../../scripts/patches/shared.js");

const HANDLER_NAME = "codex-linux-updater";
const RUNTIME_VERSION = "codex-updater-v1";

function warn(message, patchName) {
  console.warn(`WARN: ${message} - skipping ${patchName}`);
}

// ---------------------------------------------------------------------------
// Main bundle: register a handler at vscode://codex/codex-linux-updater that
// the renderer-side button calls via window.electronBridge.sendMessageFromView.
// Pattern mirrors linux-features/read-aloud/patch.js.
// ---------------------------------------------------------------------------

function applyMainBundlePatch(source) {
  if (source.includes(`"${HANDLER_NAME}":async`)) {
    return source;
  }

  const fsVar = requireName(source, "node:fs");
  const pathVar = requireName(source, "node:path");
  const osVar = requireName(source, "node:os") ?? requireName(source, "os");
  const childProcessVar =
    requireName(source, "node:child_process") ?? requireName(source, "child_process");
  if (fsVar == null || pathVar == null || osVar == null || childProcessVar == null) {
    warn(
      "Could not find node:fs/node:path/node:os/node:child_process deps",
      "codex updater main-bundle patch",
    );
    return source;
  }

  const helper = [
    `function codexLinuxUpdaterHome(){return process.env.HOME||${osVar}.homedir?.()||\`\`}`,
    `function codexLinuxUpdaterStatePath(){let h=codexLinuxUpdaterHome();let d=process.env.XDG_STATE_HOME||(h&&${pathVar}.join(h,\`.local\`,\`state\`));return d?${pathVar}.join(d,\`codex-update-manager\`,\`state.json\`):null}`,
    `function codexLinuxUpdaterMarkerPath(){let h=codexLinuxUpdaterHome();let d=process.env.XDG_STATE_HOME||(h&&${pathVar}.join(h,\`.local\`,\`state\`));return d?${pathVar}.join(d,\`codex-desktop\`,\`update-pending\`):null}`,
    `function codexLinuxUpdaterReadStatus(){try{let p=codexLinuxUpdaterStatePath();if(!p||!${fsVar}.existsSync(p))return null;return JSON.parse(${fsVar}.readFileSync(p,\`utf8\`))}catch{return null}}`,
    `function codexLinuxUpdaterPhase(s){if(!s||typeof s!==\`object\`)return null;return s.status||s.phase||null}`,
    `function codexLinuxUpdaterShouldShow(phase){return phase===\`update_detected\`||phase===\`ready_to_install\`||phase===\`waiting_for_app_exit\`}`,
    `function codexLinuxUpdaterIsReady(phase){return phase===\`ready_to_install\`||phase===\`waiting_for_app_exit\`}`,
    `function codexLinuxUpdaterStatusPayload(){let s=codexLinuxUpdaterReadStatus();let phase=codexLinuxUpdaterPhase(s);return{ok:!0,phase,show:codexLinuxUpdaterShouldShow(phase),ready:codexLinuxUpdaterIsReady(phase)}}`,
    `function codexLinuxUpdaterSpawnCheck(){try{let c=${childProcessVar}.spawn(\`codex-update-manager\`,[\`check-now\`,\`--if-stale\`],{stdio:\`ignore\`,detached:!0,env:process.env});c.on(\`error\`,()=>{});c.unref()}catch{}}`,
    `function codexLinuxUpdaterTriggerBuild(){try{let c=${childProcessVar}.spawn(\`codex-update-manager\`,[\`check-now\`],{stdio:\`ignore\`,detached:!0,env:process.env});c.on(\`error\`,()=>{});c.unref();return{ok:!0,triggered:\`build\`}}catch(e){return{ok:!1,error:String(e?.message||e)}}}`,
    `function codexLinuxUpdaterWriteMarker(){let p=codexLinuxUpdaterMarkerPath();if(!p)return{ok:!1,reason:\`no-marker-path\`};try{${fsVar}.mkdirSync(${pathVar}.dirname(p),{recursive:!0});${fsVar}.writeFileSync(p,new Date().toISOString());return{ok:!0,path:p}}catch(e){return{ok:!1,error:String(e?.message||e)}}}`,
    `function codexLinuxUpdaterInstallNow(){let m=codexLinuxUpdaterWriteMarker();if(!m.ok)return m;try{let a=require(\`electron\`).app;setTimeout(()=>a.exit(0),200);return{ok:!0}}catch(e){return{ok:!1,error:String(e?.message||e)}}}`,
    `function codexLinuxUpdaterHandle(e={}){let action=e&&e.action;if(action===\`status\`)return codexLinuxUpdaterStatusPayload();if(action===\`check\`){codexLinuxUpdaterSpawnCheck();return{ok:!0}}if(action===\`install\`){let s=codexLinuxUpdaterReadStatus();let phase=codexLinuxUpdaterPhase(s);if(codexLinuxUpdaterIsReady(phase))return codexLinuxUpdaterInstallNow();return codexLinuxUpdaterTriggerBuild()}return{ok:!1,reason:\`unknown-action\`}}`,
    // Fire a stale-check once at module load so state.json gets refreshed when the app starts.
    `(()=>{if(process.env.CODEX_LINUX_MULTI_LAUNCH!==\`1\`)codexLinuxUpdaterSpawnCheck()})();`,
  ].join("");

  const handler = `"${HANDLER_NAME}":async(e)=>codexLinuxUpdaterHandle(e),`;
  const needle = `"native-desktop-apps":`;
  const handlerIndex = source.indexOf(needle);
  if (handlerIndex === -1) {
    warn(`Could not find ${needle} handler map needle`, "codex updater main-bundle patch");
    return source;
  }

  const withHandler = source.slice(0, handlerIndex) + handler + source.slice(handlerIndex);
  const useStrictDouble = `"use strict";`;
  const useStrictSingle = `'use strict';`;
  const helperInsertAt = withHandler.startsWith(useStrictDouble)
    ? useStrictDouble.length
    : withHandler.startsWith(useStrictSingle)
      ? useStrictSingle.length
      : 0;
  return withHandler.slice(0, helperInsertAt) + helper + withHandler.slice(helperInsertAt);
}

// ---------------------------------------------------------------------------
// Webview runtime: a small fixed-position "Update" button that appears in the
// top header area when an update is available. Click -> install (writes the
// restart marker and quits; the launcher does the rest on next start).
// ---------------------------------------------------------------------------

function updaterRuntimeSource() {
  return [
    `;(()=>{`,
    `const VERSION=${JSON.stringify(RUNTIME_VERSION)};`,
    `if(globalThis.codexLinuxUpdaterVersion===VERSION)return;`,
    `globalThis.codexLinuxUpdaterVersion=VERSION;`,
    `const METHOD=${JSON.stringify(HANDLER_NAME)};`,
    `let seq=0,pending=new Map,button=null,busy=false,lastPhase=null;`,
    `function onMessage(e){let t=e?.data;if(!t||typeof t!=="object"||t.type!=="fetch-response")return;let n=pending.get(t.requestId);if(!n)return;pending.delete(t.requestId);if(t.responseType==="success"){let v=null;try{v=t.bodyJsonString?JSON.parse(t.bodyJsonString):null}catch{}n.resolve({status:t.status,body:v})}else n.reject(Error(t.error||"fetch failed"))}`,
    `window.addEventListener("message",onMessage);`,
    `function dispatch(payload){let bridge=window.electronBridge,ev=new CustomEvent("codex-message-from-view",{detail:payload});if(bridge?.sendMessageFromView){ev.__codexForwardedViaBridge=!0;bridge.sendMessageFromView(payload).catch(()=>{})}window.dispatchEvent(ev)}`,
    `function post(params,timeoutMs=4000){let requestId="codex-linux-updater-"+ ++seq;let payload={type:"fetch",hostId:"local",requestId,method:"POST",url:"vscode://codex/"+METHOD,body:JSON.stringify(params??{})};return new Promise((resolve,reject)=>{pending.set(requestId,{resolve,reject});setTimeout(()=>{pending.delete(requestId);reject(Error("timeout"))},timeoutMs);dispatch(payload)})}`,
    `function installStyle(){if(document.getElementById("codex-linux-updater-style"))return;let s=document.createElement("style");s.id="codex-linux-updater-style";s.textContent=".codex-linux-update-btn{height:22px;padding:0 10px;margin:0 8px;display:none;align-items:center;font:500 12px/1 -apple-system,BlinkMacSystemFont,\\"Segoe UI\\",Roboto,sans-serif;color:#fff;background:#0e639c;border:1px solid #1177bb;border-radius:4px;cursor:pointer;-webkit-app-region:no-drag;box-shadow:0 1px 2px rgba(0,0,0,0.18);transition:background-color 120ms ease;vertical-align:middle;line-height:1}.codex-linux-update-btn[data-state=\\"available\\"],.codex-linux-update-btn[data-state=\\"ready\\"],.codex-linux-update-btn[data-state=\\"working\\"]{display:inline-flex}.codex-linux-update-btn.codex-linux-update-floating{position:fixed;top:6px;right:120px;z-index:2147483000}.codex-linux-update-btn:hover{background:#1177bb}.codex-linux-update-btn:disabled{opacity:.7;cursor:default}";document.head.appendChild(s)}`,
    `function findHeaderTarget(){const candidates=["header","[role=\\"banner\\"]","nav[aria-label]"];for(const sel of candidates){const el=document.querySelector(sel);if(el&&el.getBoundingClientRect().top<120&&el.offsetHeight>0)return el}let firstButton=document.querySelector("button, [role=\\"button\\"]");if(firstButton){let parent=firstButton.parentElement;while(parent&&parent!==document.body){const rect=parent.getBoundingClientRect();if(rect.top<80&&rect.width>200&&parent.querySelectorAll("button, [role=\\"button\\"]").length>=1)return parent;parent=parent.parentElement}}return null}`,
    `function attachButton(b){if(b.parentElement)return;let host=findHeaderTarget();if(host){b.classList.remove("codex-linux-update-floating");host.appendChild(b)}else{b.classList.add("codex-linux-update-floating");(document.body||document.documentElement).appendChild(b)}}`,
    `function ensureButton(){if(button&&document.contains(button))return button;installStyle();let b=document.createElement("button");b.type="button";b.className="codex-linux-update-btn";b.setAttribute("aria-label","Install Codex Desktop update");b.title="Install Codex Desktop update";b.textContent="Update";b.addEventListener("click",onClick);button=b;attachButton(b);return b}`,
    `let observer=null;function watchForHeader(){if(observer)return;observer=new MutationObserver(()=>{if(!button)return;if(button.classList.contains("codex-linux-update-floating")){let host=findHeaderTarget();if(host){button.classList.remove("codex-linux-update-floating");host.appendChild(button)}}else if(!button.parentElement||!document.contains(button.parentElement)){attachButton(button)}});observer.observe(document.body||document.documentElement,{childList:!0,subtree:!0})}`,
    `function setState(phase){let b=ensureButton();if(phase==="ready_to_install"||phase==="waiting_for_app_exit"){b.dataset.state="ready";b.title="Restart to install Codex Desktop update";b.textContent="Update"}else if(phase==="update_detected"){b.dataset.state="available";b.title="Install Codex Desktop update";b.textContent="Update"}else if(phase==="preparing_workspace"||phase==="patching_app"||phase==="building_package"||phase==="downloading_dmg"){b.dataset.state="working";b.title="Building Codex Desktop update";b.textContent="Updating…";b.disabled=true;return}else{b.dataset.state="hidden";return}b.disabled=false}`,
    `async function onClick(){if(busy)return;busy=true;let b=ensureButton();b.disabled=true;try{let r=await post({action:"install"});if(r&&r.body&&r.body.ok===false){b.textContent="Update";b.title=r.body.error||r.body.reason||"Update failed";setTimeout(()=>{b.title="Install Codex Desktop update"},2400)}else if(r&&r.body&&r.body.triggered==="build"){b.dataset.state="working";b.textContent="Updating…";b.title="Building Codex Desktop update";busy=false;setTimeout(refresh,3000);setTimeout(refresh,8000);return}}catch{}finally{busy=false;b.disabled=false}}`,
    `async function refresh(){try{let r=await post({action:"status"},2500);let phase=r?.body?.phase||null;lastPhase=phase;setState(phase)}catch{}}`,
    `function start(){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:!0});else{ensureButton();watchForHeader();refresh();setInterval(refresh,30000)}}`,
    `start();`,
    `})();`,
  ].join("");
}

function applyWebviewRuntimePatch(source) {
  if (source.includes(`codexLinuxUpdaterVersion=`)) {
    return source;
  }
  return source + updaterRuntimeSource();
}

module.exports = {
  HANDLER_NAME,
  RUNTIME_VERSION,
  applyMainBundlePatch,
  applyWebviewRuntimePatch,
  descriptors: [
    {
      id: "codex-updater-main-handler",
      phase: "main-bundle",
      order: 20_900,
      ciPolicy: "optional",
      apply: applyMainBundlePatch,
    },
    {
      id: "codex-updater-webview-runtime",
      phase: "webview-asset",
      order: 20_910,
      ciPolicy: "optional",
      pattern: /^index-.*\.js$/,
      missingDescription: "webview index bundle",
      skipDescription: "codex updater webview runtime patch",
      apply: applyWebviewRuntimePatch,
    },
  ],
};
