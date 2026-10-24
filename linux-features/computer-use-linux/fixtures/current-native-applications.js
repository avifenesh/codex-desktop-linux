// Current signed native metadata service. External services are inert test bindings.
const cp=require("node:child_process"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
function wJe(){if(process.platform===`darwin`||process.platform===`win32`)return{getByBundleId:async e=>await lk(e)??await s.F(e),list:s.L,getIcon:async({appPath:e,size:t})=>t===`medium`?{iconSmall:null,iconMedium:await Zl(e)}:{iconSmall:await Xl(e)}}}
class CurrentFetchHandler{nativeApplications=wJe()}
function expose(){return {nativeApplications:this.fetchHandler.nativeApplications}}
