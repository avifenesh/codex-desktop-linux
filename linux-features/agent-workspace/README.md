# Agent Workspaces Linux Feature

`agent-workspace` is an opt-in Codex Desktop for Linux feature that adds the
`agent-workspace-linux` control surface to the app settings UI.

Enable it in `linux-features/features.json` before running the install/build
pipeline:

```json
{
  "enabled": [
    "agent-workspace"
  ]
}
```

The feature adds a Linux-only settings section named **Agent Workspaces**. The
page can point Codex Desktop at an `agent-workspace-linux` binary, list and edit
saved profiles, validate profile JSON without saving, preview profile-backed
workspace starts, require an explicit approval card before starting a hidden
workspace, stop running workspaces, run stale workspace cleanup, and create a restricted Chrome
starter profile that keeps the `--no-sandbox` browser tradeoff visible. It can
also prepare a browser-session profile from a picked browser data directory,
defaulting to a managed copy under Agent Workspace data and keeping direct
read-write mounting behind an explicit profile-lock warning.
The friendly profile editor intentionally exposes only three network choices:
**Closed** (`network.mode=disabled`), **Local** (`network.mode=local_only`), and
**Open** (`network.mode=inherit_host`). More complex host allowlists are not a
current product path; advanced JSON can still show older/internal profile data
without making the normal UI promise filtering that the runtime does not
enforce.
The startup-app picker accepts ordinary executable files and Linux `.desktop`
launchers; when a launcher is selected, the bridge reads its `Name`/`Exec`
fields, removes desktop field codes such as `%U`, and stores the parsed command
array without invoking a shell.

The bridge is intentionally allowlisted. It invokes `agent-workspace-linux`
through `execFile`, never through a shell, and exposes only profile/workspace
lifecycle actions needed by the UI. The default command is
`~/.local/bin/agent-workspace-linux` when `$HOME` is available, falling back to
`agent-workspace-linux`; users can override it with either:

- `CODEX_AGENT_WORKSPACE_BIN=/absolute/path/to/agent-workspace-linux`
- the settings-page command field, persisted as
  `codex-linux-agent-workspace-command`

On each bridge call, the feature inspects the local Codex MCP config for
`mcp_servers.agent-workspace-linux`. If that server is configured with
`--permissions PATH`, the settings page shows the MCP ceiling state and the
bridge prepends the same `--permissions PATH` to CLI profile/workspace actions.
That keeps app-driven actions inside the same spawn-time ceiling used by
auto-loop agents and other MCP hosts. If no MCP permission file is configured,
the page stays in the existing app-owned permission mode: after the user
approves the hidden workspace, normal workspace-local actions follow the Codex
session permission choice, including full-access sessions that should not ask
again for every click, launch, screenshot, or keystroke.

After the user approves a workspace start, the settings page opens the native
GPUI viewer with `agent-workspace-linux viewer --id WORKSPACE_ID
--exit-when-workspace-gone`. The active/stopped workspace controls can reopen
the same viewer explicitly. This is a detached child process rather than another
Codex conversation surface, keeps always-on-top disabled unless explicitly
requested, and uses the same MCP `--permissions` path when one is configured.
Viewer launch errors are reported through the bridge instead of falling back to
a shell or crashing the app on an asynchronous spawn failure.

The feature intentionally does not inject a conversation workspace screen. The
planned visible monitor is the native GPUI viewer launched by the settings
page/bridge, so the Codex conversation stays focused on the thread instead of
competing with the floating viewer.
The feature only patches the Electron bridge and the Settings webview bundles;
conversation and composer webview assets stay untouched.

The dedicated Settings page owns local start approvals: pressing
**Start** first runs a dry-run preview and renders an **Approve hidden
workspace** card with the request, profile, purpose, setup/startup choices, and
required acknowledgements. The bridge sends `--ack-hidden-workspace` and any
needed policy acknowledgement only after the user presses **Approve and start**.

Dogfood check: the side-by-side dev app built with `make build-dev-app` has been
launched inside an agent workspace. The old in-conversation monitor has been
removed; active workspaces are controlled from Settings and viewed through the
detached native GPUI viewer. The bridge no longer exposes the screenshot-backed
`workspaceObserve` action that fed the removed panel. Fresh app builds should
not carry the old embedded panel; existing incrementally patched installs should
be rebuilt from clean assets when retiring that stale runtime.

Settings dogfood: the same side-by-side dev app opened Settings inside a hidden
workspace, showed the **Agent Workspaces** sidebar entry and page, rendered the
active workspace card, and opened the **Chrome template** create form with the
disabled-network `restricted-chrome` profile plus its explicit
`restricted-chrome-no-sandbox` startup command. The page also exposes a
**Project template** starter that opens the file/folder picker and calls the MCP
`project-dev` template, plus a **Browser session** starter that opens a
browser-data folder picker, shows the selected path and account-data warning,
offers a managed copy or direct-folder mode, and then calls the MCP
`browser-session` template with the selected `userDataDir`. The form was not
saved during the test, and cleanup left no saved profiles or active workspaces.

Run the feature tests with:

```bash
node --test linux-features/agent-workspace/test.js
```
