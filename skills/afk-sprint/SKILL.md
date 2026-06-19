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
3. Ask the user to invoke `afk-to-issues` next. It creates executable checkpoint packets from the goal package.
4. After checkpoint packets exist, ask the user to invoke `afk-execution-tracking` when they are ready to execute.
5. During execution tracking, run native `/goal` for the prepared `goal.md` and keep checkpoint packets current.

Preserve execution discipline inside checkpoint packets: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
