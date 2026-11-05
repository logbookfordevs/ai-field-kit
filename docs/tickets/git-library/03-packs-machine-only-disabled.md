---
id: 03
title: Packs, machine-only skills and the end of `.disabled`
status: pending
blocked_by: [02]
source: docs/specs/git-library.md — "On and off without a `.disabled` folder" (L90-104), "Storage and links", "Migration" step 1
---

# 03 — Packs, machine-only skills and the end of `.disabled`

## What To Build
Extend storage to the other Global skills: pack skills from repositories live in the pack cache, machine-only skills in `~/.afk/machine`, and the Global `.disabled` contents move into the matching storage during migration. Pack activation turns on and off by linking from the cache. Skills found in an agent folder that AFK doesn't store appear as "To review", with *Add to library* (moved into the library and linked) or *Keep on this machine* (moved into machine storage and linked); keeping one machine-only can offer to bookmark its source in Try later. One stored copy per skill means the "Two copies" case no longer arises for stored skills.

## Acceptance Criteria
- [ ] Migration moves pack skills, machine-only skills and `.disabled` contents into their storage; the Global `.disabled` folder is empty afterwards.
- [ ] Turning a pack on links its cached skills; turning it off removes only those links.
- [ ] An outside skill can be added to the library or kept on this machine, ending as a stored copy plus links.
- [ ] Reinstalling a stored skill replaces its stored copy; no duplicate is created.
- [ ] Pack definitions stay byte-identical, so existing activation keys survive.

## Blocked By
- 02.

## Execution Bundle
- tdd
- Test Seam: Migration and pack on/off on a temporary home; adopting an outside skill both ways.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
