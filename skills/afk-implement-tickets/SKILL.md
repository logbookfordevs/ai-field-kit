---
name: afk-implement-tickets
description: Implement checkpointed local or remote tickets with statuses, review acceptance, handoff notes, parallel-agent coordination, interruption recovery, and durable progress state.
disable-model-invocation: true
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

When remote tracking is chosen, inspect the available mechanism and agree with the user where the ticket status, execution evidence, review state, findings, and handoff notes will live. Use that location as the tracking home.

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
review_gate: pending
---
```

Statuses: `pending`, `in_progress`, `validating`, `review`, `blocked`, `done`.

`review_gate` uses `pending`, `changes_requested`, `awaiting_acceptance`, and `accepted`:

- `pending`: automated code review has not completed.
- `changes_requested`: the latest review has findings being judged or fixed.
- `awaiting_acceptance`: the review was clean, or its findings were judged and warranted fixes were validated and committed; the gate awaits the user's final judgment.
- `accepted`: the user accepted the checkpoint.

Keep the ticket status `review` until the review gate is accepted. Preserve the automatic review under `## Code Review Findings`:

- For actionable findings, preserve the complete review output plus the judgment and resolution for each finding.
- For a clean review, keep a compact receipt with the reviewed range, finding count per axis, verification gaps, and `awaiting_acceptance` gate state.

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

During implementation, run focused tests and relevant typechecking. Run the complete relevant validation before review, or record the strongest available substitute.

## Green Atomic Commits
Record `HEAD` as `review_base` before editing. Keep it unchanged for any later user-requested review.

Commit each green behavior slice, and commit all ticket-owned implementation before review.

This authorizes forward local commits. History rewrites and remote or public actions still require approval. If local commits are unavailable, ask.

## Review Gate
After final validation, run `afk-code-review` once automatically from `review_base`. If it reports findings, set `changes_requested`; judge each finding against the code and its cited source, fix warranted findings, record evidence for dismissals, revalidate, and commit. Do not rerun it automatically. Once the review is clean or warranted fixes are committed, set `awaiting_acceptance` and hand the gate to the user. The user decides whether fixes or later changes require another review; only the user's explicit acceptance, directly or through approval of an external review result such as Plannotator Review, sets `accepted`.

## Ticket Record
Keep task-local state in the tracking home. Preserve `Parent` and `User Stories Covered` when present. Keep these sections or equivalent fields when creating or normalizing the record: `What To Build`, `Acceptance Criteria`, `Blocked By`, `Execution Bundle`, `Verification`, `Discipline Evidence`, `Implementation Notes`, `Changes`, `Review Gate`, `Review Guide`, `Code Review Findings`, and `Handoff Notes`.

If an existing ticket uses a different shape, preserve useful content and add missing sections or equivalent fields as they become relevant.

Record material deviations, assumptions, trade-offs, scope changes, surprising constraints, reviewer context, and next-agent context in the relevant tracking home. If a note belongs to a later slice, put it in that later ticket's `Handoff Notes`.

Before final handoff after implementation or review fixes:

- Record a ticket note for non-obvious behavior invariants.
- Create or update an ADR for reusable policy, ownership, shared component, integration contract, data/model, migration, or long-term product decisions.
- Record material simplification opportunities and offer `code-simplification`; do not silently refactor outside the checkpoint scope.

For ADR boundaries, see [notes-and-decisions.md](references/notes-and-decisions.md). When implementation changes user-facing behavior, copy, or workflow, or acceptance needs visual judgment, follow [review-guides.md](references/review-guides.md).

## Operating Loop
1. Resolve the ticket identifier and select its tracking home.
2. If no executable ticket exists and the request is one quick action, use the available context to create a single local ticket and continue; otherwise recommend `afk-to-tickets` and stop.
3. Select the active ticket.
4. Read blockers and relevant previous handoff notes.
5. Record the selected execution bundle and confirm its Test Seam or skip reason.
6. Mark the active ticket `in_progress` before editing.
7. Before editing, adopt a comment-free default: express intent through names, structure, and types; every new comment must preserve enduring, non-obvious code behavior.
8. Implement one green behavior slice at a time and create its atomic local commit.
9. Record important scope changes, working set changes, and blockers as they happen.
10. Move to `validating`, run the complete relevant validation bundle, and record discipline evidence.
11. Commit remaining ticket-owned implementation changes.
12. Move to `review` and run the Review Gate workflow.
13. Run the checkpoint-notes/ADR check before final handoff.
14. Move to `done` only after the review gate is accepted.
15. For a local ticket, update `updated_at` whenever it changes; for a remote ticket, rely on or update the tracking home's equivalent modification signal.
