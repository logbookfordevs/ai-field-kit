# Workflow Crossroads

Use this reference when the user needs a path through skills or advice about where one phase, context, task, or worker should end. Verify every recommended skill against its current `SKILL.md` before applying this guidance.

## Choose the tracking posture

Determine whether the user wants durable execution tracking before choosing the build path.

The **tracked path** is:

`grill-me` or `grill-with-docs` → `afk-to-spec` → `afk-to-tickets` → `afk-implement-tickets`

Use it when the user wants ticket status, blocking edges, execution evidence, interruption recovery, handoff notes, or a per-ticket review and acceptance gate. Enter at the earliest phase that still has unresolved work. AFK's ticket implementation workflow expects executable tickets; a spec alone is not its normal activation input.

The **untracked paths** are:

- settled grilling context → an ordinary implementation prompt;
- approved spec → an ordinary implementation prompt grounded in that spec.

Offer an untracked path when all of these hold:

- the work fits one implementation run rather than several independently executable slices;
- dependencies or sequencing do not need a durable record;
- implementation will not be distributed across tasks or people;
- the project does not require a tracking ticket for the change;
- the user does not want ticket-level execution tracking.

This is ordinary agent behavior, not an invocation of `afk-implement-tickets`. Give a copyable prompt such as `Implement the settled change now without ticket-level execution tracking.` When starting from a spec, name or link it in the prompt. A spec remains useful when the user wants a durable brief or the context must be compacted; it does not, by itself, require tickets.

If the user's tracking intention is unknown, say that direct implementation is available if they do not need ticket status, blockers, durable recovery, handoff notes, or the ticket review gate. Do not create a ceremonial ticket merely to preserve the tracked flow. If the user does want any of those guarantees, route through `afk-to-tickets` and `afk-implement-tickets`.

## Context continuity

Keep decision-making, synthesis, and ticket grooming in one task whenever the context remains healthy:

- Continue from grilling into `afk-to-spec` so the spec can synthesize the live decisions and vocabulary.
- Continue from the approved spec into `afk-to-tickets` so the ticket breakdown retains the same intent. When two or more tickets belong to one breakdown, groom and approve them together before implementation whenever possible; their granularity and blocking edges are one decision graph.
- Start each implementation ticket in a fresh task or context by default. `afk-to-tickets` sizes each slice for one fresh context window, while the ticket, its source links, blockers, and handoff notes carry the durable implementation context.
- For untracked implementation, continue directly from settled grilling while the context is healthy. If a spec already exists, continue from it or start fresh with the spec as the source; no ticket handoff is required.

A boundary is justified by a change in context ownership, not merely by reaching the next named skill.

## Context pressure

When the current task approaches its useful context limit, move at the nearest natural phase boundary instead of continuing with degraded reasoning.

- If grilling is complete and its decisions are still live, run `afk-to-spec` before compacting or starting fresh. After compaction, route from the approved spec either to `afk-to-tickets` for tracked execution or to an ordinary implementation prompt for untracked execution.
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
| An executable ticket has durable source context | Start a fresh tracked implementation task for that ticket |
| Settled grilling or an approved spec is enough and execution tracking is unwanted | Continue with an ordinary implementation prompt |

Do not add a pickup workflow merely to consume an ordinary handoff. Point the receiving task at the handoff file. Add resume verification only after real drift or stale-state failures justify it.

## Ticket execution

Work the ticket frontier: start only tickets whose blockers are satisfied. Sequential tickets can run one after another without worktrees. Parallel tickets need separate workers with exact ticket ownership and separate worktrees when their filesystem or Git work can overlap; use `afk-architect` for native teammates and follow `afk-implement-tickets` for tracking-home ownership.

Treat each ticket's review and acceptance gate as part of that ticket's implementation task. Start the next dependent ticket only after the blocker reaches the state required by its tracking contract.

## Recommendation

Return the shortest complete flow that reaches the user's outcome. Show exact invocations in order, or give the free implementation prompt when the route is untracked. State only the tracking trade-off and boundaries that materially protect context quality, isolation, dependency order, or recoverability.
