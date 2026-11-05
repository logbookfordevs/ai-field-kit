---
id: 01
title: One command runner with deadlines and live progress
status: done
blocked_by: []
source: docs/specs/git-library.md — "Reliability requirements" (L222-229), "Invariants" (L189-195); ADR 0012 last consequence
---

# 01 — One command runner with deadlines and live progress

## What To Build
AFK starts outside commands in five places (tool runs, pack preparation, skill install, skill update, app update worker), each with its own spawn code and none with a deadline. A hung `npx skills add` blocked shutdown on 2026-11-05 and left the CLI answering `fetch failed`. Replace them with one runner that every caller uses, with a deadline, cancellation of the whole process group, and live progress (phase, current item, elapsed time, last output line) that the install and update dialogs show. Shutdown gets a deadline and reports what it abandoned. `afk status`, `afk stop` and `afk --background` recognise a recorded server that is alive but not answering and say how to clear it (offering to stop it after confirmation) instead of failing with `fetch failed`.

## Acceptance Criteria
- [x] All five launch sites use the shared runner; no other `spawn` of external commands remains outside it (the browser opener and the background launcher excepted).
- [x] A command that produces no output past its deadline is stopped with its children, and the operation fails with a message naming the step; the app keeps serving.
- [x] Cancel stops the running command and its children.
- [x] Install and update progress shows phase, current item, elapsed time and last output line, and keeps running when the dialog closes.
- [x] Server shutdown completes within its deadline even with a hung operation, logging what it abandoned.
- [x] `afk status` against a live but unresponsive recorded server prints the PID and the fix instead of `fetch failed`; `afk stop --force` clears it.

## Blocked By
- None - can start immediately

## Execution Bundle
- tdd
- Test Seam: Runner API (stalled fake command hits its deadline; cancel kills the process group); `afk status`/`stop` against a fake unresponsive server; server close with a hung operation.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
