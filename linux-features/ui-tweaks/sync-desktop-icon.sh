#!/usr/bin/env bash
set -Eeuo pipefail
set -f

home_dir="${HOME:-}"
[ -n "$home_dir" ] || exit 0

app_id="${CODEX_LINUX_APP_ID:-${CODEX_APP_ID:-codex-desktop}}"
case "$app_id" in
    *[!A-Za-z0-9._-]*|'') exit 0 ;;
esac

data_home="${XDG_DATA_HOME:-$home_dir/.local/share}"
applications_dir="$data_home/applications"
icons_dir="$data_home/icons/hicolor/256x256/apps"
desktop_target="$applications_dir/$app_id.desktop"
legacy_marker="X-Codex-Linux-Dock-Icon=1"
marker_prefix="X-Codex-Linux-Dock-Icon-SHA256="

managed_icon_is_owned() {
    local icon="$1"
    local actual_digest
    local expected_digest
    [ -f "$icon" ] && [ ! -L "$icon" ] || return 1
    case "$icon" in
        "$icons_dir/$app_id-dock-chatgpt-"*.png) expected_digest="${icon#"$icons_dir/$app_id-dock-chatgpt-"}" ;;
        "$icons_dir/$app_id-dock-codex-dark-"*.png) expected_digest="${icon#"$icons_dir/$app_id-dock-codex-dark-"}" ;;
        "$icons_dir/$app_id-dock-codex-light-"*.png) expected_digest="${icon#"$icons_dir/$app_id-dock-codex-light-"}" ;;
        *) return 1 ;;
    esac
    expected_digest="${expected_digest%.png}"
    case "$expected_digest" in
        *[!0-9a-f]*|'') return 1 ;;
    esac
    [ "${#expected_digest}" -eq 64 ] || return 1
    actual_digest="$(sha256sum "$icon" | awk '{print $1}')"
    [ "$actual_digest" = "$expected_digest" ]
}

acquire_app_lock() {
    mkdir -p "$applications_dir"
    exec 9< "$applications_dir"
    if ! flock -w 5 9; then
        echo "WARN: Could not lock Dock icon launcher state: $applications_dir" >&2
        exit 0
    fi
}

release_app_lock() {
    flock -u 9 || true
    exec 9<&-
}

cleanup_owned_icon_orphans() {
    local keep="${1:-}"
    local icon
    [ -d "$icons_dir" ] || return 0
    while IFS= read -r -d '' icon; do
        [ "$icon" = "$keep" ] && continue
        managed_icon_is_owned "$icon" || continue
        rm -f -- "$icon" || echo "WARN: Could not remove stale managed Dock icon resource: $icon" >&2
    done < <(
        find "$icons_dir" -maxdepth 1 -type f \
            \( -name "$app_id-dock-chatgpt-*.png" \
               -o -name "$app_id-dock-codex-dark-*.png" \
               -o -name "$app_id-dock-codex-light-*.png" \) \
            -print0
    )
}

refresh_desktop_database() {
    if [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]]; then
        command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
    fi
}

managed_desktop_content_is_owned() {
    local actual_digest
    local expected_digest
    local icon_value
    [ -f "$desktop_target" ] && [ ! -L "$desktop_target" ] || return 1
    expected_digest="$(awk -v prefix="$marker_prefix" '
        index($0, prefix) == 1 { count += 1; digest = substr($0, length(prefix) + 1) }
        END { if (count == 1) print digest }
    ' "$desktop_target")"
    case "$expected_digest" in
        *[!0-9a-f]*|'') return 1 ;;
    esac
    [ "${#expected_digest}" -eq 64 ] || return 1
    actual_digest="$(
        awk -v prefix="$marker_prefix" 'index($0, prefix) != 1 { print }' "$desktop_target" |
            sha256sum | awk '{print $1}'
    )"
    [ "$actual_digest" = "$expected_digest" ] || return 1
    icon_value="$(awk '/^Icon=/{sub(/^Icon=/, ""); print; exit}' "$desktop_target")"
    case "$icon_value" in
        "$icons_dir/$app_id-dock-chatgpt-"*.png|"$icons_dir/$app_id-dock-codex-dark-"*.png|"$icons_dir/$app_id-dock-codex-light-"*.png) ;;
        *) return 1 ;;
    esac
}

managed_desktop_is_owned() {
    local icon_value
    managed_desktop_content_is_owned || return 1
    icon_value="$(awk '/^Icon=/{sub(/^Icon=/, ""); print; exit}' "$desktop_target")"
    managed_icon_is_owned "$icon_value"
}

cleanup_managed_desktop() {
    local icon_value
    if ! managed_desktop_content_is_owned; then
        if [ ! -e "$desktop_target" ] && [ ! -L "$desktop_target" ]; then
            cleanup_owned_icon_orphans
        fi
        return 0
    fi
    icon_value="$(awk '/^Icon=/{sub(/^Icon=/, ""); print; exit}' "$desktop_target")"
    if [ -e "$icon_value" ] || [ -L "$icon_value" ]; then
        managed_icon_is_owned "$icon_value" || return 0
        if ! rm -f -- "$icon_value"; then
            echo "WARN: Could not remove managed Dock icon resource: $icon_value" >&2
            return 0
        fi
    fi
    if ! rm -f -- "$desktop_target"; then
        echo "WARN: Could not remove managed Dock icon desktop entry: $desktop_target" >&2
        return 0
    fi
    cleanup_owned_icon_orphans
    release_app_lock
    refresh_desktop_database
}

if [ "${CODEX_LINUX_FEATURE_HOOK_PHASE:-}" = "prelaunch" ]; then
    app_dir="${CODEX_LINUX_APP_DIR:-${1:-}}"
    [ -n "$app_dir" ] && [ -d "$app_dir" ] || exit 0
    payload_helper="$app_dir/resources/dock-icon/sync-desktop-icon.sh"
    if [ -f "$payload_helper" ] && [ ! -L "$payload_helper" ]; then
        exit 0
    fi
    acquire_app_lock
    cleanup_managed_desktop
    exit 0
fi

selection="${1:-}"
case "$selection" in
    chatgpt|codex-dark|codex-light) ;;
    *) exit 0 ;;
esac

acquire_app_lock

desktop_source_matches_identity() {
    local source="$1"
    local line
    local token
    local value
    [ "$(basename -- "$source")" = "$app_id.desktop" ] || return 1
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in
            StartupWMClass=*) [ "${line#*=}" = "$app_id" ] || return 1 ;;
            X-GNOME-WMClass=*) [ "${line#*=}" = "$app_id" ] || return 1 ;;
            Exec=*)
                if [ "$app_id" != "codex-desktop" ] && [[ "$line" != *"$app_id"* ]]; then
                    return 1
                fi
                ;;
        esac
        for token in $line; do
            case "$token" in
                CHROME_DESKTOP=*) [ "${token#*=}" = "$app_id.desktop" ] || return 1 ;;
                BAMF_DESKTOP_FILE_HINT=*)
                    value="${token#*=}"
                    [ "$(basename -- "$value")" = "$app_id.desktop" ] || return 1
                    ;;
                CODEX_APP_ID=*|CODEX_LINUX_APP_ID=*) [ "${token#*=}" = "$app_id" ] || return 1 ;;
            esac
        done
    done < "$source"
}

desktop_exec_quote() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\`/\\\`}"
    value="${value//\$/\\\$}"
    value="${value//%/%%}"
    printf '"%s"' "$value"
}

if [ -e "$desktop_target" ] || [ -L "$desktop_target" ]; then
    [ -f "$desktop_target" ] && [ ! -L "$desktop_target" ] || exit 0
    managed_desktop_content_is_owned || exit 0
    current_icon="$(awk '/^Icon=/{sub(/^Icon=/, ""); print; exit}' "$desktop_target")"
    if [ -e "$current_icon" ] || [ -L "$current_icon" ]; then
        managed_icon_is_owned "$current_icon" || exit 0
    fi
fi

desktop_source="${CODEX_LINUX_DESKTOP_FILE_SOURCE:-}"
if [ -z "$desktop_source" ]; then
    data_dirs="${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
    IFS=: read -r -a data_dirs_array <<< "$data_dirs"
    candidates=("${BAMF_DESKTOP_FILE_HINT:-}")
    for data_dir in "${data_dirs_array[@]}"; do
        [ -n "$data_dir" ] && candidates+=("$data_dir/applications/$app_id.desktop")
    done
    for candidate in "${candidates[@]}"; do
        if [ -n "$candidate" ] && [ "$candidate" != "$desktop_target" ] && [ -f "$candidate" ] && [ ! -L "$candidate" ] && desktop_source_matches_identity "$candidate"; then
            desktop_source="$candidate"
            break
        fi
    done
fi
[ -n "$desktop_source" ] && [ -f "$desktop_source" ] && [ ! -L "$desktop_source" ] || exit 0
grep -q '^Icon=' "$desktop_source" || exit 0
if ! desktop_source_matches_identity "$desktop_source"; then
    echo "WARN: Dock icon desktop source identity does not match app id '$app_id'; leaving launchers unchanged" >&2
    exit 0
fi

appimage_exec=""
if grep -Eq '^Exec=(AppRun|.*[[:space:]]AppRun)([[:space:]]|$)' "$desktop_source"; then
    appimage_path="${APPIMAGE:-}"
    case "$appimage_path" in
        /*) ;;
        *)
            echo "WARN: Dock icon AppImage desktop source has no persistent AppImage path; leaving launchers unchanged" >&2
            exit 0
            ;;
    esac
    if [ ! -f "$appimage_path" ] || [ ! -x "$appimage_path" ]; then
        echo "WARN: Dock icon AppImage path is not an executable file; leaving launchers unchanged: $appimage_path" >&2
        exit 0
    fi
    appimage_exec="$(desktop_exec_quote "$appimage_path")"
fi

mkdir -p "$applications_dir" "$icons_dir"
desktop_content_tmp="$(mktemp "$applications_dir/.$app_id.desktop-content.XXXXXX")"
desktop_tmp="$(mktemp "$applications_dir/.$app_id.desktop.XXXXXX")"
icon_tmp="$(mktemp "$icons_dir/.$app_id-dock-selection.XXXXXX")"
trap 'rm -f -- "$desktop_content_tmp" "$desktop_tmp" "$icon_tmp"' EXIT
cat > "$icon_tmp"
[ -s "$icon_tmp" ] || exit 0
chmod 0644 "$icon_tmp"
icon_digest="$(sha256sum "$icon_tmp" | awk '{print $1}')"
icon_target="$icons_dir/$app_id-dock-$selection-$icon_digest.png"
if [ -e "$icon_target" ] || [ -L "$icon_target" ]; then
    if ! managed_icon_is_owned "$icon_target"; then
        echo "WARN: Dock icon target is not an unchanged managed resource; leaving launchers unchanged: $icon_target" >&2
        exit 0
    fi
fi
CODEX_DOCK_APPIMAGE_EXEC="$appimage_exec" awk -v icon="$icon_target" \
    -v legacy_marker="$legacy_marker" -v marker_prefix="$marker_prefix" '
    BEGIN { appimage_exec = ENVIRON["CODEX_DOCK_APPIMAGE_EXEC"] }
    function replace_literal(value, needle, replacement, output, position) {
        output = ""
        while ((position = index(value, needle)) != 0) {
            output = output substr(value, 1, position - 1) replacement
            value = substr(value, position + length(needle))
        }
        return output value
    }
    $0 == legacy_marker || index($0, marker_prefix) == 1 { next }
    /^Exec=/ && appimage_exec != "" { $0 = replace_literal($0, "AppRun", appimage_exec) }
    /^Icon=/ && !icon_written { print "Icon=" icon; icon_written=1; next }
    { print }
' "$desktop_source" > "$desktop_content_tmp"
desktop_digest="$(sha256sum "$desktop_content_tmp" | awk '{print $1}')"
awk -v marker="$marker_prefix$desktop_digest" '
    /^\[/ && $0 != "[Desktop Entry]" && !marker_written { print marker; marker_written=1 }
    { print }
    END { if (!marker_written) print marker }
' "$desktop_content_tmp" > "$desktop_tmp"
chmod 0644 "$desktop_tmp"

changed=0
if [ ! -f "$icon_target" ]; then
    mv -f -- "$icon_tmp" "$icon_target"
    changed=1
else
    rm -f -- "$icon_tmp"
fi
previous_icon=""
if managed_desktop_is_owned; then
    previous_icon="$(awk '/^Icon=/{sub(/^Icon=/, ""); print; exit}' "$desktop_target")"
fi
if [ ! -f "$desktop_target" ] || ! cmp -s "$desktop_tmp" "$desktop_target"; then
    mv -f -- "$desktop_tmp" "$desktop_target"
    changed=1
fi
if [ -n "$previous_icon" ] && [ "$previous_icon" != "$icon_target" ] && managed_icon_is_owned "$previous_icon"; then
    rm -f -- "$previous_icon" || true
fi
cleanup_owned_icon_orphans "$icon_target"
release_app_lock
[ "$changed" -eq 0 ] || refresh_desktop_database
