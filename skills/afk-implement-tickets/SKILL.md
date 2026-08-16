---
name: afk-implement-tickets
description: Implement checkpointed local or remote tickets with statuses, review gates, handoff notes, parallel-agent coordination, interruption recovery, and durable progress state.
metadata:
  short-description: Implement tickets with status, validation, and handoff tracking.
---

# Implement Tickets
Keep implementation state visible in the selected tracking home. The tracking home is the source of truth for its slice.

## Activation
Use after executable local or remote tickets exist. If there is only a spec, plan, goal package, unsliced parent issue, or rough implementation context, create tickets first, typically with `afk-to-tickets` or another approved slicing source.

If the user asks to resume task implementation, use [resume.md](references/resume.md).

Skip tiny one-shot edits unless the user asks.

## Tracking Home
Resolve the ticket identifier before implementation.

- For a local ticket file, use that file as the tracking home and continue with the existing workflow.
- For a remote ticket, ask whether to create a local Markdown counterpart and track implementation locally, or keep implementation tracking in the remote source through an available remote mechanism.

When remote tracking is chosen, inspect the available mechanism and agree with the user where the ticket status, execution evidence, review gates, findings, and handoff notes will live. Use that location as the tracking home.

Keep local tracking artifacts outside agent-created commits unless the user or repository convention explicitly opts them in. Remote tracking remains external to Git unless a local counterpart is selected.

Begin implementation only after one tracking home is selected and can preserve the required ticket state. Treat any secondary representation as a reference unless the user explicitly agrees to a synchronization contract.

For a local counterpart, follow the active repo or user artifact convention.

The selected tracking home is the only required tracking artifact.

For parallel work, assign exact tickets. Each agent updates only its assigned tracking home and directly relevant handoff notes.

When parallel work needs separate worktrees, prefer `yggtree` when available before falling back to native git worktree commands.

## Active Ticket
Choose the active ticket in this order:

1. The ticket explicitly named by the user.
2. Any ticket marked `in_progress`, `validating`, or `review`.
3. The first unblocked `pending` ticket in dependency order.

Before starting, read blockers and previous ticket `Handoff Notes` when they affect the current slice.

## Ticket State
Keep this state in the selected tracking home. For a local Markdown ticket, use frontmatter as the current-state dashboard:

```yaml
---
id: <NN>
title: <Ticket title>
status: in_progress
blocked_by: []
source: <artifact-or-issue-reference>
review_base: <commit recorded before implementation>
updated_at: 2026-06-15T16:40:00-03:00
review_gates:
  code: pending
---
```

Statuses: `pending`, `in_progress`, `validating`, `review`, `blocked`, `done`.

Allowed review gates are `code`, `design`, and `product`. Every implementation ticket has a `code` gate. Add `design` for visual parity against an explicit reference, and `product` for user-facing behavior, copy, workflow, or product-fit validation.

Review gates use `pending` and `accepted`. The `code` gate also allows `changes_requested` and `awaiting_acceptance`:

- `pending`: automated code review has not completed.
- `changes_requested`: the latest review has actionable findings.
- `awaiting_acceptance`: automated review has no actionable findings and awaits the user's final judgment.
- `accepted`: the user accepted the code gate.

Keep the ticket status `review` while any review gate remains open. Retain every review round under `## Code Review Findings — Round N`:

- For actionable findings, preserve the complete review output plus the judgment and resolution for each finding.
- For a clean review, keep a compact receipt with the reviewed range, finding count per axis, verification gaps, and `awaiting_acceptance` gate state.

A user-approved external code review, including Plannotator Review when used, may move the code gate from `awaiting_acceptance` to `accepted`.

Do not name gates after evidence sources such as tests, lint, Figma, or backend contracts. Record those under validation or discipline evidence.

Use `blocked_by` for ticket dependencies, human decisions, missing context, or external blockers.

## Execution Evidence
Record the selected execution bundle before implementation begins: `tdd`, `source-driven-development`, `doubt-driven-development`, normal project validation, or a combination.

Use `tdd` when the ticket has a meaningful public Test Seam. Treat the seam approved with the ticket as pre-agreed. If the seam is missing, ambiguous, or invalidated by codebase evidence, agree on it with the user before writing tests. Use normal validation with an explicit skip reason when no meaningful executable seam exists.

Before moving a ticket to `review`, record evidence for each selected discipline:

- `tdd`: failing-test evidence before implementation when practical, then the passing run after implementation. If literal test-first was skipped, record why and the nearest proof used.
- `source-driven-development`: official docs or primary sources consulted, version signals checked, and source-backed implementation decisions or unresolved gaps.
- `doubt-driven-development`: fresh-context adversarial review result, findings reconciled, and unresolved concerns escalated.
- Normal validation: tests, typechecks, lint, builds, runtime checks, browser checks, or a clear reason a check could not run.

Do not mark the ticket `review` while selected discipline evidence is missing without an explicit skip reason.

During implementation, run the narrowest relevant test files and relevant typechecking regularly. Before the code gate begins, run the complete relevant test suite and required project checks. If a full project suite is disproportionate, unavailable, or outside the ticket's validation boundary, record the reason and strongest substitute.

## Green Atomic Commits
Record the current `HEAD` as `review_base` before editing and keep it unchanged across every review round.

After each meaningful behavior slice is green, create a green atomic local commit from explicit ticket-owned paths. Preserve unrelated working-tree changes.

This workflow authorizes forward local commits for the active ticket. Rewriting history and any push, PR, publish, tag, or release action still require explicit user approval.

Commit every ticket-owned implementation change before opening the code gate. If local commits are unavailable, record the limitation and ask before continuing.

## Code Gate
After final validation, run `afk-code-review` from the unchanged `review_base`.

- If it reports actionable findings, set the code gate to `changes_requested`, preserve the findings, reconcile and fix them, commit the fixes, then review the complete original range again.
- If it reports no actionable findings, set the gate to `awaiting_acceptance`.
- Only user approval or a user-approved external review moves the gate to `accepted`.

Persist review evidence after each round. A tracking-only review receipt does not trigger another review; implementation fixes do.

## Ticket Record
Keep task-local state in the tracking home. Preserve `Parent` and `User Stories Covered` when present. Keep these sections or equivalent fields when creating or normalizing the record: `What To Build`, `Acceptance Criteria`, `Blocked By`, `Execution Bundle`, `Verification`, `Discipline Evidence`, `Implementation Notes`, `Changes`, `Review Gates`, `Review Guide`, `Code Review Findings`, and `Handoff Notes`.

If an existing ticket uses a different shape, preserve useful content and add missing sections or equivalent fields as they become relevant.

Record material deviations, assumptions, trade-offs, scope changes, surprising constraints, reviewer context, and next-agent context in the relevant tracking home. If a note belongs to a later slice, put it in that later ticket's `Handoff Notes`.

Before final handoff after implementation or review fixes:

- Record a ticket note for non-obvious behavior invariants.
- Create or update an ADR for reusable policy, ownership, shared component, integration contract, data/model, migration, or long-term product decisions.
- Record material simplification opportunities and offer `code-simplification`; do not silently refactor outside the checkpoint scope.

For ADR boundaries, see [notes-and-decisions.md](references/notes-and-decisions.md). For design/product reviewer guides, see [review-guides.md](references/review-guides.md).

## Operating Loop
1. Resolve the ticket identifier and select its tracking home.
2. If no executable ticket exists and the request is one quick action, use the available context to create a single local ticket and continue; otherwise recommend `afk-to-tickets` and stop.
3. Select the active ticket.
4. Read blockers and relevant previous handoff notes.
5. Record the selected execution bundle and confirm its Test Seam or skip reason.
6. Mark the active ticket `in_progress` before editing.
7. Implement one green behavior slice at a time and create its atomic local commit.
8. Record important scope changes, working set changes, and blockers as they happen.
9. Move to `validating`, run the complete relevant validation bundle, and record discipline evidence.
10. Commit remaining ticket-owned implementation changes.
11. Move to `review` and run the Code Gate workflow.
12. Run the checkpoint-notes/ADR check before final handoff.
13. Move to `done` only after every review gate is accepted.
14. For a local ticket, update `updated_at` whenever it changes; for a remote ticket, rely on or update the tracking home's equivalent modification signal.
