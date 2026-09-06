#!/usr/bin/env bash
# Deploy orbit-api to Hostinger via lftp.
# Preserves remote config/config.php and public/uploads/.
#
# Required env: FTP_SERVER, FTP_USERNAME, FTP_PASSWORD, FTP_REMOTE_DIR
# Optional: ORBIT_ROOT (default: repo orbit-api next to this script)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORBIT_ROOT="${ORBIT_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
FTP_SERVER="${FTP_SERVER:?FTP_SERVER required}"
FTP_USERNAME="${FTP_USERNAME:?FTP_USERNAME required}"
FTP_PASSWORD="${FTP_PASSWORD:?FTP_PASSWORD required}"
FTP_REMOTE_DIR="${FTP_REMOTE_DIR:?FTP_REMOTE_DIR required}"

# Normalize remote dir (no leading ./ ; ensure trailing slash parent)
REMOTE_BASE="${FTP_REMOTE_DIR#./}"
REMOTE_BASE="${REMOTE_BASE%/}"

echo "Deploying ${ORBIT_ROOT} → ftp://${FTP_SERVER}/${REMOTE_BASE}/php"

lftp -u "${FTP_USERNAME},${FTP_PASSWORD}" "ftp://${FTP_SERVER}" <<EOF
set ftp:ssl-allow no
set net:max-retries 3
set net:timeout 30
set cmd:fail-exit yes
cd ${REMOTE_BASE}
mkdir -p php || true
lcd ${ORBIT_ROOT}
cd php
mirror -R \
  --verbose \
  --delete \
  --exclude-glob .git/** \
  --exclude-glob config/config.php \
  --exclude-glob public/uploads/** \
  --exclude-glob '**/.DS_Store' \
  --exclude-glob '**/Thumbs.db' \
  .
bye
EOF

# Upload generated config.php if present (CI writes it before this script)
if [[ -f "${ORBIT_ROOT}/config/config.php" ]]; then
  echo "Uploading config/config.php"
  lftp -u "${FTP_USERNAME},${FTP_PASSWORD}" "ftp://${FTP_SERVER}" <<EOF
set ftp:ssl-allow no
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

echo "orbit-api deploy complete."
