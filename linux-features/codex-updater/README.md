# codex-updater (in-app update UI)

Opt-in feature that surfaces upstream-release detection, feature opt-in, and
update orchestration inside the running Codex Desktop app instead of leaning on
the cron-driven `codex-desktop-update` script alone.

## Design

The Rust binary `codex-update-manager` (`updater/`) already does the heavy
lifting: HEAD-based release detection, DMG fetch + sha256, workspace prep,
patching, package build, `pkexec`-mediated install, rollback. Its
[`UpdateStatus`](../../updater/src/state.rs) enum even has a
`WaitingForAppExit` variant designed for the exact flow this feature drives.

What this feature adds is the **app side** of that contract:

```
launcher (start.sh)
    │
    └─ on cold start of the primary instance, fire
       `codex-update-manager check-now --if-stale &`
       (writes ~/.local/share/codex-update-manager/state.json)

Electron main process (patched by patch.js)
    │
    ├─ on app.whenReady(), read state.json
    ├─ if status ∈ {UpdateDetected, ReadyToInstall, WaitingForAppExit},
    │  set badge / menu item
    └─ expose IPC handlers to renderer:
         - codex-updater:get-status
         - codex-updater:get-features (reads features.json + user override)
         - codex-updater:save-features (writes user override to settings.json)
         - codex-updater:trigger-build (spawns `codex-update-manager` with
           CODEX_LINUX_FEATURES_CONFIG pointing at the user override)
         - codex-updater:install-now (calls `install-ready`, writes the
           `update-pending` marker, calls app.quit())

Picker BrowserWindow (Phase 3)
    │
    └─ loads ./window.html, talks to main via the IPC handlers above.

launcher (start.sh, Phase 5)
    │
    └─ if ~/.local/state/codex-desktop/update-pending exists at startup,
       run the staged install (pkexec for system, copy-in-place for
       user-local) before launching Electron; remove marker on success.
```

## Phases

- **Phase 1 — Discovery** (this scaffold)
  - launcher fires `check-now` at primary-instance startup
  - main-process patch reads `state.json`, logs status, exposes
    `codex-updater:get-status` IPC. No UI yet.

- **Phase 2 — Menu indicator**
  - main-process patch adds a menu entry when status indicates an update
    is available.

- **Phase 3 — Features picker BrowserWindow**
  - `window.html` + `window.js` + IPC for get/save features.

- **Phase 4 — Build trigger**
  - "Update" button spawns `codex-update-manager` build; renderer polls
    state via IPC; switches button to "Restart" on `ReadyToInstall`.

- **Phase 5 — Restart dance**
  - `install-now` writes marker + quits. `start.sh.template` detects the
    marker on next launch and runs the install.

## State + settings

| Location | Purpose | Owner |
|---|---|---|
| `~/.local/share/codex-update-manager/state.json` | Rust updater state machine | updater |
| `~/.config/codex-update-manager/config.toml` | Rust updater config | updater |
| `~/.config/codex-desktop/settings.json` → `codex-linux-update-features` key | User's feature opt-in selection | this feature |
| `~/.local/state/codex-desktop/update-pending` | Restart-handoff marker | this feature + launcher |

User feature selection lives next to the existing
`codex-linux-read-aloud-enabled` etc. settings. When the user triggers a
build, this feature materialises the selection as a temporary
`features-user.json`, sets `CODEX_LINUX_FEATURES_CONFIG` to its path, and
spawns the updater.

## Install-type handling

The updater already differentiates user-local vs system packaging
(`builder.rs` produces .deb/.rpm/.pkg.tar.zst; `install_rollback.rs` wraps
the install in `pkexec`). This feature is install-type agnostic: it just
asks the updater to install whatever it built. `pkexec` will prompt the
user if elevation is required.

## Open splice points (Phase 2+)

The main-process splice for the IPC and menu indicator needs to land
after Avi's existing patches in [scripts/patches/main-process.js](../../scripts/patches/main-process.js):

- The single-instance lock guard (line 615) modifies the same region we
  want to hook (right around `await n.app.whenReady()`). Our patch needs
  to detect the post-single-instance form and splice into _that_, not
  the raw upstream form.
- A safe hook is immediately after the resolved `whenReady()` — same
  pattern as the tray setup further down.

This `patch.js` is a scaffold: the splice helpers are imported from
`scripts/patches/shared.js` exactly like the other features.
