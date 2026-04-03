---
name: "afk-discuss-phase-context"
description: "Clarify phase-level implementation decisions before planning. Use when a project phase needs focused discussion, unresolved choices need to be surfaced, or a CONTEXT.md-style artifact should be created for downstream planning or research."
metadata:
  short-description: "Clarify phase-level decisions before planning and capture them in a reusable context artifact."
---

# Discuss Phase Context

Use this skill to gather the missing decisions that planning depends on.

Its job is not to brainstorm endlessly or expand scope. Its job is to identify what is still unclear about a specific phase, discuss those gray areas with the user, and produce a context artifact that downstream work can rely on.

## Goal

Extract the phase-specific decisions that researchers, planners, or implementers need so they can move forward without reopening the same questions.

Typical output:
- a context document for downstream planning
- a phase discussion summary
- another equivalent artifact requested by the user

## Inputs

Use whatever exists:
- a phase name, phase number, milestone, or workstream label
- existing project materials such as planning docs, requirement notes, specs, tickets, prior context summaries, or design notes
- relevant repository context and code patterns
- the user's current goals and constraints

If no formal phase structure exists, treat the user’s stated scope as the working phase.

## Core Principles

- Clarify implementation decisions, not broad product vision.
- Respect scope boundaries. If new capabilities emerge, capture them as deferred ideas instead of folding them into the current phase.
- Do not re-ask questions that have already been answered in existing artifacts.
- Ask only the highest-value questions needed to unblock planning.
- Capture concrete decisions, trade-offs, assumptions, and unresolved questions.

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

## Workflow

### 1. Identify the phase boundary

- Determine which phase, milestone, or scoped chunk of work is under discussion.
- If the phase is ambiguous, clarify it first.
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
- prior decisions that constrain the current phase

Summarize only the context that affects the current phase discussion.

### 4. Find the remaining gray areas

Identify 3-4 phase-specific decisions that still need clarification.

Good gray areas are concrete and relevant to the phase, for example:
- layout, interaction states, density, or flow for user-facing work
- responses, validation, auth, versioning, or error behavior for API work
- output shape, flags, modes, and failure handling for CLI or automation work
- structure, tone, depth, and navigation for documentation work
- naming, grouping, criteria, and exceptions for organizational work

Avoid generic buckets if the phase suggests more specific questions.

When presenting gray areas, prefer a compact choice list. For example:

```text
Phase Discussion Areas

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

You may recommend one or two areas to start with when the best next topic is obvious.

### 5. Discuss selected gray areas

- Present the unresolved areas in a compact list.
- Let the user choose which one to tackle first, or recommend an order if that helps.
- Go deep enough to turn vague preferences into actionable decisions.
- Keep the discussion centered on the current phase.

Suggested probing pattern:
- Ask a few focused questions, usually in a short round.
- Prefer choices plus a freeform option when possible.
- Use examples or contrasting options to make the trade-off concrete.
- Summarize what is now decided.
- Check whether the area is sufficiently clear or needs one more pass.
- Move to the next area once the current one is actionable.

Default rhythm:
- Start with up to 4 targeted questions for the selected area.
- Then pause and offer a checkpoint.
- If the user wants to go deeper, continue with another short round.
- If the user wants to move on, show the remaining unvisited areas.

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

### 6. Guard against scope creep

If the user introduces new capabilities or work that belongs outside the current phase:
- acknowledge the idea
- capture it as deferred work
- return to the current phase discussion

This skill should sharpen the current phase, not quietly expand it.

### 7. Write the context artifact

Produce a context document that is useful for downstream planning.

Preferred filename when writing a file:
- `artifacts/context/context-<phase-or-topic>.md`

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

Recommended sections:
- `Phase`
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
