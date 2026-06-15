# AFK Sprint

Use Sprint when the user wants a fast goal-driven run with Markdown checkpoint packets instead of a visual board and PM loop.

## Route

1. Use existing AFK artifacts as Plannotator input when present.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Use `afk-to-issues` to fragment the plan or goal package into executable checkpoint packets.
4. Run native `/goal` for the prepared `goal.md`.
5. Track execution with `afk-execution-tracking`.

Preserve AFK execution discipline inside checkpoint packets: `tdd` for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.
