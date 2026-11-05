---
id: 02
title: Local library for Core skills
status: pending
blocked_by: [01]
source: docs/specs/git-library.md — "What is saved", "Repository layout", "Storage and links" (L53-89), "Migration" (L211-220), "Invariants"; ADR 0012
---

# 02 — Local library for Core skills

## What To Build
Introduce AFK-owned storage for Core skills: `~/.afk/library` as a local Git repository with `skills/<name>/` and `.afk/skills/<name>.json` records (source, skillPath, upstream revision, invocation choice), plus `.afk/settings.json` for the remaining small settings. `afk library init` (dry run by default, `--apply` to write) migrates this machine's Core skills into storage, writes the records from the portable settings, the Skills CLI lock and this machine's invocation choices, copies `AGENTS.md` and `references/` into `rules/`, and replaces the original folders with links in `~/.agents/skills` and `~/.claude/skills`, keeping the originals in a dated backup until confirmed. Turning a Core skill off removes its links. Every library change is one commit. The existing Installed Skills page and headless operations keep working on top of the new storage. No remote yet.

## Acceptance Criteria
- [ ] Dry run writes nothing and reports what would move; `--apply` performs it.
- [ ] After apply, each Core skill exists once in `~/.afk/library/skills`, linked from `~/.agents/skills` and `~/.claude/skills`, and its record holds source, revision and invocation choice.
- [ ] Invocation choices are in the skill files and in the records; the Installed Skills page shows them unchanged.
- [ ] Turning a Core skill off removes its links and moves no files; turning it on restores them.
- [ ] Each operation that changes the library makes exactly one commit with a readable message; a failed operation leaves the working tree as it was.
- [ ] Originals are kept in a dated backup folder until the user confirms.

## Blocked By
- 02 needs the shared runner from 01 for `git`.

## Execution Bundle
- tdd
- Test Seam: Migration and toggle on a temporary home through `SkillLibrary`/operations: files moved once, links correct, choice in files and records, one commit per change.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
