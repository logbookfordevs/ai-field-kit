# AFK Turbo

Use Turbo when the user wants high-throughput progress toward a broad outcome with a visual board and PM loop.

Turbo uses `plannotator-setup-goal` plus GoalBuddy's local live board and PM loop as one AFK execution package. Existing AFK artifacts can sharpen Plannotator input; if they do not exist, Plannotator handles discovery.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Run GoalBuddy from that goal package.
4. Start or register the local board before execution and include a clickable board URL when available.

Do not also use `afk-execution-tracking`; the GoalBuddy board is the continuity surface.

Preserve AFK execution discipline in GoalBuddy tasks: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
