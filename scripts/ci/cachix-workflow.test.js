"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("Cachix publishes every audited Nix runtime for both architectures", () => {
  const workflow = fs.readFileSync(".github/workflows/cachix.yml", "utf8");
  assert.doesNotMatch(workflow, /^    paths:/m);
  assert.match(workflow, /system: x86_64-linux/);
  assert.match(workflow, /system: aarch64-linux/);
  assert.match(workflow, /runner: ubuntu-24\.04-arm/);
  assert.match(workflow, /checks\.\$\{\{ matrix\.system \}\}\.modules/);
  assert.match(workflow, /Require Cachix publishing credentials/);
  assert.match(workflow, /test -n "\$CACHIX_AUTH_TOKEN"/);
  assert.match(workflow, /nix-runtime-maximal-directory-watch/);
  assert.match(workflow, /nix-runtime-maximal-shallow-watch/);
  assert.match(workflow, /codex-desktop-maximal-directory-watch/);
  assert.match(workflow, /codex-desktop-maximal-shallow-watch/);
  assert.match(workflow, /nix-installer/);
  assert.doesNotMatch(workflow, /if \[ -n "\$CACHIX_AUTH_TOKEN"/);
  assert.match(workflow, /nix build/);
  assert.doesNotMatch(workflow, /codexDmg|nativeModulesSource/);
});

function cachixWorkflow() {
  return fs.readFileSync(".github/workflows/cachix.yml", "utf8");
}

function publishingEligible(repository, cacheName) {
  const expression = cachixWorkflow().match(/^    if: (.+)$/m)?.[1] ?? "true";
  return require("node:vm").runInNewContext(expression, {
    github: { repository },
    vars: { CACHIX_CACHE_NAME: cacheName },
  });
}

test("an unconfigured fork does not publish to the upstream cache", () => {
  assert.equal(publishingEligible("avifenesh/codex-desktop-linux", ""), false);
});

test("upstream and explicitly configured forks remain eligible publishers", () => {
  assert.equal(publishingEligible("ilysenko/codex-desktop-linux", ""), true);
  assert.equal(publishingEligible("avifenesh/codex-desktop-linux", "avi-cache"), true);
});

test("configured publishers use their selected cache and require credentials", () => {
  const workflow = cachixWorkflow();
  const value = workflow.match(/^      CACHIX_CACHE_NAME: (.+)$/m)[1];
  const expression = value.match(/^\$\{\{\s*(.+?)\s*\}\}$/)?.[1];
  for (const [configured, expected] of [["", "codex-desktop-linux"], ["avi-cache", "avi-cache"]]) {
    const selected = expression
      ? require("node:vm").runInNewContext(expression, { vars: { CACHIX_CACHE_NAME: configured } })
      : value;
    assert.equal(selected, expected);
  }
  assert.match(workflow, /name: \$\{\{ env\.CACHIX_CACHE_NAME \}\}/);

  const command = workflow.match(/name: Require Cachix publishing credentials\n\s+run: (.+)/)[1];
  const { spawnSync } = require("node:child_process");
  assert.notEqual(spawnSync("bash", ["-c", command], { env: { CACHIX_AUTH_TOKEN: "" } }).status, 0);
  assert.equal(spawnSync("bash", ["-c", command], { env: { CACHIX_AUTH_TOKEN: "fixture-only" } }).status, 0);
});
