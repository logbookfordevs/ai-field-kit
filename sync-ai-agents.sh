#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME}"
REPO_DIR="${AI_RULES_REPO:-$HOME_DIR/codes/ai-rules-workflows}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"

# Source in repo
AGENTS_REL_PATH="rules/AGENTS.md"
RULES_SRC="$REPO_DIR/$AGENTS_REL_PATH"

# Canonical store
CANON_DIR="$HOME_DIR/.agents/rules"
CANON_FILE="$CANON_DIR/AGENTS.md"

timestamp() { date +"%Y%m%d-%H%M%S"; }

ensure_repo() {
  echo "▶ Using repo dir: $REPO_DIR"
  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "▶ Repo not found locally. Cloning..."
    mkdir -p "$REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  else
    echo "▶ Repo found. Pulling latest changes..."
    git -C "$REPO_DIR" pull --ff-only
  fi
}

copy_to_canonical() {
  if [ ! -f "$RULES_SRC" ]; then
    echo "❌ Rules file not found at: $RULES_SRC"
    exit 1
  fi

  mkdir -p "$CANON_DIR"
  cp "$RULES_SRC" "$CANON_FILE"
  echo "✅ Canonical rules updated: $CANON_FILE"
}

backup_if_real_file() {
  local path="$1"
  if [ -f "$path" ] && [ ! -L "$path" ]; then
    local bak="$path.bak.$(timestamp)"
    mv "$path" "$bak"
    echo "   ↳ 📦 Backed up existing file to: $bak"
  fi
}

link_rule() {
  local dest="$1"
  local dest_dir
  dest_dir="$(dirname "$dest")"

  mkdir -p "$dest_dir"

  # If a real file exists, backup first (don’t destroy user data)
  backup_if_real_file "$dest"

  # If a symlink exists (even wrong), replace it
  if [ -L "$dest" ]; then
    rm -f "$dest"
  fi

  ln -s "$CANON_FILE" "$dest"
  echo "✅ Linked: $dest -> $CANON_FILE"
}

main() {
  ensure_repo
  copy_to_canonical

  echo "▶ Linking rules into agents"

  # Gemini
  link_rule "$HOME_DIR/.gemini/GEMINI.md"

  # Codex
  link_rule "$HOME_DIR/.codex/AGENTS.md"

  # Kiro
  link_rule "$HOME_DIR/.kiro/steering/AGENTS.md"

  # KiloCode
  link_rule "$HOME_DIR/.kilocode/rules/AGENTS.md"

  echo "✔ Done. Rules are now single-source via symlink."
  echo "ℹ️  Skills sync removed: you’re handling skills via npx skills + ~/.agents/skills."
}

main