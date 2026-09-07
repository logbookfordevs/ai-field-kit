#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="$(mktemp -d)"
LINT_FIXTURE="$ROOT_DIR/apps/site/src/security-lint-fixture-$$.js"

cleanup() {
  rm -rf "$FIXTURE_DIR"
  rm -f "$LINT_FIXTURE"
}
trap cleanup EXIT

printf 'debugger;\n' > "$LINT_FIXTURE"
set +e
pnpm --dir "$ROOT_DIR" exec eslint "$LINT_FIXTURE" >/dev/null 2>&1
lint_status=$?
set -e
if [[ $lint_status -ne 1 ]]; then
  printf 'eslint accepted a synthetic debugger statement\n' >&2
  exit 1
fi

printf '%s\n' \
  '[[rules]]' \
  'id = "afk-synthetic-secret"' \
  'description = "AFK scanner self-test marker"' \
  "regex = '''AFK_SYNTHETIC_SECRET_[A-Z0-9]{24}'''" \
  > "$FIXTURE_DIR/gitleaks.toml"
printf 'AFK_SYNTHETIC_SECRET_7H3K9M2Q5R8T4V6X1Z0N3P7D\n' > "$FIXTURE_DIR/secret.txt"
set +e
gitleaks dir "$FIXTURE_DIR" \
  --config "$FIXTURE_DIR/gitleaks.toml" \
  --no-banner \
  --redact \
  --report-format json \
  --report-path "$FIXTURE_DIR/gitleaks-report.json" \
  >/dev/null 2>&1
gitleaks_status=$?
set -e
if [[ $gitleaks_status -ne 1 ]] ||
  ! jq -e 'any(.[]; .RuleID == "afk-synthetic-secret" and (.File | endswith("/secret.txt")))' "$FIXTURE_DIR/gitleaks-report.json" >/dev/null; then
  printf 'gitleaks did not detect the synthetic credentials fixture\n' >&2
  exit 1
fi

mkdir -p "$FIXTURE_DIR/.github/workflows"
printf '%s\n' \
  'name: Unsafe' \
  'on: push' \
  'jobs:' \
  '  unsafe:' \
  '    runs-on: ubuntu-latest' \
  '    steps:' \
  '      - uses: actions/checkout@v4' \
  > "$FIXTURE_DIR/.github/workflows/unsafe.yml"
set +e
zizmor --offline "$FIXTURE_DIR/.github/workflows/unsafe.yml" >/dev/null 2>&1
zizmor_status=$?
set -e
if [[ $zizmor_status -ne 14 ]]; then
  printf 'zizmor accepted a synthetic unpinned action\n' >&2
  exit 1
fi

printf 'security tools rejected every synthetic unsafe fixture\n'
