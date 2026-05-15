---
name: "afk-coding-tradeoffs"
description: "Discuss high-leverage UX and implementation trade-offs inside an already understood scope. Use when a feature is clear enough to build, but important local decisions about interaction behavior, composition strategy, code ownership, library commitments, or information design still need to be locked before coding."
metadata:
  short-description: "Resolve UX and implementation trade-offs before coding and capture the final decisions in a reusable artifact."
---

# Coding Trade-offs

Use this skill when the feature is already understood, but the work still has meaningful gray areas in UX, behavior, composition, or implementation strategy.

Its job is not to rediscover the product idea or do broad planning. Its job is to help the user make smart local decisions that materially change the result, then write those decisions down so future chats and agents do not have to reopen them.

## Goal

Resolve high-leverage UX and implementation trade-offs inside a bounded scope and produce a reusable decision artifact that downstream work can trust.

Typical output:
- a decision memo for downstream implementation
- a reusable trade-off record
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

This skill should feel guided, interactive, and easy to respond to.

Prefer:
- offering multiple concrete choices instead of only open-ended questions
- including a freeform option so the user can override the menu
- checking whether to continue, go deeper, move on, or stop
- making progress visible as decisions accumulate
- using lightweight visual formatting, including simple ASCII-style layouts, when that makes options easier to scan
- using the host runtime's interactive question UI when it exists, with plain-text menus as fallback only

The interaction should feel like a thoughtful engineering and UX trade-off discussion, not interrogation.

Important behavior to preserve:
- present unresolved areas as choices, not just prompts
- allow the user to choose, skip, go deeper, or stop
- keep the discussion moving in rounds
- show what remains unvisited so the user knows the shape of the session
- use simple visual layouts when they improve scanability
- discuss one trade-off area at a time by default
- avoid turning the session into a homework-style survey or matrix unless the user explicitly asks for a batched pass

What this skill is intentionally not:
- not broad ideation
- not macro architecture design
- not a power-user bulk questionnaire
- not a full implementation plan
- not a worksheet that asks the user to answer every gray area in one reply

The intended feel is:
- collaborative
- paced
- engineering-minded
- product-aware
- easy to answer in the moment

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

When the host environment provides an interactive question mechanism, use it by default for:
- choosing the next trade-off area to discuss
- option-based decision questions inside a selected area
- checkpoints such as go deeper / move on / stop

Examples of acceptable host-native mechanisms:
- Codex CLI: use `request_user_input` for structured multiple-choice questions
- Claude Code: use `AskUserQuestion` for equivalent structured prompts
- equivalent runtime-native interactive question tools in other hosts

Use plain-text numbered menus only when:
- no interactive question mechanism is available
- the environment is explicitly text-only
- the user has already switched into a freeform explanation and forcing a menu would be awkward
- the question genuinely needs an open written answer instead of a menu choice

Do not silently drift from interactive prompts into plain-text menus just because one answer was freeform.
After a freeform reply, return to the interactive question mechanism for the next option-based choice when the tool is available.

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

This step is for identifying candidate areas, not fully expanding them yet.
Do not attach full option trees to every area at this stage.
The purpose here is to help the user choose what to discuss first.

When presenting trade-off areas, prefer a compact initial picker that lets the user choose one or more areas to cover without turning the session into a worksheet.

Example initial picker:

```text
Coding Trade-off Areas
(Select one or more. We will discuss them one by one.)

[ ] Interaction behavior
    Should this flow be modal, drawer-based, inline, or something else?

[ ] Component ownership
    Should this behavior live in one shared controller or stay composable per item?

[ ] Data / state strategy
    What actually needs to be reactive, and what can stay outside render state?

[ ] Library commitment
    Do we want a library here, and if so, which style of usage keeps the code clearer?

[ ] Custom trade-off area: ________________________
[ ] Stop discussion and create context with current decisions
```

Preferred behavior:
- if the user adds a custom area, include it in the selected set before discussion starts
- if multiple areas are selected, discuss them one by one in sequence
- if only one area is selected, start there directly

You may recommend one area to start with only when the best next topic is genuinely obvious and there is a concrete reason to say so.
If you recommend a starting area:
- keep it to one short sentence
- tie it to an actual dependency, risk, or sequencing reason
- do not present a broad opinionated analysis before the user chooses

If there is no strong reason, present the areas neutrally and let the user choose.

When an interactive question tool exists, present these candidate areas through that tool by default instead of plain text.

Important interpretation rule:
- if the user says "discuss all", "cover all", or "go through all of them", interpret that as "discuss all areas in sequence"
- do not interpret that as "ask about all areas in one message"
- only switch to a true batched worksheet when the user explicitly asks for all-at-once, one-message, matrix, worksheet, or single-reply mode

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

Do not expand all areas in parallel unless the user explicitly asks for a matrix, worksheet, batch pass, or all-at-once comparison.
Do not pre-solve the whole session before the first area is chosen.

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

Do not present a full decision survey across all unresolved areas unless the user explicitly asks for a matrix, scorecard, or all-at-once comparison.

If the user chooses "all", the correct behavior is:
1. acknowledge that all areas will be covered
2. pick the first area or ask which one to start with
3. discuss that one area only
4. checkpoint
5. continue to the next remaining area

The incorrect behavior is:
- expanding every area immediately
- asking for compact coded answers like `1a, 2b, 3c`
- turning "all" into "all at once"

Default rhythm:
- Start with up to 4 targeted questions for the selected area.
- Then pause and offer a checkpoint.
- If the user wants to go deeper, continue with another short round.
- If the user wants to move on, show the remaining unvisited areas.

Good question shape for a selected area:
- concrete
- contrastive when helpful
- easy to answer with a choice or short freeform reply
- informed by prior context or codebase reality when available
- high leverage according to the Interesting Trade-off Filter

Bad question shape:
- long survey pages
- asking for answers to multiple unrelated areas at once
- dumping every option for every unresolved topic before the user has chosen a direction
- giving your opinion on every gray area before the user has selected one
- bikeshedding style or syntax
- asking about choices already settled by conventions

When helpful, present question options like this:

```text
Choose the closest fit:

1. Compact and fast
   Fewer steps, lighter UI, minimal guidance

2. Guided and explicit
   Clear progress, more prompts, safer defaults

3. Power-user oriented
   More flexibility, more configuration, less hand-holding

f. None of these - I want something different
x. Stop here for now
```

After each area, use a checkpoint. Preferred pattern:

```text
Current status: Interaction model is mostly clear.

What next?
1. Go one level deeper on this area
2. Move to the next trade-off area
3. Capture this and create the context artifact
f. Something else
x. Stop
```

If the user wants to continue, deepen the same area with sharper questions. If the user wants to move on, carry forward the decisions already made.

When the current step is still an option-based choice, return to the interactive question UI if available.
Do not keep the rest of the session in plain text unless the environment requires it.

When moving on, prefer showing the remaining areas explicitly. For example:

```text
Remaining areas:
- Error behavior
- State strategy
- Library usage style
```

Good default shape:
1. show the candidate gray areas
2. choose one
3. discuss that one area only
4. summarize what is now decided
5. ask whether to go deeper, move to the next area, or stop

Avoid this shape by default:
- defining all decision areas in detail
- providing options for all of them at once
- asking the user to respond with a full numbered matrix

Bad example:

```text
1. Runtime: pick 1/2/3
2. Visual style: pick 1/2/3
3. Architecture: pick 1/2/3
4. Rewrite scope: pick 1/2/3
Reply like 1-2, 2-1, 3-3, 4-2
```

That is a batched worksheet, not the default AFK discussion experience.

Better example:

```text
Coding Trade-off Areas
(Select one or more. We will cover them in sequence.)

[ ] Runtime and pacing
[ ] Visual treatment of V1
[ ] Rewrite scope
[ ] Custom trade-off area: ________________________
[ ] Stop and capture current decisions
```

Then, after the user picks one or more:

```text
Selected:
- Runtime and pacing
- Rewrite scope

Let's talk about runtime and pacing first.

Choose the closest fit:
1. Full-length version
2. Tightened but still legible
3. Condensed product-demo cut
f. Something else
x. Stop here
```

Bad recommendation style:
- "I recommend we start with X" with no concrete reason
- "Best next area" when the user has not asked for steering
- giving recommendations for several areas before any one is selected

Better recommendation style:
- "If you want, we can start with runtime because it affects the pacing of every later scene."
- or no recommendation at all when the areas are equally discussable

### 6. Guard against scope creep

If the user introduces new capabilities or work that belongs outside the current slice:
- acknowledge the idea
- capture it as deferred work
- return to the current phase discussion

This skill should sharpen the current scope, not quietly expand it.

### 7. Write the decision artifact

Produce a decision document that is useful for downstream implementation and future chats.

When writing a file, follow the repo or user artifact convention. If none exists, follow the AFK default from `afk-workflow`.

This artifact is mandatory, even if the conversation was short.

Recommended sections:
- `Goal`
- `Scope`
- `Gray Areas Discussed`
- `Options Considered`
- `Truss Evaluation`
- `Decisions`
- `Trade-offs Accepted`
- `Open Questions`
- `Next Step`

Adapt section names to the repository’s conventions when needed.

When the discussion was interactive, preserve that value in the artifact:
- record the final decisions, not every conversational branch
- include notable rejected options only when they explain an important boundary
- reflect where the user explicitly chose one direction over another

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
- `afk-documentation-authoring` if the decision artifact needs to become cleaner, more readable, or more user-facing
- `afk-note` if the most important decisions should also be preserved in lightweight durable memory
*** End of File
