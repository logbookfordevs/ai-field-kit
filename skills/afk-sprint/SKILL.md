---
name: afk-sprint
description: AFK Sprint is a fast goal-driven execution package using Plannotator, AFK checkpoint packets, native /goal, and AFK task implementation.
metadata:
  short-description: Fast goal execution with Markdown checkpoint tracking.
---

# AFK Sprint

AFK Sprint is a named execution package with Markdown checkpoint tracking.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. If no useful preflight exists, or the current context is too thin for good facts, run a short grilling pass before Plannotator.
3. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
4. Ask the user to invoke `afk-to-tasks` next. It creates executable checkpoint packets from the goal package.
5. After checkpoint packets exist, ask the user to invoke `afk-implement-tasks` when they are ready to execute.
6. During task implementation, run native `/goal` for the prepared `goal.md` and keep checkpoint packets current.

Preserve execution discipline inside checkpoint packets: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.

AFK Implement Tasks owns review gates. When review starts, it may recommend `/plannotator-review` for a better review experience.
