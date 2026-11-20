#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const { loadLinuxFeaturePatchDescriptors } = require("../../scripts/lib/linux-features.js");
const {
  applyUsageLimitSendAttemptPatch,
  applyUsageLimitSendAttemptAppPatch,
  applySharedUsageReasonsPatch,
  descriptors,
} = require("./patch.js");

// Reduced fixture of the current signed Linux webview composer. The account
// usage value remains available to its other consumers after this patch.
const composer = 'let{agentMode:os,permissionProfileId:ol,shouldSendPermissionOverrides:od}=(0,eK.Ap)(H),' +
  'oc=(0,i.Ul)(null==tq?null:P.Gq),om=(0,ei.r9)(),op=(0,i.Ul)("local"===nB&&R.U),oh=om===ei.O$?"codex_work_desktop":null;' +
  'let oN=void 0!==tm&&tm&&"caller-disabled",oE=ou&&"provider-blocked",oQ=op&&"usage-limit";' +
  'cacheChanged?(e0=[oN,oE,oQ].filter(Boolean),cache=e0):e0=cache;' +
  'let oT=e0.join(",");return{usageBanner:R.U,submitDisabledReasons:oT,onSubmitLocal:of}';

// Reduced fixture of the 26.1117 layout: the local usage gate lives in a shared
// rspack module and the composer reads its joined reasons atom.
const sharedReasons = ',a6kU:(function(e,t,n){var r=n("qmMi"),a=n("OWtl"),l=n("eLmE");' +
  'let c=(0,r.un)(a.u,({get:e})=>{let t=e(l.PO);return!(null==t||t.allowed)}),' +
  'p=(0,r.i1)(a.u,(e,{get:t})=>[t(l.F9,e)&&"reserve-limit","local"===e&&t(c)&&"usage-limit"].filter(Boolean).join(","));' +
  'n.d(t,{},{U:c,o:p})}),EU9a:(function(e,t,n){})';
const sharedComposer = 'var P=n("a6kU");let{agentMode:od,permissionProfileId:oc,shouldSendPermissionOverrides:ou}=(0,e$.Ap)(H),' +
  'nW=(0,i._U)(P.o,n$),oN=void 0!==tm&&tm&&"caller-disabled";eY=[oN,nW].filter(Boolean);' +
  'let oO=eY.join(",");return{usageBanner:(0,i._U)(P.U),submitDisabledReasons:oO}';

test("shared local usage reasons drop only the local usage gate", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-shared-"));
  const assets = path.join(directory, "webview", "assets", "async");
  try {
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, "shared.js"), sharedReasons);
    fs.writeFileSync(path.join(assets, "composer.js"), sharedComposer);
    const result = applyUsageLimitSendAttemptAppPatch(directory);
    assert.equal(result.changed, 1);
    const patched = fs.readFileSync(path.join(assets, "shared.js"), "utf8");
    assert.equal(patched, sharedReasons.replace('"local"===e&&t(c)', "!1/*codexLinuxUsageLimitSendAttempt*/"));
    assert.match(patched, /t\(l\.F9,e\)&&"reserve-limit"/);
    assert.match(patched, /n\.d\(t,\{\},\{U:c,o:p\}\)/);
    assert.equal(fs.readFileSync(path.join(assets, "composer.js"), "utf8"), sharedComposer);
    assert.equal(applySharedUsageReasonsPatch(patched), patched);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("drifted shared usage reasons or a disconnected composer stay unchanged", () => {
  for (const [shared, composer] of [
    [sharedReasons.replace('"local"===e', '"remote"===e'), sharedComposer],
    [sharedReasons.replace("o:p", "o:x"), sharedComposer],
    [sharedReasons, sharedComposer.replace("(P.o,", "(P.other,")],
    [sharedReasons, sharedComposer.replace('n("a6kU")', 'n("b7lV")')],
    [sharedReasons + sharedReasons, sharedComposer],
  ]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-shared-drift-"));
    const assets = path.join(directory, "webview", "assets", "async");
    try {
      fs.mkdirSync(assets, { recursive: true });
      fs.writeFileSync(path.join(assets, "shared.js"), shared);
      fs.writeFileSync(path.join(assets, "composer.js"), composer);
      assert.equal(applyUsageLimitSendAttemptAppPatch(directory).changed, 0);
      assert.equal(fs.readFileSync(path.join(assets, "shared.js"), "utf8"), shared);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("feature is disabled by default and registered when enabled", () => {
  const previous = process.env.CODEX_LINUX_FEATURES_CONFIG;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-"));
  const config = path.join(directory, "features.json");
  try {
    process.env.CODEX_LINUX_FEATURES_CONFIG = config;
    fs.writeFileSync(config, '{"enabled":[]}\n');
    assert.deepEqual(loadLinuxFeaturePatchDescriptors({ featuresRoot: path.resolve(__dirname, "..") }), []);
    fs.writeFileSync(config, '{"enabled":["usage-limit-send-attempt"]}\n');
    const loaded = loadLinuxFeaturePatchDescriptors({ featuresRoot: path.resolve(__dirname, "..") });
    assert.deepEqual(loaded.map(({ id }) => id), ["feature:usage-limit-send-attempt:usage-limit-send-attempt-ui"]);
    assert.equal(descriptors[0].phase, "extracted-app:post-webview");
  } finally {
    if (previous == null) delete process.env.CODEX_LINUX_FEATURES_CONFIG;
    else process.env.CODEX_LINUX_FEATURES_CONFIG = previous;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("local Codex usage does not disable Send while other blocks remain", () => {
  const patched = applyUsageLimitSendAttemptPatch(composer);
  assert.notEqual(patched, composer);
  assert.equal(applyUsageLimitSendAttemptPatch(patched), patched);
  assert.equal(patched.replace("op=!1/*codexLinuxUsageLimitSendAttempt*/", 'op=(0,i.Ul)("local"===nB&&R.U)'), composer);
  assert.match(patched, /oQ=op&&"usage-limit"/);
  assert.match(patched, /submitDisabledReasons:oT/);
  assert.match(patched, /usageBanner:R\.U/);
});

test("patches every matching composer asset without relying on chunk or module IDs", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-layout-"));
  const assets = path.join(directory, "webview", "assets", "async");
  try {
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, "first.js"), composer);
    fs.writeFileSync(path.join(assets, "second.js"), composer.replaceAll("op", "am").replaceAll("R.U", "I.X"));
    fs.writeFileSync(path.join(assets, "other.js"), "return{submitDisabled:true}");
    const result = applyUsageLimitSendAttemptAppPatch(directory);
    assert.equal(result.changed, 2);
    assert.match(fs.readFileSync(path.join(assets, "first.js"), "utf8"), /codexLinuxUsageLimitSendAttempt/);
    assert.match(fs.readFileSync(path.join(assets, "second.js"), "utf8"), /codexLinuxUsageLimitSendAttempt/);
    assert.equal(fs.readFileSync(path.join(assets, "other.js"), "utf8"), "return{submitDisabled:true}");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("one drifted composer asset prevents partial writes", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-drift-"));
  const assets = path.join(directory, "webview", "assets", "async");
  try {
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, "first.js"), composer);
    const drifted = composer.replace('oQ=op&&"usage-limit"', 'oQ=anotherFlag&&"usage-limit"');
    fs.writeFileSync(path.join(assets, "second.js"), drifted);
    assert.equal(applyUsageLimitSendAttemptAppPatch(directory).changed, 0);
    assert.equal(fs.readFileSync(path.join(assets, "first.js"), "utf8"), composer);
    assert.equal(fs.readFileSync(path.join(assets, "second.js"), "utf8"), drifted);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("ambiguous or drifted composer rules remain byte-identical", () => {
  assert.equal(applyUsageLimitSendAttemptPatch(composer + composer), composer + composer);
  const renamed = composer.replace("agentMode:os", "agentModeChanged:os");
  assert.equal(applyUsageLimitSendAttemptPatch(renamed), renamed);
  const disconnected = composer.replace('oQ=op&&"usage-limit"', 'oQ=otherFlag&&"usage-limit"');
  assert.equal(applyUsageLimitSendAttemptPatch(disconnected), disconnected);
  const renamedReason = composer.replace('"usage-limit"', '"quota-limit"');
  assert.equal(applyUsageLimitSendAttemptPatch(renamedReason), renamedReason);
  const disconnectedReasons = composer.replace("[oN,oE,oQ]", "[oN,oE]");
  assert.equal(applyUsageLimitSendAttemptPatch(disconnectedReasons), disconnectedReasons);
  const disconnectedSubmit = composer.replace("submitDisabledReasons:oT", "submitDisabledReasons:otherReasons");
  assert.equal(applyUsageLimitSendAttemptPatch(disconnectedSubmit), disconnectedSubmit);
  const nonLocal = composer.replace('"local"===nB', '"remote"===nB');
  assert.equal(applyUsageLimitSendAttemptPatch(nonLocal), nonLocal);
});

test(
  "current signed composer assets match uniquely and remain valid JavaScript",
  { skip: process.env.CODEX_SIGNED_EXTRACTED_APP == null },
  t => {
    const signed = path.join(process.env.CODEX_SIGNED_EXTRACTED_APP, "webview", "assets", "async");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-signed-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const assets = path.join(directory, "webview", "assets", "async");
    fs.mkdirSync(assets, { recursive: true });
    const copied = [];
    for (const name of fs.readdirSync(signed).filter(file => file.endsWith(".js"))) {
      const source = fs.readFileSync(path.join(signed, name), "utf8");
      const shared = source.includes('&&"usage-limit"].filter(Boolean).join(",")');
      if (!shared && (!source.includes("shouldSendPermissionOverrides:") ||
          !source.includes("submitDisabledReasons:"))) continue;
      fs.writeFileSync(path.join(assets, name), source);
      copied.push({ name, shared, source });
    }
    const result = applyUsageLimitSendAttemptAppPatch(directory);
    // 26.1117: one shared reasons module; the composers read it unchanged.
    assert.equal(result.changed, 1);
    assert.deepEqual(result.targets.map((target) => path.basename(target)),
      copied.filter(({ shared }) => shared).map(({ name }) => name));
    for (const { name, shared, source } of copied) {
      if (!shared) {
        assert.equal(fs.readFileSync(path.join(assets, name), "utf8"), source);
        continue;
      }
      const patched = fs.readFileSync(path.join(assets, name), "utf8");
      assert.equal(patched.split("codexLinuxUsageLimitSendAttempt").length, 2);
      const check = spawnSync(process.execPath, ["--input-type=module", "--check"], {
        input: patched, encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
      });
      assert.equal(check.status, 0, `${name}: ${check.stderr}`);
    }
  },
);
