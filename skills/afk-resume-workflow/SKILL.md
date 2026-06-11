---
name: afk-resume-workflow
description: Resume an existing AFK workflow from durable repo artifacts and choose the next phase. Use when the user asks to continue, resume, pick up, or find the next phase/slice of an AFK workflow, feature workflow, or AFK run after a context reset.
metadata:
  short-description: Resume an AFK workflow from repo artifacts and route the next move.
---

# AFK Resume Workflow

Resume from durable artifacts, not chat memory.

1. Find the active workflow from the user's hint, current repo, branch, `.afk/execution-tracking/current.json`, and relevant `docs/<task-slug>/` artifacts.
2. Read only the smallest useful set: tracking index, active checkpoints, implementation plan, and directly referenced spec/ADR files.
3. Report what is done, what is active, what is blocked, and the next useful move.
4. Re-enter `afk-compass` for the next skill or phase.

If multiple workflows or next moves are plausible, ask one clarifying question.

Do not create, edit, or reorganize artifacts unless the next routed skill requires it.
