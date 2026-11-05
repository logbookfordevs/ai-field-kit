---
id: 05
title: Install from a zip, a `.skill` file or a folder
status: pending
blocked_by: [04]
source: docs/specs/git-library.md — "Install" step 2, "What is saved" (uploaded skills row), Decisions 10; docs/specs/git-library-wireframes.html screen 4 "Zip or folder"
---

# 05 — Install from a zip, a `.skill` file or a folder

## What To Build
Add a second install source: a `.zip`, a `.skill` file or a folder. AFK finds each `SKILL.md`, shows what it found with its size, and notes the skill can't auto-update. Destinations are Core, a pack or this machine (Try later is repository-only). In Core or a pack the files are saved in full in the library and the pack definition references the saved copy instead of a source; turning such a pack on links it without downloading. A pack containing an uploaded skill can't be exported as a manifest.

## Acceptance Criteria
- [ ] A zip, a `.skill` file and a folder each install to Core, a pack and this machine.
- [ ] Uploaded skills in Core or a pack are stored in the library and committed; in this machine only they are not.
- [ ] A pack with an uploaded member turns on without network access.
- [ ] Exporting a pack with an uploaded member is refused with a clear reason.
- [ ] Archives with no `SKILL.md`, unsafe paths or symlinks are rejected before anything is written.

## Blocked By
- 04.

## Execution Bundle
- tdd
- Test Seam: Install from zip and folder fixtures for each destination; manifest export refusal; unsafe archive rejection.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
