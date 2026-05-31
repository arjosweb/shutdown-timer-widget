#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Shutdown Timer.app"
DEFAULT_ZIP_URL="https://raw.githubusercontent.com/arjosweb/shutdown-timer-widget/main/downloads/macos/v-1.0.2.zip"
ZIP_URL="${SHUTDOWN_TIMER_ZIP_URL:-$DEFAULT_ZIP_URL}"
INSTALL_ROOT="$HOME/Applications"
TARGET_APP="${INSTALL_ROOT}/${APP_NAME}"

TMP_DIR=""
MOUNT_DIR=""

log() {
  printf '[Shutdown Timer] %s\n' "$1"
}

fail() {
  printf '[Shutdown Timer] ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  local command_path="$1"
  [[ -x "$command_path" ]] || fail "Required command not found: $command_path"
}

cleanup() {
  if [[ -n "$MOUNT_DIR" ]]; then
    /usr/bin/hdiutil detach "$MOUNT_DIR" >/dev/null 2>&1 || true
  fi

  if [[ -n "$TMP_DIR" ]]; then
    /bin/rm -rf "$TMP_DIR"
  fi
}

trap cleanup EXIT

[[ "$(/usr/bin/uname)" == "Darwin" ]] || fail "This installer only supports macOS."

require_command "/usr/bin/curl"
require_command "/usr/bin/ditto"
require_command "/usr/bin/hdiutil"
require_command "/usr/bin/xattr"
require_command "/usr/bin/open"
require_command "/usr/bin/mktemp"
require_command "/usr/bin/find"
require_command "/usr/bin/awk"
require_command "/bin/rm"
require_command "/bin/mkdir"

TMP_DIR="$(/usr/bin/mktemp -d)"
ZIP_PATH="${TMP_DIR}/shutdown-timer.zip"
EXTRACT_DIR="${TMP_DIR}/extract"

log "Downloading macOS package..."
/usr/bin/curl -fL --retry 3 --connect-timeout 15 -o "$ZIP_PATH" "$ZIP_URL"

log "Extracting package..."
/bin/mkdir -p "$EXTRACT_DIR"
/usr/bin/ditto -x -k "$ZIP_PATH" "$EXTRACT_DIR"

DMG_PATH=""
DMG_COUNT=0
while IFS= read -r found_dmg; do
  DMG_PATH="$found_dmg"
  DMG_COUNT=$((DMG_COUNT + 1))
done < <(/usr/bin/find "$EXTRACT_DIR" -type f -name "*.dmg" -print)

if [[ "$DMG_COUNT" -eq 0 ]]; then
  fail "No DMG file found inside the downloaded ZIP."
fi
if [[ "$DMG_COUNT" -gt 1 ]]; then
  fail "More than one DMG file found inside the downloaded ZIP."
fi

log "Mounting DMG..."
ATTACH_OUTPUT="$(/usr/bin/hdiutil attach "$DMG_PATH" -nobrowse -readonly)"
MOUNT_DIR="$(printf '%s\n' "$ATTACH_OUTPUT" | /usr/bin/awk '/\/Volumes\// { path = substr($0, index($0, "/Volumes/")) } END { print path }')"

if [[ -z "$MOUNT_DIR" || "$MOUNT_DIR" != /Volumes/* || ! -d "$MOUNT_DIR" ]]; then
  fail "Failed to detect mounted DMG volume."
fi

SOURCE_APP="${MOUNT_DIR}/${APP_NAME}"
if [[ ! -d "$SOURCE_APP" ]]; then
  fail "App not found in mounted DMG: $SOURCE_APP"
fi

EXPECTED_TARGET="${INSTALL_ROOT}/${APP_NAME}"
if [[ "$TARGET_APP" != "$EXPECTED_TARGET" || -z "$INSTALL_ROOT" || "$INSTALL_ROOT" == "/" ]]; then
  fail "Unsafe install target."
fi

log "Installing to ${TARGET_APP}..."
/bin/mkdir -p "$INSTALL_ROOT"
/bin/rm -rf "$TARGET_APP"
/usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"

log "Removing quarantine attribute..."
/usr/bin/xattr -dr com.apple.quarantine "$TARGET_APP" 2>/dev/null || true

log "Opening Shutdown Timer..."
/usr/bin/open "$TARGET_APP"

log "Installation complete."
