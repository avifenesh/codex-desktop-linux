#!/usr/bin/env bash
# Guided, conservative setup helper for native Codex Desktop Linux builds.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FEATURES_ROOT="${CODEX_LINUX_FEATURES_ROOT:-$REPO_DIR/linux-features}"
PACKAGE_NAME="${PACKAGE_NAME:-codex-desktop}"

info() {
    echo "[setup] $*"
}

warn() {
    echo "[setup][WARN] $*" >&2
}

error() {
    echo "[setup][ERROR] $*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage: scripts/bootstrap-wizard.sh [--help]

Environment:
  CODEX_BOOTSTRAP_NONINTERACTIVE=1     never prompt
  CODEX_LINUX_FEATURES=a,b             enable build-time Linux features
  CODEX_LINUX_DISABLE_FEATURES=a,b     disable build-time Linux features
  CODEX_LINUX_FEATURES_ROOT=/path      override linux-features root
  CODEX_LINUX_FEATURES_CONFIG=/path    override features.json path
  PACKAGE_WITH_UPDATER=0               choose manual-update package mode

The wizard is conservative: it does not install packages, start services, stop
ydotoold, or delete feature-owned user data. It prepares feature config and
prints the exact rebuild/reinstall command to run next.
EOF
}

case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    "")
        ;;
    *)
        error "Unknown argument: $1"
        ;;
esac

truthy() {
    case "${1:-}" in
        1|true|True|TRUE|yes|Yes|YES|on|On|ON)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

package_with_updater_enabled() {
    case "${PACKAGE_WITH_UPDATER:-1}" in
        1|true|True|TRUE|yes|Yes|YES|on|On|ON)
            return 0
            ;;
        0|false|False|FALSE|no|No|NO|off|Off|OFF)
            return 1
            ;;
        *)
            error "PACKAGE_WITH_UPDATER must be 1 or 0"
            ;;
    esac
}

feature_config_path() {
    if [ -n "${CODEX_LINUX_FEATURES_CONFIG:-}" ]; then
        printf '%s\n' "$CODEX_LINUX_FEATURES_CONFIG"
    else
        printf '%s\n' "$FEATURES_ROOT/features.json"
    fi
}

os_release_field() {
    local field="$1"
    local file line value

    for file in ${OS_RELEASE_FILE:-} /etc/os-release /usr/lib/os-release; do
        [ -n "$file" ] || continue
        [ -r "$file" ] || continue
        while IFS= read -r line; do
            case "$line" in
                "$field="*)
                    value="${line#*=}"
                    value="${value#\"}"
                    value="${value%\"}"
                    value="${value#\'}"
                    value="${value%\'}"
                    printf '%s\n' "${value,,}"
                    return 0
                    ;;
            esac
        done < "$file"
    done

    return 1
}

os_release_matches() {
    local expected token
    for expected in "$@"; do
        [ "${OS_RELEASE_ID:-}" = "$expected" ] && return 0
        for token in ${OS_RELEASE_ID_LIKE:-}; do
            [ "$token" = "$expected" ] && return 0
        done
    done
    return 1
}

detect_package_manager() {
    if os_release_matches debian ubuntu linuxmint pop elementary zorin && command -v apt-get >/dev/null 2>&1; then
        echo "apt"
    elif os_release_matches arch archlinux manjaro endeavouros artix && command -v pacman >/dev/null 2>&1; then
        echo "pacman"
    elif os_release_matches opensuse suse sles && command -v zypper >/dev/null 2>&1; then
        echo "zypper"
    elif os_release_matches fedora rhel centos rocky almalinux ol; then
        if command -v dnf5 >/dev/null 2>&1; then
            echo "dnf5"
        elif command -v dnf >/dev/null 2>&1; then
            echo "dnf"
        else
            echo "unknown"
        fi
    elif command -v apt-get >/dev/null 2>&1; then
        echo "apt"
    elif command -v dnf5 >/dev/null 2>&1; then
        echo "dnf5"
    elif command -v dnf >/dev/null 2>&1; then
        echo "dnf"
    elif command -v pacman >/dev/null 2>&1; then
        echo "pacman"
    elif command -v zypper >/dev/null 2>&1; then
        echo "zypper"
    else
        echo "unknown"
    fi
}

detect_package_format() {
    if os_release_matches arch archlinux manjaro endeavouros artix; then
        echo "pacman"
    elif os_release_matches fedora rhel centos rocky almalinux ol sles suse opensuse; then
        echo "rpm"
    elif os_release_matches debian ubuntu linuxmint pop elementary zorin; then
        echo "deb"
    elif command -v pacman >/dev/null 2>&1 && ! command -v dpkg-deb >/dev/null 2>&1; then
        echo "pacman"
    elif command -v rpmbuild >/dev/null 2>&1 && ! command -v dpkg-deb >/dev/null 2>&1; then
        echo "rpm"
    elif command -v dpkg-deb >/dev/null 2>&1; then
        echo "deb"
    elif command -v rpmbuild >/dev/null 2>&1; then
        echo "rpm"
    elif command -v pacman >/dev/null 2>&1; then
        echo "pacman"
    else
        echo "unknown"
    fi
}

command_status() {
    local name="$1"
    if command -v "$name" >/dev/null 2>&1; then
        printf '%s' "$(command -v "$name")"
    else
        printf 'missing'
    fi
}

service_state() {
    local unit="$1"
    local scope="${2:-system}"
    if ! command -v systemctl >/dev/null 2>&1; then
        printf 'systemctl missing'
        return
    fi

    local active enabled
    if [ "$scope" = "user" ]; then
        active="$(systemctl --user is-active "$unit" 2>/dev/null || true)"
        enabled="$(systemctl --user is-enabled "$unit" 2>/dev/null || true)"
    else
        active="$(systemctl is-active "$unit" 2>/dev/null || true)"
        enabled="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
    fi
    if [ -z "$active$enabled" ]; then
        printf 'unknown'
    else
        printf 'active=%s enabled=%s' "${active:-unknown}" "${enabled:-unknown}"
    fi
}

ydotool_socket_summary() {
    local uid runtime_dir candidate
    uid="$(id -u 2>/dev/null || true)"
    runtime_dir="${XDG_RUNTIME_DIR:-${uid:+/run/user/$uid}}"
    for candidate in \
        "${YDOTOOL_SOCKET:-}" \
        "${runtime_dir:+$runtime_dir/.ydotool_socket}" \
        "/tmp/.ydotool_socket"; do
        [ -n "$candidate" ] || continue
        if [ -S "$candidate" ]; then
            printf '%s' "$candidate"
            return
        fi
    done
    printf 'not found'
}

portal_summary() {
    local bus_names
    if command -v busctl >/dev/null 2>&1; then
        bus_names="$(busctl --user --list 2>/dev/null || true)"
    else
        bus_names=""
    fi

    if grep 'org.freedesktop.portal.Desktop' >/dev/null 2>&1 <<<"$bus_names"; then
        printf 'available on session bus'
    elif command -v pgrep >/dev/null 2>&1 &&
        pgrep -f '(^|[/[:space:]])xdg-desktop-portal([[:space:]]|$)' >/dev/null 2>&1; then
        printf 'running'
    else
        printf 'not detected'
    fi
}

installed_package_version() {
    if command -v dpkg-query >/dev/null 2>&1 &&
        dpkg-query -W -f='${Version}' "$PACKAGE_NAME" >/dev/null 2>&1; then
        dpkg-query -W -f='deb ${Version}' "$PACKAGE_NAME" 2>/dev/null || true
        return
    fi
    if command -v rpm >/dev/null 2>&1 &&
        rpm -q --qf 'rpm %{VERSION}-%{RELEASE}' "$PACKAGE_NAME" >/dev/null 2>&1; then
        rpm -q --qf 'rpm %{VERSION}-%{RELEASE}' "$PACKAGE_NAME" 2>/dev/null || true
        return
    fi
    if command -v pacman >/dev/null 2>&1 &&
        pacman -Q "$PACKAGE_NAME" >/dev/null 2>&1; then
        pacman -Q "$PACKAGE_NAME" 2>/dev/null | sed 's/^/pacman /'
        return
    fi
    printf 'not installed'
}

updater_install_summary() {
    if [ -x /usr/bin/codex-update-manager ] || [ -d "/opt/$PACKAGE_NAME/update-builder" ]; then
        printf 'updater artifacts detected'
    else
        printf 'not detected'
    fi
}

print_system_summary() {
    OS_RELEASE_ID="$(os_release_field ID 2>/dev/null || true)"
    OS_RELEASE_ID_LIKE="$(os_release_field ID_LIKE 2>/dev/null || true)"
    OS_RELEASE_VERSION_ID="$(os_release_field VERSION_ID 2>/dev/null || true)"

    info "Codex Desktop Linux guided setup"
    info "Repository: $REPO_DIR"
    info "Distro: ID=${OS_RELEASE_ID:-unknown} ID_LIKE=${OS_RELEASE_ID_LIKE:-unknown} VERSION_ID=${OS_RELEASE_VERSION_ID:-unknown}"
    info "Package manager: $(detect_package_manager)"
    info "Native package format: $(detect_package_format)"
    info "Session: XDG_CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-unknown} DESKTOP_SESSION=${DESKTOP_SESSION:-unknown} XDG_SESSION_TYPE=${XDG_SESSION_TYPE:-unknown} WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-none} DISPLAY=${DISPLAY:-none}"
    info "Helpers: pkexec=$(command_status pkexec) kdialog=$(command_status kdialog) zenity=$(command_status zenity)"
    info "Computer Use readiness: ydotool=$(command_status ydotool) ydotoold=$(command_status ydotoold) ydotoold.service(system)=[$(service_state ydotoold.service system)] ydotoold.service(user)=[$(service_state ydotoold.service user)] ydotool.service(system)=[$(service_state ydotool.service system)] ydotool.service(user)=[$(service_state ydotool.service user)] socket=$(ydotool_socket_summary) portal=$(portal_summary)"
    info "Installed package: $(installed_package_version)"
    info "Installed updater mode: $(updater_install_summary)"
}

run_feature_config_python() {
    local enable_raw="$1"
    local disable_raw="$2"
    local apply_changes="$3"
    local config_path
    config_path="$(feature_config_path)"

    if ! command -v python3 >/dev/null 2>&1; then
        if [ -n "$enable_raw$disable_raw" ]; then
            error "python3 is required to edit Linux feature config. Run bash scripts/install-deps.sh first."
        fi
        warn "python3 is missing; skipping Linux feature discovery and config editing"
        return
    fi

    python3 - "$FEATURES_ROOT" "$config_path" "$enable_raw" "$disable_raw" "$apply_changes" <<'PY'
import json
import pathlib
import re
import sys

features_root = pathlib.Path(sys.argv[1])
config_path = pathlib.Path(sys.argv[2])
enable_raw = sys.argv[3]
disable_raw = sys.argv[4]
apply_changes = sys.argv[5] == "1"

id_re = re.compile(r"^[a-z0-9][a-z0-9-]*$")

def die(message):
    print(f"[setup][ERROR] {message}", file=sys.stderr)
    sys.exit(1)

def warn(message):
    print(f"[setup][WARN] {message}", file=sys.stderr)

def split_ids(raw):
    if not raw.strip():
        return []
    ids = [item for item in re.split(r"[,\s]+", raw.strip()) if item]
    seen = set()
    result = []
    for item in ids:
        if not id_re.match(item):
            die(f"Invalid Linux feature id: {item}")
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

def read_json(path, label):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except Exception as exc:
        die(f"Could not read {label} at {path}: {exc}")

def discover_features(root):
    features = {}
    if not root.exists():
        warn(f"Linux features root not found: {root}")
        return features
    for manifest_path in sorted(root.glob("*/feature.json")):
        data = read_json(manifest_path, f"Linux feature manifest {manifest_path}") or {}
        feature_id = data.get("id")
        if not isinstance(feature_id, str) or not id_re.match(feature_id):
            warn(f"Skipping feature with invalid id in {manifest_path}")
            continue
        if data.get("hidden") is True:
            continue
        if feature_id in features:
            warn(f"Skipping duplicate Linux feature id: {feature_id}")
            continue
        title = data.get("title") or data.get("name") or feature_id
        description = data.get("description") or ""
        features[feature_id] = {
            "id": feature_id,
            "title": str(title),
            "description": str(description),
        }
    return dict(sorted(features.items()))

def read_enabled_ids(path):
    if not path.exists():
        fallback = features_root / "features.example.json"
        if fallback.exists():
            data = read_json(fallback, "Linux features example config") or {}
        else:
            return []
    else:
        data = read_json(path, "Linux features config") or {}
    enabled = data.get("enabled", [])
    if not isinstance(enabled, list):
        die(f"Linux features config {path} must contain an enabled array")
    result = []
    seen = set()
    for item in enabled:
        if not isinstance(item, str) or not id_re.match(item):
            die(f"Invalid Linux feature id in {path}: {item}")
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result

def csv(ids):
    return ", ".join(ids) if ids else "none"

features = discover_features(features_root)
current = read_enabled_ids(config_path)
enable = split_ids(enable_raw)
disable = split_ids(disable_raw)
conflicting = sorted(set(enable) & set(disable))
if conflicting:
    die(f"Linux feature ids cannot be both enabled and disabled: {csv(conflicting)}")

for feature_id in enable:
    if feature_id not in features:
        die(f"Unknown Linux feature id: {feature_id}")
for feature_id in disable:
    if feature_id not in features and feature_id not in current:
        die(f"Unknown Linux feature id: {feature_id}")

final = [feature_id for feature_id in current if feature_id not in set(disable)]
for feature_id in enable:
    if feature_id not in final:
        final.append(feature_id)

if apply_changes and (enable or disable):
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps({"enabled": final}, indent=2) + "\n")
    print(f"[setup] Updated Linux feature config: {config_path}")
elif not config_path.exists():
    print(f"[setup] Linux feature config: {config_path} (not created yet)")
else:
    print(f"[setup] Linux feature config: {config_path}")

print(f"[setup] Enabled Linux features: {csv(final)}")

unknown_enabled = [feature_id for feature_id in final if feature_id not in features]
if unknown_enabled:
    warn(f"Enabled feature ids not found in this checkout: {csv(unknown_enabled)}")

if "conversation-mode" in final and "read-aloud" not in final:
    warn("conversation-mode is enabled without read-aloud; speech output requires the Read Aloud feature.")

if features:
    print("[setup] Available Linux features:")
    for feature_id, feature in features.items():
        state = "enabled" if feature_id in final else "available"
        sample = " (developer sample)" if feature_id == "example-feature" else ""
        print(f"[setup]   [{state}] {feature_id}{sample} - {feature['title']}")
else:
    print("[setup] Available Linux features: none found")

if apply_changes and (enable or disable):
    print("[setup] Feature changes apply after rebuilding and reinstalling Codex Desktop Linux.")
PY
}

list_includes_id() {
    local raw="$1"
    local needle="$2"
    local item
    raw="${raw//,/ }"
    for item in $raw; do
        [ "$item" = "$needle" ] && return 0
    done
    return 1
}

print_safe_disable_guidance() {
    local disable_raw="$1"
    [ -n "$disable_raw" ] || return 0

    info "Disabling a build-time feature only edits linux-features/features.json for the next rebuild."

    if list_includes_id "$disable_raw" "remote-mobile-control"; then
        local config_home="${XDG_CONFIG_HOME:-$HOME/.config}"
        local key_file="$config_home/codex-desktop/remote-control-device-keys-v1.json"
        info "Remote mobile control opt-out: Not deleting $key_file."
        info "Revoke paired devices from Codex Settings/Connections or ChatGPT before deleting local keys manually."
    fi

    if list_includes_id "$disable_raw" "read-aloud" ||
        list_includes_id "$disable_raw" "read-aloud-mcp" ||
        list_includes_id "$disable_raw" "conversation-mode"; then
        local data_home="${XDG_DATA_HOME:-$HOME/.local/share}"
        local read_aloud_data="$data_home/codex-desktop/read-aloud"
        local read_aloud_cache="$HOME/.codex/plugins/cache/openai-bundled/read-aloud"
        info "Read Aloud opt-out: Not removing Read Aloud model files, Python runtimes, or plugin caches."
        info "Cleanup is separate and should list exact paths first, such as:"
        info "  $read_aloud_data"
        info "  $read_aloud_cache"
    fi
}

print_package_mode_guidance() {
    if package_with_updater_enabled; then
        info "Default native package mode includes codex-update-manager."
        info "Next rebuild/reinstall command: make install-native"
    else
        info "Manual-update native package mode selected (PACKAGE_WITH_UPDATER=0)."
        info "No-updater mode takes effect only after rebuilding and reinstalling the native package."
        info "Next rebuild/reinstall command: PACKAGE_WITH_UPDATER=0 make install-native"
    fi
    info "AppImage builds never include codex-update-manager. Nix feature choices stay declarative in flake outputs, not linux-features/features.json."
}

prompt_for_feature_changes() {
    local enable_raw="${CODEX_LINUX_FEATURES:-}"
    local disable_raw="${CODEX_LINUX_DISABLE_FEATURES:-}"

    if truthy "${CODEX_BOOTSTRAP_NONINTERACTIVE:-0}" || ! [ -t 0 ]; then
        run_feature_config_python "$enable_raw" "$disable_raw" "1"
        print_safe_disable_guidance "$disable_raw"
        return
    fi

    run_feature_config_python "" "" "0"
    echo
    read -r -p "[setup] Enable feature ids for the next build (comma-separated, blank keeps current): " enable_raw
    read -r -p "[setup] Disable feature ids for the next build (comma-separated, blank disables none): " disable_raw
    if [ -n "$enable_raw$disable_raw" ]; then
        run_feature_config_python "$enable_raw" "$disable_raw" "1"
        print_safe_disable_guidance "$disable_raw"
    else
        info "Feature config unchanged."
    fi

    local answer
    if package_with_updater_enabled; then
        read -r -p "[setup] Keep codex-update-manager in the next native package? [Y/n]: " answer
        case "$answer" in
            n|N|no|No|NO)
                PACKAGE_WITH_UPDATER=0
                ;;
        esac
    else
        read -r -p "[setup] Keep manual-update package mode for the next native build? [Y/n]: " answer
        case "$answer" in
            n|N|no|No|NO)
                PACKAGE_WITH_UPDATER=1
                ;;
        esac
    fi
}

main() {
    print_system_summary
    prompt_for_feature_changes
    print_package_mode_guidance
    info "No system services, groups, key files, model files, plugin caches, or package installs were changed."
    info "If Computer Use needs ydotoold, input group membership, a portal backend, or logout/login, run those steps explicitly after reviewing the commands."
}

main "$@"
