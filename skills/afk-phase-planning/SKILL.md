---
name: afk-phase-planning
description: Turn a clear brief, context artifact, or refined plan into small reviewable implementation phases. Use when the work is understood well enough to sequence, but the user wants execution-agnostic phase slices with checkpoints, validation focus, and room for human revision before coding starts.
metadata:
  short-description: Break clear work into reviewable, human-centered implementation phases.
---

# Phase Planning

Use this skill to turn a clear artifact into a phase plan that is easy to review, easy to execute in slices, and easy to revise with the human before implementation begins.

This skill does not execute the work. It prepares the work for execution.

The experience should feel like collaborative phase design:
- serious about boundaries and checkpoints
- flexible enough to revise phase order and scope
- open to placeholder phases when the future is not fully known yet
- structured enough that the human can react quickly without rereading everything

## Goal

Produce a phase plan that helps a human and any coding agent move through implementation in clean, reviewable chunks.

Typical output:
- one primary phase-plan artifact
- a reviewed and revised sequence of phases
- clear validation focus for each phase
- explicit room for future or tentative phases when needed

## Inputs

Use whatever exists:
- a brief, spec, context artifact, interview artifact, or refined draft
- upstream AFK artifacts such as analysis, context, interview, or elicitation outputs
- relevant codebase context and architecture signals
- user constraints around risk, reviewability, deadlines, and execution style

If no artifact exists yet, this skill should not invent one from scratch. First ask for the best available source artifact or suggest an upstream skill.

## Core Principles

- Plan phases, not implementation details.
- Optimize for human reviewability, not automation theater.
- Keep phases meaningful and distinct.
- Prefer 3-5 phases by default. Go higher only when complexity clearly demands it.
- Each phase should leave the work in a more stable, reviewable state.
- Make validation focus explicit so the user knows what to inspect before moving on.
- Keep execution agnostic: the user may implement manually, with an agent, or with another framework.
- Treat the phase plan as a living artifact. Draft first, revise with the human, then settle the current version.
- Prefer vertical value slices when possible, but use foundational phases first when contracts or architecture genuinely need them.

## Use When

- the work is understood but still feels too large to implement in one pass
- the user wants git diffs split into cleaner reviewable slices
- the user wants a human-centered implementation sequence without adopting an execute framework
- a brief or context artifact needs to become buildable in stages
- the user wants to reserve future enhancement phases without fully defining them yet

## Do Not Use When

- the problem is still vague and needs discovery more than sequencing
- the user only needs a requirements artifact, not an implementation structure
- the work is so small that one reviewable change is enough
- the user is asking for task-by-task execution rather than phase planning

## Workflow

### 1. Load the source artifact

- Read the best available upstream artifact or artifacts.
- Identify:
  - the real goal
  - scope boundaries
  - non-goals
  - major dependencies
  - major unknowns
  - likely risk surfaces

If the source material is still too fuzzy to phase cleanly, say so and recommend the most useful upstream skill.

### 2. Find the natural phase boundaries

Look for review-friendly boundaries such as:
- contracts, types, schemas, or interfaces
- data flow and core logic
- foundational UI or workflows
- integration surfaces
- hardening, polish, or enhancement passes

Prefer phase boundaries that make git diffs easier to understand.

Good phase design should help the user say:
- "I can review this phase coherently"
- "I know what should be true before the next phase starts"

Bad phase design usually looks like:
- one giant phase that mixes contracts, logic, UI, polish, and cleanup
- phases split by technical layer when the user really needs reviewable behavior slices
- late phases that secretly contain foundational changes that should have happened earlier

When possible, prefer a split such as:
- foundation or contracts
- one or more core working slices
- hardening or polish

### 3. Draft the initial phase plan

Create an initial phase draft with a small number of phases.

Each phase should include:
- `Phase`
- `Objective`
- `Scope`
- `Non-goals`
- `Dependencies`
- `Likely Surfaces Touched`
- `Validation Focus`
- `Review Checkpoint`
- `Definition Level`
- `Progress Markers`
- `Implementation Notes` (optional)

`Definition Level` should be one of:
- `firm` when the phase is well defined now
- `provisional` when the phase is intentionally reserved for later clarification

Provisional phases are valid. Use them when the user knows a future slice should exist but does not want to over-specify it yet.

### 4. Present the phase draft for discussion

Do not treat the first draft as final.

Present the draft as a working proposal and invite revision.

When presenting the draft:
- briefly explain why the work was split this way
- call out which phases are firm vs provisional
- identify the riskiest or least-settled phase
- make it easy for the human to react with a small edit instead of a full rewrite

Support revision moves such as:
- add a phase
- remove a phase
- merge two phases
- split one phase
- reorder phases
- defer something into a later phase
- mark a phase as provisional

When helpful, use a compact menu like this:

```text
Phase Plan Revision

1. Keep the phase structure as drafted
2. Add a new phase
3. Merge or split phases
4. Reorder phases
5. Mark a later phase as provisional
f. Something else
x. Stop here
```

The skill should stay open to follow-up edits after the file exists. The artifact is the current plan, not permanent truth.

Preferred checkpoint pattern after the first draft:

```text
Current phase draft is ready.

What would you like to change?
1. Keep it as-is
2. Add a later enhancement phase
3. Split or merge a phase
4. Reorder the sequence
5. Mark a phase as provisional for now
f. Something else
x. Stop here
```

If the user asks for a phase that is intentionally rough, add it anyway and mark it `provisional` instead of forcing premature detail.

### 5. Write the phase-plan artifact

Preferred filename when writing a file:
- `artifacts/phases/phase-plan-<topic-or-slug>.md`

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

Prefer one primary artifact, not a set of phase files.

Recommended structure:
- `Goal`
- `Source Artifacts`
- `Implementation Strategy`
- `Phases`
- `Phase Order Rationale`
- `Cross-Phase Risks`
- `Open Questions`
- `Suggested Next Step`

Each phase block should stay compact and review-oriented.

Within the `Phases` section, prefer this compact shape:
- `Phase`
- `Definition Level`
- `Objective`
- `Scope`
- `Non-goals`
- `Dependencies`
- `Likely Surfaces Touched`
- `Validation Focus`
- `Review Checkpoint`
- `Progress Markers`
- `Implementation Notes` (optional)

`Likely Surfaces Touched` should be slightly technical when the source artifact supports it.

Good examples:
- API contract and shared types
- auth middleware and request validation
- profile form UI and save flow
- animation layer and transition states

When confidence is high, this may include specific likely files or modules. Keep it directional, not overcommitted.

`Progress Markers` should stay lightweight.

Use 3-5 short checklist items that help a later chat or agent quickly see:
- what this phase is trying to complete
- what part of the phase may already be done
- whether the phase is ready for review

Do not turn `Progress Markers` into a detailed task breakdown.

Good examples:
- contract and types align with the phase intent
- core user path works end to end
- failure path is handled acceptably
- phase-ready diff is available for review

Bad examples:
- a long engineering to-do list
- implementation instructions better suited for an executor
- checklist items that duplicate the whole phase description

`Implementation Notes` are optional and should stay brief.

Use them only when they improve trust for a later agent or chat, for example:
- a likely sequence inside the phase
- an important boundary to preserve
- a contract or dependency that should be settled first

Do not turn `Implementation Notes` into a full technical plan document.

### 6. Close with execution-agnostic guidance

End by making the handoff clear:
- the phase plan is ready to use
- the user may execute the next phase however they prefer
- the user may return to revise the plan before or after any phase

Do not force a specific execution method.

## Output Quality Bar

A good phase plan should:
- feel easier to implement than the source artifact
- make review order obvious
- separate foundational work from later polish
- avoid mixing unrelated concerns in the same phase
- preserve non-goals so phases do not quietly expand
- make validation expectations visible
- leave room for later enhancement phases when that matches the user's real planning style
- let the human quickly say "yes, this sequence makes sense" or "change phase 3 like this"
- let the next agent quickly recover where a phase likely stopped without reading the entire chat history

## Red Flags

- phases read like a task list with too much implementation detail
- progress markers expand into a detailed execution plan
- every phase is equally vague, so review order is not actually clearer
- a provisional future phase is forced into false precision
- the first draft is written as if the user should only approve or reject it
- the plan makes execution choices that belong to another framework or the user's own workflow

## Anti-Rationalizations

| Rationalization | Better move |
|---|---|
| "Let's just start coding and figure phases out later" | Create at least a minimal phase plan so review boundaries are intentional. |
| "This should be one giant phase because it's all related" | Related work can still be split into cleaner reviewable slices. |
| "We need every future phase fully defined right now" | Use provisional phases when a later slice is real but not ready to specify in detail. |
| "This is basically a task list" | Keep the output at the phase level. Tasks belong to execution style, not this skill. |
| "The first draft is good enough" | Review the phase plan with the human before treating it as the working sequence. |

## Suggested Next Skills

These are suggestions, not required steps:
- use `afk-phase-planning` after `afk-business-analyst`, `afk-deep-interview`, `afk-discuss-phase-context`, or `afk-advanced-elicitation` when the work is clear enough to sequence
- use `afk-advanced-elicitation` if the phase plan itself needs a stronger critique or simplification pass
- use `afk-note` if important phase decisions or future enhancements should be preserved outside the main phase artifact
- use `afk-archive-artifact` when an old phase plan is superseded by a newer one
- move into implementation with any execution style the user prefers once the phase order feels solid
