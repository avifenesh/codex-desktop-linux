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
starter profile that keeps the `--no-sandbox` browser tradeoff visible.

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
agent workspace is active. It polls `workspace observe --screenshot` through the
allowlisted bridge, renders the latest screenshot in the conversation surface,
shows the display, profile/policy summary, and running app names, and exposes a
stop button next to the live view. Stop failures keep the panel visible and show
the bridge or CLI error instead of pretending the workspace stopped. This is not
a full streaming viewer yet; the deeper viewer can build on the same
observe/screenshot bridge after the lifecycle and profile surface is stable.

Dogfood check: the side-by-side dev app built with `make build-dev-app` has been
launched inside an agent workspace. The conversation panel rendered the live
workspace screenshot and its Stop control issued the expected workspace stop
request through the bridge. The live stop path was exercised from the embedded
panel and left the workspace manifest with `ready: false`.

Settings dogfood: the same side-by-side dev app opened Settings inside a hidden
workspace, showed the **Agent Workspaces** sidebar entry and page, rendered the
active workspace card, and opened the **Chrome template** create form with the
disabled-network `restricted-chrome` profile plus its explicit
`restricted-chrome-no-sandbox` startup command. The form was not saved during the
test, and cleanup left no saved profiles or active workspaces.

Run the feature tests with:

```bash
node --test linux-features/agent-workspace/test.js
```
