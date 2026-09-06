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
  if [[ "$host" == *"/"* ]]; then
    host="${host%%/*}"
  fi
  printf '%s' "$host"
}

ftp_lftp_settings() {
  echo "set ftp:ssl-allow no"
  echo "set ftp:passive-mode yes"
  echo "set ftp:auto-sync-mode no"
  echo "set net:timeout 12"
  echo "set net:max-retries 1"
  echo "set cmd:fail-exit yes"
  echo "set cmd:interactive false"
}

ftp_try_cd() {
  local user="$1" pass="$2" host="$3" path="$4"
  if [[ "$path" == "." || -z "$path" ]]; then
    lftp -u "${user},${pass}" "ftp://${host}" \
      -e "$(ftp_lftp_settings); pwd; bye" >/dev/null 2>&1
  else
    lftp -u "${user},${pass}" "ftp://${host}" \
      -e "$(ftp_lftp_settings); cd ${path}; pwd; bye" >/dev/null 2>&1
  fi
}

# Probe Hostinger FTP home. Prints resolved base on stdout only.
ftp_resolve_remote_base() {
  local user="${1:?}"
  local pass="${2:?}"
  local host="${3:?}"
  local requested="${4:-.}"

  requested="${requested#./}"
  requested="${requested%/}"
  [[ -z "$requested" ]] && requested="."

  echo "FTP resolve: listing login home…" >&2
  if ! lftp -u "${user},${pass}" "ftp://${host}" \
    -e "$(ftp_lftp_settings); pwd; cls -1; bye" >&2; then
    echo "::error::FTP login failed — check FTP_SERVER / FTP_USERNAME / FTP_PASSWORD" >&2
    return 1
  fi

  local candidates=()
  candidates+=("$requested" "." "public_html")

  if [[ "$requested" == *"/public_html" ]]; then
    candidates+=("public_html" ".")
  fi
  if [[ "$requested" == domains/*/* ]]; then
    # domains/hostname/public_html → public_html
    candidates+=("${requested##*/}")
    # domains/hostname/public_html → hostname/public_html (rare)
    candidates+=("${requested#domains/}")
  fi

  local seen="|" c
  for c in "${candidates[@]}"; do
    [[ "$seen" == *"|$c|"* ]] && continue
    seen+="$c|"
    echo "FTP resolve: trying cd → '${c}'" >&2
    if ftp_try_cd "$user" "$pass" "$host" "$c"; then
      echo "FTP resolve: OK → '${c}'" >&2
      if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
        echo "::notice title=FTP path::Using remote dir '${c}'" >&2
      fi
      printf '%s\n' "$c"
      return 0
    fi
  done

  echo "::error::Could not cd into any of: ${candidates[*]}" >&2
  echo "::error::Set ORBIT_FTP_REMOTE_DIR to '.' or 'public_html' (Hostinger FTP often starts in site root)." >&2
  return 1
}

# Resolve path + ensure php/. Prints resolved base on stdout only.
ftp_preflight() {
  local user="${1:?}"
  local pass="${2:?}"
  local host="${3:?}"
  local remote_base="${4:?}"
  local resolved cd_cmd

  echo "FTP preflight: connecting to ${host}…" >&2
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP::Connecting to ${host}" >&2
  fi

  resolved="$(ftp_resolve_remote_base "$user" "$pass" "$host" "$remote_base")" || return 1

  echo "FTP preflight: ensuring php/ under '${resolved}'" >&2
  if [[ "$resolved" == "." ]]; then
    cd_cmd="pwd"
  else
    cd_cmd="cd ${resolved}"
  fi

  if ! lftp -u "${user},${pass}" "ftp://${host}" \
    -e "$(ftp_lftp_settings); ${cd_cmd}; mkdir -p php; cd php; pwd; bye" >&2; then
    echo "::error::FTP could not mkdir php under '${resolved}'" >&2
    return 1
  fi

  echo "FTP preflight: ready (remote base=${resolved})" >&2
  printf '%s\n' "$resolved"
  return 0
}

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
