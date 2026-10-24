"use strict";

const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { stageEnabledLinuxFeatureInstall } = require("../../scripts/lib/linux-features.js");
const {
  gentooFeaturePlan,
  renderGentooEbuild,
  restoreGentooFeaturePayloadPermissions,
  validateGentooFeatureSnapshot,
} = require("../../scripts/lib/gentoo-feature-support.js");

const root = path.resolve(__dirname, "../..");
const hasPortageParser = cp.spawnSync("python3", ["-c", "from portage.dep import Atom"], {
  stdio: "ignore",
}).status === 0;

function fixture(t, enabled = ["remote-mobile-control"]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "remote-mobile-gentoo-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const featuresConfigPath = path.join(dir, "features.json");
  const writeConfig = (ids) => fs.writeFileSync(featuresConfigPath, JSON.stringify({ enabled: ids }));
  writeConfig(enabled);
  return { dir, writeConfig, options: { featuresRoot: path.join(root, "linux-features"), featuresConfigPath } };
}

test("Gentoo remote mobile support adds only the runtime key-store lock dependency", (t) => {
  const f = fixture(t);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "feature.json"), "utf8"));
  assert.equal(manifest.defaultEnabled, false);
  assert.equal(manifest.gentoo.supported, true);
  assert.deepEqual(gentooFeaturePlan(f.options), {
    enabled: ["remote-mobile-control"],
    dependencies: { bootstrap: [], BDEPEND: [], DEPEND: [], RDEPEND: ["sys-apps/util-linux"], IDEPEND: [] },
  });
  f.writeConfig([]);
  assert.deepEqual(gentooFeaturePlan(f.options).dependencies, {
    bootstrap: [], BDEPEND: [], DEPEND: [], RDEPEND: [], IDEPEND: [],
  });
  f.writeConfig(["remote-mobile-control", "ui-tweaks"]);
  assert.deepEqual(gentooFeaturePlan(f.options).dependencies.RDEPEND, ["sys-apps/util-linux"]);
});

test("Gentoo remote mobile dependencies pass the host Portage parser", { skip: !hasPortageParser }, (t) => {
  const f = fixture(t);
  const result = cp.spawnSync("python3", [path.join(root, "scripts/lib/validate-gentoo-dependencies.py")], {
    input: JSON.stringify(gentooFeaturePlan(f.options)), encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});

test("Gentoo remote mobile preflight accepts ui-tweaks and keeps updater and unaudited features rejected", (t) => {
  const f = fixture(t, ["remote-mobile-control", "ui-tweaks"]);
  const run = (updater) => cp.spawnSync("bash", ["scripts/build-gentoo.sh", "--preflight"], {
    cwd: root, encoding: "utf8",
    env: {
      ...process.env, CODEX_LINUX_FEATURES_ROOT: f.options.featuresRoot,
      CODEX_LINUX_FEATURES_CONFIG: f.options.featuresConfigPath, PACKAGE_WITH_UPDATER: updater,
    },
  });
  const accepted = run("0");
  assert.equal(accepted.status, 0, accepted.stderr);
  const updater = run("1");
  assert.notEqual(updater.status, 0);
  assert.match(updater.stderr, /Portage owns native updates/);
  f.writeConfig(["remote-mobile-control", "pet-overlay"]);
  const unsupported = run("0");
  assert.notEqual(unsupported.status, 0);
  assert.match(unsupported.stderr, /does not support.*pet-overlay/);
});

test("Gentoo remote mobile cold-start resource is validated, permission-restored and removed when disabled", (t) => {
  const f = fixture(t);
  const app = path.join(f.dir, "app"), state = path.join(app, ".codex-linux");
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, "build-info.json"), JSON.stringify({ linuxFeatures: { enabled: ["remote-mobile-control"] } }));
  fs.writeFileSync(path.join(state, "patch-report.json"), JSON.stringify({ enabledFeatures: ["remote-mobile-control"], patches: [] }));
  const staged = stageEnabledLinuxFeatureInstall(app, f.options);
  const hook = path.join(state, "cold-start.d/remote-mobile-control");
  assert.equal(fs.readFileSync(hook, "utf8"), fs.readFileSync(path.join(__dirname, "cold-start-hook.sh"), "utf8"));
  assert.equal(fs.statSync(hook).mode & 0o777, 0o755);
  assert.equal(staged.resources.length, 1);
  assert.deepEqual(validateGentooFeatureSnapshot(app, f.options).enabled, ["remote-mobile-control"]);
  fs.chmodSync(hook, 0o644);
  assert.throws(() => validateGentooFeatureSnapshot(app, f.options), /mode mismatch/);
  restoreGentooFeaturePayloadPermissions(app, f.options);
  assert.equal(fs.statSync(hook).mode & 0o777, 0o755);
  fs.unlinkSync(hook);
  assert.throws(() => validateGentooFeatureSnapshot(app, f.options), /ENOENT/);
  stageEnabledLinuxFeatureInstall(app, f.options);
  f.writeConfig([]);
  stageEnabledLinuxFeatureInstall(app, f.options);
  assert.equal(fs.existsSync(hook), false);
});

test("Gentoo remote mobile snapshot rejects a symlinked cold-start resource", (t) => {
  const f = fixture(t);
  const app = path.join(f.dir, "app"), state = path.join(app, ".codex-linux");
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(state, "build-info.json"), JSON.stringify({ linuxFeatures: { enabled: ["remote-mobile-control"] } }));
  fs.writeFileSync(path.join(state, "patch-report.json"), JSON.stringify({ enabledFeatures: ["remote-mobile-control"], patches: [] }));
  stageEnabledLinuxFeatureInstall(app, f.options);
  const hook = path.join(state, "cold-start.d/remote-mobile-control");
  const outside = path.join(f.dir, "outside");
  fs.renameSync(hook, outside);
  fs.symlinkSync(outside, hook);
  assert.throws(() => validateGentooFeatureSnapshot(app, f.options), /links/);
});

test("Gentoo remote mobile ebuild declares flock once in RDEPEND for each supported architecture", (t) => {
  const f = fixture(t, ["remote-mobile-control", "ui-tweaks"]);
  const template = fs.readFileSync(path.join(root, "packaging/gentoo/codex-desktop.ebuild.template"), "utf8");
  for (const architecture of ["amd64", "arm64"]) {
    const ebuild = renderGentooEbuild(template, gentooFeaturePlan(f.options), architecture, "fixture.tar.xz");
    assert.equal(ebuild.match(/sys-apps\/util-linux/g).length, 1);
    assert.match(ebuild.match(/^RDEPEND="([\s\S]*?)"/m)[1], /sys-apps\/util-linux/);
    assert.doesNotMatch(ebuild.match(/^BDEPEND="([\s\S]*?)"/m)[1], /sys-apps\/util-linux/);
    assert.match(ebuild, new RegExp(`KEYWORDS="~${architecture}"`));
  }
  f.writeConfig([]);
  assert.doesNotMatch(renderGentooEbuild(template, gentooFeaturePlan(f.options), "amd64", "fixture.tar.xz"), /sys-apps\/util-linux/);
});
