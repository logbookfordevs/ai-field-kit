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

link_canonical() {
  if [ ! -f "$RULES_SRC" ]; then
    echo "❌ Rules file not found at: $RULES_SRC"
    exit 1
  fi

  mkdir -p "$CANON_DIR"

  # If a real file exists at canonical path, backup it
  backup_if_real_file "$CANON_FILE"

  # If a symlink exists (even wrong), replace it
  if [ -L "$CANON_FILE" ]; then
    rm -f "$CANON_FILE"
  fi

  ln -s "$RULES_SRC" "$CANON_FILE"
  echo "✅ Canonical rules linked: $CANON_FILE -> $RULES_SRC"
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

link_claude_imports() {
  local claude_dir="$HOME_DIR/.claude"
  local claude_file="$claude_dir/CLAUDE.md"
  local import_start="<!-- AFK:IMPORT:START -->"
  local import_end="<!-- AFK:IMPORT:END -->"
  local import_block

  mkdir -p "$claude_dir"

  link_claude_import_file "$CANON_FILE" "$claude_dir/AGENTS.md"

  import_block="$import_start
@AGENTS.md
$import_end"

  if [ -L "$claude_file" ]; then
    rm -f "$claude_file"
  fi

  if [ ! -f "$claude_file" ]; then
    printf "%s\n" "$import_block" > "$claude_file"
    echo "✅ Claude rules created with AFK import block: $claude_file"
    return
  fi

  if grep -q "$import_start" "$claude_file"; then
    local tmp
    tmp="$(mktemp)"
    awk -v start="$import_start" -v end="$import_end" -v block="$import_block" '
      index($0, start) {
        if (!replaced) {
          print block
          replaced = 1
        }
        in_block = 1
        next
      }
      index($0, end) {
        in_block = 0
        next
      }
      !in_block {
        print
      }
    ' "$claude_file" > "$tmp"
    mv "$tmp" "$claude_file"
    echo "✅ Claude AFK import block updated: $claude_file"
  else
    local tmp
    tmp="$(mktemp)"
    local first_local_line
    first_local_line="$(awk '/^@RTK\.md$/ || /^<!-- OMC:IMPORT:START -->/ {print NR; exit}' "$claude_file")"

    if [ -n "$first_local_line" ]; then
      local bak
      bak="$claude_file.bak.$(timestamp)"
      cp "$claude_file" "$bak"
      {
        printf "%s\n\n" "$import_block"
        tail -n +"$first_local_line" "$claude_file"
      } > "$tmp"
      mv "$tmp" "$claude_file"
      echo "✅ Claude AFK import block added and local imports preserved: $claude_file"
      echo "   ↳ 📦 Backed up previous Claude file to: $bak"
    else
      {
        printf "%s\n\n" "$import_block"
        cat "$claude_file"
      } > "$tmp"
      mv "$tmp" "$claude_file"
      echo "✅ Claude AFK import block prepended: $claude_file"
    fi
  fi
}

link_claude_import_file() {
  local src="$1"
  local dest="$2"

  backup_if_real_file "$dest"

  if [ -L "$dest" ]; then
    rm -f "$dest"
  fi

  ln -s "$src" "$dest"
  echo "✅ Claude import linked: $dest -> $src"
}

main() {
  ensure_repo
  link_canonical

  echo "▶ Linking rules into agents"

  # Gemini
  link_rule "$HOME_DIR/.gemini/GEMINI.md"

  # Codex
  link_rule "$HOME_DIR/.codex/AGENTS.md"

  # OpenCode
  link_rule "$HOME_DIR/.config/opencode/AGENTS.md"

  # Claude keeps a real CLAUDE.md so Claude-specific imports can coexist.
  link_claude_imports

  echo "✔ Done. Rules are now single-source via symlink."
  echo "ℹ️  Skills sync removed: you’re handling skills via npx skills + ~/.agents/skills."
}

main
