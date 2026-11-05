---
id: 10
title: One Skills page
status: pending
blocked_by: [03, 07]
source: docs/specs/git-library.md — Decisions 9; docs/specs/git-library-wireframes.html screen 2, direction B
---

# 10 — One Skills page

## What To Build
Replace the separate Kit and Installed Skills pages with one Skills page: tabs Core (grouped by source, with follow and update per source) · Packs (on/off per machine) · This machine only · Try later · To review. Each row shows availability, the Manual/Automatic choice with a tooltip naming the agents that follow it where known, and a backup chip (Backed up, Saved · not pushed yet, Needs attention, Outside library, Not in library). Keep the existing interaction quality and AFK's interface design system.

## Acceptance Criteria
- [ ] Kit and Installed Skills are replaced by one Skills page with the five tabs.
- [ ] Every existing action (on/off, invocation, update, delete, add to pack/Core, Try later actions) is reachable from the new page.
- [ ] Backup chips reflect the library state from 07 and 08.
- [ ] The page works at desktop and phone widths with no horizontal scroll.

## Blocked By
- 03 and 07.

## Execution Bundle
- tdd
- Test Seam: Render functions with fixture inventories (existing UI test style) plus a browser check at desktop and phone widths.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
