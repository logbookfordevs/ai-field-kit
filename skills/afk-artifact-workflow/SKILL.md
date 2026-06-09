---
name: afk-artifact-workflow
description: Apply AFK artifact workflow doctrine for PRDs, specs, RFCs, implementation plans, tracking, handoff notes, source references, and generated workflow artifacts. Use when work needs durable artifact boundaries, storage conventions, next-artifact suggestions, or handoff state; skip quick one-shot operations.
metadata:
  short-description: Apply AFK artifact workflow for specs, plans, tracking, and conventions.
---

# AFK Artifact Workflow

Use this skill for artifact-oriented workflow work: PRDs, specs, RFCs, implementation plans, tracking notes, handoff notes, source references, or generated workflow artifacts.

This skill owns artifact boundaries, storage, and next-artifact suggestions. It does not choose the full skill sequence; return to `afk-compass` when the next phase needs planning, elicitation, trade-offs, execution discipline, debugging, review, UI, or documentation polish.

Skip quick one-shot operations where no workflow state, artifact, or handoff is needed.


## Artifact Boundaries

- **PRD** explains product intent: user problem, goals, scope, non-goals, success criteria, and stakeholder context.
- **Spec** explains behavior and design decisions: user flow, expected behavior, acceptance criteria, edge cases, constraints, and relevant design references. In small or solo contexts, PRD and spec can be combined when one artifact covers both responsibilities.
- If the PRD or combined artifact lacks behavior needed for implementation, create or update a spec before writing the implementation plan.
- **RFC** explains a proposed direction and invites review and feedback before implementation planning.
- **Implementation Plan** is the technical execution artifact: files, types, interfaces, pseudocode, tasks, and build strategy.
- **Tracking** follows the implementation plan and records execution status, checkpoints, validation, and handoff notes.

## Artifact Storage

- Follow the repo or user artifact convention first.
- If no convention exists, store generated workflow artifacts under `docs/<task-slug>/`.
- Use a concise kebab-case task slug, such as `smart-filters` or `checkout-retry-flow`.
- Prefer `docs/<task-slug>/<task-slug>.<type>.md`, using clear suffixes such as `.prd.md`, `.spec.md`, `.plan.md`, `.tracking.md`, etc.
- Keep ADR-style decision records under `docs/<task-slug>/decisions/` with sequential filenames such as `0001-shared-modal-ownership.adr.md`, unless the repo has a stronger ADR convention.
- Keep passive fetched material, screenshots, exports, and source references under `docs/<task-slug>/references/` when they belong to the task.
- Treat generated workflow artifacts as local working artifacts unless the repo convention or the user says they should be committed.

## RFC Positioning

- Create an RFC only when the user asks for one or confirms that team review is needed before implementation planning.

## Implementation Planning Doctrine

- An implementation plan should act as an **execution index**, not a restatement of every prior document.
- Prefer task-oriented plans with **on-demand references** to the exact prior docs, sections, or snippets needed for that task.
- Optimize plans to reduce **context rot** and keep room for the codebase context that implementation will need.
- Prefer a structure where **1 task can map to 1 clean agent session** when that improves focus, traceability, or parallel work.
- When prior docs already exist, treat them as the primary planning source of truth.

## Execution Tracking

- Route to `afk-execution-tracking` when the user requests it or execution needs checkpoints, approval gates, handoff notes, parallel agents, interruption recovery, or durable progress state.
- Skip tracking for short, single-session implementations where the plan is concrete and final response plus validation are enough.

## Implementation Notes

- Record only decisions the source artifact did not settle: deviations, assumptions, trade-offs, scope changes, surprising constraints, or reviewer handoff context.
- Prefer the tracking file when one exists. Otherwise, use `docs/<task-slug>/<task-slug>.implementation-notes.md` when the work needs a handoff trail.
- Use an ADR only for decisions that change architecture, ownership, integration contracts, data model, migration strategy, or long-term maintenance expectations.

## Behavior

- Do not create workflow artifacts for tiny one-shot edits unless the user asks.
- Do not turn every coding request into a spec-driven ceremony.
- If the user already has PRDs, specs, RFCs, plans, or tracking files, read those before inventing new structure.
- When current sources or artifacts are staged, suggest the next useful workflow artifact, such as PRD/spec, domain grill, implementation plan, tracking, or handoff, and explain why that artifact is the next useful one.
- If a project uses a different established convention, follow that project convention and preserve AFK as a fallback lens.
