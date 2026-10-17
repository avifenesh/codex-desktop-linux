#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  corePatchDescriptors,
  featurePatchDescriptors,
  patchExtractedApp,
} = require("./patches/runner.js");
const {
  createPatchReport,
  enabledFeatureFailuresFromReport,
  reportHasPatchChanges,
} = require("./lib/patch-report.js");

test("best-effort feature drift stays non-fatal without hiding changed outputs", () => {
  const report = createPatchReport();
  report.enabledFeatures = ["best-effort", "strict"];
  report.patches = [
    {
      name: "feature:best-effort:repair",
      status: "skipped-optional",
      ciPolicy: "optional",
      sourceKind: "feature",
      featureId: "best-effort",
      enforceWhenEnabled: false,
    },
  ];
  assert.deepEqual(enabledFeatureFailuresFromReport(report), []);
  assert.equal(reportHasPatchChanges(report), false);

  report.patches[0].status = "applied-with-warnings";
  assert.equal(reportHasPatchChanges(report), true);

  report.patches[0] = {
    ...report.patches[0],
    name: "feature:strict:repair",
    status: "skipped-optional",
    featureId: "strict",
    enforceWhenEnabled: true,
  };
  assert.equal(enabledFeatureFailuresFromReport(report).length, 1);
});

test("official Linux baseline has required compatibility descriptors", () => {
  assert.deepEqual(
    corePatchDescriptors().map(({ id, ciPolicy, phase }) => ({ id, ciPolicy, phase })),
    [{
      id: "quit-confirmation-focus",
      ciPolicy: "required-upstream",
      phase: "extracted-app:pre-webview",
    }],
  );
  assert.equal(featurePatchDescriptors({
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  }).length, 0);
});

test("an explicitly empty core registry leaves an extracted official-style app unchanged", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-empty-patch-registry-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const buildDir = path.join(root, ".vite", "build");
  const webviewDir = path.join(root, "webview", "assets");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(webviewDir, { recursive: true });
  const mainPath = path.join(buildDir, "main-fixture.js");
  const assetPath = path.join(webviewDir, "app-initial-fixture.js");
  fs.writeFileSync(mainPath, "const officialMain=true;\n");
  fs.writeFileSync(assetPath, "const officialWebview=true;\n");
  const before = new Map([
    [mainPath, fs.readFileSync(mainPath)],
    [assetPath, fs.readFileSync(assetPath)],
  ]);
  const report = createPatchReport();
  patchExtractedApp(root, {
    report,
    corePatchRoot: path.join(root, "empty-core-registry"),
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  });
  assert.deepEqual(report.patches, []);
  for (const [filePath, bytes] of before) assert.deepEqual(fs.readFileSync(filePath), bytes);
});

test("final main-process syntax gate rejects duplicate parameters without executing the app", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-main-syntax-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const buildDir = path.join(root, ".vite", "build");
  fs.mkdirSync(buildDir, { recursive: true });
  // A valid entry does not hide an invalid imported chunk. This is the exact
  // destructured/formal collision introduced by the 26.1013 CUA adaptation.
  fs.writeFileSync(path.join(buildDir, "main.js"), 'throw Error("must never execute");');
  const chunk = path.join(buildDir, "cua-config.js");
  fs.writeFileSync(chunk, "function Aa({browserBackends:e,deferTools:t,surfaces:n,nodeRepl:r},r){}");
  const options = {
    corePatchRoot: path.join(root, "empty-core"),
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  };
  assert.throws(() => patchExtractedApp(root, options), (error) =>
    error.code === "PATCH_INTEGRITY_FAILURE" &&
    /cua-config\.js: SyntaxError: Duplicate parameter name/.test(error.message));

  fs.writeFileSync(chunk, "function Aa({browserBackends:e,deferTools:t,surfaces:n,nodeRepl:r},pluginRoot){}");
  fs.writeFileSync(path.join(buildDir, "module.mjs"), 'export const value = await Promise.resolve(1); throw Error("must never execute");');
  fs.writeFileSync(path.join(buildDir, "common.cjs"), 'return;');
  assert.doesNotThrow(() => patchExtractedApp(root, options));
});

test("syntax validation runs after extracted-app post-webview transforms", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-final-syntax-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const buildDir = path.join(root, ".vite", "build");
  const corePatchRoot = path.join(root, "core");
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(corePatchRoot, { recursive: true });
  fs.writeFileSync(path.join(buildDir, "main.js"), "const main=true;");
  fs.writeFileSync(path.join(corePatchRoot, "patch.js"), `
    module.exports.descriptors = [{
      id: "late-syntax-regression", phase: "extracted-app:post-webview",
      apply(root) {
        require("node:fs").writeFileSync(require("node:path").join(root, ".vite/build/main.js"),
          "function Aa({nodeRepl:r},r){}");
        return { changed: true };
      }
    }];
  `);
  assert.throws(() => patchExtractedApp(root, {
    corePatchRoot,
    featuresConfigPath: path.join(__dirname, "..", "linux-features", "features.example.json"),
  }), /JavaScript syntax validation failed.*main\.js: SyntaxError: Duplicate parameter name/);
});

test("CLI rejects drift in an explicitly enabled feature", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-enabled-feature-drift-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, ".vite", "build"), { recursive: true });
  fs.mkdirSync(path.join(root, "webview", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, ".vite", "build", "main-fixture.js"), "const main=true;\n");
  fs.writeFileSync(path.join(root, "webview", "assets", "app-initial-fixture.js"), "const webview=true;\n");
  const config = path.join(root, "features.json");
  const report = path.join(root, "report.json");
  fs.writeFileSync(config, '{"enabled":["frameless-titlebar"]}\n');

  const result = childProcess.spawnSync(
    process.execPath,
    [path.join(__dirname, "patch-linux-window-ui.js"), "--report-json", report, "--enforce-critical", root],
    {
      encoding: "utf8",
      env: { ...process.env, CODEX_LINUX_FEATURES_CONFIG: config },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicitly enabled feature patches drifted/);
});
