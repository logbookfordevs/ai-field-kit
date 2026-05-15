---
name: afk-execution-tracking
description: Track checkpointed implementation after a plan exists. Use when execution should be split into reviewable tasks, resumed across chats, coordinated across parallel agents, or paused for engineer and product validation instead of running the whole plan at once.
metadata:
  short-description: Track implementation checkpoints, statuses, validation, and handoffs across agent sessions.
---

# Execution Tracking

Use this skill after an implementation plan exists and before or during execution.

The goal is to keep implementation state visible without turning the plan into a diary. The tracking file is the shared checkpoint ledger for agents and the responsible engineer.

## Use When

- a plan has multiple tasks, majors, phases, or checkpoints
- execution should pause for engineer review before continuing
- work may resume in a later chat
- parallel agents need a shared status source
- the user wants divide-and-conquer implementation instead of one long build run

Do not use this skill for tiny one-shot edits unless the user asks for tracking.

## Storage

Create or update one canonical tracking file.

Follow the repo or user artifact convention. If none exists, use the AFK workflow default:

```text
docs/<task-slug>/<task-slug>.tracking.md
```

Use the same task slug as the related plan whenever possible.

For parallel work, keep one tracking file per feature or plan. Each agent updates its assigned section in that file. Create separate scratch notes only when they are clearly subordinate to the canonical tracking file.

## Statuses

Use these task statuses consistently:

- `pending`: not started
- `in_progress`: implementation is actively being changed
- `validating`: agent-side verification is running or being fixed, such as typecheck, lint, tests, build, or targeted runtime checks
- `review`: ready for checkpoint review by the responsible engineer and, when relevant, user/product validation
- `blocked`: cannot continue without a decision, dependency, access, or fix outside the current task
- `done`: checkpoint accepted, not merely implemented

When review needs more detail, keep the main status as `review` and split gates in frontmatter or the body:

```yaml
review_gates:
  code: pending
  product: pending
```

Use `code` for engineer review of implementation strategy, clarity, maintainability, semantics, performance, and ship-readiness.

Use `product` for user-facing validation of behavior, workflow, and whether the outcome feels right.

## Minimum Frontmatter

Keep frontmatter small and easy to update:

```yaml
---
title: Example Feature Tracking
updated_at: 2026-05-15T14:10:00-03:00
source_plan: docs/example-feature/example-feature.plan.md
checkpoint_mode: task_by_task
current_task: foundation
current_status: in_progress
---
```

Add fields only when they earn their keep, such as `linear_tickets`, `review_gates`, `owner`, or `parallel_agents`.

## Body Shape

Prefer short, skimmable sections:

- `Resume Context`: what a fresh agent needs to know before continuing
- `Current Status`: the active task, current gate, and whether work is paused
- `Task Ledger`: task sections or a compact table with status, owner, and notes
- `Working Set`: files touched or expected to be touched for the current checkpoint
- `Validation`: commands run and results
- `Review Notes`: code review and product validation notes
- `Next Action`: the single next move

The body can be flexible. The non-negotiable part is that a new agent can resume without guessing what happened, what is safe to touch, and what needs approval.

## Operating Loop

1. Locate the source plan and task slug.
2. Create the tracking file if it does not exist.
3. Mark the active task as `in_progress` before editing.
4. Record important scope changes, working set changes, and blockers as they happen.
5. Move to `validating` before running verification.
6. Move to `review` only when the checkpoint is ready for responsible engineer review.
7. Move to `done` only after the checkpoint is accepted.
8. Update `updated_at` whenever the tracking file changes.

If execution changes the implementation plan materially, note the divergence in tracking before continuing.
