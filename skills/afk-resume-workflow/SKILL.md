---
name: afk-resume-workflow
description: Resume existing feature or AFK workflow work from durable repo artifacts and choose the next phase. Use when the user asks to continue/resume work, pick up a feature, run the next task/slice/phase, or launch parallel subagents for an ongoing workflow after prior artifacts or tracking exist.
metadata:
  short-description: Resume feature or AFK workflow work from repo artifacts and route the next move.
---

# AFK Resume Workflow

Resume from durable artifacts, not chat memory.

1. Find the active workflow from the user's hint, current repo, branch, and relevant `docs/<task-slug>/tracking/` checkpoint packets.
2. Read only the smallest useful set: active checkpoints, blockers, handoff notes, checkpoint packet sources, and directly referenced spec/ADR files.
3. If active tracking exists or the requested work is part of a tracked flow, use `afk-execution-tracking` before implementing, delegating, or changing checkpoint status.
4. Report what is done, what is active, what is blocked, and the next useful move.
5. Re-enter `afk-compass` for the next skill or phase; before implementation or delegation, it must select `test-driven-development`, `source-driven-development`, `doubt-driven-development`, or an explicit normal-validation fallback.

If multiple workflows or next moves are plausible, ask one clarifying question.

Do not create, edit, or reorganize artifacts unless the next routed skill requires it.
