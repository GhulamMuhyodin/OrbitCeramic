#!/usr/bin/env bash
# Shared FTP upload progress helpers for CI deploy scripts.
# Source from deploy-*.sh — do not execute directly.

ftp_bar() {
  local pct="${1:-0}"
  local width=20
  local filled=$((pct * width / 100))
  local empty=$((width - filled))
  local bar=""
  local i
  for ((i = 0; i < filled; i++)); do bar+="█"; done
  for ((i = 0; i < empty; i++)); do bar+="░"; done
  printf '%s' "$bar"
}

ftp_normalize_host() {
  local host="${1:?}"
  host="${host#ftp://}"
  host="${host#FTP://}"
  host="${host#ftps://}"
  host="${host#FTPS://}"
  host="${host#http://}"
  host="${host#https://}"
  # Drop path if someone pasted a URL; keep host or host:port
  if [[ "$host" == *"/"* ]]; then
    host="${host%%/*}"
  fi
  printf '%s' "$host"
}

# Fast connect check — fails within ~20s instead of hanging for minutes.
ftp_preflight() {
  local user="${1:?}"
  local pass="${2:?}"
  local host="${3:?}"
  local remote_base="${4:?}"

  echo "FTP preflight: connecting to ${host}…"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP::Connecting to ${host}"
  fi

  # shellcheck disable=SC2034
  if ! lftp -u "${user},${pass}" "ftp://${host}" \
    -e "set ftp:ssl-allow no; set ftp:passive-mode yes; set net:timeout 12; set net:max-retries 1; set cmd:fail-exit yes; pwd; bye" \
    2>&1; then
    echo "::error::FTP preflight failed — check FTP_SERVER / username / password"
    return 1
  fi

  echo "FTP preflight: login OK — ensuring remote path ${remote_base}/php"
  if ! lftp -u "${user},${pass}" "ftp://${host}" \
    -e "set ftp:ssl-allow no; set ftp:passive-mode yes; set net:timeout 12; set net:max-retries 1; set cmd:fail-exit yes; cd ${remote_base}; mkdir -p php; cd php; pwd; bye" \
    2>&1; then
    echo "::error::FTP could not cd/mkdir ${remote_base}/php — check ORBIT_FTP_REMOTE_DIR"
    return 1
  fi

  echo "FTP preflight: ready"
  return 0
}

# Reads lines from stdin; counts FTP_PUT markers (and lftp Transferring lines).
# Args: label total_files
ftp_track_progress() {
  local label="${1:?label required}"
  local total="${2:?total required}"
  local done=0
  local last_pct=-1
  local pct=0
  local line
  local last_beat
  last_beat="$(date +%s)"

  if ! [[ "$total" =~ ^[0-9]+$ ]] || [[ "$total" -lt 1 ]]; then
    total=1
  fi

  echo "FTP ${label}: $(ftp_bar 0) 0% (0/${total})"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP ${label}::0% (0/${total}) — starting uploads"
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s\n' "$line"

    # Heartbeat if quiet for 20s (still connecting / mkdir)
    if [[ "$(( $(date +%s) - last_beat ))" -ge 20 ]]; then
      echo "FTP ${label}: still working… ${done}/${total} uploaded so far ($(ftp_bar "$pct") ${pct}%)"
      last_beat="$(date +%s)"
    fi

    if [[ "$line" =~ ^FTP_PUT\  ]] \
      || [[ "$line" =~ [Tt]ransferring\ file ]] \
      || [[ "$line" =~ ^Sending\ file ]] \
      || [[ "$line" =~ ^Putting\ file ]]; then
      done=$((done + 1))
      last_beat="$(date +%s)"
      if [[ "$done" -gt "$total" ]]; then
        done=$total
      fi
      pct=$((done * 100 / total))
      if [[ "$pct" -gt 99 && "$done" -lt "$total" ]]; then
        pct=99
      fi

      if [[ "$pct" -ne "$last_pct" ]] \
        && { [[ $((pct % 5)) -eq 0 ]] || [[ "$total" -le 25 ]] || [[ "$done" -eq "$total" ]] || [[ "$done" -eq 1 ]]; }; then
        last_pct=$pct
        echo "FTP ${label}: $(ftp_bar "$pct") ${pct}% (${done}/${total})"
        if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
          echo "::notice title=FTP ${label}::${pct}% (${done}/${total})"
        fi
      fi
    fi
  done

  echo "FTP ${label}: $(ftp_bar 100) 100% (${total}/${total})"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP ${label}::100% — complete"
  fi
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "- **FTP ${label}:** 100% (${total} files)" >>"$GITHUB_STEP_SUMMARY"
  fi
}
