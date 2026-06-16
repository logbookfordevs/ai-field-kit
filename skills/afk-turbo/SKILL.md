---
name: afk-turbo
description: Run AFK Turbo, a high-throughput execution package using Plannotator plus GoalBuddy's local live board and PM loop. Use when the user explicitly asks for AFK Turbo or wants broad outcome execution with a visual board.
metadata:
  short-description: High-throughput goal execution with GoalBuddy board.
---

# AFK Turbo

AFK Turbo is a named execution package. Use it only when the user asks for Turbo or clearly wants this package.

Turbo combines `plannotator-setup-goal` with GoalBuddy's local live board and PM loop. Existing AFK artifacts can sharpen Plannotator input; if they do not exist, Plannotator handles discovery.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Run GoalBuddy from that goal package.
4. Start or register the local board before execution and include a clickable board URL when available.

Do not also use `afk-execution-tracking`; the GoalBuddy board is the continuity surface.

Preserve execution discipline in GoalBuddy tasks: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
