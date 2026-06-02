---
name: afk-workflow
description: Apply AFK workflow doctrine for spec-oriented engineering work involving PRDs, specs, RFCs, implementation plans, tracking, handoff notes, or generated workflow artifacts. Skip quick one-shot operations with no workflow state, artifact, or handoff.
metadata:
  short-description: Apply AFK workflow doctrine for specs, plans, tracking, and artifact conventions.
---

# AFK Workflow

Use this skill as the default behavior lens for spec-oriented engineering work: discovery, brainstorming, elicitation, PRDs, specs, RFCs, implementation planning, execution, testing, validation, tracking, handoff, or generated workflow artifacts.

This skill is not a full ceremony. It keeps artifact boundaries, storage, and handoff expectations consistent while letting the user choose the actual planning or execution method.

Skip quick one-shot operations where no workflow state, artifact, or handoff is needed.


## Workflow Framing

- Treat the path from PRD/spec to implementation plan as a **workflow slice**, not the whole delivery lifecycle.
- Work may start before this slice with brainstorming, discovery, elicitation, deep interview, or similar clarification flows.
- Work usually continues after this slice with execution, testing, verification, review, and approval gates.
- A task does not need every workflow stage to qualify; meaningful context, decisions, validation, or handoff is enough.

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
- Prefer `docs/<task-slug>/<task-slug>.<type>.md`, using clear suffixes such as `.prd.md`, `.spec.md`, `.rfc.md`, `.plan.md`, `.tracking.md`, `.implementation-notes.md`, `.test-plan.md`, `.test-spec.md`, `.brainstorming.md`, `.interview.md`, `.tradeoffs.md`, `.gemini.md`, and `.notes.md`.
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

- Use `afk-execution-tracking` when explicitly requested, or when execution needs checkpoints, approval gates, handoff notes, parallel agents, interruption recovery, or durable progress state.
- Skip it for short, single-session implementations where the plan is concrete and final response plus validation are enough.
- Start tracking after a plan exists and before tracked execution begins.

## Implementation Notes

- During implementation from a PRD, spec, RFC, or plan, keep running notes for decisions the source artifact did not settle.
- Record deviations, assumptions, trade-offs, scope changes, surprising constraints, and anything the reviewer or next agent should know.
- Prefer the tracking file when one exists. Otherwise, use `docs/<task-slug>/<task-slug>.implementation-notes.md` when the work needs a handoff trail.
- If a decision changes architecture, ownership, integration contracts, data model, migration strategy, or long-term maintenance expectations, create or update an ADR under `docs/<task-slug>/decisions/` unless the repo has a stronger convention.
- Keep notes concise and decision-oriented. Skip them for quick one-shot edits.

## Behavior

- Do not create workflow artifacts for tiny one-shot edits unless the user asks.
- Do not turn every coding request into a spec-driven ceremony.
- If the user already has PRDs, specs, RFCs, plans, or tracking files, read those before inventing new structure.
- If a project uses a different established convention, follow that project convention and preserve AFK as a fallback lens.
