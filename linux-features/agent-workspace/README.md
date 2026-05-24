# Agent Workspaces Linux Feature

`agent-workspace` is an opt-in Codex Desktop for Linux feature that embeds the
`agent-workspace-linux` control surface into the app settings UI.

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
workspace starts, start a hidden workspace after explicit acknowledgement, stop
running workspaces, run stale workspace cleanup, and create a restricted Chrome
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
the page stays in the existing app-owned permission mode.

The first conversation-view slice shows a compact live workspace panel when an
agent workspace is active. It uses the current Codex `--color-token-*` theme
variables first, with older token names only as fallback, polls `workspace observe
--screenshot` through the allowlisted bridge, renders the latest screenshot in
the conversation surface, shows a user-facing `Workspace active` summary with
profile/policy and app count, keeps display numbers and internal app names in
hover detail, and exposes Refresh, Stop, and Revoke buttons next to the live view.
The panel can be dragged by its header, resized from its lower-right handle, and
keeps its clamped position/size in local storage so it does not stay stuck over
half the conversation. Newer injected runtimes clean up older panel instances
before rendering, which prevents stacked live-view overlays after an app patch.
Stop failures keep the panel visible and show the bridge or CLI error instead of
pretending the workspace stopped. The panel hides on Settings pages, where the
dedicated Agent Workspaces page owns the controls, and watches
navigation/content changes so it does not linger over settings after route
changes. This is not a full streaming viewer yet; the deeper viewer can build on
the same observe/screenshot bridge after the lifecycle and profile surface is
stable.

Agent Workspace approval prompts are also rendered through a Linux webview patch.
The renderer recognizes workspace/profile parameters and the
`agent-workspace-linux` approval bundle shape returned by start/launch previews,
then shows user-facing rows such as **Workspace request**, **Needs user
approval**, and **Approve by setting** instead of falling back to a raw JSON
`Params` object. Generic MCP approval prompts keep the upstream renderer.

Dogfood check: the side-by-side dev app built with `make build-dev-app` has been
launched inside an agent workspace. The conversation panel rendered the live
workspace screenshot and its Stop control issued the expected workspace stop
request through the bridge. The live stop path was exercised from the embedded
panel and left the workspace manifest with `ready: false`. The installed app
bundle was also launched inside the `mcp-visible` workspace with the real
`CODEX_HOME` and `CODEX_AGENT_WORKSPACE_BIN`; Chrome DevTools Protocol confirmed
the conversation panel rendered the live screenshot, workspace metadata,
Refresh/Stop/Revoke controls, and a working Refresh action without console
errors.

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
