# Ticket Templates

Use the template matching the approved destination.

<local-ticket-template>
---
id: <NN>
title: <Ticket title>
status: pending
blocked_by: []
source: <artifact names or links; relevant sections, headings, or line ranges; omit when there is no source artifact>
review_gates:
  code: pending
---

# <NN> — <Ticket title>

## Parent
Omit this section unless the source was an existing tracker issue.

## What To Build
Describe the end-to-end behavior, not layer-by-layer implementation. Avoid specific file paths or code snippets unless a prototype snippet encodes a decision more precisely than prose can.

## User Stories Covered
- Omit this section when the source has no user stories.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked By
Use one of:
- None - can start immediately
- Checkpoint dependencies, human decisions, missing context, or external blockers.

## Execution Bundle
- tdd | source-driven-development | doubt-driven-development | normal validation
- Test Seam: <public interface and behavior, or `TDD skipped: <reason>`>

## Verification
- [ ] Expected proof before review

## Handoff Notes
- Notes a later checkpoint or future agent must know

## Implementation Notes
## Changes
## Review Gates
</local-ticket-template>

<issue-template>

## Parent

A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

**Source:** <artifact names or links; relevant sections, headings, or line ranges; omit when there is no source artifact>

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None — can start immediately".

## Execution bundle

- tdd | source-driven-development | doubt-driven-development | normal validation
- Test seam: <public interface and behavior, or `TDD skipped: <reason>`>

</issue-template>

Avoid prescribing implementation file paths or incidental code snippets — they go stale fast. Artifact paths and URLs belong in `Source`; inline only the decision-rich schema, state machine, reducer, or type shape that governs the ticket.
