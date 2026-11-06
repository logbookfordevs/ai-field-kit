---
id: 07
title: Backup
status: done
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Direction" (Backup in navigation); Git library spec "Save", "Local checks"
---

# 07 — Backup

## What To Build
Backup page: connect a remote or create a private GitHub repository, save state (saved, waiting, failed) with Save now, what is and isn't in the backup, Needs attention items with their actions, and history with Go back.

## Acceptance Criteria
- [x] All backup operations reachable; states saved, waiting, failed and off are distinct in text.
- [x] Needs-attention actions call the existing operations.
- [x] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests per backup state and needs-attention action with a mocked client.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [x] Checked in a real browser at 1440px and 390px against a temporary home
