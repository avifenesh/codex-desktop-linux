"use strict";

// Minimal current FetchHandler owner. Keep origin/signal replacement and trace
// scoping in the fixture so feature bridges exercise the production dispatcher.
module.exports = [
  "var IpcMissing=class extends Error{};var requestScope={ct:(scope,call)=>globalThis.traceRequest?globalThis.traceRequest(scope,call):call()};",
  "var FetchHandler=class{windowManager={getPrimaryWindows:()=>globalThis.primaryWindows??[]};remoteConnectionsHandler={setRemoteWslConnectionsEnabled:e=>({enabled:e}),catalog:{read:()=>({wsl:[]})}};",
  'handlers={"set-remote-wsl-connections-enabled":async({enabled:e,origin:t})=>this.windowManager.getPrimaryWindows().some(e=>e.webContents===t)?this.remoteConnectionsHandler.setRemoteWslConnectionsEnabled(e):{remoteWslConnections:this.remoteConnectionsHandler.catalog.read().wsl??[]}};',
  "handleVSCodeRequest(e,t,n,r,i){try{let a=t,o=this.handlers[a];if(typeof o!=`function`)throw Error(`${t} not implemented in the current Electron process. Restart ChatGPT to load the latest Electron handlers.`);let c=()=>o({...n,origin:e,signal:i});return r==null?c():requestScope.ct({source:r,requestKind:t},c)}catch(e){throw e instanceof IpcMissing?Error(`${t} not implemented in Electron.`):e}}};",
  "var fetchHandler=new FetchHandler;var bridge=fetchHandler.handlers;",
].join("");
