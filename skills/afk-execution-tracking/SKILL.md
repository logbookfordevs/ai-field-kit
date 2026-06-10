---
name: afk-execution-tracking
description: Track implementation when explicitly requested or when execution needs checkpoints, approval gates, handoff notes, parallel agents, interruption recovery, or durable progress state after a plan exists.
metadata:
  short-description: Track implementation checkpoints, statuses, validation, and handoffs across agent sessions.
---

# Execution Tracking

Use this skill after an implementation plan exists and before or during execution.

The goal is to keep implementation state visible without turning the plan into a diary. The tracking file is the shared checkpoint ledger for agents and the responsible engineer.

## Use When

- the user explicitly asks for tracked execution
- execution has visible checkpoints, approval gates, or handoff notes
- execution should pause for engineer review before continuing
- work may resume in a later chat
- parallel agents need a shared status source
- the user wants divide-and-conquer implementation instead of one long build run

Do not use this skill for tiny one-shot edits unless the user asks for tracking.

## Storage

Create or update one canonical tracking index plus the active checkpoint file.

Follow the repo or user artifact convention. If none exists, use the AFK workflow default:

```text
docs/<task-slug>/<task-slug>.tracking.md
```

Use the same task slug as the related plan whenever possible.

For parallel work, keep one canonical tracking index per feature or plan. Each agent updates its assigned checkpoint file and the index row for that checkpoint. Create separate scratch notes only when they are clearly subordinate to the canonical tracking set.

Use the canonical `.tracking.md` as the entrypoint and put checkpoint-specific detail in sibling files under `tracking/`:

```text
docs/<task-slug>/<task-slug>.tracking.md
docs/<task-slug>/tracking/<checkpoint-slug>.md
```

When execution tracking is active, maintain a small runtime marker:

```text
.afk/execution-tracking/current.json
```

Write or update it when creating or resuming tracking, and when the active checkpoint changes:

```json
{
  "tracking": "docs/<task-slug>/<task-slug>.tracking.md",
  "checkpoint": "docs/<task-slug>/tracking/<checkpoint-slug>.md",
  "updated_at": "2026-05-27T13:42:00-03:00"
}
```

The canonical file contains the current snapshot, task ledger, next action, and links to available checkpoint files. Open the current checkpoint file by default. Open previous checkpoint files only when the current task references them or code/context is not enough.

## Active Slice First

When preparing execution tracking:

- Create the tracking index.
- Create `.afk/execution-tracking/current.json`.
- Create a detailed checkpoint file only for the active slice.
- Record the selected execution bundle for the active slice before execution starts.
- Keep future slices as index rows until they start.
- Create a future checkpoint file early only when it already has useful content to hold: scaffold mode, parallel work, explicitly assigned future checkpoints, a known blocker, or a deferred note from the current slice.
- If a future file is created early, create only the needed file, keep it skeletal except for the useful content, and link it from the canonical index row. Do not expand the rest of the future tracking set.

## Execution Bundle Evidence

An execution bundle is the set of execution disciplines selected for a checkpoint, such as `test-driven-development`, `source-driven-development`, `doubt-driven-development`, or normal project validation. Multiple disciplines can apply to the same checkpoint.

Record the selected bundle in the active checkpoint file before implementation begins. If work is delegated, the worker prompt should include the selected bundle and the evidence expected for each discipline.

Before moving a checkpoint to `review`, record adherence evidence for each selected discipline:

- `test-driven-development`: failing-test evidence before implementation when literal TDD is practical, then the passing run after implementation. If literal test-first was skipped, record the reason and the nearest proof mechanism used.
- `source-driven-development`: official docs or primary sources consulted, version signals checked, and any source-backed implementation decisions or unresolved source gaps.
- `doubt-driven-development`: fresh-context adversarial review result, findings reconciled, and any unresolved concerns escalated.
- Normal validation: tests, typechecks, lint, builds, runtime checks, browser checks, or a clear reason a check could not run.

Do not mark the checkpoint `review` while a selected discipline lacks evidence or an explicit skip reason.

## Statuses

Use these task statuses consistently:

- `pending`: not started
- `in_progress`: implementation is actively being changed
- `validating`: agent-side verification is running or being fixed, such as typecheck, lint, tests, build, or targeted runtime checks
- `review`: ready for checkpoint review by the responsible engineer and, when relevant, user/product validation
- `blocked`: cannot continue without a decision, dependency, access, or fix outside the current task
- `done`: checkpoint accepted, not merely implemented

Use review gates only when a checkpoint needs more than one human review layer. Keep the main status as `review` and use only the applicable gates in frontmatter or the body:

```yaml
review_gates:
  code: review
  design: review
  product: review
```

Use `code` for engineer review of implementation strategy, clarity, maintainability, semantics, performance, and ship-readiness.

Use `design` for visual parity review against an explicit design reference.

Default to a `design` review gate when the task changes user-facing visuals and has an explicit design reference or visual parity expectation. Passing code validation or recording design-reference evidence does not replace design review.

Use `product` for user-facing validation of behavior, workflow, and whether the outcome feels right.

Default to a `product` review gate when the task changes user-facing UI, copy, visual state, visibility rules, empty states, or product behavior. Passing code validation or recording design-reference evidence does not replace product POV review.

Keep review gate names to this small set: `code`, `design`, and `product`.

Do not create gates named after evidence or validation sources like Figma, backend contracts, tests, or lint. Record those under `Validation`, `Review Notes`, or a focused evidence note instead.

When `current_status` is `review`, every required review gate should usually be `review`. Use `pending` only before that review layer is ready, `blocked` when it cannot proceed without an external decision or dependency, and `done` only after that layer is accepted.

Do not add review gates to every checkpoint by default. For code-only checkpoints, a normal `review` status plus validation notes is enough.

## Minimum Frontmatter

Keep frontmatter as a small current-state dashboard:

```yaml
---
title: Example Feature Tracking
updated_at: 2026-05-15T14:10:00-03:00
source_plan: docs/example-feature/example-feature.plan.md
current_task: foundation
current_status: in_progress
---
```

Allowed frontmatter fields are `title`, `updated_at`, `source_plan`, `current_task`, `current_status`, and optional `review_gates`.

If the pause cadence matters, write one sentence in `Resume Context` instead of adding another frontmatter field.

Do not put evidence, validation, dependency, or historical task data in frontmatter. Keep details like Figma nodes, backend contracts, test runs, owners, and parallel agents in the relevant checkpoint file.

## Body Shape

Keep the canonical `.tracking.md` short. It is an index for the current dashboard and stable cross-task context only:

- `Resume Context`: what a fresh agent needs to know before continuing
- `Current Snapshot`: active task, status, review gates, blockers, and whether work is paused
- `Task Ledger`: compact table with each task, status, last update, one-line notes, and a checkpoint link when the file exists
- `Next Action`: the single next move

Put task-specific detail inside the matching checkpoint file instead of appending it to the canonical index. The invariant is where the information lives, not an exact heading template.

```markdown
# <checkpoint title>

Status: <pending | in_progress | validating | review | blocked | done>
Updated: <timestamp>

Include enough task-local detail and source links to resume safely. Do not restate the implementation plan. Use only the headings that help the next reader.
```

Common task headings include `Scope`, `Changes`, `Validation`, `Review Gates`, `Review Guide`, `Notes / Decisions`, and `Next Action`. Do not force empty sections.

Use `Execution Bundle` and `Discipline Evidence` headings when the checkpoint has selected execution disciplines.

Preserve completed checkpoint files as historical packets. When updating tracking, refresh the frontmatter, `Current Snapshot`, `Task Ledger`, `Next Action`, and the active checkpoint file. Do not append checkpoint-specific details to the canonical index.

The body can be flexible. The non-negotiable part is that a new agent can open the canonical index, find the current checkpoint file, and resume without guessing what happened, what is current, what is historical, what is safe to touch, and what needs approval.

## Notes And Decisions

During execution, record task-local notes for deviations, assumptions, trade-offs, scope changes, surprising constraints, and reviewer or next-agent context.

Prefer the active checkpoint file. If notes grow beyond the current checkpoint or need to survive as a standalone handoff, use `docs/<task-slug>/<task-slug>.implementation-notes.md`.

If a note belongs to a later slice, put it in that slice's checkpoint file and link the file from the canonical index. Do not bury future-only context in the active checkpoint unless it also changes the current slice.

If a decision changes architecture, ownership, integration contracts, data model, migration strategy, or long-term maintenance expectations, create or update an ADR under `docs/<task-slug>/decisions/` unless the repo has a stronger convention.

Before final handoff after implementation or review fixes, run a notes/ADR check:

- If the change introduced a non-obvious behavior invariant, record an implementation note in the active checkpoint file.
- If the change establishes a reusable policy, ownership boundary, shared component rule, integration contract, data/model rule, or long-term product decision, create or update an ADR.
- If neither applies, no note is needed.

Also look for material simplification opportunities before final handoff. If simplification would clearly reduce risk, duplication, or maintenance cost, record the opportunity in the active checkpoint file and offer `code-simplification`; do not silently refactor outside the current checkpoint scope.

For examples, see [notes-and-decisions.md](references/notes-and-decisions.md).

## Design And Product Review Guides

When a checkpoint includes a `design` or `product` review gate, include a short reviewer journey for the current task, phase, or checkpoint.

Skip this section for code-only review gates. For guide shape and examples, see [review-guides.md](references/review-guides.md).

## Operating Loop

1. Locate the source plan and task slug.
2. Create the canonical tracking index and active checkpoint file if they do not exist.
3. Write or update `.afk/execution-tracking/current.json` with the canonical index and active checkpoint paths.
4. Open the current checkpoint file by default; open previous checkpoint files only when needed.
5. Record the selected execution bundle for the active checkpoint.
6. Mark the active task as `in_progress` before editing.
7. Record important scope changes, working set changes, and blockers as they happen in the active checkpoint file.
8. Move to `validating` before running verification.
9. Record discipline evidence for the selected execution bundle.
10. Move to `review` only when the checkpoint is ready for responsible engineer review and selected discipline evidence is present or explicitly skipped with a reason.
11. Before final handoff, run the notes/ADR check and update the active checkpoint file if needed.
12. Move to `done` only after the checkpoint is accepted.
13. Update `updated_at` in the canonical index, active checkpoint file, and active marker whenever tracking changes.

If execution changes the implementation plan materially, note the divergence in tracking before continuing.
