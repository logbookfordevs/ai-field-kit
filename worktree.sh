#!/usr/bin/env bash
set -euo pipefail

ROOT="${WORKTREES_ROOT:-$HOME/.agents/worktrees}"
LOG_FILE="$ROOT/wt-last.log"

mkdir -p "$ROOT"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "------"
echo "wt start: $(date)"
echo "pwd: $(pwd)"
echo "shell: ${SHELL:-unknown}"
echo "log: $LOG_FILE"

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "❌ Not inside a git repository."
  exit 1
}

echo "Repo: $repo_root"
read -r -p "Worktree name (folder slug): " wt_name
wt_name="${wt_name// /-}"

[ -n "$wt_name" ] || { echo "❌ Worktree name is required."; exit 1; }

read -r -p "Existing branch/ref to use: " branch_ref
[ -n "$branch_ref" ] || { echo "❌ Branch/ref is required."; exit 1; }

wt_dir="$ROOT/$wt_name"
if [ -e "$wt_dir" ]; then
  echo "❌ Target path already exists: $wt_dir"
  exit 1
fi

echo "▶ Fetching..."
git fetch --all --prune

echo "▶ Verifying ref exists..."
git rev-parse --verify "$branch_ref" >/dev/null 2>&1 || {
  echo "❌ Branch/ref not found locally: $branch_ref"
  echo "   Tip: try 'origin/<branch>' or 'git fetch origin <branch>:<branch>'"
  exit 1
}

echo "▶ Creating worktree: $wt_dir from $branch_ref"
git worktree add "$wt_dir" "$branch_ref"

echo "▶ Bootstrapping..."
(
  cd "$wt_dir"

  if command -v npm >/dev/null 2>&1; then
    npm install
  else
    echo "⚠️ npm not found, skipping npm install"
  fi

  git submodule sync --recursive || true
  git submodule update --init --recursive || true
)

echo "✅ Done."
echo ""
echo "Next:"
echo "cd \"$wt_dir\""

# Optional: open macOS Terminal at the worktree dir
if command -v open >/dev/null 2>&1; then
  read -r -p "Open macOS Terminal at this worktree? (y/N): " ans
  if [[ "${ans:-}" =~ ^[Yy]$ ]]; then
    open -a Terminal "$wt_dir"
  fi
fi

echo ""
echo "✅ Worktree ready at:"
echo "👉 $WT_PATH"
echo ""

cd "$WT_PATH"