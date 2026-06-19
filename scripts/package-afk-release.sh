#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AFK_DIR="$ROOT_DIR/packages/afk"
OUT_DIR="${AFK_RELEASE_OUT_DIR:-$ROOT_DIR/.release}"
ASSET_NAME="${AFK_RELEASE_ASSET:-afk-cli.tar.gz}"
ASSET_PATH="$OUT_DIR/$ASSET_NAME"

info() {
  printf '\033[1;36m%s\033[0m %s\n' "afk" "$1"
}

fail() {
  printf '\033[1;31m%s\033[0m %s\n' "afk" "$1" >&2
  exit 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  fail "pnpm is required to package AFK"
fi

info "installing AFK package dependencies"
pnpm --dir "$AFK_DIR" install

info "building AFK package"
pnpm --dir "$AFK_DIR" run build

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

package_dir="$tmp_dir/package"
info "deploying production package"
pnpm --dir "$ROOT_DIR" --filter @logbookfordevs/afk deploy --prod --legacy "$package_dir"
chmod +x "$package_dir/dist/index.js"

mkdir -p "$OUT_DIR"
tar -czf "$ASSET_PATH" -C "$package_dir" .

if [[ "$(uname -s)" = "Darwin" ]]; then
  checksum="$(shasum -a 256 "$ASSET_PATH" | awk '{print $1}')"
else
  checksum="$(sha256sum "$ASSET_PATH" | awk '{print $1}')"
fi

printf '%s  %s\n' "$checksum" "$ASSET_NAME" > "$ASSET_PATH.sha256"

info "created $ASSET_PATH"
info "created $ASSET_PATH.sha256"
