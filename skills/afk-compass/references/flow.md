# AFK Flow

Use Flow when the user asks for an "AFK workflow", "feature workflow", "start a workflow", "AFK run", or wants AFK to coordinate a feature lifecycle across phases.

Flow is the full AFK workflow: human-visible, artifact-aware, checkpointed, and phase-managed.

Use existing accepted artifacts as the output of their matching phase. Do not recreate them just to satisfy the sequence.

## Required Phases

1. **Orient:** apply [artifacts.md](artifacts.md) to locate or establish artifact boundaries, source references, and storage.
2. **Pressure:** use `grill-with-docs` for brownfield work or `grill-me` for greenfield work before PRD/spec work and before executable slicing.
3. **Specify:** use `afk-to-prd-spec` when no agent-ready PRD/spec exists or the existing artifact lacks behavior needed for implementation.
4. **Slice:** use `afk-to-issues` to create executable checkpoint packets from the PRD/spec, plan, goal package, tracker issue, or current context.
5. **Track:** use `afk-execution-tracking` as the continuity surface for checkpoint execution.
6. **Prove:** before implementation or delegation, select at least one execution discipline for each checkpoint: `tdd`, `source-driven-development`, `doubt-driven-development`, or normal project validation.

## Optional Branches

- Use `afk-brainstorming-facilitator` before Pressure when the target is too vague to grill.
- Use `afk-code-grill` when meaningful product, UX, component, ownership, library, or implementation choices remain open.
- Pair `afk-code-grill` with `afk-ui-registry-preferences` when UI primitives, registry components, or headless foundations are part of the decision.
- Use `prototype` when a throwaway code artifact would reduce uncertainty before PRD/spec, slicing, or implementation.

## Phase Rules

- Re-enter Compass after source gathering, user answers, drafts, plans, checkpoint review, or execution gates.
- Do not implement before checkpoint packets exist unless the task is intentionally leaving Flow.
- Do not delegate execution without the checkpoint file, selected execution discipline, and expected evidence.
