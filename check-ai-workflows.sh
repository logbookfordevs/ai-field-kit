#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${AI_RULES_REPO:-$HOME/codes/ai-rules-workflows}"
SRC_WORKFLOWS_DIR="$REPO_DIR/workflows"

DEST_KILO="$HOME/.kilocode/workflows"
DEST_CURSOR="$HOME/.cursor/commands"
DEST_GEMINI="$HOME/.gemini/commands"
DEST_CODEX="$HOME/.codex/skills"

normalize_name() {
  local s="$1"
  s="$(echo "$s" | tr '[:upper:]' '[:lower:]')"
  s="$(echo "$s" | sed -E 's/[[:space:]]+/-/g')"
  s="$(echo "$s" | sed -E 's/[^a-z0-9_-]+/-/g; s/-+/-/g; s/^-|-$//g')"
  echo "$s"
}

extract_description() {
  local file="$1"
  local line
  line="$(grep -m 1 -E '^[[:space:]]*[^[:space:]].*' "$file" || true)"
  line="$(echo "$line" | sed -E 's/^[[:space:]]*(#+|\-|\*)[[:space:]]*//')"
  line="$(echo "$line" | tr -d '\r')"
  if [ -z "${line:-}" ]; then
    echo "Generated workflow"
  else
    echo "$line" | cut -c1-140
  fi
}

escape_toml_string() {
  echo "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

sha256_stdin() {
  shasum -a 256 | awk '{print $1}'
}

gen_gemini_toml() {
  local md="$1"
  local raw_desc desc
  raw_desc="$(extract_description "$md")"
  desc="$(escape_toml_string "$raw_desc")"
  {
    echo "description=\"$desc\""
    echo "prompt = \"\"\""
    cat "$md"
    echo ""
    echo "\"\"\""
  }
}

gen_codex_skill_md() {
  local md="$1"
  local skill="$2"
  local desc
  desc="$(extract_description "$md")"
  {
    echo "---"
    echo "name: $skill"
    echo "description: $desc"
    echo "metadata:"
    echo "  short-description: $desc"
    echo "---"
    echo ""
    cat "$md"
    echo ""
  }
}

status_ok=0
status_warn=0
status_fail=0
ok()   { echo "✅ $*"; status_ok=$((status_ok+1)); }
warn() { echo "⚠️  $*"; status_warn=$((status_warn+1)); }
fail() { echo "❌ $*"; status_fail=$((status_fail+1)); }

print_header() {
  echo ""
  echo "🔍 $1"
  echo "--------------------------------"
}

echo "🔍 AI Workflows check"
echo "Repo: $REPO_DIR"
echo "Source workflows: $SRC_WORKFLOWS_DIR"
echo "Targets:"
echo "  Kilo:   $DEST_KILO"
echo "  Cursor: $DEST_CURSOR"
echo "  Gemini: $DEST_GEMINI"
echo "  Codex:  $DEST_CODEX"

if [ ! -d "$REPO_DIR/.git" ]; then
  fail "Source repo not found at $REPO_DIR (set AI_RULES_REPO or clone it)"
  exit 1
fi

if [ ! -d "$SRC_WORKFLOWS_DIR" ]; then
  fail "Source workflows dir not found: $SRC_WORKFLOWS_DIR"
  exit 1
fi

print_header "Per-workflow verification"

# BSD find compatible list: print basenames, sort
src_files="$(find "$SRC_WORKFLOWS_DIR" -maxdepth 1 -type f -name "*.md" -exec basename {} \; | sort)"

# iterate line-by-line
while IFS= read -r f; do
  [ -n "$f" ] || continue

  src="$SRC_WORKFLOWS_DIR/$f"
  stem="${f%.md}"
  norm="$(normalize_name "$stem")"

  # KILO
  kilo="$DEST_KILO/$f"
  if [ -f "$kilo" ]; then
    if [ "$(sha256_file "$src")" = "$(sha256_file "$kilo")" ]; then
      ok "Kilo in sync: $f"
    else
      warn "Kilo OUT OF DATE: $f"
    fi
  else
    fail "Kilo missing: $f"
  fi

  # CURSOR
  cursor="$DEST_CURSOR/$f"
  if [ -f "$cursor" ]; then
    if [ "$(sha256_file "$src")" = "$(sha256_file "$cursor")" ]; then
      ok "Cursor in sync: $f"
    else
      warn "Cursor OUT OF DATE: $f"
    fi
  else
    fail "Cursor missing: $f"
  fi

  # GEMINI (generated toml)
  gem="$DEST_GEMINI/$norm.toml"
  if [ -f "$gem" ]; then
    expected_hash="$(gen_gemini_toml "$src" | sha256_stdin)"
    actual_hash="$(sha256_file "$gem")"
    if [ "$expected_hash" = "$actual_hash" ]; then
      ok "Gemini in sync: $norm.toml"
    else
      warn "Gemini OUT OF DATE: $norm.toml"
    fi
  else
    fail "Gemini missing: $norm.toml (from $f)"
  fi

  # CODEX (generated SKILL.md)
  skill_md="$DEST_CODEX/$norm/SKILL.md"
  if [ -f "$skill_md" ]; then
    expected_hash="$(gen_codex_skill_md "$src" "$norm" | sha256_stdin)"
    actual_hash="$(sha256_file "$skill_md")"
    if [ "$expected_hash" = "$actual_hash" ]; then
      ok "Codex in sync: $norm/SKILL.md"
    else
      warn "Codex OUT OF DATE: $norm/SKILL.md"
    fi
  else
    fail "Codex missing: $norm/SKILL.md (from $f)"
  fi

done <<< "$src_files"

print_header "Orphans check (extras in targets not present in repo)"

# Orphans in Kilo
if [ -d "$DEST_KILO" ]; then
  while IFS= read -r base; do
    [ -n "$base" ] || continue
    if [ ! -f "$SRC_WORKFLOWS_DIR/$base" ]; then
      warn "Orphan in Kilo: $base"
    fi
  done < <(find "$DEST_KILO" -maxdepth 1 -type f -name "*.md" -exec basename {} \; | sort)
fi

# Orphans in Cursor
if [ -d "$DEST_CURSOR" ]; then
  while IFS= read -r base; do
    [ -n "$base" ] || continue
    if [ ! -f "$SRC_WORKFLOWS_DIR/$base" ]; then
      warn "Orphan in Cursor: $base"
    fi
  done < <(find "$DEST_CURSOR" -maxdepth 1 -type f -name "*.md" -exec basename {} \; | sort)
fi

# Orphans in Gemini
if [ -d "$DEST_GEMINI" ]; then
  while IFS= read -r base; do
    [ -n "$base" ] || continue
    name="${base%.toml}"
    keep="false"
    while IFS= read -r f; do
      stem="${f%.md}"
      if [ "$(normalize_name "$stem")" = "$name" ]; then
        keep="true"; break
      fi
    done <<< "$src_files"
    if [ "$keep" = "false" ]; then
      warn "Orphan in Gemini: $base"
    fi
  done < <(find "$DEST_GEMINI" -maxdepth 1 -type f -name "*.toml" -exec basename {} \; | sort)
fi

# Orphans in Codex
if [ -d "$DEST_CODEX" ]; then
  while IFS= read -r skill; do
    [ -n "$skill" ] || continue
    keep="false"
    while IFS= read -r f; do
      stem="${f%.md}"
      if [ "$(normalize_name "$stem")" = "$skill" ]; then
        keep="true"; break
      fi
    done <<< "$src_files"
    if [ "$keep" = "false" ]; then
      warn "Orphan in Codex skills: $skill/"
    fi
  done < <(find "$DEST_CODEX" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)
fi

print_header "Summary"
echo "✅ OK:   $status_ok"
echo "⚠️  WARN: $status_warn"
echo "❌ FAIL: $status_fail"

if [ "$status_fail" -gt 0 ]; then
  exit 1
fi
exit 0
