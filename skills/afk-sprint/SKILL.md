---
name: afk-sprint
description: AFK Sprint is a fast goal-driven execution package using Plannotator, AFK checkpoint packets, native /goal, and AFK execution tracking.
metadata:
  short-description: Fast goal execution with Markdown checkpoint tracking.
---

# AFK Sprint

AFK Sprint is a named execution package with Markdown checkpoint tracking.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Use `afk-to-issues` to create the implementation plan as executable checkpoint packets from the goal package.
4. Run native `/goal` for the prepared `goal.md`.
5. Track execution with `afk-execution-tracking`.

Preserve execution discipline inside checkpoint packets: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
