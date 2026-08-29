# Workflow Crossroads

Use this reference when the user needs a path through skills or advice about where one phase, context, task, or worker should end.

## Orient before decision work

When the user is new to an already-shaped feature, has not read its specifications, does not know which artifacts exist, or cannot yet explain its motivation and current behavior, recommend orientation before grilling. This is a human-readiness gate: the agent having read the sources does not mean the user is ready to challenge assumptions or make decisions.

Choose the depth that fits the user's learning goal:

- **Brief orientation:** `research` → `facts` → `grill-with-docs`. Research inventories and reconciles primary sources; Facts gives the user the critical briefing; Grill begins after the user has enough context to judge its questions.
- **Durable learning:** `research` → `teach` → `facts` → `grill-with-docs`. Use Teach when the user wants a stateful, multi-session learning workspace with lessons and retained learning records, not merely a feature summary.
- **Personal exploration:** the user may read designs, prototypes, tickets, specifications, decision records, and shipped behavior themselves before either route. Skills support the orientation; they do not replace the user's learning.

Orientation is complete when the user can explain the feature's motivation, governing sources, current behavior, active scope, adjacent work, and known contradictions well enough to participate in decisions. If only the agent can do that, continue orientation instead of starting Grill.

## Choose the planning scale

Start with the lowest specialist that can coherently own the uncertainty now:

- **`grill-me` or `grill-with-docs`:** one evolving plan, design, or domain question that can be pressured in a coherent session;
- **a domain specialist:** one connected specialist problem, such as frontend direction or a motion-led experience; consult the relevant crossroads reference for the route;
- **`wayfinder`:** a destination whose route already contains several independently substantial, interdependent decisions and needs a durable map across sessions.

Uncertainty alone does not require Wayfinder. Enter it directly when the decision landscape is already visible. Otherwise begin with the fitting specialist and promote only when its exploration reveals a decision graph that no longer fits one coherent session. Preserve settled decisions, rejected directions, evidence, artifacts, and the unresolved graph at that boundary; use `handoff` when the promotion also crosses contexts.

Wayfinder owns that decision graph, not every discipline used to resolve it. Name a governing specialist in the map's Notes when one should constrain relevant tickets, and use the fitting specialist for each ticket's decision work. Wayfinder remains planning by default: specialist work inside the map resolves a decision or produces evidence rather than silently delivering the destination. When the map converges, continue into the specialist or synthesis route that owns the destination.

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

Return the shortest complete flow that reaches the user's outcome. Show exact invocations in order, or give the free implementation prompt when the route is untracked. State only the planning-scale, tracking, and context boundaries that materially protect coherence, isolation, dependency order, or recoverability.
