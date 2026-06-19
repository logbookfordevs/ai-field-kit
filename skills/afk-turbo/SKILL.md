---
name: afk-turbo
description: AFK Turbo is a high-throughput execution package using Plannotator plus GoalBuddy's local live board and PM loop.
metadata:
  short-description: High-throughput goal execution with GoalBuddy board.
---

# AFK Turbo

AFK Turbo is a named execution package with a local live board.

Turbo combines `plannotator-setup-goal` with GoalBuddy's local live board and PM loop. Existing AFK artifacts can sharpen Plannotator input; if they do not exist, Plannotator handles discovery.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Stop at the launch boundary and ask for an explicit user trigger before execution starts.
4. After the user triggers launch, run GoalBuddy from that goal package.
5. Start or register the local board before execution and include a clickable board URL when available.

Do not also use `afk-execution-tracking`; the GoalBuddy board is the continuity surface.

Preserve execution discipline in GoalBuddy tasks: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.

If the user asks for review-gated Turbo, use [review-gated.md](references/review-gated.md).
