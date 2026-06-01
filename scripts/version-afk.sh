#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AFK_DIR="$ROOT_DIR/packages/afk"

if [[ $# -eq 0 ]]; then
  printf 'Usage: pnpm afk:version <patch|minor|major|x.y.z>\n' >&2
  exit 1
fi

package_name="$(node -p "require('$AFK_DIR/package.json').name")"
if [[ "$package_name" != "@logbookfordevs/afk" ]]; then
  printf 'Expected @logbookfordevs/afk, found %s\n' "$package_name" >&2
  exit 1
fi

cd "$AFK_DIR"
exec npm version "$@"
