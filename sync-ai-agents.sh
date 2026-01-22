#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME}"
REPO_DIR="${AI_RULES_REPO:-$HOME_DIR/codes/ai-rules-workflows}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"

AGENTS_REL_PATH="rules/AGENTS.md"

SKILLS_REL_PATH="skills"

echo "▶ Using repo dir: $REPO_DIR"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "▶ Repo not found locally. Cloning..."
  mkdir -p "$(dirname "$REPO_DIR")"
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "▶ Repo found. Pulling latest changes..."
  git -C "$REPO_DIR" pull --ff-only
fi

RULES_SRC="$REPO_DIR/$AGENTS_REL_PATH"
if [ ! -f "$RULES_SRC" ]; then
  echo "❌ Rules file not found at: $RULES_SRC"
  exit 1
fi

sync_file() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  echo "✅ Updated file: $dest"
}

sync_dir() {
  local src="$1"
  local dest="$2"

  mkdir -p "$dest"

  if [ ! -d "$src" ]; then
    echo "ℹ️  Source directory not found, skipping: $src"
    return 0
  fi

  # Copy contents (including subfolders). If empty, do nothing.
  if find "$src" -mindepth 1 -print -quit 2>/dev/null | grep -q .; then
    cp -R "$src"/* "$dest"/
  fi

  echo "✅ Synced directory: $dest"
}

echo "▶ Syncing rules"
echo "   Source: $RULES_SRC"

sync_file "$RULES_SRC" "$HOME_DIR/.gemini/GEMINI.md"
sync_file "$RULES_SRC" "$HOME_DIR/.codex/AGENTS.md"
sync_file "$RULES_SRC" "$HOME_DIR/.kiro/steering/AGENTS.md"
sync_file "$RULES_SRC" "$HOME_DIR/.kilocode/rules/AGENTS.md"

echo "▶ Syncing skills"
SKILLS_SRC="$REPO_DIR/$SKILLS_REL_PATH"
echo "   Source: $SKILLS_SRC"

# ✅ Agora só copia da fonte real do repo
sync_dir "$SKILLS_SRC" "$HOME_DIR/.gemini/skills"
sync_dir "$SKILLS_SRC" "$HOME_DIR/.gemini/antigravity/skills"
sync_dir "$SKILLS_SRC" "$HOME_DIR/.codex/skills"
sync_dir "$SKILLS_SRC" "$HOME_DIR/.kilocode/skills"
sync_dir "$SKILLS_SRC" "$HOME_DIR/.kiro/skills"
sync_dir "$SKILLS_SRC" "$HOME_DIR/.cursor/skills"

echo "✔ All agents rules and skills updated from $REPO_DIR"