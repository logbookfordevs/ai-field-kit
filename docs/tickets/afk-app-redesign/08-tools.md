---
id: 08
title: Tools
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Scope" (Tools); PRODUCT.md principle "Label copied commands separately from commands that execute"
---

# 08 — Tools

## What To Build
Tools page with everything AFK does today: add a tool (name, install command, update command, provided skills), edit, remove, run install and run update with live output and result, last-run state per tool, provided skills, and copying a command kept visually distinct from running it.

## Acceptance Criteria
- [ ] Add, edit, remove, run install and run update use the existing operations.
- [ ] Run output streams while running and stays readable after.
- [ ] Copy and run are distinct controls with distinct labels.
- [ ] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for add/edit validation and run output rendering with a mocked client.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
