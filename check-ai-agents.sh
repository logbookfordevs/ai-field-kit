#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${AI_RULES_REPO:-$HOME/codes/ai-rules-workflows}"
AGENTS_REL_PATH="rules/AGENTS.md"

SRC="$REPO_DIR/$AGENTS_REL_PATH"

echo "🔍 AI Agents configuration check"
echo "--------------------------------"

# Helper
check_file() {
  local label="$1"
  local path="$2"

  if [ -f "$path" ]; then
    echo "✅ $label → FOUND ($path)"
    return 0
  else
    echo "❌ $label → NOT FOUND ($path)"
    return 1
  fi
}

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

# 1. Repo
if [ -d "$REPO_DIR/.git" ]; then
  echo "✅ Source repo found: $REPO_DIR"
else
  echo "❌ Source repo NOT found: $REPO_DIR"
  exit 1
fi

# 2. Source AGENTS
check_file "Source AGENTS.md" "$SRC" || exit 1

SRC_HASH=$(hash_file "$SRC")

echo ""
echo "📦 Agent targets"
echo "----------------"

check_and_compare() {
  local name="$1"
  local target="$2"

  if check_file "$name" "$target"; then
    TARGET_HASH=$(hash_file "$target")
    if [ "$SRC_HASH" = "$TARGET_HASH" ]; then
      echo "   ↳ 🔁 In sync"
    else
      echo "   ↳ ⚠️  OUT OF DATE"
    fi
  fi
}

# Gemini
check_and_compare "Gemini" "$HOME/.gemini/AGENTS.md"

# Codex
check_and_compare "Codex" "$HOME/.codex/AGENTS.md"

# Kiro
check_and_compare "Kiro" "$HOME/.kiro/steering/AGENTS.md"

# KiloCode
check_and_compare "KiloCode" "$HOME/.kilocode/rules/AGENTS.md"

echo ""
echo "🧠 Cursor"
echo "---------"
echo "ℹ️ Cursor rules are stored internally in the IDE."
echo "   Manual verification required (User Rules)."

echo ""
echo "✔ Check complete"
