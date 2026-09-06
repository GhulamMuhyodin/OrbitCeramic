#!/usr/bin/env bash
# Deploy Angular browser build via lftp put (no remote tree scan of php/).
#
# Required env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_REMOTE_DIR
# Optional: ANGULAR_DIST, LFTP_PARALLEL (default 6)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ftp-progress.sh
source "${SCRIPT_DIR}/ftp-progress.sh"

REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ANGULAR_DIST="${ANGULAR_DIST:-${REPO_ROOT}/dist/OrbitCeramic/browser}"
FTP_SERVER="${FTP_SERVER:?FTP_SERVER required}"
FTP_USERNAME="${FTP_USERNAME:?FTP_USERNAME required}"
FTP_PASSWORD="${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:?FTP_REMOTE_DIR required}"
LFTP_PARALLEL="${LFTP_PARALLEL:-6}"

FTP_HOST="$(ftp_normalize_host "${FTP_SERVER}")"
REQUESTED_BASE="${FTP_REMOTE_DIR#./}"
REQUESTED_BASE="${REQUESTED_BASE%/}"
[[ -z "$REQUESTED_BASE" ]] && REQUESTED_BASE="."

if [[ ! -f "${ANGULAR_DIST}/index.html" ]]; then
  echo "ERROR: Missing ${ANGULAR_DIST}/index.html — run npm run build first."
  exit 1
fi

echo "FTP host: ${FTP_HOST}"
echo "FTP requested remote: ${REQUESTED_BASE}"
echo "FTP local: ${ANGULAR_DIST}"

# Resolve same way as API (may fall back to . or public_html)
REMOTE_BASE="$(ftp_resolve_remote_base "${FTP_USERNAME}" "${FTP_PASSWORD}" "${FTP_HOST}" "${REQUESTED_BASE}")"
echo "FTP using remote base: ${REMOTE_BASE}"

mapfile -t FILES < <(
  find "${ANGULAR_DIST}" -type f \
    | sed "s|^${ANGULAR_DIST}/||" \
    | LC_ALL=C sort
)

FILE_COUNT="${#FILES[@]}"
mapfile -t DIRS < <(
  printf '%s\n' "${FILES[@]}" \
    | xargs -n1 dirname \
    | grep -v '^\.$' \
    | LC_ALL=C sort -u
)

echo "Deploying Angular (${FILE_COUNT} files, parallel=${LFTP_PARALLEL}) → ftp://${FTP_HOST}/${REMOTE_BASE}/"
START="$(date +%s)"

SCRIPT="$(mktemp)"
trap 'rm -f "${SCRIPT}"' EXIT

{
  echo "set ftp:ssl-allow no"
  echo "set ftp:passive-mode yes"
  echo "set ftp:auto-sync-mode no"
  echo "set net:timeout 15"
  echo "set net:max-retries 1"
  echo "set net:persist-retries 0"
  echo "set cmd:fail-exit yes"
  echo "set cmd:interactive false"
  echo "set xfer:clobber on"
  echo "open -u ${FTP_USERNAME},${FTP_PASSWORD} ftp://${FTP_HOST}"
  if [[ "${REMOTE_BASE}" == "." ]]; then
    echo "pwd"
  else
    echo "cd ${REMOTE_BASE}"
  fi
  echo "!echo FTP_STATUS Angular mkdir — starting puts"

  for d in "${DIRS[@]}"; do
    echo "set cmd:fail-exit no"
    echo "mkdir -p ${d}"
    echo "set cmd:fail-exit yes"
  done
  echo "!echo FTP_STATUS directories ready — uploading ${FILE_COUNT} files"

  local_i=0
  for rel in "${FILES[@]}"; do
    local_i=$((local_i + 1))
    abs="${ANGULAR_DIST}/${rel}"
    echo "!echo FTP_PUT ${local_i}/${FILE_COUNT} ${rel}"
    echo "put \"${abs}\" -o \"${rel}\""
    if (( local_i % LFTP_PARALLEL == 0 )); then
      echo "!echo FTP_STATUS batch ${local_i}/${FILE_COUNT}"
    fi
  done

  echo "bye"
} >"${SCRIPT}"

set +e
lftp -f "${SCRIPT}" 2>&1 | ftp_track_progress "Angular" "${FILE_COUNT}"
STATUS=${PIPESTATUS[0]}
set -e

if [[ "$STATUS" -ne 0 ]]; then
  echo "::error::Angular FTP upload failed (exit ${STATUS})"
  exit "$STATUS"
fi

ELAPSED="$(( $(date +%s) - START ))"
echo "Angular deploy complete in ${ELAPSED}s (${FILE_COUNT} files)."
