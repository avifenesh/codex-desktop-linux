# Tray Usage

This optional feature shows the same rate-limit windows already used by the
profile menu in the Linux system-tray menu. It does not make a second request
or move account credentials into the Electron main process: the renderer's
existing `tray-menu-threads-changed` message already carries compact usage
labels, and this feature enables those labels in the Linux menu.

Enable it by copying `linux-features/features.example.json` to
`linux-features/features.json` and adding the feature id:

```json
{
  "enabled": [
    "tray-usage"
  ]
}
```

Then rerun `./install.sh` or the native package build flow. Fully quit every
ChatGPT Community process before launching the rebuilt app. Depending on the
desktop shell, open the tray menu with the tray icon's context-menu click
(usually right-click on Linux); a normal left click still opens the app.

The labels are read-only and can be absent while usage data is loading or when
the account has no rate-limit windows. They refresh whenever the app's existing
usage state refreshes. Multiple windows (for example, five-hour and weekly)
are shown separately with their reset time when available.

## Known risks

The patch targets a minified upstream Electron bundle and is intentionally
optional. If the upstream tray-menu contract changes, the patch leaves the
bundle unchanged and records optional drift rather than guessing at a new
location.

## Testing

```bash
node --test linux-features/tray-usage/test.js
```
