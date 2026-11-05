---
id: 07
title: Backup to GitHub, with the Backup screen
status: pending
blocked_by: [02]
source: docs/specs/git-library.md — "Start a new library" (L138-142), "Save" (L144-149), "Invariants"; docs/specs/git-library-wireframes.html screen 3 and sidebar status box
---

# 07 — Backup to GitHub, with the Backup screen

## What To Build
Connect the library to a remote: create a private GitHub repository through the GitHub CLI, or accept any Git remote, using Git's own credentials and storing no token. Saving pushes 2 minutes after the last change and on *Save now*; when a push fails (offline, credentials), commits wait locally, the sidebar says so, and nothing is lost. History lists past saves; *Go back to before this* restores that point as a new commit. Add the Backup screen (status, what is and isn't in the backup, history) and the sidebar status box. The setup screen states that skill files aren't scanned for secrets and the repository must be private.

## Acceptance Criteria
- [ ] A change is pushed after the quiet period; *Save now* pushes immediately.
- [ ] With the remote unreachable, commits stay local, status shows them as waiting, and the next successful push sends them all.
- [ ] Going back to a save creates a new commit restoring that state, which can itself be undone.
- [ ] The Backup screen and sidebar box reflect saved, waiting and failed states.
- [ ] No credential is written by AFK.

## Blocked By
- 02.

## Execution Bundle
- tdd
- Test Seam: Library save/push/history against a local bare repository as remote, including an unreachable remote; screen render functions with fixtures.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [ ] Acceptance criteria demonstrated on a temporary home, never the real `~`
