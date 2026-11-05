---
id: 13
title: Projects as repository skill management
status: pending
blocked_by: [01]
source: docs/specs/git-library.md — "Projects" (L122-130), Decisions 13; docs/specs/git-library-wireframes.html screen 6
---

# 13 — Projects as repository skill management

## What To Build
Projects become repository skill management, like Skills Manager's project workspaces: install (Skills CLI in project mode into the project's agent folders), update, delete and the Manual/Automatic switch, all editing the project's own files directly. Adding a project to AFK is the opt-in. Remove project on/off (the project `.disabled` folder), `.afk-overrides` copies and packs in projects. Projects are not part of the backup.

## Acceptance Criteria
- [ ] Install, update and delete act on the project's own skill folders, through the shared runner.
- [ ] The Manual/Automatic switch edits the project skill's own files.
- [ ] No `.disabled` folder or `.afk-overrides` copy is created in projects; existing ones are handled by a migration that restores the original files.
- [ ] Packs can no longer be turned on in a project; existing project pack activations are turned off cleanly.
- [ ] The Projects screen lists only the project's own skills.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Operations on a temporary project folder: files changed in place, no `.disabled`, no overrides, migration of existing overrides.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
