---
name: "afk-coding-tradeoffs"
description: "Discuss high-leverage UX and implementation trade-offs inside an already understood scope and capture the outcome as an ADR-style decision record. Use when important local decisions need to be locked before coding, including ADR discussions, interaction behavior, composition strategy, code ownership, library commitments, or information design."
metadata:
  short-description: "Resolve UX and implementation trade-offs before coding and capture the final decisions in an ADR-style artifact."
---

# Coding Trade-offs

Use this skill when the feature is already understood, but the work still has meaningful gray areas in UX, behavior, composition, or implementation strategy.

Its job is not to rediscover the product idea or do broad planning. Its job is to help the user make smart local decisions that materially change the result, then write those decisions down so future chats and agents do not have to reopen them.

## Goal

Resolve high-leverage UX and implementation trade-offs inside a bounded scope and produce an ADR-style decision artifact that downstream work can trust.

Typical output:
- an ADR-style decision record under `docs/<task-slug>/decisions/`
- a reusable trade-off record when the repo uses different naming
- another equivalent artifact requested by the user

## Inputs

Use whatever exists:
- a clearly bounded feature, screen, flow, component system, or implementation slice
- existing project materials such as planning docs, requirement notes, specs, tickets, prior context summaries, or design notes
- relevant repository context and code patterns
- the user's current goals and constraints

If the scope is still broad or the real problem is not yet clear, another skill should usually come first.

## Core Principles

- Discuss high-leverage local trade-offs, not broad product discovery.
- Respect scope boundaries. If new capabilities emerge, capture them as deferred ideas instead of quietly expanding the feature.
- Do not re-ask questions that have already been answered in existing artifacts.
- Ask only the highest-value questions needed to unblock confident implementation.
- Prefer real trade-offs over stylistic bikeshedding.
- Capture concrete decisions, trade-offs accepted, assumptions, and unresolved questions.
- Default to live collaborative discussion, not bulk question generation.
- Treat pacing as part of the product: one gray area at a time is the default experience.
- Use `truss-evaluation` as the preferred decision lens whenever possible.

## Interaction Style

This skill should feel guided, interactive, and easy to respond to: present unresolved areas as choices, discuss one area at a time, preserve freeform escape hatches, and show what remains.

Use the host runtime's interactive question UI when available. Use plain-text menus only when the environment requires it or the question genuinely needs an open written answer.

For pacing details and menu examples, see [interaction-flow.md](references/interaction-flow.md).

## Strong Dependency: Truss

This skill should use `truss-evaluation` as its default trade-off lens.

If `truss-evaluation` is available:
- use it to structure the comparison of real options
- frame the discussion around Maintainability, Strategy, Clarity, and Performance
- prefer conditional recommendations grounded in actual trade-offs

If `truss-evaluation` is missing:
1. tell the user this skill is designed to work with Truss
2. ask them to install it with:

```bash
npx skills add https://github.com/leoreisdias/truss-framework
```

3. do not pretend the intended experience is still fully available without it

## External Library Rule

Whenever the discussion or final recommendation points toward an external library, framework, registry, or platform dependency:
- note that the decision should be validated against the best available source of truth before implementation
- prefer a specific installed skill for that library or tool when one exists
- otherwise prefer official documentation through MCP-backed sources such as Context7 when available

Do not treat a library recommendation as "done" if the next implementation step would still benefit from:
- current API details
- setup constraints
- version-specific behavior
- library-specific best practices

In the artifact, when relevant, note the follow-up explicitly. For example:
- `Follow-up: consult the React Hook Form skill or official docs before implementation`
- `Follow-up: validate TanStack Query strategy against Context7 docs`
- `Follow-up: use the preferred registry/component skill before adopting the library output directly`

## Interesting Trade-off Filter

Ask a question only if the answer materially affects at least one of these:
- user experience
- interaction behavior
- implementation strategy
- future reuse or extensibility
- correctness or bug surface
- library or pattern commitment
- code shape in a meaningful way

If a choice is merely stylistic, syntactic, or low impact, do not ask it.

Good examples:
- modal vs drawer
- one shared modal vs one modal per row
- event handler vs `useEffect` when both are plausible
- `useRef` container vs reactive UI state
- queryOptions vs custom hooks vs hybrid TanStack Query strategy
- fetch vs axios vs another client
- registry component vs custom implementation
- local child component vs separate file when it changes clarity or maintenance
- explicit fallback vs generic fallback
- what information should be visible in a dense table or list

Read `references/examples.md` for more examples of smart versus boring questions.
Read `references/must-check-early.md` for high-impact preferences that are often worth locking early when the scope makes them relevant.

## Do Not Ask

Do not ask about:
- `type` vs `interface` as a style preference
- `useState` vs `useReducer` for trivial local state
- syntax or formatting choices already covered by repo conventions
- choices already answered by:
  - the existing stack
  - repo conventions
  - project instructions
  - existing code patterns
- low-impact style debates that do not materially change UX, implementation shape, or downstream cost

## Interaction Mechanism

Use the host runtime's interactive question mechanism by default for area selection, option decisions, and continue/deepen/stop checkpoints. After freeform replies, return to the interactive mechanism for the next option-based choice when available.

## Workflow

### 1. Identify the scope boundary

- Determine which feature, screen, flow, component boundary, or implementation slice is under discussion.
- If the scope is ambiguous, clarify it first.
- If the scope is still broad enough that product discovery is the real problem, stop and route toward the earlier AFK skills instead.

### 2. Load prior context

Read any relevant materials that already define the problem or prior decisions, such as:
- roadmap or planning documents
- requirement notes
- prior context summaries
- feature specs
- tickets or planning notes

Use these to avoid repeating resolved questions.

### 3. Scout the codebase and artifacts

Look for:
- reusable components or patterns
- integration points
- established naming or structural conventions
- prior decisions that constrain the current slice
- stack commitments that already answer boring questions
- existing UI or data patterns that make some options clearly in-scope or out-of-scope

Summarize only the context that affects the current scoped discussion.

Before moving on, check `references/must-check-early.md` and identify whether this scope clearly implies any early preference checks.
Do not ask all of them by default. Only bring them in when the current scope makes them relevant enough that missing them now would likely cause rework later.

### 4. Find the remaining trade-off areas

Identify 3-4 high-leverage local trade-off areas that still need clarification.

Good trade-off areas are concrete and relevant to the current slice of work, for example:
- interaction behavior and flow shape
- information density and hierarchy
- component ownership and composition strategy
- state strategy when reactivity truly matters
- library commitments and library usage style
- error, fallback, and feedback behavior
- code organization choices that materially change maintainability or clarity

Avoid generic buckets if the current scope suggests more specific questions.

This step identifies candidate areas, not full option trees. Present a compact picker, let the user choose one or more areas, and discuss selected areas one by one. If the user says "all", interpret that as "all in sequence", not "all at once".

Recommend a starting area only when there is a concrete sequencing, dependency, or risk reason. Otherwise present the areas neutrally.

### 5. Discuss selected trade-off areas with Truss

- Present the unresolved areas in a compact list.
- Let the user choose which single area to tackle first.
- Recommend a starting area only when doing so prevents confusion or unblocks the rest.
- Go deep enough to turn vague preferences into actionable decisions.
- Keep the discussion centered on the current scoped slice.

This is the core pacing rule:
- identify several trade-off areas
- expand only one area at a time
- summarize that area before moving on

Suggested probing pattern:
- name the trade-off clearly
- state the local context and constraints
- define what success means for this decision
- present 2-4 real options only
- use Truss to evaluate the options concisely
- Ask a few focused questions for one area only, usually in a short round.
- Prefer choices plus a freeform option when possible.
- Use examples or contrasting options to make the trade-off concrete.
- Summarize what is now decided.
- Check whether the area is sufficiently clear or needs one more pass.
- Move to the next area once the current one is actionable.

For each area, require enough context to answer:
- what is being optimized for
- what constraints apply
- what trade-offs are acceptable

When Truss is active, organize the option comparison through:
- Maintainability
- Strategy
- Clarity
- Performance

Prefer concise, conditional recommendations such as:
- "Use a shared external modal if consistency and centralized state matter more."
- "Use per-row composable modal ownership if local encapsulation and independent behavior matter more."

When the chosen direction depends on an external library, add the follow-up check immediately after the recommendation instead of leaving it implicit.

Do not present a full decision survey across all unresolved areas unless the user explicitly asks for a matrix, scorecard, worksheet, batch pass, or all-at-once comparison.

For picker shapes, checkpoint prompts, and good/bad interaction examples, see [interaction-flow.md](references/interaction-flow.md).

### 6. Guard against scope creep

If the user introduces new capabilities or work that belongs outside the current slice:
- acknowledge the idea
- capture it as deferred work
- return to the current phase discussion

This skill should sharpen the current scope, not quietly expand it.

### 7. Write the ADR-style decision artifact

Produce a decision document that is useful for downstream implementation and future chats.

When writing a file, follow the repo or user artifact convention. If none exists, follow the AFK default from `afk-workflow`.

This artifact is mandatory, even if the conversation was short.

When the discussion was interactive, preserve that value in the artifact:
- record the final decisions, not every conversational branch
- include notable rejected options only when they explain an important boundary
- reflect where the user explicitly chose one direction over another

For ADR filename, split/update, and section guidance, see [decision-artifact.md](references/decision-artifact.md).

## Output Quality Bar

The final artifact should be clear enough that another engineer or agent can continue without reopening the same trade-offs.

It should:
- reflect prior context accurately
- capture concrete decisions rather than vague aspirations
- show which options were genuinely considered
- make the accepted trade-offs explicit
- separate facts from assumptions
- preserve unresolved questions where certainty is not yet possible
- make the next step obvious

The discussion itself should also feel high quality:
- the user can usually respond by choosing from clear options
- freeform responses remain welcome at every stage
- the skill offers natural opportunities to stop, continue, or deepen
- the skill feels thoughtful and creative without becoming theatrical or noisy
- the user can tell what has been decided and what still remains

## Non-Goals

This skill is not for:
- broad ideation
- implementation planning in detail
- architecture design in depth
- low-level style bikeshedding
- unconstrained product brainstorming

Those may follow after the context artifact is complete.

## Suggested Next Skills

These are suggestions, not required steps:
- `afk-advanced-elicitation` if the decision artifact needs a stronger refinement pass
- `afk-doc-craft` if the decision artifact needs to become cleaner, more readable, or more user-facing
- `afk-note` if the most important decisions should also be preserved in lightweight durable memory
*** End of File
