# Artifact Conventions

Use these conventions when AFK work creates or resumes durable workflow artifacts.

## Boundaries

- **PRD** captures product intent: problem, goals, scope, non-goals, success criteria, and stakeholder context.
- **Spec** captures behavior and design decisions: flows, acceptance criteria, edge cases, constraints, and relevant references.
- If the PRD or combined artifact lacks behavior needed for implementation, recommend the user to create/update a spec before writing the implementation plan.
- **RFC** captures a proposed direction for review before executable slicing.
- **Tickets** are executable planning artifacts: tracer-bullet slices, dependencies, acceptance criteria, execution bundle, Test Seam, and expected verification.
- **Implementation records** are execution artifacts: status, validation evidence, changes, review state, implementation notes, and handoff state for one implementation unit.

Create or update the smallest artifact that removes the current ambiguity. If a PRD already covers behavior well enough, do not split out a separate spec just for ceremony.

## Storage

- Follow the repo or user artifact convention first.
- Otherwise use:

```text
docs/
├── adr/          # <NNNN>-<slug>.md; centralized, numbered, durable
├── specs/        # <scope>.md, or <scope>/ for multiple files
├── tickets/      # <scope>/<NN>-<slug>.md
├── research/     # usually <scope>/
├── references/   # <scope>/; replaceable external inputs
└── tracking/     # <scope>/<slug>.md
```

- Use a concise kebab-case scope slug and reuse it across artifact types for one effort.
- Keep locally maintained sources in their artifact-type folder and replaceable external material under `references/`.

Treat generated workflow artifacts as local working artifacts unless the repo convention or user says otherwise.

## Notes

- Record implementation notes in the relevant Implementation Record.
- Create standalone notes only when the user asks or the repo already has that convention.
- Use ADRs for decisions that change architecture, ownership, integration contracts, data model, migration strategy, or long-term maintenance expectations.
- Preserve execution-bundle evidence where it affects review or resume safety.
