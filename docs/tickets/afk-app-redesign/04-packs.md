---
id: 04
title: Packs
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Direction" (Packs); docs/specs/afk-app-redesign/prototype.html Packs screen
---

# 04 — Packs

## What To Build
Packs as groups: list with description, member count and state; turn a pack on or off (downloading missing members with progress and cancel); see and edit members; create a pack; import/export manifest where allowed (uploaded members block export with the reason).

## Acceptance Criteria
- [ ] On/off, download progress and cancel use the existing operations and progress state.
- [ ] Members view lists each skill with where it comes from.
- [ ] Create, edit members, import and export reachable; export refusal explains why.
- [ ] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for pack on/off with progress, member editing and export refusal using a mocked client.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
