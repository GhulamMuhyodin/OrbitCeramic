#!/usr/bin/env bash
# Shared FTP helpers for Orbit deploy.
# Path model:
#   ORBIT_FTP_REMOTE_DIR  → domain root (e.g. domains/site.hostingersite.com or .)
#   public_html           → Angular web root
#   public_html/php       → orbit-api
#
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

# True if path looks like public_html (has php/ or index.html).
ftp_looks_like_public_html() {
  local user="$1" pass="$2" host="$3" path="$4"
  local cd_cmd
  if [[ "$path" == "." || -z "$path" ]]; then
    cd_cmd="pwd"
  else
    cd_cmd="cd ${path}"
  fi
  lftp -u "${user},${pass}" "ftp://${host}" \
    -e "$(ftp_lftp_settings); ${cd_cmd}; cls -1; bye" 2>/dev/null \
    | grep -Eiq '(^php/?$|^index\.html$)'
}

# Resolve public_html (Angular root). Prints path on stdout.
# ORBIT_FTP_REMOTE_DIR is the parent (domain folder); we append /public_html when needed.
ftp_resolve_public_html() {
  local user="${1:?}"
  local pass="${2:?}"
  local host="${3:?}"
  local requested="${4:-.}"

  requested="${requested#./}"
  requested="${requested%/}"
  # If secret was set to .../public_html, treat that as web root directly
  local strip_php="${requested%/php}"
  requested="$strip_php"
  [[ -z "$requested" ]] && requested="."

  echo "FTP resolve: listing login home…" >&2
  if ! lftp -u "${user},${pass}" "ftp://${host}" \
    -e "$(ftp_lftp_settings); pwd; cls -1; bye" >&2; then
    echo "::error::FTP login failed — check FTP_SERVER / FTP_USERNAME / FTP_PASSWORD" >&2
    return 1
  fi

  local candidates=()

  # Preferred layout: ORBIT_FTP_REMOTE_DIR/public_html
  if [[ "$requested" == *"/public_html" || "$requested" == "public_html" ]]; then
    candidates+=("$requested")
  else
    if [[ "$requested" != "." ]]; then
      candidates+=("${requested}/public_html")
    fi
    candidates+=("public_html")
  fi

  # FTP account often already lands inside public_html
  candidates+=(".")

  # Extra Hostinger variants
  if [[ "$requested" == domains/* ]]; then
    candidates+=("${requested}/public_html")
    candidates+=("domains/${requested#domains/}/public_html")
  fi

  local seen="|" c
  for c in "${candidates[@]}"; do
    [[ "$seen" == *"|$c|"* ]] && continue
    seen+="$c|"
    echo "FTP resolve: trying public_html candidate → '${c}'" >&2
    if ! ftp_try_cd "$user" "$pass" "$host" "$c"; then
      continue
    fi
    # Prefer a folder that already looks like the site root
    if [[ "$c" == *public_html || "$c" == "." ]]; then
      if ftp_looks_like_public_html "$user" "$pass" "$host" "$c" \
        || [[ "$c" == *"/public_html" || "$c" == "public_html" ]]; then
        echo "FTP resolve: OK public_html → '${c}'" >&2
        if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
          echo "::notice title=FTP path::public_html='${c}' → API='${c}/php'" >&2
        fi
        printf '%s\n' "$c"
        return 0
      fi
    fi
  done

  # Fallback: first candidate we could cd into
  seen="|"
  for c in "${candidates[@]}"; do
    [[ "$seen" == *"|$c|"* ]] && continue
    seen+="$c|"
    if ftp_try_cd "$user" "$pass" "$host" "$c"; then
      echo "FTP resolve: fallback public_html → '${c}'" >&2
      printf '%s\n' "$c"
      return 0
    fi
  done

  echo "::error::Could not find public_html under ORBIT_FTP_REMOTE_DIR='${requested}'" >&2
  echo "::error::Expected: ORBIT_FTP_REMOTE_DIR/public_html/php (File Manager) or FTP home already in public_html." >&2
  return 1
}

# Back-compat alias used by Angular script
ftp_resolve_remote_base() {
  ftp_resolve_public_html "$@"
}

# Resolve public_html + ensure php/. Prints public_html path on stdout.
ftp_preflight() {
  local user="${1:?}"
  local pass="${2:?}"
  local host="${3:?}"
  local remote_dir="${4:?}"
  local public_html cd_cmd

  echo "FTP preflight: connecting to ${host}…" >&2
  if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    echo "::notice title=FTP::Connecting to ${host}" >&2
  fi

  public_html="$(ftp_resolve_public_html "$user" "$pass" "$host" "$remote_dir")" || return 1

  echo "FTP preflight: site root (public_html)='${public_html}'" >&2
  echo "FTP preflight: API target='${public_html}/php'" >&2

  if [[ "$public_html" == "." ]]; then
    cd_cmd="pwd"
  else
    cd_cmd="cd ${public_html}"
  fi

  # Enter existing php/, or create then enter (once — never php/php)
  if lftp -u "${user},${pass}" "ftp://${host}" \
    -e "$(ftp_lftp_settings); ${cd_cmd}; cd php; pwd; bye" >&2; then
    echo "FTP preflight: php/ already exists — using it" >&2
  else
    echo "FTP preflight: php/ not found — creating under public_html…" >&2
    if ! lftp -u "${user},${pass}" "ftp://${host}" \
      -e "$(ftp_lftp_settings); ${cd_cmd}; mkdir php; cd php; pwd; bye" >&2; then
      echo "::error::FTP could not create or enter ${public_html}/php" >&2
      return 1
    fi
    echo "FTP preflight: created ${public_html}/php" >&2
  fi

  echo "FTP preflight: ready" >&2
  printf '%s\n' "$public_html"
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
