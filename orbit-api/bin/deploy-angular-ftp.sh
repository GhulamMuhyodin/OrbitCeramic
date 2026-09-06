#!/usr/bin/env bash
# Deploy Angular browser build to Hostinger public_html via parallel lftp.
# Does not touch remote php/ (API) or php-backup-* folders.
#
# Required env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_REMOTE_DIR
# Optional: ANGULAR_DIST (default: repo dist/OrbitCeramic/browser), LFTP_PARALLEL (default 8)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ANGULAR_DIST="${ANGULAR_DIST:-${REPO_ROOT}/dist/OrbitCeramic/browser}"
FTP_SERVER="${FTP_SERVER:?FTP_SERVER required}"
FTP_USERNAME="${FTP_USERNAME:?FTP_USERNAME required}"
FTP_PASSWORD="${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:?FTP_REMOTE_DIR required}"
LFTP_PARALLEL="${LFTP_PARALLEL:-8}"

REMOTE_BASE="${FTP_REMOTE_DIR#./}"
REMOTE_BASE="${REMOTE_BASE%/}"

if [[ ! -f "${ANGULAR_DIST}/index.html" ]]; then
  echo "ERROR: Missing ${ANGULAR_DIST}/index.html — run npm run build first."
  exit 1
fi

FILE_COUNT="$(find "${ANGULAR_DIST}" -type f | wc -l | tr -d ' ')"
echo "Deploying Angular (${FILE_COUNT} files, parallel=${LFTP_PARALLEL}) → ftp://${FTP_SERVER}/${REMOTE_BASE}/"
START="$(date +%s)"

# No --delete on public_html (avoids scanning php/, backups, old assets).
lftp -u "${FTP_USERNAME},${FTP_PASSWORD}" "ftp://${FTP_SERVER}" <<EOF
set ftp:ssl-allow no
set net:max-retries 2
set net:timeout 20
set net:persist-retries 1
set mirror:parallel-transfer-count ${LFTP_PARALLEL}
set cmd:fail-exit yes
cd ${REMOTE_BASE}
lcd ${ANGULAR_DIST}
mirror -R \
  --parallel=${LFTP_PARALLEL} \
  --no-perms \
  --no-umask \
  --exclude-glob php/** \
  --exclude-glob php-backup-*/** \
  --exclude-glob .ftp-deploy-sync-state.json \
  --exclude-glob '**/.DS_Store' \
  --exclude-glob '**/Thumbs.db' \
  .
bye
EOF

ELAPSED="$(( $(date +%s) - START ))"
echo "Angular deploy complete in ${ELAPSED}s."
