# Official Linux package migration

This file is the durable execution record for the migration from the macOS
DMG port to OpenAI's signed Linux packages. Update it in the same commit as
each completed milestone. A checked item must have evidence in the **Tests**
column and the commit SHA must be filled after the commit is created (the SHA
may be backfilled by the next milestone commit).

## Invariants

- [x] Migration branch: `codex/migrate-to-official-linux-package`
- [x] Only signed stable OpenAI APT metadata is trusted for unattended builds.
- [x] Only `amd64` and `arm64` are supported.
- [x] A clean build preserves upstream `resources/app.asar` byte-for-byte.
- [x] The output remains `codex-desktop` under `/opt/codex-desktop` and does not
  install the upstream APT source, key, or maintainer scripts.
- [x] All optional features are disabled in committed configuration.
- [x] Known retired feature IDs are ignored; arbitrary unknown IDs fail.
- [x] Active sources outside CHANGELOG/migration history contain no DMG,
  Sparkle, macOS extraction, Electron download, or native rebuild paths.

## Milestones

| # | Milestone | Status | Tests / evidence | Commit SHA |
|---|---|---|---|---|
| 0 | Branch and exhaustive tracking record | complete | clean `main` at `4da3436f`; 86-ID official-ASAR probe and 34 manifests inventoried | `ea59dbc9` |
| 1 | Signed Linux-package source and extraction pipeline | complete | source-security tests; local official-package build; ASAR SHA equality | `33e2c03d` |
| 2 | Compact launcher and cross-format package payload | complete | launcher tests; amd64 deb/RPM builds; pacman/AppImage stage inspection | `2653173b` |
| 3 | Core patch retirement and feature retargeting | complete | 784 Node tests: 783 pass, 1 skipped; empty core registry; retired/unknown-ID policy | `e26e494d` |
| 4 | Signed-package updater and state migration | complete | 48 Rust tests; Clippy; signed metadata-only probe; updater-enabled deb payload | `47f6d69d` |
| 5 | Nix and signed-package CI/watchdog | complete | flake evaluation + Nix package check; signed full amd64/arm64 package verification; cross-arch clean ASAR equality | `eaf34e8e` |
| 6 | Documentation and final repository cleanup | complete | uninterrupted `CI_SKIP_PULL=1 ./scripts/ci-local.sh all`; forbidden-reference scan; `git diff --check` | `916a8337` |
| 7 | Community identity and legacy bundled-plugin handoff | complete | distinct ChatGPT Community desktop/icon; Browser and Chrome official clients connect after cache migration; newest native package is selected for installation | `43e2cb2b`, `ec281e0a`, `f1699543` |
| 8 | Documentation, optional-feature, and package-contract re-audit | complete | 29 retained manifests default-off; four nonfunctional/redundant IDs retired; prebuilt native artifacts in update-builder; raw-official feature, package metadata/architecture, Node/Rust/smoke checks | this commit |

## Build, package, updater, CI, and documentation checklist

### Upstream and build

- [x] Map host architecture to `amd64`/`arm64` and reject all others.
- [x] Verify `InRelease` with the pinned Codex Linux Repository key and
  fingerprint `3BFA0E4AE8B8CC16A2D9BA684A3B4A566C4660E4`.
- [x] Verify `Packages` size/SHA256 from `InRelease`.
- [x] Resolve and verify the indexed `chatgpt_<version>_<arch>.deb`.
- [x] Validate control name/version/architecture and mandatory Linux payload.
- [x] Extract data only; never run upstream maintainer scripts.
- [x] Support `./install.sh [path/to/chatgpt_*.deb]` and reject DMG inputs/env.
- [x] Stage `/usr/lib/chatgpt` directly, including native modules, `codex`, `rg`,
  code-mode host, locales, libraries, and Owl metadata.
- [x] Skip ASAR extraction/repack when no ASAR feature is enabled.
- [x] Emit build-info schema v2 `upstreamLinuxPackage` metadata.
- [x] Remove DMG extraction, Electron download, native rebuild, managed runtime,
  webview server, external CLI repair, and duplicate bundled-resource staging.

### Launcher and packages

- [x] Replace the generated launcher with a compact official-runtime wrapper.
- [x] Keep declarative env/prelaunch/electronArgs/launcher/coldStart/afterExit hooks.
- [x] Pass URI/CLI arguments through unchanged; wait only for after-exit hooks.
- [x] Remove custom single-instance/warm-start/webview/process supervision.
- [x] Preserve `codex-desktop` identity and `/opt/codex-desktop` layout.
- [x] Retarget AppArmor to `/opt/codex-desktop/ChatGPT` for system packages.
- [x] Do not automatically add `--no-sandbox` to AppImage.
- [x] Align dependency mappings for deb/RPM/pacman and inspect every payload.

### Updater

- [x] Poll signed APT metadata instead of an untrusted moving-object HEAD request.
- [x] Cache by version/architecture/SHA256.
- [x] Rebuild by extraction plus enabled feature application only.
- [x] Keep Node/ASAR tooling in update-builder, not the app runtime.
- [x] Preserve candidate promotion, running-app guard, rollback, and cleanup.
- [x] Reset incompatible schema-v1 pending state without losing installed/rollback data.
- [x] Remove the legacy source parser/cache model after the one-time schema reset.

### Nix, CI, and watchdog

- [x] Nix fetches architecture-specific official `.deb` hashes and wraps ELF deps.
- [x] Remove legacy source, Electron replacement, and `nix/native-modules` inputs.
- [x] Replace both legacy watchdogs with one signed-package watchdog.
- [x] Replace the old hash workflow with official `.deb` pin refresh.
- [x] Convert upstream-build workflow to signed APT metadata and both arches.

### Documentation

- [x] Rewrite README, architecture, build/package, native setup, updater, Nix,
  troubleshooting, feature architecture, validation playbook, and `AGENTS.md`.
- [x] Explain official `chatgpt` versus custom `codex-desktop` coexistence.
- [x] Explain shared `Codex` profile and concurrent-launch restriction.
- [x] Name the custom desktop **ChatGPT Community** while retaining the
  `codex-desktop` package/bin/path identity.
- [x] Document the narrow Browser/Chrome legacy-cache migration and safe manual
  recovery without deleting arbitrary or user-authored plugins.
- [x] Document feature retirement and zero default ASAR patches.
- [x] Retain DMG history only in CHANGELOG and this migration record.

## Core patch audit (official 26.803.81509 baseline)

Source links for every row: [descriptors](../../scripts/patches/core/README.md),
[implementations](../../scripts/patches/impl/), and
[tests](../../scripts/patch-linux-window-ui.test.js). Replace these directory
links with the exact retained feature descriptor/test when code is moved.

| Patch ID | Official baseline | Final action | Status / evidence |
|---|---|---|---|
| `linux-quit-guard` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-explicit-quit-prompt-bypass` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-explicit-quit-drain-timeout` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-explicit-tray-quit` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-explicit-ipc-quit` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-window-options` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-managed-window-system-context-menu` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-menu` | applies | delete port menu code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-application-menu` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-reload-shortcuts` | applies | delete port menu code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-set-icon` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-ready-to-show-window-state` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-resize-repaint` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-opaque-background` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-x11-project-picker` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-native-titlebar` | applies | delete; feature owns customization | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-avatar-overlay-mouse-passthrough` | applies | delete port window code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-file-manager` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-terminal-host-environment` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-terminal-user-path` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-tray` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-build-info-tray` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-single-instance` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-avatar-cursor` | applies | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-ui-feature` | disabled | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-plugin-gate` | applies | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-chrome-plugin-auto-install` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-native-desktop-apps` | disabled | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-bundled-plugin-reconcile-stale-snapshot` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-bundled-plugin-copy-permissions` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-socket-directory` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-route-liveness` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-local-app-server-feature-enablement-handler` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-remote-control-config-preservation` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-updater-menu` | applies | delete; updater uses actions/CLI | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-notification-actions` | applies | validate; optional feature only if needed | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-settings-persistence` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-launch-actions` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-hotkey-window-prewarm` | applies | delete port lifecycle code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-git-origins-source-fallback` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-xdg-documents-dir` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-external-open-env` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `main-process-ui` | applies | delete port UI aggregate | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-host-child-process-environment` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-worker-file-manager` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-multi-instance-bootstrap-lock` | applies | delete upstream lifecycle workaround | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-bootstrap-failure-exit` | applies | delete upstream lifecycle workaround | complete — removed from default core registry; empty-registry and feature suite pass |
| `browser-use-node-repl-approval` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-chrome-native-host-runtime` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-owl-feature-binding-fallback` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `automation-schedule-multi-time-rrule` | applies | move to `automation-extensions` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-projectless-xdg-documents-dir` | applies | delete port shell code | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-sunset-gate` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `opaque-window-default-general-settings` | applies | delete; feature owns customization | complete — removed from default core registry; empty-registry and feature suite pass |
| `opaque-window-default-webview-index` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-server-feature-enablement` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-fast-mode-model-guard` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-window-controls-safe-area` | applies | delete; feature owns customization | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-server-backfill-wait` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-i18n-gate` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-skills-list-dedupe` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-settings-search-visibility` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `automation-update-eager-tool` | applies | move to `automation-extensions` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-config-write-version-conflict` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-sidebar-scroll-performance` | applies | move to `linux-performance-workarounds` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-shell-tab-layout-performance` | applies | move to `linux-performance-workarounds` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-markdown-animation-performance` | applies | move to `linux-performance-workarounds` | complete — removed from default core registry; empty-registry and feature suite pass |
| `composer-persistent-rate-limit-footer` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `subagent-nickname-metadata-shape` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-tooltip-window-controls-collision` | applies | delete; feature owns customization | complete — removed from default core registry; empty-registry and feature suite pass |
| `local-environment-action-modal-draft` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-thread-side-panel-native-tooltip` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-availability` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-non-local-navigation` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-chat-search-hydration` | upstream-applied | delete | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-webview-attach-recovery-store` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-webview-attach-recovery-host` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-ui-availability` | disabled | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-host-platform` | disabled | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-computer-use-install-flow` | disabled | move to `computer-use-linux` | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-browser-use-external-availability` | applies | delete old browser port glue | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-app-updater-bridge` | applies | delete; updater uses actions/CLI | complete — removed from default core registry; empty-registry and feature suite pass |
| `browser-annotation-screenshot` | applies | delete generic upstream fix | complete — removed from default core registry; empty-registry and feature suite pass |
| `keybinds-settings` | applies | delete port fallback | complete — removed from default core registry; empty-registry and feature suite pass |
| `package-desktop-name` | applies | delete port identity rewrite | complete — removed from default core registry; empty-registry and feature suite pass |
| `linux-workspace-root-open-targets` | applies | delete port open-target rewrite | complete — removed from default core registry; empty-registry and feature suite pass |

## Linux feature audit

Manifest links are relative to `linux-features/<id>/feature.json`; every retained
or new feature must also keep its adjacent README and feature-local tests.

| Feature ID | Decision | Status / evidence |
|---|---|---|
| `agent-workspace` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `api-key-model-visibility` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `api-key-service-tier` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `appshots` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `authenticated-proxy` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `codex-micro` | simplify; remove node-hid/native rebuild | complete — retained feature tests pass against the official-bundle contracts |
| `codex-wrapper-updater` | retire | complete — directory removed; retired-ID compatibility test passes |
| `conversation-delete` | retire after official-bundle audit | complete — all 12 current UI/cache anchors drifted; zero behavior was removed instead of shipping a false opt-in |
| `conversation-mode` | retire after official-bundle audit | complete — three of four descriptors drifted and the voice loop was nonfunctional on the official ASAR |
| `copilot-reasoning-effort` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `deferred-update-build` | retire | complete — directory removed; retired-ID compatibility test passes |
| `directory-only-working-tree-watch` | audit on official runtime | retained opt-in — official Parcel route regression tests still require the bounded Watchbound adapter |
| `example-feature` | retire | complete — directory removed; retired-ID compatibility test passes |
| `frameless-titlebar` | retain; remove core composition | complete — retained feature tests pass against the official-bundle contracts |
| `global-dictation` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `mcp-helper-reaper` | audit on official runtime | retained opt-in — orphan-parent tests reproduce the cleanup gap; update builds consume prebuilt helper only |
| `node-repl-reaper` | audit on official runtime | retained opt-in — orphan and live-parent process tests cover the official bundled helper topology |
| `omarchy-theme` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `open-target-discovery` | retire | complete — directory removed; retired-ID compatibility test passes |
| `persistent-status-panel` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `pet-overlay` | audit on X11 and Wayland | retained opt-in — current official overlay/window contract tests pass; X11/Wayland acceptance remains manual |
| `project-group-last-updated-sort` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `project-task-sort` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `read-aloud` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `read-aloud-mcp` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `record-and-replay` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `remote-control-ui` | audit official pairing/reconnect/storage | retained opt-in — official chunk contract and pairing UI regression tests still pass |
| `remote-mobile-control` | audit official mobile recovery | retained opt-in — official single-instance lifecycle is reused; daemon/recovery regression tests pass |
| `shallow-repository-watches` | audit Parcel watcher | retained opt-in — official Linux recursive Parcel route regression remains covered as alternative to Watchbound |
| `shared-app-server-socket` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `ssh-command-wrapper` | retire after official-bundle audit | complete — both main/webview atomic contracts drifted; zero behavior was removed |
| `thorium-chrome-plugin` | retain and retarget | complete — retained feature tests pass against the official-bundle contracts |
| `ui-tweaks` | retain; use official icons/metadata | complete — retained feature tests pass against the official-bundle contracts |
| `x11-ewmh-computer-use` | retire as redundant architecture-limited surface | complete — generic X11/EWMH stays in `computer-use-linux`; x86-only duplicate removed |

### New disabled-by-default feature destinations

- [x] `computer-use-linux`: seven UI/plugin/cursor/native-app descriptors and
  only the staging required by a verified consumer.
- [x] `notification-actions`: not retained; the default registry does not override
  official notification handling.
- [x] `linux-performance-workarounds`: sidebar, tab layout, Markdown animation.
- [x] `automation-extensions`: multi-time RRULE and eager `automation_update`.

## Validation log

| Date | Scope | Command / environment | Result | Commit |
|---|---|---|---|---|
| 2026-08-12 | Baseline inventory | official 26.803.81509 ASAR patch probe | 17 upstream-applied, 64 applied, 5 disabled; 86 total | pre-migration |
| 2026-08-12 | Source security | `node --test scripts/lib/upstream-linux-package.test.js` | 4/4 pass: valid/tampered/wrong-key signature, release/package hashes and metadata | `33e2c03d` |
| 2026-08-12 | Clean baseline | local official `chatgpt_26.803.81509_amd64.deb` with empty feature config | upstream/output ASAR SHA `87a32f5d…ff9ff66`; launcher diagnose passes; schema v2 emitted | `33e2c03d` |
| 2026-08-12 | Launcher | `node --test launcher/start.test.js` | 2/2 pass: hook composition, exact argument forwarding, diagnose | `2653173b` |
| 2026-08-12 | Package payload | updater-disabled amd64 builders | deb and RPM built/inspected; AppImage and pacman staged/inspected; official `codex` retained, duplicate CLI absent, AppArmor path correct | `2653173b` |
| 2026-08-12 | Core/feature audit | `node --test scripts/patch-linux-window-ui.test.js scripts/lib/linux-features.test.js linux-features/*/test.js` | 784 tests: 783 pass, 1 skipped; zero core descriptors; four retired IDs ignored and typos rejected | `e26e494d` |
| 2026-08-12 | Updater | `cargo test -p codex-update-manager`; `cargo clippy -p codex-update-manager -- -D warnings` | 48/48 tests and warning-free Clippy; schema-v1 candidate reset preserves rollback | `47f6d69d` |
| 2026-08-12 | Updater source/payload | metadata-only signed index probe; updater-enabled `.deb` build/inspection | official 26.803.81509 amd64 metadata resolved without package download; update-builder contains verifier/key/templates and no Cargo workspace, managed runtime, or legacy source tooling | `47f6d69d` |
| 2026-08-12 | Signed package pins | production watchdog plus full package verification for `amd64` and `arm64` | both packages are 26.803.81509 and match signed `Packages`; corrected arm64 pin to `f38fcc194eca…accbc1` | `eaf34e8e` |
| 2026-08-12 | Nix | clean `nixos/nix` container: parse, `nix flake check --no-build`, and `.#checks.x86_64-linux.official-linux-package` | evaluation and real pinned-package derivation pass | `eaf34e8e` |
| 2026-08-12 | Cross-architecture baseline | `CODEX_TARGET_ARCH=arm64 ./install.sh chatgpt_26.803.81509_arm64.deb` | aarch64 ELF staged and output ASAR is byte-identical to official package | `eaf34e8e` |
| 2026-08-12 | Broad Node suite | tracked `*.test.js` files under Node 24 | 795 tests: 794 pass, 1 skipped, 0 fail | `916a8337` |
| 2026-08-12 | Rust updater | `cargo test -p codex-update-manager -q`; `cargo clippy -p codex-update-manager --all-targets -- -D warnings` | 48/48 tests pass; Clippy clean | `916a8337` |
| 2026-08-12 | Package matrix | clean-container `.deb`, RPM, pacman and full Nix build | all four package payloads built successfully from official 26.803.81509; upstream `app.asar` retained | `916a8337` |
| 2026-08-12 | Dependency bootstrap | `CI_SKIP_PULL=1 ./scripts/ci-local.sh install-deps` | Ubuntu 22.04, Ubuntu 24.04 and Debian 12 pass with Node 24.19.0 | `916a8337` |
| 2026-08-12 | Final matrix | uninterrupted `CI_SKIP_PULL=1 ./scripts/ci-local.sh all` | exit 0; core 777 tests (776 pass, 1 skip), deb/RPM/pacman/Nix, dependency matrix and signed upstream build all pass | `916a8337` |
| 2026-08-12 | Final source audit | forbidden-reference `rg`, shell/JS/JSON syntax, feature README inventory, `git diff --check` | no active legacy-source/runtime paths outside intentional rejection tests and migration history; all static checks pass | `916a8337` |
| 2026-08-12 | Optional-feature re-audit | `node scripts/ci/verify-official-linux-features.js <official-26.803.81509-ASAR>` | 27 ASAR-owning features pass against the raw official bundle; 29 retained manifests are default-off | this commit |
| 2026-08-12 | Retained feature/framework suite | `node --test scripts/patch-linux-window-ui.test.js scripts/lib/linux-features.test.js scripts/lib/package-common.test.js linux-features/*/test.js` | 698 tests: 697 pass, 1 intentional skip, 0 fail | this commit |
| 2026-08-12 | Updater after minimal-builder audit | `cargo test -p codex-update-manager --locked`; `cargo clippy -p codex-update-manager --locked --all-targets -- -D warnings` | 49/49 pass; Clippy clean; enabled native feature templates and binaries are retained without Cargo workspaces | this commit |
