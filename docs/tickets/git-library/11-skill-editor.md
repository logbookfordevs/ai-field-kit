---
id: 11
title: Skill editor
status: done
blocked_by: [10]
source: docs/specs/git-library.md — "Edit" (L174-180); docs/specs/git-library-wireframes.html screen 2 editor panel
---

# 11 — Skill editor

## What To Build
Open a skill's files from the Skills page in an editor: file list, plain text, Markdown preview. Save writes the file, reapplies the invocation choice (the invocation line is managed by the choice, not hand-edited) and makes one commit ("Edit <skill>"). Editing a skill that auto-updates asks first: keep my version (stop its updates) or let updates replace my edits. Tool skills and project-owned skills follow their own rules: tool skills open read-only.

## Acceptance Criteria
- [x] Saving an edit writes the file, keeps the invocation choice, and makes one commit.
- [x] Saving an auto-updating skill asks first, and the choice is persisted.
- [x] Tool skills open read-only and cannot be saved.
- [x] Paths outside the skill folder cannot be read or written.
- [x] Bulk selection is back on the Global Skills tabs (regression found after ticket 10): select several skills and change invocation, turn on/off, update or delete them together, as the old Installed Skills page allowed.

## Blocked By
- 10.

## Execution Bundle
- tdd
- Test Seam: Edit-save operation on a temporary home (commit, choice reapplied, update-stop persisted, path escape refused); editor render with fixtures.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
