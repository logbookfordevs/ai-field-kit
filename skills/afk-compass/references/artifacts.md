# AFK Artifact Conventions

Use these conventions when AFK work creates or resumes durable workflow artifacts.

## Boundaries

- **PRD** captures product intent: problem, goals, scope, non-goals, success criteria, and stakeholder context.
- **Spec** captures behavior and design decisions: flows, acceptance criteria, edge cases, constraints, and relevant references.
- If the PRD or combined artifact lacks behavior needed for implementation, recommend the user to create/update a spec before writing the implementation plan.
- **RFC** captures a proposed direction for review before executable slicing.
- **Checkpoint packets** are execution artifacts: thin vertical slices, dependencies, acceptance criteria, execution bundle, verification, handoff notes, and review gates (a.k.a implementation plan fragmented)
- **Tracking** updates checkpoint packets with status, validation, review, implementation notes, and handoff state.

Create or update the smallest artifact that removes the current ambiguity. If a PRD already covers behavior well enough, do not split out a separate spec just for ceremony.

## Storage

- Follow the repo or user artifact convention first.
- If no convention exists, use `docs/<task-slug>/`.
- Use concise kebab-case task slugs, such as `smart-filters` or `checkout-retry-flow`.
- Prefer `docs/<task-slug>/<task-slug>.<type>.md` for PRDs, specs, RFCs, and related source artifacts.
- Store executable checkpoint packets under `docs/<task-slug>/tracking/`.
- Store ADR-style decisions under `docs/<task-slug>/decisions/`.
- Store passive fetched material, screenshots, exports, and source references under `docs/<task-slug>/references/`.

Treat generated workflow artifacts as local working artifacts unless the repo convention or user says otherwise.

## Notes

- Record implementation notes in the relevant checkpoint packet.
- Create standalone notes only when the user asks or the repo already has that convention.
- Use ADRs for decisions that change architecture, ownership, integration contracts, data model, migration strategy, or long-term maintenance expectations.
- Preserve execution-bundle evidence where it affects review or resume safety.
