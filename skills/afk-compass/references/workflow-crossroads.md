# Workflow Crossroads

Use this reference when the user needs a path through skills or advice about where one phase, context, task, or worker should end. Verify every recommended skill against its current `SKILL.md` before applying this guidance.

## Main build flow

The usual AFK path is:

`grill-me` or `grill-with-docs` → `afk-to-spec` → `afk-to-tickets` → `afk-implement-tickets`

Enter at the earliest phase that still has unresolved work. Skip a phase only when its output already exists or the current skill explicitly accepts the smaller input. AFK's ticket implementation workflow expects executable tickets; a spec alone is not its normal activation input. For one quick action, it may create one local ticket and continue as its own `SKILL.md` permits.

## Context continuity

Keep decision-making, synthesis, and ticket grooming in one task whenever the context remains healthy:

- Continue from grilling into `afk-to-spec` so the spec can synthesize the live decisions and vocabulary.
- Continue from the approved spec into `afk-to-tickets` so the ticket breakdown retains the same intent. When two or more tickets belong to one breakdown, groom and approve them together before implementation whenever possible; their granularity and blocking edges are one decision graph.
- Start each implementation ticket in a fresh task or context by default. `afk-to-tickets` sizes each slice for one fresh context window, while the ticket, its source links, blockers, and handoff notes carry the durable implementation context.

A boundary is justified by a change in context ownership, not merely by reaching the next named skill.

## Context pressure

When the current task approaches its useful context limit, move at the nearest natural phase boundary instead of continuing with degraded reasoning.

- If grilling is complete and its decisions are still live, run `afk-to-spec` before compacting or starting fresh. Then compact and run `afk-to-tickets` from the approved spec.
- If grilling is still open, compact at the end of a settled branch and preserve settled decisions, domain vocabulary, and open questions. If the host cannot compact safely, use `handoff` to carry that state into a fresh task.
- Keep `afk-to-spec` and `afk-to-tickets` unbroken when practical. A durable approved spec makes a necessary boundary between them recoverable, but not preferable by default.

## Choosing a boundary

| Situation | Boundary |
|---|---|
| The next phase benefits from the reasoning already in the window | Continue in the same task |
| The same task needs more room and the host supports compaction | Compact at a natural phase boundary |
| A short disposable question needs inherited context but no durable return path | Use a side conversation when the host provides one; bring any decision back explicitly |
| An exploration needs the full inherited history and may become durable | Fork the task |
| Curated context must travel to a clean task, another directory or harness, or another person | Run `handoff`, then tell the receiver to read the generated file and continue |
| One bounded activity can run independently and report back | Use `afk-architect` with a focused teammate |
| An executable ticket has durable source context | Start a fresh implementation task for that ticket |

Do not add a pickup workflow merely to consume an ordinary handoff. Point the receiving task at the handoff file. Add resume verification only after real drift or stale-state failures justify it.

## Ticket execution

Work the ticket frontier: start only tickets whose blockers are satisfied. Sequential tickets can run one after another without worktrees. Parallel tickets need separate workers with exact ticket ownership and separate worktrees when their filesystem or Git work can overlap; use `afk-architect` for native teammates and follow `afk-implement-tickets` for tracking-home ownership.

Treat each ticket's review and acceptance gate as part of that ticket's implementation task. Start the next dependent ticket only after the blocker reaches the state required by its tracking contract.

## Recommendation

Return the shortest complete flow that reaches the user's outcome. Show exact invocations in order, then state only the boundaries that materially protect context quality, isolation, dependency order, or recoverability.
