#!/usr/bin/env bash
set -euo pipefail

# --------------------
# CONFIG
# --------------------
REPO_URL="https://github.com/leoreisdias/ai-rules-workflows.git"
REPO_DIR="${AI_RULES_REPO:-$HOME/codes/ai-rules-workflows}"

SRC_WORKFLOWS_DIR="$REPO_DIR/workflows"

# Destinations (user-scoped)
DEST_KILO="$HOME/.kilocode/workflows"
DEST_CURSOR="$HOME/.cursor/commands"
DEST_GEMINI="$HOME/.gemini/commands"
DEST_CODEX="$HOME/.codex/skills"

DELETE_MODE="false"
DRY_RUN="false"

for arg in "$@"; do
  case "$arg" in
    --delete) DELETE_MODE="true" ;;   # remove generated outputs not present anymore
    --dry-run) DRY_RUN="true" ;;      # show actions without writing
    *)
      echo "Unknown arg: $arg"
      echo "Usage: $0 [--dry-run] [--delete]"
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
    run "mkdir -p \"$(dirname "$REPO_DIR")\""
    run "git clone \"$REPO_URL\" \"$REPO_DIR\""
  else
    echo "▶ Repo found. Pulling latest..."
    run "git -C \"$REPO_DIR\" pull --ff-only"
  fi
}

# Normalize a filename to a safe skill/command name:
# - lowercase
# - spaces to hyphen
# - keep a-z0-9-_ only
normalize_name() {
  local s="$1"
  s="$(echo "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(echo "$s" | sed -E 's/[[:space:]]+/-/g')"
  s="$(echo "$s" | sed -E 's/[^a-z0-9_-]+/-/g; s/-+/-/g; s/^-|-$//g')"
  echo "$s"
}

# Extract a best-effort description:
# - first non-empty line that is not a markdown heading marker only
# - strip leading markdown tokens (#, -, *)
extract_description() {
  local file="$1"
  local line
  line="$(grep -m 1 -E '^[[:space:]]*[^[:space:]].*' "$file" || true)"
  line="$(echo "$line" | sed -E 's/^[[:space:]]*(#+|\-|\*)[[:space:]]*//')"
  line="$(echo "$line" | tr -d '\r')"
  if [ -z "${line:-}" ]; then
    echo "Generated workflow"
  else
    # cap length to avoid stupidly long descriptions
    echo "$line" | cut -c1-140
  fi
}

escape_toml_string() {
  # Escape double quotes and backslashes for TOML basic strings
  echo "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

sync_kilo_and_cursor() {
  run "mkdir -p \"$DEST_KILO\" \"$DEST_CURSOR\""

  # copy md as-is
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    run "cp \"$f\" \"$DEST_KILO/$base\""
    run "cp \"$f\" \"$DEST_CURSOR/$base\""
  done < <(find "$SRC_WORKFLOWS_DIR" -maxdepth 1 -type f -name "*.md" -print0)
}

generate_gemini_commands() {
  run "mkdir -p \"$DEST_GEMINI\""

  # Each workflow.md -> ~/.gemini/commands/<name>.toml
  while IFS= read -r -d '' f; do
    filename="$(basename "$f")"
    stem="${filename%.md}"
    name="$(normalize_name "$stem")"
    desc="$(extract_description "$f")"
    desc_escaped="$(escape_toml_string "$desc")"

    out="$DEST_GEMINI/$name.toml"

    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] write $out"
    else
      # Build TOML:
      # description="..."
      # prompt = """..."""
      {
        echo "description=\"$desc_escaped\""
        echo "prompt = \"\"\""
        cat "$f"
        echo ""
        echo "\"\"\""
      } > "$out"
    fi
  done < <(find "$SRC_WORKFLOWS_DIR" -maxdepth 1 -type f -name "*.md" -print0)
}

generate_codex_skills() {
  run "mkdir -p \"$DEST_CODEX\""

  # Each workflow.md -> ~/.codex/skills/<skill-name>/SKILL.md
  while IFS= read -r -d '' f; do
    filename="$(basename "$f")"
    stem="${filename%.md}"
    skill="$(normalize_name "$stem")"
    desc="$(extract_description "$f")"

    skill_dir="$DEST_CODEX/$skill"
    out="$skill_dir/SKILL.md"

    run "mkdir -p \"$skill_dir\""

    if [ "$DRY_RUN" = "true" ]; then
      echo "[dry-run] write $out"
    else
      {
        echo "---"
        echo "name: $skill"
        echo "description: $desc"
        echo "metadata:"
        echo "  short-description: $desc"
        echo "---"
        echo ""
        cat "$f"
        echo ""
      } > "$out"
    fi
  done < <(find "$SRC_WORKFLOWS_DIR" -maxdepth 1 -type f -name "*.md" -print0)
}

delete_extras() {
  # Removes files generated previously that no longer have a matching source .md.
  # Only deletes what this script generates (gemini *.toml, codex skill folders, kilo/cursor *.md copies).

  # Build set of current names
  mapfile -t stems < <(find "$SRC_WORKFLOWS_DIR" -maxdepth 1 -type f -name "*.md" -printf "%f\n" | sed 's/\.md$//' | sort)

  # Helper: check membership
  has_stem() {
    local s="$1"
    for x in "${stems[@]}"; do
      if [ "$x" = "$s" ]; then return 0; fi
    done
    return 1
  }

  # Kilo/Cursor: remove orphan *.md that match former sources
  for d in "$DEST_KILO" "$DEST_CURSOR"; do
    [ -d "$d" ] || continue
    while IFS= read -r -d '' p; do
      base="$(basename "$p")"
      stem="${base%.md}"
      # only delete if stem isn't in source set and file exists
      if ! has_stem "$stem"; then
        run "rm -f \"$p\""
      fi
    done < <(find "$d" -maxdepth 1 -type f -name "*.md" -print0)
  done

  # Gemini: delete orphan *.toml based on normalized names
  if [ -d "$DEST_GEMINI" ]; then
    while IFS= read -r -d '' p; do
      base="$(basename "$p")"
      name="${base%.toml}"
      # if no source normalizes to this, delete
      keep="false"
      for s in "${stems[@]}"; do
        if [ "$(normalize_name "$s")" = "$name" ]; then
          keep="true"; break
        fi
      done
      if [ "$keep" = "false" ]; then
        run "rm -f \"$p\""
      fi
    done < <(find "$DEST_GEMINI" -maxdepth 1 -type f -name "*.toml" -print0)
  fi

  # Codex: delete skill folders whose name doesn't match any normalized source stem
  if [ -d "$DEST_CODEX" ]; then
    while IFS= read -r -d '' p; do
      skill="$(basename "$p")"
      keep="false"
      for s in "${stems[@]}"; do
        if [ "$(normalize_name "$s")" = "$skill" ]; then
          keep="true"; break
        fi
      done
      if [ "$keep" = "false" ]; then
        run "rm -rf \"$p\""
      fi
    done < <(find "$DEST_CODEX" -mindepth 1 -maxdepth 1 -type d -print0)
  fi
}

main() {
  ensure_repo

  if [ ! -d "$SRC_WORKFLOWS_DIR" ]; then
    echo "❌ Source workflows dir not found: $SRC_WORKFLOWS_DIR"
    exit 1
  fi

  echo "▶ Syncing from: $SRC_WORKFLOWS_DIR"
  echo "   Kilo ->   $DEST_KILO"
  echo "   Cursor -> $DEST_CURSOR"
  echo "   Gemini -> $DEST_GEMINI (generated .toml)"
  echo "   Codex ->  $DEST_CODEX (generated skills)"

  sync_kilo_and_cursor
  generate_gemini_commands
  generate_codex_skills

  if [ "$DELETE_MODE" = "true" ]; then
    echo "▶ Deleting extras not present in source..."
    delete_extras
  fi

  echo "✔ Done."
  if [ "$DRY_RUN" = "true" ]; then
    echo "ℹ️  Dry run mode: nothing was written."
  fi
}

main
