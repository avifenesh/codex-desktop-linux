"use strict";

// Phase 1 scaffold for the codex-updater feature. Real splice work happens
// in Phase 2+ once injection points are confirmed against a fresh build.
// See ./README.md for the full design.
//
// The structure mirrors other linux-features patches: export an object
// keyed by bundle name (main-bundle, webview-asset, etc.); each value
// is an async function (source) => patchedSource.

const RUNTIME_VERSION = "codex-updater-v0";

function applyUpdaterMainBundlePatch(source) {
  // No-op placeholder. Phase 2 will:
  //   1. Detect the post-single-instance form of `await n.app.whenReady()`
  //      (see scripts/patches/main-process.js:615 for the existing splice).
  //   2. After whenReady, inject a small bootstrap that reads
  //      ~/.local/share/codex-update-manager/state.json and registers
  //      IPC handlers (codex-updater:get-status, get-features,
  //      save-features, trigger-build, install-now).
  //   3. Idempotency marker: `globalThis.codexLinuxUpdaterVersion = "${RUNTIME_VERSION}"`.
  if (source.includes(`codexLinuxUpdaterVersion=\`${RUNTIME_VERSION}\``)) {
    return source;
  }
  return source;
}

module.exports = {
  // Keys match the names used by the patch driver (see scripts/patches/*.js
  // and scripts/lib/linux-features.js).
  patches: [
    {
      target: "main-bundle",
      apply: applyUpdaterMainBundlePatch,
    },
  ],
};
