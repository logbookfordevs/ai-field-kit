---
name: afk-workflow
description: Apply the AFK workflow doctrine for PRDs, specs, RFCs, implementation plans, tracking files, and generated workflow artifacts. Use when work involves spec-driven development, planning artifacts, artifact storage, checkpointed implementation, or resuming/coordinating multi-step execution.
metadata:
  short-description: Apply AFK workflow doctrine for specs, plans, tracking, and artifact conventions.
---

# AFK Workflow

Use this skill as a behavior lens when the task involves PRDs, specs, RFCs, implementation plans, tracking files, generated workflow artifacts, or checkpointed execution.

This skill is not a full ceremony. It keeps artifact boundaries, storage, and handoff expectations consistent while letting the user choose the actual planning or execution method.

## Workflow Framing

- Treat the path from PRD/spec to implementation plan as a **workflow slice**, not the whole delivery lifecycle.
- Work may start before this slice with brainstorming, discovery, elicitation, deep interview, or similar clarification flows.
- Work usually continues after this slice with execution, testing, verification, review, and approval gates.

## Artifact Boundaries

- **PRD** explains the product vision, motivation, and why the work matters.
- **Spec** explains expected behavior, flow logic, and design intent. In smaller or solo contexts, it can absorb the PRD.
- **RFC** explains a proposed direction and invites review and feedback before implementation. In some team contexts, this document may be called an ERD.
- **Implementation Plan** is the technical execution artifact: files, types, interfaces, pseudocode, tasks, and build strategy.
- **Tracking** follows the implementation plan and records execution status, checkpoints, validation, and handoff notes.

## Artifact Storage

- Follow the repo or user artifact convention first.
- If no convention exists, store generated workflow artifacts under `docs/<task-slug>/`.
- Use a concise kebab-case task slug, such as `smart-filters` or `checkout-retry-flow`.
- Prefer `docs/<task-slug>/<task-slug>.<type>.md`, using clear suffixes such as `.prd.md`, `.spec.md`, `.rfc.md`, `.plan.md`, `.tracking.md`, `.test-plan.md`, `.test-spec.md`, `.brainstorming.md`, `.interview.md`, `.tradeoffs.md`, `.gemini.md`, and `.notes.md`.
- Keep passive fetched material, screenshots, exports, and source references under `docs/<task-slug>/references/` when they belong to the task.
- Treat generated workflow artifacts as local working artifacts unless the repo convention or the user says they should be committed.

## RFC Positioning

- RFC is **optional** and usually sits outside the core linear timeline, even when it happens between spec and implementation planning.
- Use RFC when external or cross-team feedback may change the spec, PRD, or implementation plan.
- Do not force RFC into every workflow.

## Implementation Planning Doctrine

- An implementation plan should act as an **execution index**, not a restatement of every prior document.
- Prefer task-oriented plans with **on-demand references** to the exact prior docs, sections, or snippets needed for that task.
- Optimize plans to reduce **context rot** and keep room for the codebase context that implementation will need.
- Prefer a structure where **1 task can map to 1 clean agent session** when that improves focus, traceability, or parallel work.
- When prior docs already exist, treat them as the primary planning source of truth.

## Execution Tracking

- For checkpointed or multi-step implementation, use `afk-execution-tracking` after the implementation plan exists and before execution starts.
- Keep one canonical tracking file per feature or plan. If no stronger convention exists, use `docs/<task-slug>/<task-slug>.tracking.md`.
- Parallel agents should update their assigned task sections in the canonical tracking file instead of creating competing status files.

## Behavior

- Do not create workflow artifacts for tiny one-shot edits unless the user asks.
- Do not turn every coding request into a spec-driven ceremony.
- If the user already has PRDs, specs, RFCs, plans, or tracking files, read those before inventing new structure.
- If a project uses a different established convention, follow that project convention and preserve AFK as a fallback lens.
