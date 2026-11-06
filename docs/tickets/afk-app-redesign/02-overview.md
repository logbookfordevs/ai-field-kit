---
id: 02
title: Overview
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Direction" (Overview), "States and ranges"; docs/specs/afk-app-redesign/prototype.html Overview screen
---

# 02 — Overview

## What To Build
The page AFK opens on. A Needs-you list built from real state: skills to review (installed outside AFK) with in-place Add to Core / Keep on this machine / Other…; local checks from Backup (edited outside AFK, replaced by Skills CLI); backup off or failing. Empty state reads "All set · backed up …". Below: Your setup (skills on/total, packs, sources, tools, backup) linking to each page, and quick actions (find a skill, add something new).

## Acceptance Criteria
- [ ] Each Needs-you kind renders from real operation data and its action calls the existing operation.
- [ ] All-set state when nothing needs attention, with the last save time.
- [ ] Navigation shows attention signals ("2 need you", Backup "Off") as text, never totals.
- [ ] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests with fixture state for every Needs-you kind and the all-set state; action wiring tested against a mocked typed client.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
