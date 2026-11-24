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
  consumesUsageReasons,
  findUsageReasonAtom,
  descriptors,
} = require("./patch.js");

// Reduced fixtures of the current signed Linux webview. The account usage
// module derives the host's submit-disabled reasons; the local Codex composer
// reads them for its host and adds them to its submitDisabledReasons prop. The
// usage indicator (export U) keeps serving its other consumers.
const usageModule = '}),a6kU:(function(e,t,n){var r=n("Q840"),a=n("OWtl"),l=n("eLmE");' +
  'let c=(0,r.un)(a.u,({get:e})=>e(l.qM,"local")),' +
  'p=(0,r.i1)(a.u,(e,{get:t})=>[t(l.F9,e)&&"reserve-limit","local"===e&&t(c)&&"usage-limit"].filter(Boolean).join(","));' +
  'n.d(t,{},{U:c,o:p})}),EU9a:(function(e,t,n){var r=n("SZCv")})';
const composer = 'var M=n("lOm2"),P=n("a6kU");function Composer(){' +
  'let nX=(0,i._U)(I.qM,nK),nQ=(0,i._U)(P.o,nK);' +
  'let{agentMode:ov,configData:oy,permissionProfileId:ob,shouldSendPermissionOverrides:ow}=(0,eq.Ap)(X);' +
  'let oF=void 0!==ty&&ty&&"caller-disabled",oV=nH&&"provider-blocked";' +
  'e7[170]!==oF||e7[179]!==nQ?(e2=[oF,oV,nQ].filter(Boolean),e7[170]=oF,e7[179]=nQ,e7[180]=e2):e2=e7[180];' +
  'let oJ=e2.join(",");return{usageBanner:(0,i.Ul)(P.U),submitDisabledReasons:oJ}}';

function writeLayout(directory, files) {
  const assets = path.join(directory, "webview", "assets", "async");
  fs.mkdirSync(assets, { recursive: true });
  for (const [name, source] of Object.entries(files)) fs.writeFileSync(path.join(assets, name), source);
  return assets;
}

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

test("local host usage no longer disables Send while other reasons remain", () => {
  const patched = applyUsageLimitSendAttemptPatch(usageModule);
  assert.notEqual(patched, usageModule);
  assert.equal(applyUsageLimitSendAttemptPatch(patched), patched);
  assert.equal(
    patched.replace("!1/*codexLinuxUsageLimitSendAttempt*/", '"local"===e&&t(c)&&"usage-limit"'),
    usageModule,
  );
  assert.match(patched, /t\(l\.F9,e\)&&"reserve-limit"/);
  assert.match(patched, /n\.d\(t,\{\},\{U:c,o:p\}\)/);
  assert.deepEqual(findUsageReasonAtom(usageModule) && {
    moduleId: findUsageReasonAtom(usageModule).moduleId,
    exportName: findUsageReasonAtom(usageModule).exportName,
  }, { moduleId: "a6kU", exportName: "o" });
  assert.equal(consumesUsageReasons(composer, { moduleId: "a6kU", exportName: "o" }), true);
});

test("patches the usage module once for every consuming composer, by module ID and export", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-layout-"));
  try {
    const assets = writeLayout(directory, {
      "usage.js": usageModule,
      "first.js": composer,
      "second.js": composer.replaceAll("nQ", "nK2").replaceAll("P=n(", "_=n(").replaceAll("P.", "_."),
      "other.js": "return{submitDisabled:true}",
    });
    const result = applyUsageLimitSendAttemptAppPatch(directory);
    assert.equal(result.changed, 1);
    assert.deepEqual(result.consumers.map((file) => path.basename(file)).sort(), ["first.js", "second.js"]);
    assert.match(fs.readFileSync(path.join(assets, "usage.js"), "utf8"), /codexLinuxUsageLimitSendAttempt/);
    assert.equal(fs.readFileSync(path.join(assets, "first.js"), "utf8"), composer);
    assert.equal(fs.readFileSync(path.join(assets, "other.js"), "utf8"), "return{submitDisabled:true}");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("drifted layouts leave every asset byte-identical", () => {
  const cases = {
    "no consuming composer": { "usage.js": usageModule, "first.js": composer.replace("P.o,nK", "P.x,nK") },
    "composer imports another module": { "usage.js": usageModule, "first.js": composer.replace('P=n("a6kU")', 'P=n("b7lV")') },
    "reason not in submit list": { "usage.js": usageModule, "first.js": composer.replace("[oF,oV,nQ]", "[oF,oV]") },
    "list not rendered": { "usage.js": usageModule, "first.js": composer.replace("submitDisabledReasons:oJ", "submitDisabledReasons:other") },
    "own composer gate": {
      "usage.js": usageModule,
      "first.js": composer,
      "second.js": composer.replace('oV=nH&&"provider-blocked"', 'oV=nH&&"usage-limit"'),
    },
    "duplicate usage module": { "usage.js": usageModule, "copy.js": usageModule, "first.js": composer },
  };
  for (const [name, files] of Object.entries(cases)) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-drift-"));
    try {
      const assets = writeLayout(directory, files);
      assert.equal(applyUsageLimitSendAttemptAppPatch(directory).changed, 0, name);
      for (const [file, source] of Object.entries(files)) {
        assert.equal(fs.readFileSync(path.join(assets, file), "utf8"), source, `${name}: ${file}`);
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("ambiguous or drifted usage reasons remain byte-identical", () => {
  assert.equal(applyUsageLimitSendAttemptPatch(usageModule + usageModule), usageModule + usageModule);
  for (const drifted of [
    usageModule.replace('"usage-limit"', '"quota-limit"'),
    usageModule.replace('"local"===e', '"remote"===e'),
    usageModule.replace('"local"===e', '"local"===other'),
    usageModule.replace(".filter(Boolean).join", ".join"),
    usageModule.replace("n.d(t,{},{U:c,o:p})", "n.d(t,{},{U:c})"),
  ]) {
    assert.equal(applyUsageLimitSendAttemptPatch(drifted), drifted);
  }
});

test(
  "current signed usage module is patched once for both local composers and remains valid JavaScript",
  { skip: process.env.CODEX_SIGNED_EXTRACTED_APP == null },
  t => {
    const signed = path.join(process.env.CODEX_SIGNED_EXTRACTED_APP, "webview", "assets", "async");
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "usage-limit-send-attempt-signed-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const files = {};
    for (const name of fs.readdirSync(signed).filter(file => file.endsWith(".js"))) {
      files[name] = fs.readFileSync(path.join(signed, name), "utf8");
    }
    const assets = writeLayout(directory, files);
    const result = applyUsageLimitSendAttemptAppPatch(directory);
    assert.equal(result.changed, 1);
    assert.equal(result.consumers.length, 2);
    for (const name of Object.keys(files)) {
      const patched = fs.readFileSync(path.join(assets, name), "utf8");
      const target = result.targets.includes(path.join("webview", "assets", "async", name));
      assert.equal(patched === files[name], !target, name);
      if (!target) continue;
      assert.equal(patched.split("codexLinuxUsageLimitSendAttempt").length, 2);
      assert.equal(patched.includes('"reserve-limit"'), true);
      const check = spawnSync(process.execPath, ["--input-type=module", "--check"], {
        input: patched, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      });
      assert.equal(check.status, 0, `${name}: ${check.stderr}`);
    }
  },
);
