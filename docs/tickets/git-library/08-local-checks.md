---
id: 08
title: Local checks: edited outside AFK, replaced by Skills CLI
status: done
blocked_by: [07]
source: docs/specs/git-library.md — "Local checks" (L182-187); docs/specs/git-library-wireframes.html screen 3 "Needs attention"; spike 2026-11-05: `npx skills update` replaces a linked skill with a plain folder
---

# 08 — Local checks: edited outside AFK, replaced by Skills CLI

## What To Build
Detect two situations on this machine and list them under Needs attention on the Backup screen. **Edited outside AFK:** a stored file changed without the editor; *Keep edit* commits it, *Discard* restores the saved version. **Replaced by Skills CLI:** a direct `npx skills update` (confirmed on 2026-11-05) or `npx skills add` replaced a link with a plain folder; *Take the update* moves the new files into storage, reapplies the choice, relinks and commits; *Restore saved version* puts the link back and removes the folder. Uncommitted outside edits are never pushed silently.

## Acceptance Criteria
- [x] An edit to a stored file outside AFK appears under Needs attention and is not pushed until resolved.
- [x] *Keep edit* and *Discard* each produce the expected files and a commit (or none for discard).
- [x] A link replaced by a folder appears under Needs attention; *Take the update* stores the new files with the choice reapplied and relinks; *Restore saved version* restores the link.
- [x] The sidebar count matches the list.

## Blocked By
- 07.

## Execution Bundle
- tdd
- Test Seam: On a temporary home: replace a link with a folder (as Skills CLI does) and edit a stored file; each action's resulting files, links and commits.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
