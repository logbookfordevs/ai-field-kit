#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"
REPO_DIR="${AI_RULES_REPO:-$HOME_DIR/codes/ai-rules-workflows}"

# Source in repo
SRC_DIR="$REPO_DIR/workflows"

# Canonical commands store
CANON_DIR="$HOME_DIR/.agents/commands"

# Agent destinations
DEST_KILO="$HOME_DIR/.kilocode/workflows"
DEST_CURSOR="$HOME_DIR/.cursor/commands"
DEST_CODEX="$HOME_DIR/.codex/prompts"
DEST_ANTIGRAVITY="$HOME_DIR/.gemini/antigravity/global_workflows"

ensure_repo() {
  echo "▶ Using repo dir: $REPO_DIR"
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "▶ Repo not found. Cloning..."
    mkdir -p "$REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  else
    echo "▶ Repo found. Pulling latest..."
    git -C "$REPO_DIR" pull --ff-only
  fi
}

link_dir() {
  local src="$1"
  local dest="$2"

  if [ ! -d "$src" ]; then
    echo "❌ Source directory not found: $src"
    exit 1
  fi

  mkdir -p "$(dirname "$dest")"

  # Remove existing dir/symlink/file
  if [ -e "$dest" ] || [ -L "$dest" ]; then
    rm -rf "$dest"
  fi

  ln -s "$src" "$dest"
  echo "✅ Linked: $dest -> $src"
}

main() {
  ensure_repo

  if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Workflows dir not found in repo: $SRC_DIR"
    exit 1
  fi

  echo "▶ Linking repo workflows to canonical commands"
  mkdir -p "$(dirname "$CANON_DIR")"

  # Canonical store points to repo
  link_dir "$SRC_DIR" "$CANON_DIR"

  echo "▶ Linking canonical commands into agents"

  link_dir "$CANON_DIR" "$DEST_KILO"
  link_dir "$CANON_DIR" "$DEST_CURSOR"
  link_dir "$CANON_DIR" "$DEST_CODEX"
  link_dir "$CANON_DIR" "$DEST_ANTIGRAVITY"

  echo "✔ Done. Commands are symlinked end-to-end."
}

main