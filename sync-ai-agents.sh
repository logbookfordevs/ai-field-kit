#!/usr/bin/env bash
set -euo pipefail

# Caminho onde o repo ai-rules-workflows vai ficar localmente
REPO_DIR="${AI_RULES_REPO:-$HOME/codes/ai-rules-workflows}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"
AGENTS_REL_PATH="rules/AGENTS.md"

echo "▶ Using repo dir: $REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "▶ Repo not found locally. Cloning..."
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "▶ Repo found. Pulling latest changes..."
  git -C "$REPO_DIR" pull --ff-only
fi

SRC="$REPO_DIR/$AGENTS_REL_PATH"

if [ ! -f "$SRC" ]; then
  echo "❌ AGENTS.md not found at $SRC"
  exit 1
fi

echo "▶ Using AGENTS file: $SRC"

sync_agent() {
  local src="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "✅ Updated $dest"
}

# Gemini
sync_agent "$SRC" "$HOME/.gemini/AGENTS.md"

# Codex (extension / CLI)
sync_agent "$SRC" "$HOME/.codex/AGENTS.md"

# Kiro
sync_agent "$SRC" "$HOME/.kiro/steering/AGENTS.md"

# KiloCode (IDE / CLI)
sync_agent "$SRC" "$HOME/.kilocode/rules/AGENTS.md"

echo "✔ All agents updated from $SRC"
