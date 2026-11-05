---
id: 09
title: Restore on an empty machine, with the first-run flow
status: pending
blocked_by: [03, 06, 07]
source: docs/specs/git-library.md — "First run" (L134-136), "Restore" (L151-158); docs/specs/git-library-wireframes.html screen 1
---

# 09 — Restore on an empty machine, with the first-run flow

## What To Build
First run asks *Restore my library*, *Start a new library* or *Skip*. Restore lists repositories through the GitHub CLI or takes a pasted URL, checks the repository is an AFK library, clones into a temporary folder and moves it into place only when complete, links Core skills and uploaded pack members as decided, applies invocation choices and agent folders, and lists tools so the user ticks which commands run (choices reapplied after each). A skill already on the machine with identical files is adopted; different files lose to the library copy and are moved to a dated folder listed in the summary. Packs start off. CLI: `afk library connect <owner/repo | url>`.

## Acceptance Criteria
- [ ] Restore from a bare repository into an empty home produces linked Core skills with choices in their files.
- [ ] An interrupted clone leaves no partial library in place.
- [ ] A non-AFK repository is refused before cloning.
- [ ] A differing local copy is moved to a dated folder and listed; identical copies are adopted.
- [ ] Tool commands run only when ticked; choices are reapplied after each.
- [ ] *Skip* leaves AFK usable without a backup.
- [ ] Restore's deploy step (link what the library says is on, unlink what it doesn't) is shared with ticket 07's *Go back*, so going back to an older save also re-links skills it brings back (gap found after ticket 07).

## Blocked By
- 03, 06 and 07.

## Execution Bundle
- tdd
- Test Seam: Restore operation against a local bare repository into an empty temporary home, including interruption; first-run flow render with fixtures.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
