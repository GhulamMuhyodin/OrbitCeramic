#!/usr/bin/env bash
# Deploy orbit-api to Hostinger via lftp put (no remote tree scan).
# Preserves remote public/uploads/ (never uploaded/deleted here).
#
# Required env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_REMOTE_DIR
# Optional: ORBIT_ROOT, LFTP_PARALLEL (default 6)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ftp-progress.sh
source "${SCRIPT_DIR}/ftp-progress.sh"

ORBIT_ROOT="${ORBIT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
FTP_SERVER="${FTP_SERVER:?FTP_SERVER required}"
FTP_USERNAME="${FTP_USERNAME:?FTP_USERNAME required}"
FTP_PASSWORD="${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:?FTP_REMOTE_DIR required}"
LFTP_PARALLEL="${LFTP_PARALLEL:-6}"

FTP_HOST="$(ftp_normalize_host "${FTP_SERVER}")"
REQUESTED_BASE="${FTP_REMOTE_DIR#./}"
REQUESTED_BASE="${REQUESTED_BASE%/}"
[[ -z "$REQUESTED_BASE" ]] && REQUESTED_BASE="."

echo "FTP host: ${FTP_HOST}"
echo "FTP requested remote: ${REQUESTED_BASE}"
echo "FTP local: ${ORBIT_ROOT}"

REMOTE_BASE="$(ftp_preflight "${FTP_USERNAME}" "${FTP_PASSWORD}" "${FTP_HOST}" "${REQUESTED_BASE}")"
echo "FTP using remote base: ${REMOTE_BASE}"

# Local file list only — never walks remote uploads/
mapfile -t FILES < <(
  find "${ORBIT_ROOT}" -type f \
    ! -path '*/.git/*' \
    ! -path '*/public/uploads/*' \
    ! -name 'config.php' \
    ! -name '*.md' \
    ! -name '*.bat' \
    ! -name '.gitignore' \
    ! -name 'deploy-ftp.sh' \
    ! -name 'deploy-angular-ftp.sh' \
    ! -name 'ftp-progress.sh' \
    | sed "s|^${ORBIT_ROOT}/||" \
    | LC_ALL=C sort
)

if [[ -f "${ORBIT_ROOT}/config/config.php" ]]; then
  FILES+=("config/config.php")
fi

FILE_COUNT="${#FILES[@]}"
if [[ "$FILE_COUNT" -lt 1 ]]; then
  echo "::error::No local orbit-api files to upload"
  exit 1
fi

# Unique directories (parents of each file), shallow → deep
mapfile -t DIRS < <(
  printf '%s\n' "${FILES[@]}" \
    | xargs -n1 dirname \
    | grep -v '^\.$' \
    | LC_ALL=C sort -u
)

echo "Deploying orbit-api (${FILE_COUNT} files, parallel=${LFTP_PARALLEL}) → ftp://${FTP_HOST}/${REMOTE_BASE}/php"
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
  # Prefer existing php/; create only when missing
  echo "set cmd:fail-exit no"
  echo "cd php || mkdir php"
  echo "set cmd:fail-exit yes"
  echo "cd php"
  echo "!echo FTP_STATUS php/ ready — starting file puts"

  for d in "${DIRS[@]}"; do
    echo "set cmd:fail-exit no"
    echo "mkdir -p ${d}"
    echo "set cmd:fail-exit yes"
  done
  echo "!echo FTP_STATUS directories ready — uploading ${FILE_COUNT} files"

  local_i=0
  for rel in "${FILES[@]}"; do
    local_i=$((local_i + 1))
    abs="${ORBIT_ROOT}/${rel}"
    # Marker for progress tracker (runs on CI runner via lftp !)
    echo "!echo FTP_PUT ${local_i}/${FILE_COUNT} ${rel}"
    echo "put \"${abs}\" -o \"${rel}\""
    if (( local_i % LFTP_PARALLEL == 0 )); then
      echo "!echo FTP_STATUS batch ${local_i}/${FILE_COUNT}"
    fi
  done

  echo "bye"
} >"${SCRIPT}"

set +e
lftp -f "${SCRIPT}" 2>&1 | ftp_track_progress "orbit-api" "${FILE_COUNT}"
STATUS=${PIPESTATUS[0]}
set -e

if [[ "$STATUS" -ne 0 ]]; then
  echo "::error::orbit-api FTP upload failed (exit ${STATUS})"
  exit "$STATUS"
fi

ELAPSED="$(( $(date +%s) - START ))"
echo "orbit-api deploy complete in ${ELAPSED}s (${FILE_COUNT} files)."
