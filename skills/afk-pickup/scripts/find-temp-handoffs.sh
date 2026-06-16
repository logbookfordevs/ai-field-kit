#!/usr/bin/env bash
set -euo pipefail

query="${*:-}"
cwd="${PWD:-}"
repo_name="$(basename "$cwd")"

dirs=()
seen_dirs="
"

add_dir() {
  local dir="$1"
  local normalized

  [ -n "$dir" ] || return 0
  [ -d "$dir" ] || return 0

  normalized="${dir%/}"
  case "$seen_dirs" in
    *"
$normalized
"*) return 0 ;;
  esac

  dirs+=("$dir")
  seen_dirs="${seen_dirs}${normalized}
"
}

stat_mtime() {
  stat -f "%m" "$1" 2>/dev/null || stat -c "%Y" "$1" 2>/dev/null
}

lower() {
  printf "%s" "$1" | tr "[:upper:]" "[:lower:]"
}

contains_file_text() {
  local pattern="$1"
  local file="$2"

  [ -n "$pattern" ] || return 1
  grep -FIiq -- "$pattern" "$file" 2>/dev/null
}

score_file() {
  local file="$1"
  local name
  local name_lc
  local query_lc
  local repo_lc
  local score=0

  name="$(basename "$file")"
  name_lc="$(lower "$name")"
  query_lc="$(lower "$query")"
  repo_lc="$(lower "$repo_name")"

  case "$name_lc" in
    *handoff*|*pickup*|*resume*|*continuation*) score=$((score + 40)) ;;
  esac

  if [ -n "$query_lc" ] && [ "$query_lc" != "latest" ]; then
    case "$name_lc" in
      *"$query_lc"*) score=$((score + 30)) ;;
    esac
    contains_file_text "$query_lc" "$file" && score=$((score + 25))
  fi

  case "$name_lc" in
    *"$repo_lc"*) score=$((score + 20)) ;;
  esac

  contains_file_text "$cwd" "$file" && score=$((score + 25))
  contains_file_text "$repo_lc" "$file" && score=$((score + 15))
  contains_file_text "handoff" "$file" && score=$((score + 10))
  contains_file_text "next steps" "$file" && score=$((score + 5))
  contains_file_text "validation" "$file" && score=$((score + 5))

  printf "%s" "$score"
}

emit_if_file() {
  local file="$1"
  local mtime
  local score

  [ -f "$file" ] || return 0

  mtime="$(stat_mtime "$file")" || return 0
  score="$(score_file "$file")"
  [ "$score" -gt 0 ] || return 0

  printf "%s\t%s\t%s\n" "$score" "$mtime" "$file"
}

add_dir "/tmp"
add_dir "/private/tmp"
add_dir "${TMPDIR:-}"

{
  if [ -n "$query" ] && [ "$query" != "latest" ]; then
    emit_if_file "$query"
    if [ "${query#*/}" = "$query" ]; then
      for dir in "${dirs[@]}"; do
        emit_if_file "$dir/$query"
      done
    fi
  fi

  for dir in "${dirs[@]}"; do
    find "$dir" -maxdepth 3 -type f \( -iname "*.md" -o -iname "*.markdown" -o -iname "*.txt" \) -mtime -30 -print0 2>/dev/null |
      while IFS= read -r -d "" file; do
        emit_if_file "$file"
      done
  done
} |
  sort -t $'\t' -k1,1nr -k2,2nr -u |
  head -20 |
  while IFS=$'\t' read -r score mtime file; do
    printf "score=%s mtime=%s %s\n" "$score" "$mtime" "$file"
  done
