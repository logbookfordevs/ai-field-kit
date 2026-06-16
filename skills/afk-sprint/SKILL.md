---
name: afk-sprint
description: Run AFK Sprint, a fast goal-driven execution package using Plannotator, AFK checkpoint packets, native /goal, and AFK execution tracking. Use when the user explicitly asks for AFK Sprint or wants fast goal execution with Markdown tracking instead of a visual board.
metadata:
  short-description: Fast goal execution with Markdown checkpoint tracking.
---

# AFK Sprint

AFK Sprint is a named execution package. Use it only when the user asks for Sprint or clearly wants this package.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Use `afk-to-issues` to fragment the plan or goal package into executable checkpoint packets.
4. Run native `/goal` for the prepared `goal.md`.
5. Track execution with `afk-execution-tracking`.

Preserve execution discipline inside checkpoint packets: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
