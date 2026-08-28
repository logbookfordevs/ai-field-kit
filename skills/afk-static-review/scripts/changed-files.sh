#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: changed-files.sh committed <ref> | staged | unstaged | dirty" >&2
  exit 2
}

git rev-parse --is-inside-work-tree >/dev/null

case "${1:-}" in
  committed)
    [[ $# -eq 2 ]] || usage
    git diff --name-only -z --diff-filter=ACMR "$2...HEAD" --
    ;;
  staged)
    [[ $# -eq 1 ]] || usage
    git diff --name-only -z --cached --diff-filter=ACMR --
    ;;
  unstaged)
    [[ $# -eq 1 ]] || usage
    git diff --name-only -z --diff-filter=ACMR --
    ;;
  dirty)
    [[ $# -eq 1 ]] || usage
    while IFS= read -r -d '' entry; do
      status=${entry:0:2}
      path=${entry:3}

      if [[ -e "$path" || -L "$path" ]]; then
        printf '%s\0' "$path"
      fi

      case "$status" in
        *R*|*C*) IFS= read -r -d '' _ || true ;;
      esac
    done < <(git status --porcelain=v1 -z --untracked-files=all)
    ;;
  *)
    usage
    ;;
esac
