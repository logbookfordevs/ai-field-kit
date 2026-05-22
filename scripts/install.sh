#!/usr/bin/env bash
set -euo pipefail

REPO="${AFK_INSTALL_REPO:-leoreisdias/ai-rules-workflows}"
VERSION="${AFK_INSTALL_VERSION:-latest}"
ASSET_NAME="${AFK_INSTALL_ASSET:-afk-cli.tar.gz}"
INSTALL_ROOT="${AFK_INSTALL_ROOT:-$HOME/.local/share/afk}"
BIN_DIR="${AFK_BIN_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/afk"
LOCAL_MODE=0

info() {
  printf '\033[1;36m%s\033[0m %s\n' "afk" "$1"
}

fail() {
  printf '\033[1;31m%s\033[0m %s\n' "afk" "$1" >&2
  exit 1
}

usage() {
  cat <<'USAGE'
Usage: install.sh [options]

Installs AFK from a GitHub Release asset without cloning the repository.

Options:
  --version <tag>         Release tag to install. Defaults to latest.
  --repo <owner/name>     GitHub repository to install from.
  --asset <name>          Release asset name. Defaults to afk-cli.tar.gz.
  --install-root <path>   Directory where AFK releases are stored.
  --bin-dir <path>        Directory where the afk symlink is written.
  --local                 Link the current checkout's packages/afk/dist/index.js.
  -h, --help              Show this help and exit.

Environment:
  AFK_INSTALL_REPO        Same as --repo.
  AFK_INSTALL_VERSION     Same as --version.
  AFK_INSTALL_ASSET       Same as --asset.
  AFK_INSTALL_ROOT        Same as --install-root.
  AFK_BIN_DIR             Same as --bin-dir.

Examples:
  curl -fsSL https://raw.githubusercontent.com/leoreisdias/ai-rules-workflows/main/scripts/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/leoreisdias/ai-rules-workflows/main/scripts/install.sh | bash -s -- --version v0.5.1
  ./scripts/install.sh --local
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      [[ -n "${2:-}" ]] || fail "--version requires a value"
      VERSION="$2"
      shift 2
      ;;
    --version=*)
      VERSION="${1#--version=}"
      [[ -n "$VERSION" ]] || fail "--version requires a value"
      shift
      ;;
    --repo)
      [[ -n "${2:-}" ]] || fail "--repo requires a value"
      REPO="$2"
      shift 2
      ;;
    --repo=*)
      REPO="${1#--repo=}"
      [[ -n "$REPO" ]] || fail "--repo requires a value"
      shift
      ;;
    --asset)
      [[ -n "${2:-}" ]] || fail "--asset requires a value"
      ASSET_NAME="$2"
      shift 2
      ;;
    --asset=*)
      ASSET_NAME="${1#--asset=}"
      [[ -n "$ASSET_NAME" ]] || fail "--asset requires a value"
      shift
      ;;
    --install-root)
      [[ -n "${2:-}" ]] || fail "--install-root requires a value"
      INSTALL_ROOT="$2"
      shift 2
      ;;
    --install-root=*)
      INSTALL_ROOT="${1#--install-root=}"
      [[ -n "$INSTALL_ROOT" ]] || fail "--install-root requires a value"
      shift
      ;;
    --bin-dir)
      [[ -n "${2:-}" ]] || fail "--bin-dir requires a value"
      BIN_DIR="$2"
      BIN_PATH="$BIN_DIR/afk"
      shift 2
      ;;
    --bin-dir=*)
      BIN_DIR="${1#--bin-dir=}"
      [[ -n "$BIN_DIR" ]] || fail "--bin-dir requires a value"
      BIN_PATH="$BIN_DIR/afk"
      shift
      ;;
    --local)
      LOCAL_MODE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

find_local_root() {
  if [[ -z "${BASH_SOURCE[0]:-}" || "${BASH_SOURCE[0]}" = "/dev/stdin" || "${BASH_SOURCE[0]}" = "bash" ]]; then
    return 1
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local root_dir
  root_dir="$(cd "$script_dir/.." && pwd)"

  if [[ -d "$root_dir/packages/afk" ]]; then
    printf '%s' "$root_dir"
    return 0
  fi

  return 1
}

link_entrypoint() {
  local entry_path="$1"

  if [[ ! -f "$entry_path" ]]; then
    fail "could not find CLI entrypoint at $entry_path"
  fi

  chmod +x "$entry_path"
  mkdir -p "$BIN_DIR"
  ln -sfn "$entry_path" "$BIN_PATH"

  info "linked $BIN_PATH -> $entry_path"

  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
      info "$BIN_DIR is not in PATH for this shell"
      info "add this to your shell config: export PATH=\"$BIN_DIR:\$PATH\""
      ;;
  esac

  info "ready: $(command -v afk 2>/dev/null || printf '%s' "$BIN_PATH")"
}

if [[ "$LOCAL_MODE" -eq 1 ]]; then
  LOCAL_ROOT="$(find_local_root)" || fail "--local must be run from this repository checkout"
  info "using local checkout at $LOCAL_ROOT"
  if ! command -v pnpm >/dev/null 2>&1; then
    fail "pnpm is required for --local installs"
  fi
  info "installing local AFK package dependencies"
  pnpm --dir "$LOCAL_ROOT/packages/afk" install
  info "building local AFK package"
  pnpm --dir "$LOCAL_ROOT/packages/afk" run build
  link_entrypoint "$LOCAL_ROOT/packages/afk/dist/index.js"
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to install AFK"
fi

if ! command -v tar >/dev/null 2>&1; then
  fail "tar is required to install AFK"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node is required to run AFK"
fi

if [[ "$VERSION" = "latest" ]]; then
  info "fetching latest release"
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
  [[ -n "$VERSION" ]] || fail "could not resolve latest release for $REPO"
fi

case "$VERSION" in
  v*) ;;
  *) VERSION="v$VERSION" ;;
esac

asset_url="https://github.com/$REPO/releases/download/$VERSION/$ASSET_NAME"
checksum_url="$asset_url.sha256"
release_dir="$INSTALL_ROOT/releases/$VERSION"
tmp_dir="$(mktemp -d)"
archive_path="$tmp_dir/$ASSET_NAME"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

info "downloading $REPO $VERSION"
curl -fL -o "$archive_path" "$asset_url"

if checksum_text="$(curl -fsSL "$checksum_url" 2>/dev/null)"; then
  expected_checksum="$(printf '%s\n' "$checksum_text" | awk '{print $1}' | head -n 1)"
  if [[ -n "$expected_checksum" ]]; then
    if [[ "$(uname -s)" = "Darwin" ]]; then
      actual_checksum="$(shasum -a 256 "$archive_path" | awk '{print $1}')"
    else
      actual_checksum="$(sha256sum "$archive_path" | awk '{print $1}')"
    fi

    if [[ "$actual_checksum" != "$expected_checksum" ]]; then
      fail "checksum verification failed"
    fi

    info "SHA256 verified"
  fi
else
  info "checksum asset not found; continuing without SHA256 verification"
fi

rm -rf "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"

entry_path="$release_dir/dist/index.js"
if [[ ! -f "$entry_path" ]]; then
  entry_path="$(find "$release_dir" -maxdepth 4 -path '*/dist/index.js' -type f | head -n 1)"
fi

[[ -n "$entry_path" ]] || fail "release asset did not contain dist/index.js"

link_entrypoint "$entry_path"
