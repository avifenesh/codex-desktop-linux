# codex-updater (in-app Update button)

A small VS Code–style "Update" button injected into the Codex Desktop webview
header. Visible only when the [codex-update-manager](../../updater) Rust
binary reports a new upstream release. One click runs the build and (when
the package is ready) restarts the app to install it.

No picker, no dialogs, no separate window. The Rust updater already does
the heavy lifting; this feature only adds the in-app affordance.

## How it works

Two patches, mirroring the `linux-features/read-aloud` pattern:

1. **Main bundle patch** ([patch.js](./patch.js) `applyMainBundlePatch`)
   - Registers a handler at `vscode://codex/codex-linux-updater`.
   - Fires `codex-update-manager check-now --if-stale` once at app start
     (skipped for multi-launch instances so secondary windows don't
     duplicate the work).
   - The handler exposes three actions:
     - `status` — reads `~/.local/state/codex-update-manager/state.json` and
       returns `{phase, show, ready}`.
     - `check` — fires another background `check-now`.
     - `install` — when status is `ready_to_install` / `waiting_for_app_exit`,
       writes `~/.local/state/codex-desktop/update-pending` and calls
       `app.quit()`. Otherwise triggers `check-now` (which causes the
       updater daemon to build the package).

2. **Webview runtime patch** ([patch.js](./patch.js) `applyWebviewRuntimePatch`)
   - Appended to `index-*.js` (the webview entry bundle).
   - Creates a fixed-position button at top-right, hidden by default.
   - Polls the main handler every 30s and on load.
   - When phase is `update_detected` / `ready_to_install`, the button
     appears (`opacity: 1`); otherwise it's transparent and click-through.
   - Click calls `post({action: "install"})` through
     `window.electronBridge.sendMessageFromView` (same channel read-aloud
     and conversation-mode use).

## Restart handoff

Clicking the button when an update is ready does two things:
1. Writes `~/.local/state/codex-desktop/update-pending` (ISO timestamp).
2. Calls `app.quit()`.

The launcher ([launcher/start.sh.template](../../launcher/start.sh.template))
detects the marker on the next cold start, runs the staged install
(`codex-update-manager install-ready`, which itself uses `pkexec` for
system packages), removes the marker, then continues normally into
Electron. If the install fails, the marker stays in place so the launcher
surfaces an error on subsequent starts.

## Why this isn't bigger

The Rust updater already has the full state machine
(`UpdateStatus::{Idle, UpdateDetected, BuildingPackage, ReadyToInstall,
WaitingForAppExit, …}`), the workspace prep, the package builder, and
the `pkexec`-mediated install path. This feature is intentionally just
the affordance — a button that reflects state and triggers the right
action for the current phase.
