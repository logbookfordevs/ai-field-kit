# AFK Workflow Doctrine

## Workflow Framing
- Treat the path from PRD/spec to implementation plan as a **workflow slice**, not the whole delivery lifecycle.
- Work may start before this slice with brainstorming, discovery, elicitation, deep interview, or similar clarification flows.
- Work usually continues after this slice with execution, testing, verification, review, and approval gates.

## Artifact Boundaries
- **PRD** explains the product vision, motivation, and why the work matters.
- **Spec** explains the expected behavior, flow logic, and design intent. In smaller or solo contexts, it can absorb the PRD.
- **RFC** explains a proposed direction and invites review and feedback before implementation. In some team contexts, this document may be called an ERD.
- **Implementation Plan** is the technical execution artifact: files, types, interfaces, pseudocode, tasks, and build strategy.
- **Tracking** follows the implementation plan and records execution status, checkpoints, validation, and handoff notes.

## Artifact Storage
- Store generated workflow artifacts under `docs/<task-slug>/` by default.
- Use a concise kebab-case task slug, such as `smart-filters` or `checkout-retry-flow`.
- Use this folder for PRDs, specs, RFCs, implementation plans, tracking files, testing plans, acceptance notes, and task-specific references.
- Prefer `docs/<task-slug>/<task-slug>.<type>.md`, using clear suffixes such as `.prd.md`, `.spec.md`, `.rfc.md`, `.plan.md`, `.tracking.md`, `.test-plan.md`, `.test-spec.md`, `.brainstorming.md`, `.interview.md`, `.tradeoffs.md`, `.gemini.md`, and `.notes.md`.
- Keep passive fetched material, screenshots, exports, and source references under `docs/<task-slug>/references/` when they belong to the task.
- Treat these as local working artifacts unless the repo convention or the user says they should be committed.

## RFC Positioning
- RFC is **optional** and usually sits outside the core linear timeline, even when it happens between spec and implementation planning.
- Use RFC when external or cross-team feedback may change the spec, PRD, or implementation plan.

## Implementation Planning Doctrine
- An implementation plan should act as an **execution index**, not a restatement of every prior document.
- Prefer task-oriented plans with **on-demand references** to the exact prior docs, sections, or snippets needed for that task.
- Optimize plans to reduce **context rot** and keep room for the codebase context that implementation will need.
- Prefer a structure where **1 task can map to 1 clean agent session** when that improves focus, traceability, or parallel work.
- When prior docs already exist, treat them as the primary planning source of truth.

## Execution Tracking
- For checkpointed or multi-step implementation, use the `afk-execution-tracking` skill after the implementation plan exists and before execution starts.
- Keep one canonical tracking file per feature or plan at `docs/<task-slug>/<task-slug>.tracking.md`.
- Parallel agents should update their assigned task sections in the canonical tracking file instead of creating competing status files.
