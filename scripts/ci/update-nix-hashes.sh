#!/bin/bash
set -Eeuo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_DIR"

case "${1:-write}" in
    write)
        exec node scripts/automation/upstream-linux-package-watchdog/watchdog.js --write --json
        ;;
    check)
        result="$(node scripts/automation/upstream-linux-package-watchdog/watchdog.js --json)"
        printf '%s\n' "$result"
        node -e 'const value=JSON.parse(process.argv[1]); process.exit(value.changed ? 1 : 0)' "$result"
        ;;
    *)
        echo "usage: $0 [write|check]" >&2
        exit 2
        ;;
esac
