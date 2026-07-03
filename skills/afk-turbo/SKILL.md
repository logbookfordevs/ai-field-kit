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
2. If the goal scope is fuzzy, newly resumed, or hiding a deferred seam, run a short grilling pass before Plannotator.
3. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
4. Stop at the launch boundary. Give the exact user-triggered command for the current harness and include review-gated or resume context when active.
5. After the user triggers launch, run GoalBuddy from that goal package.
6. Start or register the local board before execution and include a clickable board URL when available.

Do not also use `afk-implement-tasks`; the GoalBuddy board is the continuity surface.

Preserve execution discipline in GoalBuddy tasks: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.

If execution needs parallel worktrees, prefer `yggtree` when available, especially in repositories with submodules.

If the user asks for review-gated Turbo, use [review-gated.md](references/review-gated.md).

If the user asks to resume Turbo, use [resume.md](references/resume.md).
