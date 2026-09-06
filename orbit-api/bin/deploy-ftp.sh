#!/usr/bin/env bash
# Deploy orbit-api to Hostinger via lftp (parallel transfers).
# Preserves remote config/config.php and public/uploads/.
#
# Required env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_REMOTE_DIR
# Optional: ORBIT_ROOT, LFTP_PARALLEL (default 8)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORBIT_ROOT="${ORBIT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
FTP_SERVER="${FTP_SERVER:?FTP_SERVER required}"
FTP_USERNAME="${FTP_USERNAME:?FTP_USERNAME required}"
FTP_PASSWORD="${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:?FTP_REMOTE_DIR required}"
LFTP_PARALLEL="${LFTP_PARALLEL:-8}"

REMOTE_BASE="${FTP_REMOTE_DIR#./}"
REMOTE_BASE="${REMOTE_BASE%/}"

FILE_COUNT="$(find "${ORBIT_ROOT}" -type f \
  ! -path '*/.git/*' \
  ! -path '*/public/uploads/*' \
  ! -name 'config.php' \
  ! -name '*.md' \
  ! -name '*.bat' \
  ! -name '.gitignore' \
  | wc -l | tr -d ' ')"

echo "Deploying orbit-api (${FILE_COUNT} files, parallel=${LFTP_PARALLEL}) → ftp://${FTP_SERVER}/${REMOTE_BASE}/php"
START="$(date +%s)"

# No --delete: listing/deleting remote trees on Hostinger is extremely slow
# (especially if public/uploads has many media files).
lftp -u "${FTP_USERNAME},${FTP_PASSWORD}" "ftp://${FTP_SERVER}" <<EOF
set ftp:ssl-allow no
set net:max-retries 2
set net:timeout 20
set net:persist-retries 1
set mirror:parallel-transfer-count ${LFTP_PARALLEL}
set cmd:fail-exit yes
cd ${REMOTE_BASE}
mkdir -p php || true
lcd ${ORBIT_ROOT}
cd php
mirror -R \
  --parallel=${LFTP_PARALLEL} \
  --no-perms \
  --no-umask \
  --exclude-glob .git/** \
  --exclude-glob config/config.php \
  --exclude-glob public/uploads/** \
  --exclude-glob '**/*.md' \
  --exclude-glob '**/*.bat' \
  --exclude-glob '**/.DS_Store' \
  --exclude-glob '**/Thumbs.db' \
  --exclude-glob .gitignore \
  --exclude-glob bin/deploy-ftp.sh \
  --exclude-glob bin/deploy-angular-ftp.sh \
  .
bye
EOF

if [[ -f "${ORBIT_ROOT}/config/config.php" ]]; then
  echo "Uploading config/config.php"
  lftp -u "${FTP_USERNAME},${FTP_PASSWORD}" "ftp://${FTP_SERVER}" <<EOF
set ftp:ssl-allow no
set net:timeout 20
set cmd:fail-exit yes
cd ${REMOTE_BASE}/php/config
mkdir -p . || true
lcd ${ORBIT_ROOT}/config
put config.php
bye
EOF
else
  echo "WARNING: No local config/config.php — remote config (if any) left unchanged."
fi

ELAPSED="$(( $(date +%s) - START ))"
echo "orbit-api deploy complete in ${ELAPSED}s."
