---
id: 06
title: First run, library start and restore
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "States and ranges" (first run), "Layout and interaction" (library start); docs/specs/afk-app-redesign/prototype.html first run; Git library spec "First run", "Restore"
---

# 06 — First run, library start and restore

## What To Build
The first-run flow: Restore my library / Start a new library / Skip (skips the backup only). Library start preview with one summary line, headed groups with counts and plain descriptions, names behind Show names, and path cards; apply; done screen pointing to Backup. Restore: pick a repository (GitHub list or URL), progress, tool approval, summary of moved-aside copies. Empty-machine case shows only the backup choice.

## Acceptance Criteria
- [ ] Preview, apply and restore use the existing operations; Skip never leaves a machine without a library.
- [ ] 84+ skill names never render as running prose.
- [ ] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for each first-run branch (empty machine, existing setup, restore) with mocked operations.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
