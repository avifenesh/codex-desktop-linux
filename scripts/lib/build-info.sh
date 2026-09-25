#!/bin/bash
# Build provenance metadata written into generated Linux app directories.
#
# Sourced by install.sh. Do not run directly.
# shellcheck shell=bash

write_build_info() {
    local package_path="$1"
    local metadata_path="$2"

    mkdir -p "$INSTALL_DIR/resources" "$INSTALL_DIR/.codex-linux"
    node "$SCRIPT_DIR/scripts/lib/build-info.js" \
        "$SCRIPT_DIR" \
        "$INSTALL_DIR" \
        "$package_path" \
        "$metadata_path" \
        "$CODEX_APP_ID" \
        "$CODEX_APP_DISPLAY_NAME"
    info "Build info written"
}
