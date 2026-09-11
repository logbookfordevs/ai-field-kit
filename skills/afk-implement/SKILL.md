---
name: afk-implement
description: Implement work with durable local or remote tracking, validation, review acceptance, handoff notes, parallel-agent coordination, and interruption recovery.
disable-model-invocation: true
metadata:
  short-description: Implement work with durable tracking, validation, and review.
---

# Implement
Implement from the user's source while keeping execution state visible in an Implementation Record. Its Tracking Home is the source of truth for the implementation unit.

## Activation
Use for tracked implementation from a ticket, spec, plan, prototype, prompt, or conversation. Read every source the user provides before shaping the implementation.

If the user asks to resume tracked implementation, use [resume.md](references/resume.md).

Skip tiny one-shot edits unless the user asks for tracked implementation.

## Implementation Records
Start with one Implementation Record. It persists across sessions, compactions, and handoffs; do not create one record per session.

Split only when the work has independently owned, validated, or reviewed implementation slices. Each implementing agent owns one record and its directly relevant handoff notes; research and review agents report into the record they support.

Before implementation, ask whether the Tracking Home should be local or use an available remote mechanism:

- **Local:** create a Markdown Implementation Record following the repository or user artifact convention.
- **Remote:** inspect the available mechanism and agree where status, execution evidence, review state, findings, and handoff notes will live.

An existing remote ticket may host the record when remote tracking is chosen. Otherwise keep the source artifact unchanged and reference it from the Implementation Record. Treat secondary representations as references unless the user agrees to a synchronization contract.

Keep local Implementation Records outside agent-created commits unless the user or repository convention explicitly opts them in. Remote tracking remains external to Git unless a local counterpart is selected.

The selected Tracking Home is the only required tracking artifact.

When parallel implementation needs separate worktrees, prefer `yggtree` when available before falling back to native Git worktree commands.

## Active Implementation
Choose the active record in this order:

1. The Implementation Record explicitly named by the user.
2. Any record marked `in_progress`, `validating`, or `review`.
3. The first unblocked `pending` record in dependency order.
4. A new record shaped from the provided source.

Before starting, read blockers and previous `Handoff Notes` when they affect the active implementation.

## Implementation State
Keep this state in the selected Tracking Home. For a local Markdown record, use frontmatter as the current-state dashboard:

```yaml
---
id: <scope-or-slice-id>
title: <Implementation title>
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

Keep the implementation status `review` until the review gate is accepted. Preserve the automatic review under `## Code Review Findings`:

- For actionable findings, preserve the complete review output plus the judgment and resolution for each finding.
- For a clean review, keep a compact receipt with the reviewed range, finding count per axis, verification gaps, and `awaiting_acceptance` gate state.

Use `blocked_by` for record dependencies, human decisions, missing context, or external blockers.

## Execution Evidence
Record the selected execution bundle before implementation begins: `tdd`, `source-driven-development`, `doubt-driven-development`, normal project validation, or a combination.

Use `tdd` when the implementation has a meaningful public Test Seam. Treat a seam approved in the source as pre-agreed. If the seam is missing, ambiguous, or invalidated by codebase evidence, agree on it with the user before writing tests. Use normal validation with an explicit skip reason when no meaningful executable seam exists.

Before moving an implementation to `review`, record evidence for each selected discipline:

- `tdd`: failing-test evidence before implementation when practical, then the passing run after implementation. If literal test-first was skipped, record why and the nearest proof used.
- `source-driven-development`: official docs or primary sources consulted, version signals checked, and source-backed implementation decisions or unresolved gaps.
- `doubt-driven-development`: fresh-context adversarial review result, findings reconciled, and unresolved concerns escalated.
- Normal validation: tests, typechecks, lint, builds, runtime checks, browser checks, or a clear reason a check could not run.

Do not mark the implementation `review` while selected discipline evidence is missing without an explicit skip reason.

During implementation, run focused tests and relevant typechecking. Run the complete relevant validation before review, or record the strongest available substitute.

## Green Atomic Commits
Record `HEAD` as `review_base` before editing. Keep it unchanged for any later user-requested review.

Forward local commits are authorized, not mandatory. Create a green atomic commit when a durable checkpoint improves the work.

Commit all implementation-owned changes before opening the automated Review Gate. When the user would benefit from reviewing a small or judgment-sensitive change first, hand off for pre-commit user review instead.

History rewrites and remote or public actions still require approval. If local commits are unavailable, ask.

## Review Gate
After final validation, run `afk-code-review` once automatically from `review_base`. If it reports findings, set `changes_requested`; judge each finding against the code and its cited source, fix warranted findings, record evidence for dismissals, revalidate, and commit. Do not rerun it automatically. Once the review is clean or warranted fixes are committed, set `awaiting_acceptance` and hand the gate to the user. The user decides whether fixes or later changes require another review; only the user's explicit acceptance, directly or through approval of an external review result such as Plannotator Review, sets `accepted`.

When the gate first reaches `awaiting_acceptance`, run `plannotator review --base <review_base>` if Plannotator is available. Its UI lets the user annotate, approve, or dismiss the final implementation range. Approval sets `accepted`. Annotations set `changes_requested` and return to implementation. Closing or dismissing it leaves the gate at `awaiting_acceptance`.

After resolving that session's outcome, run `plannotator annotate <implementation-record>` when the Tracking Home is a local file, and reconcile its feedback before final handoff. If Plannotator is unavailable, recommend installing it and continue the normal handoff.

## Implementation Record
Keep task-local state in the Tracking Home. Preserve source-specific fields such as `Parent` and `User Stories Covered` when present. Keep `What To Build`, `Acceptance Criteria`, `Blocked By`, `Execution Bundle`, `Verification`, `Discipline Evidence`, `Implementation Notes`, `Changes`, `Review Gate`, `Review Guide`, `Code Review Findings`, and `Handoff Notes`, or equivalent fields, as they become relevant.

Record material deviations, assumptions, trade-offs, scope changes, surprising constraints, reviewer context, and next-agent context in the relevant Implementation Record. If a note belongs to a later slice, put it in that record's `Handoff Notes`.

Before final handoff after implementation or review fixes:

- Record a note for non-obvious behavior invariants.
- Create or update an ADR for reusable policy, ownership, shared component, integration contract, data/model, migration, or long-term product decisions.
- Record material simplification opportunities and offer `code-simplification`; do not silently refactor outside the checkpoint scope.

For ADR boundaries, see [notes-and-decisions.md](references/notes-and-decisions.md). When implementation changes user-facing behavior, copy, or workflow, or acceptance needs visual judgment, follow [review-guides.md](references/review-guides.md).

## Operating Loop
1. Read every provided source and resolve the implementation scope.
2. Create or select one Implementation Record and choose its local or remote Tracking Home.
3. Split into additional records only for independently owned, validated, or reviewed slices.
4. Read blockers and relevant previous handoff notes.
5. Record the execution bundle and confirm its Test Seam or skip reason.
6. Mark the active implementation `in_progress` before editing.
7. Before editing, adopt a comment-free default: express intent through names, structure, and types; every new comment must preserve enduring, non-obvious code behavior.
8. Implement one green behavior slice at a time, creating atomic checkpoints when useful.
9. Record important scope changes, working set changes, and blockers as they happen.
10. Move to `validating`, run the complete relevant validation bundle, and record discipline evidence.
11. Commit remaining implementation-owned changes, or hand off for pre-commit user review.
12. Once implementation-owned changes are committed, move to `review` and run the Review Gate workflow.
13. Run the checkpoint-notes/ADR check before final handoff.
14. Move to `done` only after the review gate is accepted.
15. Update the Tracking Home's modification signal whenever its record changes.
