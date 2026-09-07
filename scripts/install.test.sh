#!/usr/bin/env bash
set -euo pipefail

if [[ "$(basename "$0")" = "curl" ]]; then
  output_path=""
  write_format=""
  url=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -o)
        output_path="$2"
        shift 2
        ;;
      -w)
        write_format="$2"
        shift 2
        ;;
      -*)
        shift
        ;;
      *)
        url="$1"
        shift
        ;;
    esac
  done

  printf '%s\n' "$url" >> "$FAKE_CURL_LOG"

  case "$url" in
    https://api.github.com/*)
      printf 'curl: (22) The requested URL returned error: 403\n' >&2
      exit 22
      ;;
    https://github.com/logbookfordevs/ai-field-kit/releases/latest)
      [[ "$output_path" = "/dev/null" ]]
      [[ "$write_format" = "%{url_effective}" ]]
      printf 'https://github.com/logbookfordevs/ai-field-kit/releases/tag/v1.2.0'
      ;;
    https://github.com/logbookfordevs/ai-field-kit/releases/download/v1.2.0/afk-cli.tar.gz)
      cp "$FAKE_ARCHIVE" "$output_path"
      ;;
    https://github.com/logbookfordevs/ai-field-kit/releases/download/v1.2.0/afk-cli.tar.gz.sha256)
      printf '%s  afk-cli.tar.gz\n' "$FAKE_CHECKSUM"
      ;;
    *)
      printf 'unexpected curl URL: %s\n' "$url" >&2
      exit 1
      ;;
  esac

  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

FAKE_BIN="$TEST_DIR/bin"
FAKE_ARCHIVE="$TEST_DIR/afk-cli.tar.gz"
FAKE_CURL_LOG="$TEST_DIR/curl.log"
INSTALL_ROOT="$TEST_DIR/install"
BIN_DIR="$TEST_DIR/user-bin"
PAYLOAD_DIR="$TEST_DIR/payload"

mkdir -p "$FAKE_BIN" "$PAYLOAD_DIR/dist"
ln -s "$ROOT_DIR/scripts/install.test.sh" "$FAKE_BIN/curl"
printf '#!/usr/bin/env node\n' > "$PAYLOAD_DIR/dist/index.js"
tar -czf "$FAKE_ARCHIVE" -C "$PAYLOAD_DIR" .
FAKE_CHECKSUM="$(shasum -a 256 "$FAKE_ARCHIVE" | awk '{print $1}')"
export FAKE_ARCHIVE FAKE_CHECKSUM FAKE_CURL_LOG

if ! install_output="$(
  PATH="$FAKE_BIN:$PATH" \
  AFK_INSTALL_ROOT="$INSTALL_ROOT" \
  AFK_BIN_DIR="$BIN_DIR" \
  bash "$ROOT_DIR/scripts/install.sh" 2>&1
)"; then
  printf '%s\n' "$install_output" >&2
  exit 1
fi

if grep -q 'api.github.com' "$FAKE_CURL_LOG"; then
  printf 'installer must not use the rate-limited GitHub REST API\n' >&2
  exit 1
fi

grep -q 'https://github.com/logbookfordevs/ai-field-kit/releases/latest' "$FAKE_CURL_LOG"
grep -q 'https://github.com/logbookfordevs/ai-field-kit/releases/download/v1.2.0/afk-cli.tar.gz' "$FAKE_CURL_LOG"
test -f "$INSTALL_ROOT/releases/v1.2.0/dist/index.js"
test -x "$BIN_DIR/afk"

printf 'install.sh latest release redirect test passed\n'
