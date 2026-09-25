#!/usr/bin/env bash
set -Eeuo pipefail

source_binary="${CODEX_GLOBAL_DICTATION_LINUX_SOURCE:-$SCRIPT_DIR/global-dictation-linux/target/release/codex-global-dictation-linux}"

[ -x "$source_binary" ] || {
    echo "Global dictation requires a prebuilt release helper: $source_binary" >&2
    echo "Build native feature helpers once before packaging, or set CODEX_GLOBAL_DICTATION_LINUX_SOURCE." >&2
    exit 1
}

target_dir="$INSTALL_DIR/resources/native"
mkdir -p "$target_dir"
install -m 0755 "$source_binary" "$target_dir/codex-global-dictation-linux"
echo "Global dictation helper staged" >&2
