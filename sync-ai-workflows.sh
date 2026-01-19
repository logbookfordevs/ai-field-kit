#!/usr/bin/env bash
set -euo pipefail

# --------------------
# CONFIG
# --------------------
HOME_DIR="${HOME}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"
REPO_DIR="${AI_RULES_REPO:-$HOME_DIR/codes/ai-rules-workflows}"

SRC_DIR="$REPO_DIR/workflows"

# Destinations (user-scoped)
DEST_KILO="$HOME_DIR/.kilocode/workflows"
DEST_CURSOR="$HOME_DIR/.cursor/commands"
DEST_ANTIGRAVITY="$HOME_DIR/.gemini/antigravity/global_workflows"
DEST_GEMINI="$HOME_DIR/.gemini/commands"
DEST_CODEX="$HOME_DIR/.codex/prompts"

DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;      # show actions without writing
    *)
      echo "Unknown arg: $arg"
      echo "Usage: $0 [--dry-run]"
      exit 2
      ;;
  esac
done

run() {
  if [ "$DRY_RUN" = "true" ]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

ensure_repo() {
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "▶ Repo not found. Cloning to $REPO_DIR"
    mkdir -p "$REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  else
    echo "▶ Repo found. Pulling latest..."
    git -C "$REPO_DIR" pull --ff-only
  fi
}

copy_matches() {
  local pattern="$1"
  local dest="$2"

  run "mkdir -p \"$dest\""

  # If no files match, do nothing (avoid cp errors)
  if ! find "$SRC_DIR" -maxdepth 1 -type f -name "$pattern" -print -quit | grep -q .; then
    echo "ℹ️  No '$pattern' found in $SRC_DIR (skipping $dest)"
    return 0
  fi

  # Copy as-is, keep original filenames
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    run "cp \"$f\" \"$dest/$base\""
  done < <(find "$SRC_DIR" -maxdepth 1 -type f -name "$pattern" -print0)
}

escape_toml_string() {
  # Escape backslashes and double quotes for TOML basic strings
  echo "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

generate_gemini_from_md() {
  run "mkdir -p \"$DEST_GEMINI\""

  # If no .md files exist, skip.
  if ! find "$SRC_DIR" -maxdepth 1 -type f -name "*.md" -print -quit | grep -q .; then
    echo "ℹ️  No '*.md' found in $SRC_DIR (skipping Gemini)"
    return 0
  fi

  # Each <workflow>.md -> ~/.gemini/commands/<workflow>.toml
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    stem="${base%.md}"
    out="$DEST_GEMINI/$stem.toml"

    # Best-effort description: first non-empty line, stripped from markdown heading tokens
    desc="$(grep -m 1 -E '^[[:space:]]*[^[:space:]].*' "$f" | sed -E 's/^[[:space:]]*(#+|\*|\-)[[:space:]]*//' | tr -d '\r' || true)"
    if [ -z "${desc:-}" ]; then
      desc="Workflow: $stem"
    fi
    desc_escaped="$(escape_toml_string "$desc")"

    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] write $out"
    else
      {
        echo "description=\"$desc_escaped\""
        echo "prompt = \"\"\""
        cat "$f"
        echo ""
        echo "\"\"\""
      } > "$out"
    fi
  done < <(find "$SRC_DIR" -maxdepth 1 -type f -name "*.md" -print0)
}

main() {
  ensure_repo

  if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Source workflows dir not found: $SRC_DIR"
    exit 1
  fi

  echo "▶ Syncing from: $SRC_DIR"
  echo "   Kilo ->        $DEST_KILO        (copies *.md)"
  echo "   Cursor ->      $DEST_CURSOR      (copies *.md)"
  echo "   Antigravity -> $DEST_ANTIGRAVITY (copies *.md)"
  echo "   Gemini ->      $DEST_GEMINI      (generates *.toml from *.md)"
  echo "   Codex ->       $DEST_CODEX       (copies *.md)"

  # Workflows are Markdown
  copy_matches "*.md" "$DEST_KILO"
  copy_matches "*.md" "$DEST_CURSOR"
  copy_matches "*.md" "$DEST_ANTIGRAVITY"

  # Gemini commands must be TOML, generated from the repo's .md workflows
  generate_gemini_from_md

  # Codex prompts are Markdown
  copy_matches "*.md" "$DEST_CODEX"

  echo "✔ Done."
  if [ "$DRY_RUN" = "true" ]; then
    echo "ℹ️  Dry run mode: nothing was written."
  fi
}

main
