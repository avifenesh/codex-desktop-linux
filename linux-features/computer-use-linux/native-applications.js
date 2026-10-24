"use strict";

const { escapeRegExp, requireName } = require("../../scripts/patches/lib/minified-js.js");
const { linuxNativeDesktopAppsHelper } = require("../../scripts/patches/impl/computer-use.js");

const MARKER = "/* linux-native-applications */";
const FACTORY = /function (?<factory>[\w$]+)\(\)\{(?<patched>\/\* linux-native-applications \*\/if\(process\.platform===`linux`\)return codexLinuxNativeApplications\(\);)?(?<original>if\(process\.platform===`darwin`\|\|process\.platform===`win32`\)return\{getByBundleId:async (?<id>[\w$]+)=>await (?<lookup>[\w$]+)\(\k<id>\)\?\?await (?<module>[\w$]+)\.[\w$]+\(\k<id>\),list:\k<module>\.[\w$]+,getIcon:async\(\{appPath:(?<app>[\w$]+),size:(?<size>[\w$]+)\}\)=>\k<size>===`medium`\?\{iconSmall:null,iconMedium:await [\w$]+\(\k<app>\)\}:\{iconSmall:await [\w$]+\(\k<app>\)\}\})\}/g;

function runtimeSource(source) {
  const dependencies = {
    childProcessVar: requireName(source, "node:child_process") ?? requireName(source, "child_process"),
    fsVar: requireName(source, "node:fs"),
    osVar: requireName(source, "node:os") ?? requireName(source, "os"),
    pathVar: requireName(source, "node:path"),
  };
  if (Object.values(dependencies).some(value => value == null)) {
    throw new Error("Linux native Applications contract drift: metadata dependencies unavailable");
  }
  // Reuse the existing running-window, desktop-entry and icon implementation.
  // The new signed bridge returns arrays/records directly, without the retired
  // native-desktop-apps IPC envelope.
  return linuxNativeDesktopAppsHelper(dependencies) +
    "function codexLinuxNativeApplications(){return{" +
    "list:async(e={})=>{let{apps:t}=await codexLinuxNativeDesktopApps();return e.order===`display-name`?t.sort((e,t)=>e.displayName.localeCompare(t.displayName)):t}," +
    "getByBundleId:async e=>{if(typeof e!==`string`)return null;let{apps:t}=await codexLinuxNativeDesktopApps();return t.find(t=>t.bundleId.toLowerCase()===e.toLowerCase())??null}," +
    "getIcon:async({appPath:e,size:t})=>{let{iconSmall:n}=await codexLinuxNativeDesktopAppIcon({appPath:e});return t===`medium`?{iconSmall:null,iconMedium:n||null}:{iconSmall:n||null}}}}";
}

function applyNativeApplicationsPatch(source) {
  const fail = () => { throw new Error("Linux native Applications contract drift: missing, duplicate, or partial native metadata owner"); };
  const owners = [...source.matchAll(FACTORY)];
  if (owners.length !== 1) fail();
  const owner = owners[0];
  const calls = [...source.matchAll(new RegExp(`nativeApplications=${escapeRegExp(owner.groups.factory)}\\(\\)`, "g"))];
  const exposures = [...source.matchAll(/nativeApplications:this\.fetchHandler\.nativeApplications/g)];
  if (calls.length !== 1 || exposures.length !== 1) fail();
  const runtime = runtimeSource(source);
  const markerCount = source.split(MARKER).length - 1;
  const runtimeCount = source.split(runtime).length - 1;
  if (owner.groups.patched != null) {
    if (markerCount !== 1 || runtimeCount !== 1) fail();
    return source;
  }
  if (markerCount !== 0 || runtimeCount !== 0 || source.includes("codexLinuxNativeApplications") || source.includes("codexLinuxNativeDesktopApps(")) fail();
  const replacement = `function ${owner.groups.factory}(){${MARKER}if(process.platform===\`linux\`)return codexLinuxNativeApplications();${owner.groups.original}}`;
  const patched = source.slice(0, owner.index) + replacement + source.slice(owner.index + owner[0].length);
  const strict = patched.match(/^(?:"use strict"|'use strict');/);
  const insertAt = strict?.[0].length ?? 0;
  return patched.slice(0, insertAt) + runtime + patched.slice(insertAt);
}

module.exports = { applyNativeApplicationsPatch };
