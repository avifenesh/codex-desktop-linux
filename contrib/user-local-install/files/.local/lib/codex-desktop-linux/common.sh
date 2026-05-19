#!/usr/bin/env bash
set -euo pipefail

OPT_ROOT="${HOME}/.local/opt/codex-desktop-linux"
APP_DIR="${OPT_ROOT}/codex-app"
DMG_FILE="${OPT_ROOT}/Codex.dmg"
DMG_URL="https://persistent.oaistatic.com/codex-app-prod/Codex.dmg"

XDG_DATA_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}"
XDG_STATE_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}"

DATA_DIR="${XDG_DATA_HOME}/codex-desktop-linux"
STATE_DIR="${XDG_STATE_HOME}/codex-desktop-linux"
LOG_DIR="${STATE_DIR}/logs"
METADATA_FILE="${STATE_DIR}/metadata.env"
UPDATE_STATUS_FILE="${STATE_DIR}/update-status.env"
INSTALL_CONFIG_FILE="${STATE_DIR}/install.env"
UPDATE_CHECK_FRESHNESS_SECONDS="${UPDATE_CHECK_FRESHNESS_SECONDS:-21600}"
ICON_PATH="${XDG_DATA_HOME}/icons/hicolor/512x512/apps/codex-desktop.png"
DESKTOP_FILE="${XDG_DATA_HOME}/applications/codex-desktop.desktop"

REPO_DIR_DEFAULT="${HOME}/workspace/codex-desktop-linux"
SOURCE_REPO_DIR="$REPO_DIR_DEFAULT"
MANAGED_REPO_DIR="${DATA_DIR}/managed-repo"
BUILD_REPO_DIR=""

ensure_layout() {
    mkdir -p "$DATA_DIR" "$STATE_DIR" "$LOG_DIR" "$(dirname "$ICON_PATH")" "$(dirname "$DESKTOP_FILE")"
}

load_install_config() {
    if [ -f "$INSTALL_CONFIG_FILE" ]; then
        # shellcheck disable=SC1090
        source "$INSTALL_CONFIG_FILE"
    fi
    SOURCE_REPO_DIR="${SOURCE_REPO_DIR:-${REPO_DIR:-$REPO_DIR_DEFAULT}}"
    REPO_DIR="$SOURCE_REPO_DIR"
    MANAGED_REPO_DIR="${MANAGED_REPO_DIR:-${DATA_DIR}/managed-repo}"
    REPO_DEFAULT_BRANCH="${REPO_DEFAULT_BRANCH-}"
}

load_metadata() {
    if [ -f "$METADATA_FILE" ]; then
        # shellcheck disable=SC1090
        source "$METADATA_FILE"
    fi
}

load_update_status() {
    if [ -f "$UPDATE_STATUS_FILE" ]; then
        # shellcheck disable=SC1090
        source "$UPDATE_STATUS_FILE"
    fi
}

write_update_status_file() {
    ensure_layout
    {
        write_kv UPDATE_AVAILABLE "${UPDATE_AVAILABLE:-0}"
        write_kv UPDATE_FINGERPRINT "${UPDATE_FINGERPRINT-}"
        write_kv UPDATE_CHECKED_AT "${UPDATE_CHECKED_AT-}"
        write_kv UPDATE_NOTIFIED_FINGERPRINT "${UPDATE_NOTIFIED_FINGERPRINT-}"
        write_kv UPDATE_REASONS "${UPDATE_REASONS-}"
        write_kv OUTDATED_REPO_HEAD "${OUTDATED_REPO_HEAD-}"
        write_kv AVAILABLE_REMOTE_REPO_HEAD "${AVAILABLE_REMOTE_REPO_HEAD-}"
        write_kv OUTDATED_DMG_ETAG "${OUTDATED_DMG_ETAG-}"
        write_kv AVAILABLE_REMOTE_DMG_ETAG "${AVAILABLE_REMOTE_DMG_ETAG-}"
        write_kv OUTDATED_SOURCE_OVERLAY_SHA256 "${OUTDATED_SOURCE_OVERLAY_SHA256-}"
        write_kv AVAILABLE_SOURCE_OVERLAY_SHA256 "${AVAILABLE_SOURCE_OVERLAY_SHA256-}"
    } > "$UPDATE_STATUS_FILE"
}

update_check_is_fresh() {
    local checked_at="${UPDATE_CHECKED_AT-}"
    local now epoch_checked age

    [ -n "$checked_at" ] || return 1
    now="$(date +%s)"
    epoch_checked="$(date -d "$checked_at" +%s 2>/dev/null || true)"
    [ -n "$epoch_checked" ] || return 1
    age=$((now - epoch_checked))
    [ "$age" -ge 0 ] && [ "$age" -lt "$UPDATE_CHECK_FRESHNESS_SECONDS" ]
}

compute_update_fingerprint() {
    local remote_head="$1"
    local remote_etag="$2"
    local remote_last_modified="$3"
    local remote_content_length="$4"
    local source_overlay_sha="$5"

    printf '%s\n' "${remote_head}|${remote_etag}|${remote_last_modified}|${remote_content_length}|${source_overlay_sha}" \
        | sha256sum \
        | awk '{ print $1 }'
}

build_update_reasons() {
    local reasons=()

    if [ "${UPDATE_REPO_UPSTREAM_CHANGED:-0}" -eq 1 ]; then
        reasons+=("wrapper_repo")
    fi
    if [ "${UPDATE_REPO_OVERLAY_CHANGED:-0}" -eq 1 ]; then
        reasons+=("source_overlay")
    fi
    if [ "${UPDATE_DMG_CHANGED:-0}" -eq 1 ]; then
        reasons+=("codex_dmg")
    fi

    (IFS=,; printf '%s' "${reasons[*]}")
}

tag_outdated_install() {
    local build_head="$1"
    local remote_head="$2"
    local remote_etag="$3"
    local source_overlay_sha="$4"

    UPDATE_AVAILABLE=1
    UPDATE_FINGERPRINT="$(compute_update_fingerprint "$remote_head" "$remote_etag" "${UPDATE_REMOTE_LAST_MODIFIED-}" "${UPDATE_REMOTE_CONTENT_LENGTH-}" "$source_overlay_sha")"
    UPDATE_CHECKED_AT="$(date -Iseconds)"
    UPDATE_REASONS="$(build_update_reasons)"
    OUTDATED_REPO_HEAD="$build_head"
    AVAILABLE_REMOTE_REPO_HEAD="$remote_head"
    OUTDATED_DMG_ETAG="${DMG_ETAG-}"
    AVAILABLE_REMOTE_DMG_ETAG="$remote_etag"
    OUTDATED_SOURCE_OVERLAY_SHA256="${SOURCE_OVERLAY_SHA256-}"
    AVAILABLE_SOURCE_OVERLAY_SHA256="$source_overlay_sha"
    write_update_status_file
}

clear_outdated_install_tags() {
    UPDATE_AVAILABLE=0
    UPDATE_FINGERPRINT=""
    UPDATE_CHECKED_AT="$(date -Iseconds)"
    UPDATE_REASONS=""
    OUTDATED_REPO_HEAD=""
    AVAILABLE_REMOTE_REPO_HEAD=""
    OUTDATED_DMG_ETAG=""
    AVAILABLE_REMOTE_DMG_ETAG=""
    OUTDATED_SOURCE_OVERLAY_SHA256=""
    AVAILABLE_SOURCE_OVERLAY_SHA256=""
    write_update_status_file
}

notify_update_available_if_needed() {
    local icon message

    [ "${UPDATE_AVAILABLE:-0}" = "1" ] || return 0
    [ "${UPDATE_FINGERPRINT-}" != "${UPDATE_NOTIFIED_FINGERPRINT-}" ] || return 0
    command -v notify-send >/dev/null 2>&1 || return 0

    icon="${ICON_PATH:-codex-desktop}"
    if [ ! -f "$icon" ]; then
        icon="codex-desktop"
    fi

    message="Your installed Codex Desktop wrapper is older than the latest upstream build."
    case "${UPDATE_REASONS-}" in
        *wrapper_repo*)
            message="A newer codex-desktop-linux wrapper release is available."
            ;;
        *codex_dmg*)
            message="A newer upstream Codex.dmg is available for your local wrapper."
            ;;
        *source_overlay*)
            message="Local wrapper changes are ready to rebuild into your install."
            ;;
    esac

    notify-send \
        -a "Codex Desktop" \
        -i "$icon" \
        -h "string:desktop-entry:codex-desktop" \
        "Codex Desktop update available" \
        "${message} Run: codex-desktop-update"

    UPDATE_NOTIFIED_FINGERPRINT="${UPDATE_FINGERPRINT-}"
    write_update_status_file
}

evaluate_update_status() {
    local build_head remote_head source_overlay_sha dmg_headers
    local remote_etag remote_last_modified remote_content_length

    UPDATE_REPO_UPSTREAM_CHANGED=0
    UPDATE_REPO_OVERLAY_CHANGED=0
    UPDATE_DMG_CHANGED=0

    build_head="${REPO_HEAD-}"
    if [ -z "$build_head" ]; then
        build_head="$(current_repo_head 2>/dev/null || true)"
    fi
    [ -n "$build_head" ] || return 1

    source_overlay_sha="$(source_repo_overlay_signature 2>/dev/null || true)"

    if ! remote_head="$(remote_repo_head 2>/dev/null)"; then
        return 1
    fi

    if ! dmg_headers="$(remote_dmg_headers 2>/dev/null)"; then
        return 1
    fi

    remote_etag="$(header_value "$dmg_headers" "etag")"
    remote_last_modified="$(header_value "$dmg_headers" "last-modified")"
    remote_content_length="$(header_value "$dmg_headers" "content-length")"
    UPDATE_REMOTE_LAST_MODIFIED="$remote_last_modified"
    UPDATE_REMOTE_CONTENT_LENGTH="$remote_content_length"

    if [ "$build_head" != "$remote_head" ]; then
        UPDATE_REPO_UPSTREAM_CHANGED=1
    fi

    if [ "$source_overlay_sha" != "${SOURCE_OVERLAY_SHA256-}" ]; then
        UPDATE_REPO_OVERLAY_CHANGED=1
    fi

    if [ "${DMG_ETAG-}" != "$remote_etag" ] \
        || [ "${DMG_LAST_MODIFIED-}" != "$remote_last_modified" ] \
        || [ "${DMG_CONTENT_LENGTH-}" != "$remote_content_length" ]; then
        UPDATE_DMG_CHANGED=1
    fi

    EVAL_BUILD_HEAD="$build_head"
    EVAL_REMOTE_HEAD="$remote_head"
    EVAL_SOURCE_OVERLAY_SHA="$source_overlay_sha"
    EVAL_REMOTE_ETAG="$remote_etag"

    if [ "${UPDATE_REPO_UPSTREAM_CHANGED}" -eq 0 ] \
        && [ "${UPDATE_REPO_OVERLAY_CHANGED}" -eq 0 ] \
        && [ "${UPDATE_DMG_CHANGED}" -eq 0 ]; then
        return 0
    fi

    return 10
}

run_launch_update_check() {
    ensure_layout
    load_install_config
    load_metadata
    load_update_status

    if update_check_is_fresh; then
        if [ "${UPDATE_AVAILABLE:-0}" = "1" ]; then
            notify_update_available_if_needed
        fi
        return 0
    fi

    if evaluate_update_status; then
        clear_outdated_install_tags
        return 0
    fi

    tag_outdated_install \
        "$EVAL_BUILD_HEAD" \
        "$EVAL_REMOTE_HEAD" \
        "$EVAL_REMOTE_ETAG" \
        "$EVAL_SOURCE_OVERLAY_SHA"
    notify_update_available_if_needed
    return 10
}

run_launch_update_check_background() {
    (
        run_launch_update_check >/dev/null 2>&1 || true
    ) &
}

write_kv() {
    printf '%s=%q\n' "$1" "${2-}"
}

effective_repo_dir() {
    if [ -n "${BUILD_REPO_DIR:-}" ] && [ -d "$BUILD_REPO_DIR/.git" ]; then
        printf '%s\n' "$BUILD_REPO_DIR"
        return 0
    fi
    if [ -d "$MANAGED_REPO_DIR/.git" ]; then
        printf '%s\n' "$MANAGED_REPO_DIR"
        return 0
    fi
    printf '%s\n' "$SOURCE_REPO_DIR"
}

current_repo_head() {
    local repo_dir
    repo_dir="$(effective_repo_dir)"
    git -C "$repo_dir" rev-parse HEAD
}

source_repo_head() {
    [ -d "$SOURCE_REPO_DIR/.git" ] || return 1
    git -C "$SOURCE_REPO_DIR" rev-parse HEAD
}

remote_repo_head() {
    local origin_url
    origin_url="$(repo_origin_url)" || return 1
    git -C "$(repo_remote_query_dir)" ls-remote "$origin_url" HEAD | awk 'NR==1 { print $1 }'
}

repo_origin_url_is_relative_local() {
    local origin_url="$1"

    case "$origin_url" in
        ""|/*|~*|*://*|*:*)
            return 1
            ;;
    esac
    return 0
}

resolve_repo_origin_url() {
    local origin_url="$1"
    local base_dir="$2"
    local base_abs candidate target_dir target_name

    if ! repo_origin_url_is_relative_local "$origin_url" || [ -z "$base_dir" ]; then
        printf '%s\n' "$origin_url"
        return 0
    fi

    if [ -d "$base_dir" ]; then
        base_abs="$(cd "$base_dir" && pwd -P)" || base_abs="$base_dir"
    else
        base_abs="$base_dir"
    fi

    candidate="$base_abs/$origin_url"
    target_dir="$(dirname "$candidate")"
    target_name="$(basename "$candidate")"
    if [ -d "$target_dir" ]; then
        printf '%s/%s\n' "$(cd "$target_dir" && pwd -P)" "$target_name"
    else
        printf '%s\n' "$candidate"
    fi
}

managed_repo_origin_url() {
    [ -d "$MANAGED_REPO_DIR/.git" ] || return 1
    git -C "$MANAGED_REPO_DIR" remote get-url origin 2>/dev/null
}

repo_origin_url() {
    local origin_url=""
    local resolved_url=""
    local managed_origin_url=""

    if [ -n "${REPO_ORIGIN_URL:-}" ]; then
        origin_url="$REPO_ORIGIN_URL"
        if repo_origin_url_is_relative_local "$origin_url"; then
            resolved_url="$(resolve_repo_origin_url "$origin_url" "$SOURCE_REPO_DIR")"
            if [ -e "$resolved_url" ]; then
                printf '%s\n' "$resolved_url"
                return 0
            fi
            managed_origin_url="$(managed_repo_origin_url 2>/dev/null || true)"
            if [ -n "$managed_origin_url" ]; then
                printf '%s\n' "$managed_origin_url"
                return 0
            fi
            printf '%s\n' "$resolved_url"
            return 0
        fi
        printf '%s\n' "$origin_url"
        return 0
    elif [ -d "$SOURCE_REPO_DIR/.git" ]; then
        git -C "$SOURCE_REPO_DIR" remote get-url origin
        return $?
    fi

    managed_repo_origin_url
}

repo_remote_query_dir() {
    if [ -d "$SOURCE_REPO_DIR/.git" ]; then
        printf '%s\n' "$SOURCE_REPO_DIR"
        return 0
    fi
    if [ -d "$MANAGED_REPO_DIR/.git" ]; then
        printf '%s\n' "$MANAGED_REPO_DIR"
        return 0
    fi
    printf '%s\n' "/"
}

repo_branch_from_origin_head() {
    local repo_dir="$1"
    local branch=""

    [ -d "$repo_dir/.git" ] || return 1
    branch="$(git -C "$repo_dir" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
    branch="${branch#origin/}"
    [ -n "$branch" ] || return 1
    printf '%s\n' "$branch"
}

repo_branch_from_remote_head() {
    local origin_url=""
    local branch=""

    origin_url="$(repo_origin_url 2>/dev/null || true)"
    [ -n "$origin_url" ] || return 1
    branch="$(git -C "$(repo_remote_query_dir)" ls-remote --symref "$origin_url" HEAD 2>/dev/null | awk '
        $1 == "ref:" {
            branch = $2
            sub("^refs/heads/", "", branch)
            print branch
            exit
        }
    ')"
    [ -n "$branch" ] || return 1
    printf '%s\n' "$branch"
}

remote_branch_exists() {
    local branch="$1"
    local origin_url=""

    [ -n "$branch" ] || return 1
    origin_url="$(repo_origin_url 2>/dev/null || true)"
    [ -n "$origin_url" ] || return 1

    git -C "$(repo_remote_query_dir)" ls-remote --exit-code --heads "$origin_url" "refs/heads/$branch" >/dev/null 2>&1
}

repo_default_branch() {
    local branch="${REPO_DEFAULT_BRANCH:-}"
    if [ -n "$branch" ] && [ "$branch" != "origin/HEAD" ] && remote_branch_exists "$branch"; then
        printf '%s\n' "$branch"
        return 0
    fi

    if branch="$(repo_branch_from_origin_head "$SOURCE_REPO_DIR" 2>/dev/null)" && remote_branch_exists "$branch"; then
        printf '%s\n' "$branch"
        return 0
    fi

    if branch="$(repo_branch_from_origin_head "$MANAGED_REPO_DIR" 2>/dev/null)" && remote_branch_exists "$branch"; then
        printf '%s\n' "$branch"
        return 0
    fi

    if branch="$(repo_branch_from_remote_head 2>/dev/null)" && remote_branch_exists "$branch"; then
        printf '%s\n' "$branch"
        return 0
    fi

    printf '%s\n' "main"
}

source_repo_overlay_base_ref() {
    local upstream_ref current_branch default_branch

    [ -d "$SOURCE_REPO_DIR/.git" ] || return 1

    upstream_ref="$(git -C "$SOURCE_REPO_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
    if [ -n "$upstream_ref" ] && git -C "$SOURCE_REPO_DIR" rev-parse --verify --quiet "$upstream_ref" >/dev/null; then
        printf '%s\n' "$upstream_ref"
        return 0
    fi

    current_branch="$(git -C "$SOURCE_REPO_DIR" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
    if [ -n "$current_branch" ] && git -C "$SOURCE_REPO_DIR" rev-parse --verify --quiet "refs/remotes/origin/$current_branch" >/dev/null; then
        printf 'origin/%s\n' "$current_branch"
        return 0
    fi

    default_branch="$(repo_default_branch)"
    if git -C "$SOURCE_REPO_DIR" rev-parse --verify --quiet "refs/remotes/origin/$default_branch" >/dev/null; then
        printf 'origin/%s\n' "$default_branch"
        return 0
    fi

    return 1
}

source_repo_overlay_paths() {
    local diff_filter="$1"
    local base_ref="${2:-}"

    if [ -n "$base_ref" ]; then
        {
            git -C "$SOURCE_REPO_DIR" diff --name-only --diff-filter="$diff_filter" "$base_ref...HEAD" --
            git -C "$SOURCE_REPO_DIR" diff --name-only --diff-filter="$diff_filter" HEAD --
        } | awk 'NF && !seen[$0]++'
        return 0
    fi

    git -C "$SOURCE_REPO_DIR" diff --name-only --diff-filter="$diff_filter" HEAD --
}

source_repo_overlay_remove_paths() {
    local base_ref="${1:-}"

    if [ -n "$base_ref" ]; then
        {
            git -C "$SOURCE_REPO_DIR" diff --name-status --find-renames "$base_ref...HEAD" --
            git -C "$SOURCE_REPO_DIR" diff --name-status --find-renames HEAD --
        } | awk '
            $1 ~ /^D/ && NF >= 2 { print $2; next }
            $1 ~ /^R/ && NF >= 3 { print $2; next }
        ' | awk 'NF && !seen[$0]++'
        return 0
    fi

    git -C "$SOURCE_REPO_DIR" diff --name-status --find-renames HEAD -- | awk '
        $1 ~ /^D/ && NF >= 2 { print $2; next }
        $1 ~ /^R/ && NF >= 3 { print $2; next }
    '
}

source_repo_path_is_unmerged() {
    local path="$1"
    git -C "$SOURCE_REPO_DIR" ls-files -u -- "$path" | grep -q .
}

source_repo_has_overlay() {
    local base_ref=""

    [ -d "$SOURCE_REPO_DIR/.git" ] || return 1
    base_ref="$(source_repo_overlay_base_ref 2>/dev/null || true)"

    if [ -n "$base_ref" ] && ! git -C "$SOURCE_REPO_DIR" diff --quiet --no-ext-diff "$base_ref...HEAD" --; then
        return 0
    fi

    ! git -C "$SOURCE_REPO_DIR" diff --quiet --no-ext-diff HEAD --
}

source_repo_overlay_signature() {
    local base_ref=""

    [ -d "$SOURCE_REPO_DIR/.git" ] || return 0
    base_ref="$(source_repo_overlay_base_ref 2>/dev/null || true)"

    if [ -z "$base_ref" ] && git -C "$SOURCE_REPO_DIR" diff --quiet --no-ext-diff HEAD --; then
        return 0
    fi

    if [ -n "$base_ref" ] && git -C "$SOURCE_REPO_DIR" diff --quiet --no-ext-diff "$base_ref...HEAD" -- && git -C "$SOURCE_REPO_DIR" diff --quiet --no-ext-diff HEAD --; then
        return 0
    fi

    {
        printf 'base_ref=%s\n' "$base_ref"
        if [ -n "$base_ref" ]; then
            git -C "$SOURCE_REPO_DIR" diff --binary "$base_ref...HEAD" --
        fi
        printf '\n--worktree--\n'
        git -C "$SOURCE_REPO_DIR" diff --binary HEAD --
    } | sha256sum | awk '{ print $1 }'
}

configure_managed_repo_fetch() {
    git -C "$MANAGED_REPO_DIR" config --replace-all remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
}

ensure_managed_repo() {
    local origin_url branch
    origin_url="$(repo_origin_url)" || return 1
    branch="$(repo_default_branch)"

    mkdir -p "$(dirname "$MANAGED_REPO_DIR")"
    if [ -d "$MANAGED_REPO_DIR/.git" ]; then
        git -C "$MANAGED_REPO_DIR" remote set-url origin "$origin_url"
        configure_managed_repo_fetch
        return 0
    fi

    rm -rf "$MANAGED_REPO_DIR"
    git clone --origin origin --branch "$branch" --single-branch "$origin_url" "$MANAGED_REPO_DIR" >/dev/null 2>&1 \
        || git clone --origin origin "$origin_url" "$MANAGED_REPO_DIR" >/dev/null
    configure_managed_repo_fetch
}

apply_source_overlay() {
    local path target_path base_ref
    source_repo_has_overlay || return 0
    base_ref="$(source_repo_overlay_base_ref 2>/dev/null || true)"

    while IFS= read -r path; do
        [ -n "$path" ] || continue
        [ -e "$SOURCE_REPO_DIR/$path" ] || continue
        source_repo_path_is_unmerged "$path" && continue
        target_path="$MANAGED_REPO_DIR/$path"
        mkdir -p "$(dirname "$target_path")"
        rm -rf "$target_path"
        cp -a "$SOURCE_REPO_DIR/$path" "$target_path"
    done < <(source_repo_overlay_paths "ACMRTXB" "$base_ref")

    while IFS= read -r path; do
        [ -n "$path" ] || continue
        rm -rf "$MANAGED_REPO_DIR/$path"
    done < <(source_repo_overlay_remove_paths "$base_ref")
}

prepare_build_repo() {
    local branch managed_ref

    load_install_config
    if ! repo_origin_url >/dev/null 2>&1; then
        BUILD_REPO_DIR="$SOURCE_REPO_DIR"
        return 0
    fi

    ensure_managed_repo
    branch="$(repo_default_branch)"
    managed_ref="origin/$branch"

    git -C "$MANAGED_REPO_DIR" reset --hard >/dev/null
    git -C "$MANAGED_REPO_DIR" clean -fdx >/dev/null
    git -C "$MANAGED_REPO_DIR" fetch --prune origin
    if git -C "$MANAGED_REPO_DIR" show-ref --verify --quiet "refs/heads/$branch"; then
        git -C "$MANAGED_REPO_DIR" checkout -q "$branch"
    else
        git -C "$MANAGED_REPO_DIR" checkout -q -B "$branch" "$managed_ref"
    fi
    git -C "$MANAGED_REPO_DIR" reset --hard "$managed_ref" >/dev/null
    git -C "$MANAGED_REPO_DIR" clean -fdx >/dev/null
    apply_source_overlay
    BUILD_REPO_DIR="$MANAGED_REPO_DIR"
}

remote_dmg_headers() {
    curl -fsSIL "$DMG_URL" | tr -d '\r'
}

header_value() {
    local headers="$1"
    local name="$2"
    printf '%s\n' "$headers" | awk -F': ' -v target="$name" 'tolower($1) == tolower(target) { print $2; exit }'
}

extract_icon() {
    ensure_layout
    local tmp_dir
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' RETURN

    7z e -y "$DMG_FILE" "Codex Installer/Codex.app/Contents/Resources/electron.icns" "-o${tmp_dir}" >/dev/null
    python3 - "$tmp_dir/electron.icns" "$ICON_PATH" <<'PY'
from PIL import Image
import sys

source_path, target_path = sys.argv[1], sys.argv[2]
with Image.open(source_path) as img:
    img.load()
    img.thumbnail((512, 512))
    img.save(target_path, format="PNG")
PY
}

record_metadata() {
    ensure_layout
    load_install_config

    local build_repo_dir repo_head source_repo_head_value source_overlay_sha dmg_sha256 dmg_size electron_version dmg_headers dmg_etag dmg_last_modified dmg_content_length build_time repo_origin
    build_repo_dir="$(effective_repo_dir)"

    if [ -d "$build_repo_dir/.git" ]; then
        repo_head="$(current_repo_head)"
        repo_origin="$(repo_origin_url 2>/dev/null || git -C "$build_repo_dir" remote get-url origin 2>/dev/null || printf '%s' unavailable)"
    else
        repo_head="unavailable"
        repo_origin="unavailable"
    fi
    dmg_sha256="$(sha256sum "$DMG_FILE" | awk '{ print $1 }')"
    dmg_size="$(stat -c '%s' "$DMG_FILE")"
    electron_version="$(cat "$APP_DIR/version")"
    build_time="$(date -Iseconds)"
    source_repo_head_value="$(source_repo_head 2>/dev/null || true)"
    source_overlay_sha="$(source_repo_overlay_signature 2>/dev/null || true)"

    dmg_headers="$(remote_dmg_headers 2>/dev/null || true)"
    dmg_etag="$(header_value "$dmg_headers" "etag")"
    dmg_last_modified="$(header_value "$dmg_headers" "last-modified")"
    dmg_content_length="$(header_value "$dmg_headers" "content-length")"

    {
        write_kv BUILD_TIME "$build_time"
        write_kv REPO_ORIGIN "$repo_origin"
        write_kv REPO_HEAD "$repo_head"
        write_kv SOURCE_REPO_HEAD "$source_repo_head_value"
        write_kv SOURCE_OVERLAY_SHA256 "$source_overlay_sha"
        write_kv DMG_SHA256 "$dmg_sha256"
        write_kv DMG_SIZE "$dmg_size"
        write_kv DMG_ETAG "$dmg_etag"
        write_kv DMG_LAST_MODIFIED "$dmg_last_modified"
        write_kv DMG_CONTENT_LENGTH "$dmg_content_length"
        write_kv ELECTRON_VERSION "$electron_version"
        write_kv APP_DIR "$APP_DIR"
        write_kv ICON_PATH "$ICON_PATH"
        write_kv OPT_ROOT "$OPT_ROOT"
        write_kv REPO_DIR "$build_repo_dir"
        write_kv SOURCE_REPO_DIR "$SOURCE_REPO_DIR"
        write_kv MANAGED_REPO_DIR "$MANAGED_REPO_DIR"
    } > "$METADATA_FILE"
}
