#!/usr/bin/env bash
set -euo pipefail

source_binary="${CODEX_PET_KWIN_SOURCE:-$SCRIPT_DIR/linux-features/pet-overlay/kwin-helper/target/release/codex-pet-kwin}"
[ -x "$source_binary" ] || {
    echo "Pet Overlay requires a prebuilt helper: $source_binary" >&2
    echo "Run make build-native-feature-helpers before packaging." >&2
    exit 1
}
mkdir -p "$INSTALL_DIR/resources/native"
install -m 0755 "$source_binary" "$INSTALL_DIR/resources/native/codex-pet-kwin"
