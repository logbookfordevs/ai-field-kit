---
id: 12
title: Agent folders, with icons
status: done
blocked_by: [02]
source: docs/specs/git-library.md — "Agent folders" (L105-120), Decisions 12, 14, 15; docs/specs/git-library-wireframes.html screen 5
---

# 12 — Agent folders, with icons

## What To Build
Make the folders AFK links into configurable. `~/.agents/skills` is always on and names the agents that read it. AFK ships an agent table (taken from Skills CLI's, with global and project folders and which invocation mechanism each follows); agents detected on this machine are listed first with switches; *Add a folder* takes a name, a global path and an optional project path. Every skill that is on gets a link in each enabled folder; enabling a folder links every skill that is on, disabling it removes only AFK's links. Today's fixed `~/.claude/skills` link becomes the Claude Code entry, on by default. Enabled folders are saved in the library as `~`-relative paths. Each agent shows its icon (Skills Manager's MIT-licensed set with its notice, or the agent's own brand assets); custom folders get a lettered placeholder. The invocation tooltip uses the table's mechanism data.

## Acceptance Criteria
- [x] Enabling a folder creates links for every skill that is on; disabling removes only AFK's links and leaves other files.
- [x] Claude Code is on by default and reproduces today's links.
- [x] Custom folders are validated (absolute or `~` path, not inside the library) and saved in the library.
- [x] Agent icons render, with a placeholder for unknown agents; the icon license notice is included.
- [x] The invocation tooltip lists the agents that follow each mechanism, where known.

## Blocked By
- 02.

## Execution Bundle
- tdd
- Test Seam: Enable/disable a folder on a temporary home; custom folder validation; agent detection from the table; screen render with fixtures.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
