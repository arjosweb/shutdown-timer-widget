#!/usr/bin/env bash
set -euo pipefail

NO_BUILD="false"
ALLOW_MISSING="false"

for arg in "$@"; do
  if [[ "${arg}" == "--no-build" ]]; then
    NO_BUILD="true"
  elif [[ "${arg}" == "--allow-missing" ]]; then
    ALLOW_MISSING="true"
  else
    echo "[release:zip] ERROR: unsupported argument '${arg}'" >&2
    echo "[release:zip] Supported args: --no-build --allow-missing" >&2
    exit 1
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
DOWNLOADS_DIR="${ROOT_DIR}/downloads"
MACOS_DIR="${DOWNLOADS_DIR}/macos"
LINUX_DIR="${DOWNLOADS_DIR}/linux"
WINDOWS_DIR="${DOWNLOADS_DIR}/windows"

mkdir -p "${MACOS_DIR}" "${LINUX_DIR}" "${WINDOWS_DIR}"
rm -f "${MACOS_DIR}"/*.zip "${LINUX_DIR}"/*.zip "${WINDOWS_DIR}"/*.zip

if [[ "${NO_BUILD}" != "true" ]]; then
  echo "[release:zip] Running multiplatform build (pack:all)..."
  cd "${ROOT_DIR}"
  npm run pack:all
fi

if [[ ! -d "${DIST_DIR}" ]]; then
  echo "[release:zip] ERROR: dist directory not found at ${DIST_DIR}" >&2
  exit 1
fi

shopt -s nullglob
MAC_ARTIFACTS=( "${DIST_DIR}"/*.dmg )
LINUX_ARTIFACTS=( "${DIST_DIR}"/*.AppImage )
WINDOWS_ARTIFACTS=( "${DIST_DIR}"/*.exe )
shopt -u nullglob

zip_artifacts() {
  local platform_dir="$1"
  shift
  local files=( "$@" )

  local count=0
  for file in "${files[@]}"; do
    local name
    name="$(basename "${file}")"
    local zip_path="${platform_dir}/${name}.zip"
    zip -j -q "${zip_path}" "${file}"
    count=$((count + 1))
    echo "[release:zip] Created ${zip_path}" >&2
  done

  echo "${count}"
}

MAC_COUNT="$(zip_artifacts "${MACOS_DIR}" "${MAC_ARTIFACTS[@]}")"
LINUX_COUNT="$(zip_artifacts "${LINUX_DIR}" "${LINUX_ARTIFACTS[@]}")"
WINDOWS_COUNT="$(zip_artifacts "${WINDOWS_DIR}" "${WINDOWS_ARTIFACTS[@]}")"

if [[ "${MAC_COUNT}" -eq 0 && "${ALLOW_MISSING}" != "true" ]]; then
  echo "[release:zip] ERROR: no .dmg artifact found in ${DIST_DIR}" >&2
  exit 1
fi

if [[ "${LINUX_COUNT}" -eq 0 && "${ALLOW_MISSING}" != "true" ]]; then
  echo "[release:zip] ERROR: no .AppImage artifact found in ${DIST_DIR}" >&2
  exit 1
fi

if [[ "${WINDOWS_COUNT}" -eq 0 && "${ALLOW_MISSING}" != "true" ]]; then
  echo "[release:zip] ERROR: no .exe artifact found in ${DIST_DIR}" >&2
  exit 1
fi

if [[ "${ALLOW_MISSING}" == "true" ]]; then
  echo "[release:zip] Warning: --allow-missing enabled (platforms sem artefato serão ignoradas)."
fi

echo ""
echo "[release:zip] Summary"
echo "- macOS zips:   ${MAC_COUNT} -> ${MACOS_DIR}"
echo "- Linux zips:   ${LINUX_COUNT} -> ${LINUX_DIR}"
echo "- Windows zips: ${WINDOWS_COUNT} -> ${WINDOWS_DIR}"
