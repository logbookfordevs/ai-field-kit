---
name: "afk-discuss-implementation-decisions"
description: "Clarify implementation decisions for a bounded slice of work before planning. Use when a workstream, implementation slice, milestone, or phase has unresolved choices that need focused discussion and a reusable context artifact."
metadata:
  short-description: "Clarify implementation decisions before planning and capture them in a reusable context artifact."
---

# Discuss Implementation Decisions

Use this skill to gather the missing decisions that planning depends on.

Its job is not to brainstorm endlessly or expand scope. Its job is to identify what is still unclear about a specific bounded slice of work, discuss those gray areas with the user, and produce a context artifact that downstream work can rely on.

## Goal

Extract the scope-specific decisions that researchers, planners, or implementers need so they can move forward without reopening the same questions.

Typical output:
- a context document for downstream planning
- a scoped discussion summary
- another equivalent artifact requested by the user

## Inputs

Use whatever exists:
- a scope label such as a phase name, workstream, milestone, or implementation slice
- existing project materials such as planning docs, requirement notes, specs, tickets, prior context summaries, or design notes
- relevant repository context and code patterns
- the user's current goals and constraints

If no formal phase structure exists, treat the user’s stated scope as the working slice.

## Core Principles

- Clarify implementation decisions, not broad product vision.
- Respect scope boundaries. If new capabilities emerge, capture them as deferred ideas instead of folding them into the current slice.
- Do not re-ask questions that have already been answered in existing artifacts.
- Ask only the highest-value questions needed to unblock planning.
- Capture concrete decisions, trade-offs, assumptions, and unresolved questions.
- Default to live collaborative discussion, not bulk question generation.
- Treat pacing as part of the product: one area at a time is the default experience.

## Interaction Style

This skill should feel guided, interactive, and easy to respond to.

Prefer:
- offering multiple concrete choices instead of only open-ended questions
- including a freeform option so the user can override the menu
- checking whether to continue, go deeper, move on, or stop
- making progress visible as decisions accumulate
- using lightweight visual formatting, including simple ASCII-style layouts, when that makes options easier to scan

The interaction should feel like structured discovery, not interrogation.

Important behavior to preserve:
- present unresolved areas as choices, not just prompts
- allow the user to choose, skip, go deeper, or stop
- keep the discussion moving in rounds
- show what remains unvisited so the user knows the shape of the session
- use simple visual layouts when they improve scanability
- discuss one decision area at a time by default
- avoid turning the session into a homework-style survey or matrix unless the user explicitly asks for a batched pass

What this skill is intentionally not:
- not a codebase-first assumptions pass
- not a power-user bulk questionnaire
- not a full implementation plan
- not a worksheet that asks the user to answer every gray area in one reply

The intended feel is:
- collaborative
- paced
- builder-oriented
- easy to answer in the moment

## Workflow

### 1. Identify the scope boundary

- Determine which workstream, implementation slice, milestone, or phase is under discussion.
- If the scope is ambiguous, clarify it first.
- If a roadmap or phase list exists, use it. If not, infer a practical boundary from the user’s request.

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

Summarize only the context that affects the current scoped discussion.

### 4. Find the remaining gray areas

Identify 3-4 scope-specific decisions that still need clarification.

Good gray areas are concrete and relevant to the current slice of work, for example:
- layout, interaction states, density, or flow for user-facing work
- responses, validation, auth, versioning, or error behavior for API work
- output shape, flags, modes, and failure handling for CLI or automation work
- structure, tone, depth, and navigation for documentation work
- naming, grouping, criteria, and exceptions for organizational work

Avoid generic buckets if the current scope suggests more specific questions.

This step is for identifying candidate areas, not fully expanding them yet.
Do not attach full option trees to every area at this stage.
The purpose here is to help the user choose what to discuss first.

When presenting gray areas, prefer a compact choice list that helps the user choose the next area to discuss, not a full worksheet to answer all at once. For example:

```text
Decision Discussion Areas

1. Interaction model
   How should users move through this flow?

2. Error handling
   What should happen when validation fails or dependencies are unavailable?

3. Output shape
   What should the final artifact contain, and how detailed should it be?

4. Naming and structure
   How should this work be organized so it stays maintainable?

f. Something else in freeform
x. Stop discussion and create context with current decisions
```

You may recommend one area to start with when the best next topic is obvious.

### 5. Discuss selected gray areas

- Present the unresolved areas in a compact list.
- Let the user choose which single area to tackle first, or recommend one if that helps.
- Go deep enough to turn vague preferences into actionable decisions.
- Keep the discussion centered on the current scoped slice.

This is the core pacing rule:
- identify several gray areas
- expand only one area at a time
- summarize that area before moving on

Do not expand all areas in parallel unless the user explicitly asks for a matrix, worksheet, batch pass, or all-at-once comparison.

Suggested probing pattern:
- Ask a few focused questions for one area only, usually in a short round.
- Prefer choices plus a freeform option when possible.
- Use examples or contrasting options to make the trade-off concrete.
- Summarize what is now decided.
- Check whether the area is sufficiently clear or needs one more pass.
- Move to the next area once the current one is actionable.

Do not present a full decision survey across all unresolved areas unless the user explicitly asks for a matrix, scorecard, or all-at-once comparison.

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

Bad question shape:
- long survey pages
- asking for answers to multiple unrelated areas at once
- dumping every option for every unresolved topic before the user has chosen a direction

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
2. Move to the next gray area
3. Capture this and create the context artifact
f. Something else
x. Stop
```

If the user wants to continue, deepen the same area with sharper questions. If the user wants to move on, carry forward the decisions already made.

When moving on, prefer showing the remaining areas explicitly. For example:

```text
Remaining areas:
- Error handling
- Output shape
- Naming and structure
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
Decision areas

1. Runtime and pacing
2. Visual treatment of V1
3. Rewrite scope
f. Something else
x. Stop and capture current decisions
```

Then, after the user picks one:

```text
Let’s talk about runtime and pacing first.

Choose the closest fit:
1. Full-length version
2. Tightened but still legible
3. Condensed product-demo cut
f. Something else
x. Stop here
```

### 6. Guard against scope creep

If the user introduces new capabilities or work that belongs outside the current slice:
- acknowledge the idea
- capture it as deferred work
- return to the current phase discussion

This skill should sharpen the current scope, not quietly expand it.

### 7. Write the context artifact

Produce a context document that is useful for downstream planning.

Preferred filename when writing a file:
- `artifacts/context/context-<scope-or-topic>.md`

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

Recommended sections:
- `Scope`
- `Goal`
- `What Is Already Decided`
- `Gray Areas Discussed`
- `Decisions`
- `Constraints`
- `Assumptions`
- `Open Questions`
- `Deferred Ideas`
- `Relevant Code or Project Context`
- `Next Step`

Adapt section names to the repository’s conventions when needed.

When the discussion was interactive, preserve that value in the artifact:
- record the final decisions, not every conversational branch
- include notable rejected options only when they explain an important boundary
- reflect where the user explicitly chose one direction over another

## Output Quality Bar

The final context artifact should be clear enough that a planner or implementer can continue without having to ask the user the same questions again.

It should:
- reflect prior context accurately
- capture concrete decisions rather than vague aspirations
- separate facts from assumptions
- preserve unresolved questions where certainty is not yet possible
- make the next step obvious

The discussion itself should also feel high quality:
- the user can usually respond by choosing from clear options
- freeform responses remain welcome at every stage
- the skill offers natural opportunities to stop, continue, or deepen
- the skill feels thoughtful and creative without becoming theatrical or noisy
- the user can tell what has been decided and what still remains

## AFK Boundary

This skill intentionally keeps the default experience lighter than frameworks that expose multiple discuss modes.

For AFK, the default is enough:
- live discussion
- one area at a time
- compact checkpoints
- reusable context artifact at the end

Do not simulate extra modes unless the user explicitly asks for them.

## Non-Goals

This skill is not for:
- architecture design in depth
- implementation planning in detail
- performance tuning deep dives
- unconstrained product brainstorming

Those may follow after the context artifact is complete.

## Suggested Next Skills

These are suggestions, not required steps:
- `afk-advanced-elicitation` if the context document needs a stronger refinement pass before planning
- `afk-documentation-authoring` if the context artifact needs to become cleaner, more readable, or more user-facing
- `afk-note` if the most important decisions should also be preserved in lightweight durable memory
