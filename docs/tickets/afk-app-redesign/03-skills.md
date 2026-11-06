---
id: 03
title: Skills
status: done
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Direction" (Skills), "Layout and interaction"; docs/specs/afk-app-redesign/prototype.html Skills screen and side panel
---

# 03 — Skills

## What To Build
One searchable list of every Global skill, with a "Comes from" column (Core, Pack: name, This machine, Tool: name) and filters (comes from, on/off, Manual/Automatic, to review). Rows: name, one-line description, comes from, on/off switch, Manual/Automatic two-way choice, backup state only where it differs; rare actions in a ⋯ menu (inspect, edit files, update, move to Core/pack/machine, delete). A side panel shows details and the skill editor (plain text + preview, existing save rules). Bulk selection with the existing bulk actions. Project scope keeps repository skill management as today.

## Acceptance Criteria
- [x] Search and filters work on 150+ skills without layout shift; empty and no-results states.
- [x] Every existing single-skill and bulk action is reachable and calls the existing operation.
- [x] Tool skills open read-only in the panel; skills that auto-update ask before saving edits.
- [x] The invocation tooltip names the agents that follow each mechanism.
- [x] Works at 1440px and 390px; no tab rows.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for list filtering, row actions, bulk bar and editor save flow with a mocked client; existing operation tests stay green.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
