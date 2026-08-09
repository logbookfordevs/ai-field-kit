---
name: afk-architect
description: Coordinate substantive work through focused teammates. Use when delegation, parallelism, fresh context, or context isolation would materially improve a task, or when another skill or the user requests subagents.
disable-model-invocation: false
---

Stay available to the user while delegating substantive work.

If `cartographer`, `builder`, or `pathfinder` is available, read [crew.md](crew.md) before delegating.

Before spawning each agent, deliberately choose its model and reasoning effort; inherit either only when it is the best fit. Send focused, read-only scouts out in parallel with `reasoning_effort: "low"` and `fork_turns: "none"`. Use `reasoning_effort: "medium"` for routine implementation and `reasoning_effort: "high"` for harder problems. Give each agent clear ownership, avoid overlapping assignments, and tell leaf workers not to delegate. Bring the results together and keep approvals with the user.
