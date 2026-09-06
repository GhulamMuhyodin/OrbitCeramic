#!/usr/bin/env bash
# Shared FTP upload progress helpers for CI deploy scripts.
# Source from deploy-*.sh — do not execute directly.
#
# Usage:
#   source "$(dirname "$0")/ftp-progress.sh"
#   lftp ... 2>&1 | ftp_track_progress "orbit-api" "$FILE_COUNT"
#   status=${PIPESTATUS[0]}

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

# Reads lftp --verbose lines from stdin; prints % + GitHub notices.
# Args: label total_files
ftp_track_progress() {
  local label="${1:?label required}"
  local total="${2:?total required}"
  local done=0
  local last_pct=-1
  local pct=0
  local line

  if ! [[ "$total" =~ ^[0-9]+$ ]] || [[ "$total" -lt 1 ]]; then
    total=1
  fi

  echo "FTP ${label}: $(ftp_bar 0) 0% (0/${total})"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP ${label}::0% (0/${total})"
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    # Keep lftp noise visible in the job log
    printf '%s\n' "$line"

    # Count file transfer lines from lftp --verbose / --log
    if [[ "$line" =~ [Tt]ransferring\ file ]] \
      || [[ "$line" =~ [Tt]ransferred$ ]] \
      || [[ "$line" =~ \ transferred$ ]] \
      || [[ "$line" =~ ^Sending\ file ]] \
      || [[ "$line" =~ ^Putting\ file ]] \
      || [[ "$line" =~ ^[Tt]ransfer\ of\  ]]; then
      done=$((done + 1))
      if [[ "$done" -gt "$total" ]]; then
        done=$total
      fi
      pct=$((done * 100 / total))
      if [[ "$pct" -gt 99 && "$done" -lt "$total" ]]; then
        pct=99
      fi

      # Throttle: every 5%, every file under 20, or last file
      if [[ "$pct" -ne "$last_pct" ]] \
        && { [[ $((pct % 5)) -eq 0 ]] || [[ "$total" -le 20 ]] || [[ "$done" -eq "$total" ]]; }; then
        last_pct=$pct
        echo "FTP ${label}: $(ftp_bar "$pct") ${pct}% (${done}/${total})"
        if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
          echo "::notice title=FTP ${label}::${pct}% (${done}/${total})"
        fi
        if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
          echo "- **FTP ${label}:** ${pct}% (${done}/${total})" >>"$GITHUB_STEP_SUMMARY"
        fi
      fi
    fi
  done

  echo "FTP ${label}: $(ftp_bar 100) 100% (${total}/${total})"
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP ${label}::100% — complete"
  fi
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    echo "- **FTP ${label}:** 100% complete" >>"$GITHUB_STEP_SUMMARY"
  fi
}

# Run lftp script from stdin through progress tracker; preserve exit code.
# Args: label total_files  then same args as lftp (e.g. -u user,pass ftp://host)
ftp_lftp_mirror() {
  local label="${1:?}"
  local total="${2:?}"
  shift 2

  set +e
  # shellcheck disable=SC2034
  lftp "$@" 2>&1 | ftp_track_progress "$label" "$total"
  local status=${PIPESTATUS[0]}
  set -e
  return "$status"
}
