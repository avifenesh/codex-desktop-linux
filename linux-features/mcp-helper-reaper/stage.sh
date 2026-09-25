#!/usr/bin/env bash
set -euo pipefail

feature_dir="$SCRIPT_DIR/linux-features/mcp-helper-reaper"
reaper_crate_dir="$feature_dir/reaper"
codex_linux_dir="$INSTALL_DIR/.codex-linux"
mcp_reaper_dir="$codex_linux_dir/mcp-helper-reaper"
resources_dir="$INSTALL_DIR/resources"
node_repl="$resources_dir/node_repl"
original_node_repl="$resources_dir/node_repl.codex-linux-original"

resolve_reaper_source() {
    local source_binary="$reaper_crate_dir/target/release/codex-mcp-helper-reaper"

    if [ -n "${CODEX_MCP_HELPER_REAPER_SOURCE:-}" ]; then
        [ -x "$CODEX_MCP_HELPER_REAPER_SOURCE" ] || {
            echo "mcp-helper-reaper source is not executable: $CODEX_MCP_HELPER_REAPER_SOURCE" >&2
            return 1
        }
        printf '%s\n' "$CODEX_MCP_HELPER_REAPER_SOURCE"
        return 0
    fi

    [ -x "$source_binary" ] || {
        echo "MCP helper reaper release artifact is missing: $source_binary" >&2
        echo "Build native feature helpers once before packaging; upstream updates never invoke Cargo." >&2
        return 1
    }
    printf '%s\n' "$source_binary"
}

restore_previous_node_repl_wrapper() {
    [ -e "$original_node_repl" ] || return 0

    if [ ! -e "$node_repl" ]; then
        mv "$original_node_repl" "$node_repl"
        return 0
    fi

    if grep -q "mcp-helper-reaper-node-repl-wrapper" "$node_repl" 2>/dev/null; then
        rm -f "$node_repl"
        mv "$original_node_repl" "$node_repl"
        return 0
    fi

    rm -f "$original_node_repl"
}

reaper_source="$(resolve_reaper_source)"
restore_previous_node_repl_wrapper

mkdir -p "$mcp_reaper_dir" "$codex_linux_dir/cold-start.d" "$codex_linux_dir/after-exit.d"
install -m 0755 "$reaper_source" "$mcp_reaper_dir/codex-mcp-helper-reaper"
install -m 0755 "$feature_dir/install-session-hook.sh" "$mcp_reaper_dir/install-session-hook.sh"
install -m 0755 "$feature_dir/cold-start-hook.sh" "$codex_linux_dir/cold-start.d/mcp-helper-reaper"
install -m 0755 "$feature_dir/after-exit-hook.sh" "$codex_linux_dir/after-exit.d/mcp-helper-reaper"

echo "mcp-helper-reaper staged: orphan MCP helper reaper installed" >&2
