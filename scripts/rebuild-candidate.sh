#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
    cat <<'HELP'
Usage: scripts/rebuild-candidate.sh [--install] [path/to/chatgpt_*.deb]

Builds from an explicitly supplied official package or resolves the current
package through OpenAI's signed stable APT index.

Environment:
  CODEX_NEXT_APP_DIR   Candidate destination (default: ./codex-app-next)
  CODEX_FINAL_APP_DIR  Final destination for --install (default: ./codex-app)
  REBUILD_REPORT_DIR   Report directory (default: ./dist-next/rebuild)
HELP
}

install_after_build=0
upstream_deb=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --install) install_after_build=1 ;;
        -h|--help) usage; exit 0 ;;
        -*) usage >&2; exit 2 ;;
        *)
            [ -z "$upstream_deb" ] || { usage >&2; exit 2; }
            upstream_deb="$(realpath "$1")"
            ;;
    esac
    shift
done

target="${CODEX_NEXT_APP_DIR:-$REPO_DIR/codex-app-next}"
if [ "$install_after_build" -eq 1 ]; then
    target="${CODEX_FINAL_APP_DIR:-$REPO_DIR/codex-app}"
fi
report_dir="${REBUILD_REPORT_DIR:-$REPO_DIR/dist-next/rebuild}"
args=()
if [ -n "$upstream_deb" ]; then
    [ -f "$upstream_deb" ] || { echo "[rebuild][ERROR] package not found: $upstream_deb" >&2; exit 1; }
    args=("$upstream_deb")
fi

CODEX_INSTALL_DIR="$target" REBUILD_REPORT_DIR="$report_dir" \
    "$REPO_DIR/install.sh" "${args[@]}"

printf '[rebuild] Complete\n  App: %s\n  Run: %s/start.sh\n  Patch report: %s/patch-report.json\n  Upstream metadata: %s/upstream-linux-package.json\n' \
    "$target" "$target" "$report_dir" "$report_dir"
