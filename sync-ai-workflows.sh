#!/usr/bin/env bash
set -euo pipefail

HOME_DIR="${HOME}"
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"
REPO_DIR="${AI_RULES_REPO:-$HOME_DIR/codes/ai-rules-workflows}"
NAMESPACE_DIR="afk"
ANTIGRAVITY_PREFIX="afk-"

# Source in repo
SRC_DIR="$REPO_DIR/workflows"

# Canonical store of raw markdown workflows
CANON_ROOT="$HOME_DIR/.agents/commands"
CANON_DIR="$CANON_ROOT/$NAMESPACE_DIR"

# Agent destination roots
ROOT_KILO="$HOME_DIR/.kilocode/workflows"
ROOT_CURSOR="$HOME_DIR/.cursor/commands"
ROOT_ANTIGRAVITY="$HOME_DIR/.gemini/antigravity/global_workflows"
ROOT_CLAUDE="$HOME_DIR/.claude/commands"
ROOT_GEMINI="$HOME_DIR/.gemini/commands"
ROOT_CODEX="$HOME_DIR/.codex/skills"

# Agent destinations
DEST_KILO="$ROOT_KILO/$NAMESPACE_DIR"
DEST_CURSOR="$ROOT_CURSOR/$NAMESPACE_DIR"
DEST_ANTIGRAVITY="$ROOT_ANTIGRAVITY/$NAMESPACE_DIR"
DEST_CLAUDE="$ROOT_CLAUDE/$NAMESPACE_DIR"
DEST_GEMINI="$ROOT_GEMINI/$NAMESPACE_DIR"
DEST_CODEX="$ROOT_CODEX/$NAMESPACE_DIR"

MANAGED_MARKER=".ai-field-kit-managed"

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

list_workflow_files() {
  find "$SRC_DIR" -maxdepth 1 -type f -name "*.md" | sort
}

normalize_root_dir() {
  local root="$1"

  mkdir -p "$(dirname "$root")"

  if [ -L "$root" ]; then
    rm -f "$root"
    mkdir -p "$root"
    echo "⚠️ Replaced legacy symlinked command directory with a real directory: $root"
    return
  fi

  if [ -e "$root" ] && [ ! -d "$root" ]; then
    echo "❌ Destination root exists and is not a directory: $root"
    exit 1
  fi

  mkdir -p "$root"
}

ensure_real_dir() {
  local dest="$1"
  local root
  root="$(dirname "$dest")"

  normalize_root_dir "$root"

  if [ -L "$dest" ]; then
    rm -f "$dest"
  fi

  if [ -e "$dest" ] && [ ! -d "$dest" ]; then
    echo "❌ Destination exists and is not a directory: $dest"
    exit 1
  fi

  mkdir -p "$dest"
}

ensure_workflows_exist() {
  if [ ! -d "$SRC_DIR" ]; then
    echo "❌ Workflows dir not found in repo: $SRC_DIR"
    exit 1
  fi

  if ! list_workflow_files | grep -q .; then
    echo "❌ No workflow markdown files found in: $SRC_DIR"
    exit 1
  fi
}

clear_managed_files() {
  local dest="$1"
  local manifest="$dest/$MANAGED_MARKER"

  ensure_real_dir "$dest"

  if [ -f "$manifest" ]; then
    while IFS= read -r rel_path; do
      [ -n "$rel_path" ] || continue
      rm -rf "$dest/$rel_path"
    done < "$manifest"
    rm -f "$manifest"
  fi
}

clear_legacy_root_managed_files() {
  local root="$1"
  local manifest="$root/$MANAGED_MARKER"

  normalize_root_dir "$root"

  if [ -f "$manifest" ]; then
    while IFS= read -r rel_path; do
      [ -n "$rel_path" ] || continue
      rm -f "$root/$rel_path"
    done < "$manifest"
    rm -f "$manifest"
    echo "✅ Removed legacy root-level managed entries from: $root"
  fi
}

clear_prefixed_entries() {
  local root="$1"
  local prefix="$2"

  normalize_root_dir "$root"

  find "$root" -maxdepth 1 \( -type f -o -type l \) -name "${prefix}*.md" -print0 | while IFS= read -r -d '' path; do
    rm -f "$path"
  done
}

to_title_case() {
  printf '%s' "$1" | sed 's/[-_]/ /g' | awk '
    {
      for (i = 1; i <= NF; i++) {
        $i = toupper(substr($i, 1, 1)) tolower(substr($i, 2))
      }
      print
    }
  '
}

append_managed_file() {
  local dest="$1"
  local rel_path="$2"
  echo "$rel_path" >> "$dest/$MANAGED_MARKER"
}

sync_symlinked_markdown_dir() {
  local dest="$1"
  local label="$2"

  clear_managed_files "$dest"
  : > "$dest/$MANAGED_MARKER"

  while IFS= read -r src; do
    local filename target
    filename="$(basename "$src")"
    target="$dest/$filename"

    if [ -e "$target" ] || [ -L "$target" ]; then
      echo "⚠️ Skipping existing unmanaged file: $target"
      continue
    fi

    ln -s "$src" "$target"
    append_managed_file "$dest" "$filename"
  done < <(list_workflow_files)

  echo "✅ Synced managed symlinks to $label: $dest"
}

sync_copied_markdown_dir() {
  local dest="$1"
  local label="$2"

  clear_managed_files "$dest"
  : > "$dest/$MANAGED_MARKER"

  while IFS= read -r src; do
    local filename target
    filename="$(basename "$src")"
    target="$dest/$filename"

    if [ -e "$target" ] || [ -L "$target" ]; then
      echo "⚠️ Skipping existing unmanaged file: $target"
      continue
    fi

    cp "$src" "$target"
    append_managed_file "$dest" "$filename"
  done < <(list_workflow_files)

  echo "✅ Synced managed copies to $label: $dest"
}

sync_antigravity_workflows() {
  local dest="$1"

  normalize_root_dir "$dest"
  clear_prefixed_entries "$dest" "$ANTIGRAVITY_PREFIX"

  while IFS= read -r src; do
    local filename target description escaped_description
    filename="${ANTIGRAVITY_PREFIX}$(basename "$src")"
    target="$dest/$filename"
    description="$(extract_description "$src")"
    escaped_description="$(escape_double_quotes "${description:-$(basename "$src" .md)}")"

    {
      printf -- '---\n'
      printf 'description: "%s"\n' "$escaped_description"
      printf -- '---\n\n'
      cat "$src"
    } > "$target"
  done < <(list_workflow_files)

  echo "✅ Synced Antigravity workflows with required frontmatter and afk- prefix: $dest"
}

sync_codex_skills() {
  local dest="$1"
  local legacy_root="$HOME_DIR/.codex/prompts"
  local legacy_dir="$legacy_root/$NAMESPACE_DIR"
  local legacy_manifest="$legacy_dir/$MANAGED_MARKER"

  clear_managed_files "$dest"
  : > "$dest/$MANAGED_MARKER"

  if [ -L "$legacy_dir" ]; then
    rm -f "$legacy_dir"
  elif [ -d "$legacy_dir" ]; then
    if [ -f "$legacy_manifest" ]; then
      while IFS= read -r rel_path; do
        [ -n "$rel_path" ] || continue
        rm -f "$legacy_dir/$rel_path"
      done < "$legacy_manifest"
      rm -f "$legacy_manifest"
    fi

    rmdir "$legacy_dir" 2>/dev/null || true
  fi

  clear_prefixed_entries "$legacy_root" "afk-"

  while IFS= read -r src; do
    local stem skill_dir skill_md agents_dir openai_yaml title description short_description
    stem="$(basename "$src" .md)"
    skill_dir="$dest/$stem"
    skill_md="$skill_dir/SKILL.md"
    agents_dir="$skill_dir/agents"
    openai_yaml="$agents_dir/openai.yaml"
    title="$(to_title_case "$stem")"
    description="$(extract_description "$src")"
    short_description="${description:-Workflow skill generated from /$stem.}"

    mkdir -p "$agents_dir"

    cat > "$skill_md" <<EOF
---
name: afk-$stem
description: $short_description
---

# AFK $title

This skill is generated from the AI Field Kit workflow \`/$stem\`.

Use it when the user wants this exact named operating procedure executed with the same checkpoints, guardrails, and output expectations defined below.

$(cat "$src")
EOF

    cat > "$openai_yaml" <<EOF
display_name: AFK $title
short_description: $short_description
default_prompt: Follow the AI Field Kit /$stem workflow for this project.
EOF

    append_managed_file "$dest" "$stem"
  done < <(list_workflow_files)

  echo "✅ Synced Codex skills generated from workflows: $dest"
}

escape_double_quotes() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

escape_toml_multiline() {
  sed 's/\\/\\\\/g; s/"/\\"/g' "$1"
}

extract_description() {
  awk '
    BEGIN {
      seen_heading = 0
      collecting = 0
      description = ""
      printed = 0
    }
    /^# / {
      seen_heading = 1
      next
    }
    seen_heading && /^## / {
      if (description != "") {
        print description
        printed = 1
        exit
      }
      next
    }
    seen_heading && /^```/ {
      next
    }
    seen_heading && /^$/ {
      if (collecting && description != "") {
        print description
        printed = 1
        exit
      }
      next
    }
    seen_heading && !collecting && $0 !~ /^#/ {
      collecting = 1
      description = $0
      next
    }
    collecting {
      description = description " " $0
    }
    END {
      if (!printed && description != "") {
        print description
      }
    }
  ' "$1" | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//'
}

sync_gemini_commands() {
  local dest="$1"

  clear_managed_files "$dest"
  : > "$dest/$MANAGED_MARKER"

  while IFS= read -r src; do
    local stem outfile description escaped_description
    stem="$(basename "$src" .md)"
    outfile="$dest/$stem.toml"
    description="$(extract_description "$src")"
    escaped_description="$(escape_double_quotes "${description:-$stem}")"

    {
      printf 'description = "%s"\n' "$escaped_description"
      printf 'prompt = """\n'
      escape_toml_multiline "$src"
      printf '\n"""\n'
    } > "$outfile"

    append_managed_file "$dest" "$(basename "$outfile")"
  done < <(list_workflow_files)

  echo "✅ Synced Gemini CLI commands: $dest"
}

main() {
  ensure_repo
  ensure_workflows_exist

  echo "▶ Normalizing command roots and cleaning legacy flat installs"
  clear_legacy_root_managed_files "$CANON_ROOT"
  clear_legacy_root_managed_files "$ROOT_KILO"
  clear_legacy_root_managed_files "$ROOT_CURSOR"
  clear_legacy_root_managed_files "$ROOT_ANTIGRAVITY"
  clear_legacy_root_managed_files "$ROOT_CLAUDE"
  clear_legacy_root_managed_files "$ROOT_GEMINI"
  clear_legacy_root_managed_files "$ROOT_CODEX"

  echo "▶ Linking canonical markdown workflows"
  sync_symlinked_markdown_dir "$CANON_DIR" "canonical store"

  echo "▶ Linking raw markdown workflow consumers"
  sync_symlinked_markdown_dir "$DEST_KILO" "KiloCode workflows"
  sync_symlinked_markdown_dir "$DEST_CURSOR" "Cursor commands"
  sync_symlinked_markdown_dir "$DEST_CLAUDE" "Claude Code commands"

  echo "▶ Syncing agent-specific command formats"
  sync_antigravity_workflows "$ROOT_ANTIGRAVITY"
  sync_codex_skills "$DEST_CODEX"
  sync_gemini_commands "$DEST_GEMINI"

  echo "✔ Done. AI Field Kit workflows now live in namespaced subfolders for most agents. Gemini CLI is rendered as TOML, Antigravity gets root-level afk-prefixed Markdown copies, Codex gets generated skills under ~/.codex/skills/afk/, and other supported agents use managed per-file symlinks."
}

main
