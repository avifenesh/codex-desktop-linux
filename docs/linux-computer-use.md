# Linux Computer Use

Linux Computer Use is an opt-in UI surface backed by a native Rust MCP backend,
`codex-computer-use-linux`. The backend is bundled and registered by default;
the in-app Computer Use controls are disabled until you opt in.

It supports:

- app listing and accessibility trees through AT-SPI
- screenshots through GNOME Shell DBus, the Codex GNOME Shell extension, or XDG Desktop Portal
- window listing and focusing on GNOME, KWin/Plasma 5 and 6, Hyprland, Niri,
  COSMIC, i3, and generic X11/EWMH window managers; GNOME extension and X11
  windows can also be moved and resized
- keyboard, text, click, scroll, and drag input through `/dev/uinput`, XDG
  RemoteDesktop portal, `xdotool` on X11, or `ydotool`
- pointer-direction feedback for the built-in V2 pet after successful click,
  scroll, and drag actions

## Runtime Dependencies

The embedded backend includes the standalone v0.5.0 accessibility setup
readback fix. Setup verifies GNOME's saved toolkit-accessibility key even when
runtime AT-SPI is ready, and warns when the saved key cannot be verified.
Other accessibility tools can change the key later; setup does not hold it on.

For an explicit foreground hold-open, run `codex-computer-use-linux guard-accessibility`.
It holds a passive AT-SPI listener and watches/reasserts the saved toolkit setting
for the current user. It is never started by MCP, setup, or observation. Stop
with Ctrl-C or SIGTERM before disabling accessibility. Stop cancels pending
work and releases the listener without disabling other clients or restoring
an old setting. Applications launched during a reset/reassertion interval may
still need restarting.

Plain left element/selector clicks prefer a native AT-SPI `click`, `press`, or
`toggle` action, resolved by name against the live action list. Entry `activate`
and slider `jump` actions are not substituted for pointer clicks. This avoids guessing a
GTK toolkit-to-pointer scale. Explicit coordinates, right clicks, and multiple
clicks retain pointer semantics. Relative coordinates use the clipped screenshot
crop origin in coordinate pixels: divide preview pixels by the returned scale.
Raw GDK surface coordinates and widget-local coordinates are not that origin.
This does not qualify every GNOME X11 EWMH move/resize or mixed-monitor mapping.

Set `CODEX_COMPUTER_USE_NOTIFY_ON_COMPLETE=1` in the MCP server environment
to expose `complete_interaction`, a parameter-free completion notification.
The standalone `COMPUTER_USE_LINUX_NOTIFY_ON_COMPLETE` alias is accepted only
when the Codex variable is unset; an explicit Codex value of `0` disables it.
The tool uses `notify-send` with bounded execution and cleanup. Missing services,
failures, and timeouts skip the cue without failing the task. It does not grant
exclusive desktop ownership and is disabled by default.

Install `ydotool` 1.0.3 or newer when you need the fallback input path. The
backend probes the exact absolute move, wheel move, click, delayed key, and
stdin typing command shapes it emits. Earlier or incompatible CLIs are rejected
even if `ydotoold` and its socket are present.

```bash
# Debian / Ubuntu
sudo apt install ydotool
sudo apt install ydotoold   # on Ubuntu releases that split the daemon

# Fedora
sudo dnf install ydotool

# Arch / Manjaro
sudo pacman -S ydotool

# openSUSE
sudo zypper install ydotool
```

The preferred coordinate input path opens `/dev/uinput` directly, but that
device provides pointer input only. Keyboard readiness still requires an XDG
RemoteDesktop portal with keyboard support, `xdotool` on X11, or a compatible
`ydotool` daemon and socket. Portal pointer support also requires the
RemoteDesktop pointer methods, a monitor-capable ScreenCast source, and the
matching advertised device types. ScreenCast v2 and newer must also advertise
the hidden cursor mode that the runtime requests; v1 uses that mode by default.

For `ydotool`, run a daemon and make sure your user can access the socket:

```bash
sudo systemctl enable --now ydotoold
sudo usermod -a -G input "$USER"
```

Then log out and back in.

On X11, install `xdotool` for layout-correct XTEST keyboard/text input and
coordinate clicks, and `wmctrl` plus `xprop` for generic EWMH window listing,
focus, move, and resize. `xdotool` is preferred only with a nonempty `DISPLAY`;
ydotool is used when it cannot be launched. Once xdotool starts, a failure or
timeout is returned and input is never replayed through ydotool. Override
keyboard selection with `COMPUTER_USE_LINUX_FORCE_YDOTOOL_KEYBOARD=1` or
`CODEX_COMPUTER_USE_FORCE_YDOTOOL_KEYBOARD=1`; the corresponding
`*_FORCE_XDOTOOL_KEYBOARD=1` names force XTEST when available. Set
`COMPUTER_USE_LINUX_FORCE_YDOTOOL_POINTER=1` or
`CODEX_COMPUTER_USE_FORCE_YDOTOOL_POINTER=1` to skip native-X11 xdotool clicks.

Some distros name the unit `ydotool.service` instead of `ydotoold.service`, and
some install `/usr/bin/ydotoold` without a service unit. If the system unit path
is awkward, a user-session service that binds `%t/.ydotool_socket` is also
valid.

Portal packages are needed when your desktop relies on XDG Desktop Portal input
or screenshots:

- KDE Plasma: `xdg-desktop-portal-kde`
- sway/wlroots: `xdg-desktop-portal-wlr`
- Hyprland: `xdg-desktop-portal-hyprland`
- GNOME: usually available by default

`doctor` evaluates pointer and keyboard portal capability independently. A
keyboard-only or pointer-only RemoteDesktop implementation remains useful when
its supported modality is complete, but pointer-only support does not make
keyboard readiness green.

Niri window listing and exact focus use the `niri` command and the active
session's `NIRI_SOCKET`. The Computer Use backend hydrates `NIRI_SOCKET` for GUI
starts, but the socket must still belong to the active Niri session and be
reachable by the desktop user.

The optional `x11-ewmh-computer-use` Linux feature remains available as a
separate, alternative namespaced tool surface. It is not required for the core
backend's generic X11/EWMH support.

## Verify Readiness

Once Computer Use is visible in the Codex UI, ask Codex:

> Check whether Linux Computer Use is ready

You can also run the backend directly:

```bash
./codex-app/resources/plugins/openai-bundled/plugins/computer-use/bin/codex-computer-use-linux doctor
./codex-app/resources/plugins/openai-bundled/plugins/computer-use/bin/codex-computer-use-linux setup
./codex-app/resources/plugins/openai-bundled/plugins/computer-use/bin/codex-computer-use-linux apps
./codex-app/resources/plugins/openai-bundled/plugins/computer-use/bin/codex-computer-use-linux windows
./codex-app/resources/plugins/openai-bundled/plugins/computer-use/bin/codex-computer-use-linux screenshot
```

## Enable The In-App UI

Ad hoc, for one build:

```bash
CODEX_LINUX_ENABLE_COMPUTER_USE_UI=1 make build-app
```

Persistent, including future auto-updater rebuilds:

```bash
mkdir -p ~/.config/codex-desktop
echo '{"codex-linux-computer-use-ui-enabled": true}' > ~/.config/codex-desktop/settings.json
```

To opt back out, unset the env var and remove the settings flag or set it to
`false`.

Nix:

```bash
nix run github:ilysenko/codex-desktop-linux#codex-desktop-computer-use-ui
```

Combined with a Linux feature output:

```bash
nix run github:ilysenko/codex-desktop-linux#computer-use-ui-remote-mobile-control
```

## Side-By-Side Dev Variant

```bash
make build-dev-app
make run-dev-app
```

Override the dev identity with `DEV_APP_ID`, `DEV_APP_NAME`, and
`CODEX_WEBVIEW_PORT` if needed.
