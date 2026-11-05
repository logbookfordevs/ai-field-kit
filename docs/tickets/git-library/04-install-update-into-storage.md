---
id: 04
title: Install and update from repositories into storage
status: pending
blocked_by: [02, 03]
source: docs/specs/git-library.md — "Install" (L160-167), "Update" (L169-172), "Invariants"; docs/specs/git-library-wireframes.html screen 4
---

# 04 — Install and update from repositories into storage

## What To Build
Installing from a repository runs Skills CLI in an isolated temporary home through the shared runner, then copies the chosen skills into the library (Core) or pack cache (pack) or machine storage (this machine), records their source, applies saved invocation choices, links them and commits. Updates go through the protected updater the same way and record the new revision, one commit per run; scheduled updates keep working. Turning a pack on downloads any missing pack skills with visible progress. Opening Install from a Try later bookmark fills the repository and its saved selection and still asks for the destination instead of preselecting Try later.

## Acceptance Criteria
- [ ] Install to each destination stores one copy, links it, applies the saved choice and commits once.
- [ ] A failed or cancelled install leaves the library and agent folders unchanged.
- [ ] An update replaces stored files, keeps links intact, reapplies choices and records the new revision in one commit.
- [ ] Turning a pack on whose skills aren't cached downloads them with progress and a deadline.
- [ ] Install opened from a Try later bookmark preselects the repository and skills, not the Try later destination.

## Blocked By
- 02 and 03.

## Execution Bundle
- tdd
- Test Seam: `installSkills`/`updateSkills` with a fake runner on a temporary home; the install UI flow from a bookmark (existing UI test style).

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
