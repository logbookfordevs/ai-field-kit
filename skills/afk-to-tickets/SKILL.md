---
name: afk-to-tickets
description: "Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker — edges as text in one file per ticket locally, or native blocking links on a real tracker."
metadata:
  short-description: Create tracer-bullet tickets with explicit blocking edges.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it.

Tickets are written as local checkpoint files by default. They may be mirrored to an external tracker when requested, but the local files are the execution source of truth unless the user chooses another destination.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket — green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)
- **What it delivers**: the end-to-end behavior this checkpoint makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any tickets be merged or split further?
- Should approved tickets be written as local checkpoint files, external tracker issues, or both?

Iterate until the user approves the breakdown.

### 5. Write the tickets

Write the approved tickets. **How** depends on the user requested or default — the tickets are the same either way, only the shape of the blocking edges changes:

- **Local files** → write one file per ticket under `docs/<feature-slug>/tracking/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first). Each file's "Blocked by" lists the numbers/titles it depends on. Use the per-ticket file template below — one ticket per file, never a single combined file.
- **A real issue tracker (GitHub, Linear, …)** → publish one issue per ticket in dependency order (blockers first) so each ticket's blocking edges can reference real identifiers. Use the platform's native blocking / sub-issue relationship where it has one; otherwise set each ticket's "Blocked by" to the blocking issues.

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Publish new tracker issues only when the user requested tracker publication or existing project context clearly expects it. If writing both local packets and external issues, create local files first and add tracker links after publication.

Do NOT close or modify any parent issue.

<local-ticket-template>
---
id: <NN>
title: <Ticket title>
status: pending
blocked_by: []
source: docs/<task-slug>/<source-artifact>.md
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

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket, or "None — can start immediately".

</issue-template>

In either form, avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

After writing local tickets, run `plannotator annotate --gate <tracking-folder>` when Plannotator is available. Treat returned annotations or user feedback as requested changes across the packet set.

If the user does not approve the gate, apply their feedback, then run `plannotator annotate --gate <tracking-folder>` again for the revised packet set. Keep reopening the annotation gate until the user approves or explicitly asks to stop the review loop.

If only external tracker issues were created, skip this gate unless a local draft folder exists.
