#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$ROOT_DIR/packages/afk"
BIN_DIR="${AFK_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/afk"
TARGET="$PACKAGE_DIR/dist/index.js"

info() {
  printf '▶ %s\n' "$1"
}

success() {
  printf '✓ %s\n' "$1"
}

fail() {
  printf '✗ %s\n' "$1" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required. Install pnpm or enable it with corepack."

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js >= 20 is required. Current version: $(node --version)"
fi

info "Installing AFK CLI dependencies"
pnpm --dir "$PACKAGE_DIR" install

info "Building AFK CLI"
pnpm --dir "$PACKAGE_DIR" run build
chmod +x "$TARGET"

mkdir -p "$BIN_DIR"

if [ -e "$BIN_PATH" ] || [ -L "$BIN_PATH" ]; then
  CURRENT_TARGET="$(readlink "$BIN_PATH" 2>/dev/null || true)"
  if [ "$CURRENT_TARGET" != "$TARGET" ]; then
    if [ "${AFK_INSTALL_FORCE:-}" != "1" ]; then
      fail "$BIN_PATH already exists and is not managed by this checkout. Re-run with AFK_INSTALL_FORCE=1 to replace it."
    fi
    rm -f "$BIN_PATH"
  else
    rm -f "$BIN_PATH"
  fi
fi

ln -s "$TARGET" "$BIN_PATH"

success "AFK CLI installed at $BIN_PATH"

if ! command -v afk >/dev/null 2>&1; then
  printf '\n%s\n' "$BIN_DIR is not on your PATH yet."
  printf '%s\n' "Add this to your shell profile:"
  printf '\n  export PATH="%s:\$PATH"\n\n' "$BIN_DIR"
else
  printf '\n'
  afk --help
fi
