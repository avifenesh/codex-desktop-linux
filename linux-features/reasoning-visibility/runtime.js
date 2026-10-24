"use strict";

const STORAGE_KEY = "codex-linux-reasoning-visibility";

// Freeze one preference for the renderer session. Lazy chunks must not pick up
// a changed preference until restart while already loaded chunks keep the old one.
function reasoningVisibilitySnapshot(scope = globalThis) {
  const slot = "__codexCommunityReasoningVisibility";
  if (scope[slot] == null) {
    let enabled = false;
    try { enabled = scope.localStorage.getItem("codex-linux-reasoning-visibility") === "1"; } catch {}
    scope[slot] = { enabled };
  }
  return scope[slot].enabled === true;
}

const RUNTIME = `var codexLinuxReasoningVisibilityActive=(${reasoningVisibilitySnapshot.toString()})(globalThis);function codexLinuxReasoningVisibilityEnabled(){return codexLinuxReasoningVisibilityActive}`;

function withRuntime(source) {
  if (source.includes(RUNTIME)) return source;
  if (source.includes("codexLinuxReasoningVisibilityActive=")) {
    throw Error("reasoning-visibility: incomplete renderer preference runtime");
  }
  return RUNTIME + "\n" + source;
}

module.exports = { STORAGE_KEY, RUNTIME, reasoningVisibilitySnapshot, withRuntime };
