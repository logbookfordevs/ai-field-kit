---
name: afk-execution-tracking
description: Track executable AFK checkpoint packets with statuses, review gates, handoff notes, parallel-agent coordination, interruption recovery, and durable progress state.
metadata:
  short-description: Track implementation checkpoints, statuses, validation, and handoffs across agent sessions.
---

# Execution Tracking
Keep implementation state visible in the checkpoint packet itself. The packet is the source of truth for its slice.

## Activation
Use after executable checkpoint packets exist. If there is only a PRD/spec, plan, goal package, tracker issue, or rough implementation context, create checkpoint packets first, typically with `afk-to-tasks` or another approved slicing source.

If the user asks to resume tracked work, use [resume.md](references/resume.md).

Skip tiny one-shot edits unless the user asks.

## Storage
Use existing checkpoint packet files. Follow the repo or user artifact convention. If none exists, use:

```text
docs/<task-slug>/tracking/I001-short-title.md
```

Checkpoint packets are the only required tracking artifacts.

For parallel work, assign exact checkpoint files. Each agent updates only its assigned packet and directly relevant handoff notes.

When parallel work needs separate worktrees, prefer `yggtree` when available before falling back to native git worktree commands.

## Active Checkpoint
Choose the active checkpoint in this order:

1. The checkpoint explicitly named by the user.
2. Any checkpoint marked `in_progress`, `validating`, or `review`.
3. The first unblocked `pending` checkpoint in dependency order.

Before starting, read blockers and previous checkpoint `Handoff Notes` when they affect the current slice.

## Packet State
Use packet frontmatter as the current-state dashboard:

```yaml
---
id: I001
title: Short Title
status: in_progress
blocked_by: []
source: docs/<task-slug>/<source-artifact>.md
updated_at: 2026-06-15T16:40:00-03:00
review_gates:
  code: pending
---
```

Statuses: `pending`, `in_progress`, `validating`, `review`, `blocked`, `done`.

Allowed review gates are `code`, `design`, and `product`. Every implementation checkpoint has a `code` gate. Add `design` for visual parity against an explicit reference, and `product` for user-facing behavior, copy, workflow, or product-fit validation.

When a checkpoint reaches review, recommend `/plannotator-review` for a better guided review experience when available.

Do not name gates after evidence sources such as tests, lint, Figma, or backend contracts. Record those under validation or discipline evidence.

Use `blocked_by` for checkpoint dependencies, human decisions, missing context, or external blockers.

## Execution Evidence
Record the selected execution bundle before implementation begins: `tdd`, `source-driven-development`, `doubt-driven-development`, normal project validation, or a combination.

Before moving a checkpoint to `review`, record evidence for each selected discipline:

- `tdd`: failing-test evidence before implementation when practical, then the passing run after implementation. If literal test-first was skipped, record why and the nearest proof used.
- `source-driven-development`: official docs or primary sources consulted, version signals checked, and source-backed implementation decisions or unresolved gaps.
- `doubt-driven-development`: fresh-context adversarial review result, findings reconciled, and unresolved concerns escalated.
- Normal validation: tests, typechecks, lint, builds, runtime checks, browser checks, or a clear reason a check could not run.

Do not mark the checkpoint `review` while selected discipline evidence is missing without an explicit skip reason.

## Packet Body
Keep task-local state in the packet. Use this body shape when creating or normalizing a checkpoint packet: `What To Build`, `Acceptance Criteria`, `Execution Bundle`, `Verification`, `Discipline Evidence`, `Implementation Notes`, `Changes`, `Review Gates`, `Review Guide`, and `Handoff Notes`.

If an existing packet uses a different shape, preserve useful content and add missing standard sections as they become relevant.

Record material deviations, assumptions, trade-offs, scope changes, surprising constraints, reviewer context, and next-agent context in the relevant checkpoint file. If a note belongs to a later slice, put it in that later slice's `Handoff Notes`.

Before final handoff after implementation or review fixes:

- Record a checkpoint note for non-obvious behavior invariants.
- Create or update an ADR for reusable policy, ownership, shared component, integration contract, data/model, migration, or long-term product decisions.
- Record material simplification opportunities and offer `code-simplification`; do not silently refactor outside the checkpoint scope.

For ADR boundaries, see [notes-and-decisions.md](references/notes-and-decisions.md). For design/product reviewer guides, see [review-guides.md](references/review-guides.md).

## Operating Loop
1. Locate checkpoint packet files.
2. If checkpoint files do not exist, route to `afk-to-tasks`.
3. Select the active checkpoint.
4. Read blockers and relevant previous handoff notes.
5. Record the selected execution bundle.
6. Mark the active checkpoint `in_progress` before editing.
7. Record important scope changes, working set changes, and blockers as they happen.
8. Move to `validating` before running verification.
9. Record discipline evidence.
10. Move to `review` only when discipline evidence is present or explicitly skipped with a reason.
11. Run the checkpoint-notes/ADR check before final handoff.
12. Move to `done` only after the checkpoint is accepted.
13. Update `updated_at` whenever the checkpoint changes.

Tracking may mention commits as receipts, but never as permission to create them. Do not commit tracking artifacts unless the user explicitly asks.
