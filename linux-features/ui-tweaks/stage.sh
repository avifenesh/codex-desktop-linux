#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="${CODEX_UPSTREAM_APP_DIR:?CODEX_UPSTREAM_APP_DIR is required}"
install_dir="${INSTALL_DIR:?INSTALL_DIR is required}"
official_icon="$app_dir/resources/icon-chatgpt.png"
official_desktop="$install_dir/.codex-linux/upstream-package/chatgpt.desktop"
community_icon="$SCRIPT_DIR/assets/codex-linux.png"
resources_dir="$install_dir/resources"
target_dir="$resources_dir/dock-icon"
temp_dir="$resources_dir/.dock-icon.tmp.$$"
helper_source="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sync-desktop-icon.sh"

remove_dock_icon_payload() {
    rm -rf -- "$temp_dir"
    if [ -L "$target_dir" ]; then
        rm -f -- "$target_dir"
    else
        rm -rf -- "$target_dir"
    fi
}

dock_icon_enabled="$(node - "$SCRIPT_DIR" <<'NODE'
const path = require("node:path");
const scriptDir = process.argv[2];
const { loadEnabledLinuxFeatures } = require(path.join(scriptDir, "scripts/lib/linux-features.js"));
const { dockIconEnabled } = require(path.join(
  scriptDir,
  "linux-features/ui-tweaks/patches/dock-icon.js",
));
const feature = loadEnabledLinuxFeatures().find(({ id }) => id === "ui-tweaks");
process.stdout.write(feature != null && dockIconEnabled({ feature }) ? "true" : "false");
NODE
)"

if [ "$dock_icon_enabled" != "true" ]; then
    remove_dock_icon_payload
    exit 0
fi

if [ ! -f "$official_icon" ] || [ -L "$official_icon" ] ||
   [ ! -f "$official_desktop" ] || [ -L "$official_desktop" ] ||
   ! grep -qxF 'Name=ChatGPT' "$official_desktop" ||
   ! grep -qxF 'Exec=chatgpt %U' "$official_desktop" ||
   ! grep -qxF 'Icon=chatgpt' "$official_desktop"; then
    echo "ERROR: Official Linux Dock icon resource or desktop metadata drifted; refusing incomplete Dock icon payload" >&2
    remove_dock_icon_payload
    exit 1
fi

for source in "$community_icon" "$helper_source"; do
    if [ ! -f "$source" ] || [ -L "$source" ]; then
        echo "ERROR: Dock icon feature resource is unavailable; refusing incomplete Dock icon payload: $source" >&2
        remove_dock_icon_payload
        exit 1
    fi
done

mkdir -p "$resources_dir"
rm -rf -- "$temp_dir"
mkdir -m 0755 "$temp_dir"
trap 'rm -rf -- "$temp_dir"' EXIT
install -m 0644 "$official_icon" "$temp_dir/icon-chatgpt.png"
install -m 0644 "$community_icon" "$temp_dir/icon-codex-dark-color.png"
install -m 0644 "$community_icon" "$temp_dir/icon-codex-light.png"
install -m 0755 "$helper_source" "$temp_dir/sync-desktop-icon.sh"
if [ -L "$target_dir" ]; then
    rm -f -- "$target_dir"
else
    rm -rf -- "$target_dir"
fi
mv "$temp_dir" "$target_dir"
trap - EXIT
