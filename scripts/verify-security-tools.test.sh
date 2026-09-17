#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_DIR"' EXIT
mkdir -p "$TEST_DIR/bin" "$TEST_DIR/repo/scripts" "$TEST_DIR/repo/apps/site/src"
cp "$ROOT_DIR/scripts/verify-security-tools.sh" "$TEST_DIR/repo/scripts/"

cat > "$TEST_DIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
printf 'synthetic linter diagnostic\n' >&2
exit "$TEST_LINT_STATUS"
STUB
cat > "$TEST_DIR/bin/gitleaks" <<'STUB'
#!/usr/bin/env bash
while [[ $# -gt 0 ]]; do
  if [[ "$1" = "--report-path" ]]; then
    printf '[{"RuleID":"afk-synthetic-secret","File":"fixture/secret.txt"}]\n' > "$2"
    break
  fi
  shift
done
exit 1
STUB
cat > "$TEST_DIR/bin/zizmor" <<'STUB'
#!/usr/bin/env bash
exit 14
STUB
chmod +x "$TEST_DIR/bin/"*

check_linter_status() {
  local lint_status="$1" expected_status="$2" expected_message="$3" status=0
  PATH="$TEST_DIR/bin:$PATH" TEST_LINT_STATUS="$lint_status" \
    bash "$TEST_DIR/repo/scripts/verify-security-tools.sh" > "$TEST_DIR/output" 2>&1 || status=$?
  if [[ "$status" -ne "$expected_status" ]] || ! grep -Fq "$expected_message" "$TEST_DIR/output"; then
    cat "$TEST_DIR/output" >&2
    printf 'unexpected scanner result for linter exit %s\n' "$lint_status" >&2
    exit 1
  fi
  if compgen -G "$TEST_DIR/repo/apps/site/src/security-lint-fixture-*.ts" > /dev/null; then
    printf 'scanner left a lint fixture behind\n' >&2
    exit 1
  fi
}

check_linter_status 0 1 'eslint accepted a synthetic debugger statement'
check_linter_status 1 0 'security tools rejected every synthetic unsafe fixture'
check_linter_status 2 1 'eslint failed to run (exit 2)'
grep -Fq 'synthetic linter diagnostic' "$TEST_DIR/output"
check_linter_status 127 1 'eslint failed to run (exit 127)'
printf 'scanner linter-exit regression tests passed\n'
