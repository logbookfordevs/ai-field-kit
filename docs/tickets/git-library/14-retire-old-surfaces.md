---
id: 14
title: Retire the old surfaces and update the docs
status: done
blocked_by: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13]
source: docs/specs/git-library.md — "What this retires" (L197-209); ADR 0012 Consequences
---

# 14 — Retire the old surfaces and update the docs

## What To Build
Remove what the library replaces: the Drive-hosted settings location and *Move current setup here* / *Load existing setup*, AFK folder ZIP export and import, the `~/.afk/backups` settings rotation, Kit sync's reinstall plan and `afk sync`, the old Kit and Installed Skills pages, and the code paths only they used. Update `docs/kit.md`, `docs/settings.md`, `docs/AGENTS.md`, `docs/development.md` and the `afk-cli` skill to the new model, and add a changelog entry under Next Release.

## Acceptance Criteria
- [x] Retired operations no longer appear in `afk manage describe` or the CLI help.
- [x] No dead code remains for the retired surfaces.
- [x] Docs and the `afk-cli` skill describe the library, backup, restore, agent folders and projects.
- [x] "Start a new library" (first run and Backup screen) runs the migration from the UI: preview, then apply, through new operations wrapping `planLibraryInit`/`applyLibraryInit` (gap found after ticket 09).
- [x] Adding an agent folder links tool skills too, not only stored skills (gap found after ticket 09).
- [x] All test suites, typecheck and lint pass.

## Blocked By
- All other tickets.

## Execution Bundle
- normal validation
- Test Seam: TDD skipped: removal and documentation; existing suites must stay green and retired operations must disappear from the operation catalog.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
