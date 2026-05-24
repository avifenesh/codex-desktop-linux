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
saved profiles, preview profile-backed workspace starts, start a hidden
workspace after explicit acknowledgement, stop running workspaces, and run stale
workspace cleanup.

The bridge is intentionally allowlisted. It invokes `agent-workspace-linux`
through `execFile`, never through a shell, and exposes only profile/workspace
lifecycle actions needed by the UI. The default command is
`agent-workspace-linux`; users can override it with either:

- `CODEX_AGENT_WORKSPACE_BIN=/absolute/path/to/agent-workspace-linux`
- the settings-page command field, persisted as
  `codex-linux-agent-workspace-command`

The first embedded version does not stream the hidden X11 workspace into the app
yet. That should come as a separate viewer slice after the lifecycle and profile
surface is stable.

Run the feature tests with:

```bash
node --test linux-features/agent-workspace/test.js
```
