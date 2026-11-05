---
id: 03
title: Packs, machine-only skills and the end of `.disabled`
status: done
blocked_by: [02]
source: docs/specs/git-library.md — "Repository layout" (L67-84), "On and off without a `.disabled` folder" (L90-104), "Storage and links", "Migration" step 1
---

# 03 — Packs, machine-only skills and the end of `.disabled`

## What To Build
Extend storage to the other Global skills: pack skills from repositories live in the pack cache, machine-only skills in `~/.afk/machine`, and the Global `.disabled` contents move into the matching storage during migration. Pack activation turns on and off by linking from the cache. Skills found in an agent folder that AFK doesn't store appear as "To review", with *Add to library* (moved into the library and linked) or *Keep on this machine* (moved into machine storage and linked); keeping one machine-only can offer to bookmark its source in Try later. One stored copy per skill means the "Two copies" case no longer arises for stored skills.

The library also becomes the home of the portable settings (gap found after ticket 02): pack definitions, tool definitions, Try later bookmarks and the Core list are written as one file per object under `.afk/` (`packs/<id>.json`, `tools/<id>.json`, `bookmarks/<id>.json`, `settings.json`) whenever they change, and invocation choices for every stored skill live in its record. After migration AFK reads and writes these instead of the Drive-hosted `settings.json`, which is no longer written. Each change is one library commit. `rules/` becomes the canonical Agent rules location instead of a copy taken at init.

## Acceptance Criteria
- [x] Migration moves pack skills, machine-only skills and `.disabled` contents into their storage; the Global `.disabled` folder is empty afterwards.
- [x] Turning a pack on links its cached skills; turning it off removes only those links.
- [x] An outside skill can be added to the library or kept on this machine, ending as a stored copy plus links.
- [x] Reinstalling a stored skill replaces its stored copy; no duplicate is created.
- [x] Pack definitions stay byte-identical, so existing activation keys survive.
- [x] After migration, changing a pack, tool, bookmark, the Core list or an invocation choice writes the matching `.afk/` file in one commit, and `settings.json` is no longer written.
- [x] Agent rules are read from and saved to the library's `rules/`.

## Blocked By
- 02.

## Execution Bundle
- tdd
- Test Seam: Migration and pack on/off on a temporary home; adopting an outside skill both ways.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
