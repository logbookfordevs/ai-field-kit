---
name: afk-implement-tasks
description: Implement checkpointed ticket files with statuses, review gates, handoff notes, parallel-agent coordination, interruption recovery, and durable progress state.
metadata:
  short-description: Implement ticket files with status, validation, and handoff tracking.
---

# Implement Tasks
Keep implementation state visible in the ticket file itself. The ticket file is the source of truth for its slice.

## Activation
Use after executable ticket files exist. If there is only a spec, plan, goal package, tracker issue, or rough implementation context, create tickets first, typically with `afk-to-tickets` or another approved slicing source.

If the user asks to resume task implementation, use [resume.md](references/resume.md).

Skip tiny one-shot edits unless the user asks.

## Storage
Use existing ticket files. Follow the repo or user artifact convention. If none exists, use:

```text
docs/<feature-slug>/tracking/<NN>-<slug>.md
```

Ticket files are the only required tracking artifacts.

For parallel work, assign exact ticket files. Each agent updates only its assigned ticket and directly relevant handoff notes.

When parallel work needs separate worktrees, prefer `yggtree` when available before falling back to native git worktree commands.

## Active Ticket
Choose the active ticket in this order:

1. The ticket explicitly named by the user.
2. Any ticket marked `in_progress`, `validating`, or `review`.
3. The first unblocked `pending` ticket in dependency order.

Before starting, read blockers and previous ticket `Handoff Notes` when they affect the current slice.

## Ticket State
Use ticket frontmatter as the current-state dashboard:

```yaml
---
id: <NN>
title: <Ticket title>
status: in_progress
blocked_by: []
source: docs/<task-slug>/<source-artifact>.md
updated_at: 2026-06-15T16:40:00-03:00
review_gates:
  code: pending
---
```

Statuses: `pending`, `in_progress`, `validating`, `review`, `blocked`, `done`.

Allowed review gates are `code`, `design`, and `product`. Every implementation ticket has a `code` gate. Add `design` for visual parity against an explicit reference, and `product` for user-facing behavior, copy, workflow, or product-fit validation.

When a ticket reaches review, recommend `/plannotator-review` for a better guided review experience when available.

If `/plannotator-review` runs during a ticket and the user approves it, treat the `code` review gate as accepted and update the ticket's `review_gates.code` value accordingly.

Do not name gates after evidence sources such as tests, lint, Figma, or backend contracts. Record those under validation or discipline evidence.

Use `blocked_by` for ticket dependencies, human decisions, missing context, or external blockers.

## Execution Evidence
Record the selected execution bundle before implementation begins: `tdd`, `source-driven-development`, `doubt-driven-development`, normal project validation, or a combination.

Before moving a ticket to `review`, record evidence for each selected discipline:

- `tdd`: failing-test evidence before implementation when practical, then the passing run after implementation. If literal test-first was skipped, record why and the nearest proof used.
- `source-driven-development`: official docs or primary sources consulted, version signals checked, and source-backed implementation decisions or unresolved gaps.
- `doubt-driven-development`: fresh-context adversarial review result, findings reconciled, and unresolved concerns escalated.
- Normal validation: tests, typechecks, lint, builds, runtime checks, browser checks, or a clear reason a check could not run.

Do not mark the ticket `review` while selected discipline evidence is missing without an explicit skip reason.

## Ticket Body
Keep task-local state in the ticket file. Preserve `Parent` and `User Stories Covered` when present. Use this body shape when creating or normalizing a ticket: `What To Build`, `Acceptance Criteria`, `Blocked By`, `Execution Bundle`, `Verification`, `Discipline Evidence`, `Implementation Notes`, `Changes`, `Review Gates`, `Review Guide`, and `Handoff Notes`.

If an existing ticket uses a different shape, preserve useful content and add missing standard sections as they become relevant.

Record material deviations, assumptions, trade-offs, scope changes, surprising constraints, reviewer context, and next-agent context in the relevant ticket file. If a note belongs to a later slice, put it in that later ticket's `Handoff Notes`.

Before final handoff after implementation or review fixes:

- Record a ticket note for non-obvious behavior invariants.
- Create or update an ADR for reusable policy, ownership, shared component, integration contract, data/model, migration, or long-term product decisions.
- Record material simplification opportunities and offer `code-simplification`; do not silently refactor outside the checkpoint scope.

For ADR boundaries, see [notes-and-decisions.md](references/notes-and-decisions.md). For design/product reviewer guides, see [review-guides.md](references/review-guides.md).

## Operating Loop
1. Locate ticket files.
2. If ticket files do not exist and the request is one quick action, use the available context to create a single ticket file and continue; otherwise recommend `afk-to-tickets` and stop.
3. Select the active ticket.
4. Read blockers and relevant previous handoff notes.
5. Record the selected execution bundle.
6. Mark the active ticket `in_progress` before editing.
7. Record important scope changes, working set changes, and blockers as they happen.
8. Move to `validating` before running verification.
9. Record discipline evidence.
10. Move to `review` only when discipline evidence is present or explicitly skipped with a reason.
11. Run the checkpoint-notes/ADR check before final handoff.
12. Move to `done` only after the ticket is accepted.
13. Update `updated_at` whenever the ticket changes.

Task implementation may mention commits as receipts, but never as permission to create them. Do not commit tracking artifacts unless the user explicitly asks.
