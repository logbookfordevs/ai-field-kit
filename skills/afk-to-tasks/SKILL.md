---
name: afk-to-tasks
description: Break a plan, spec, goal package, tracker issue, or rough context into independently-grabbable AFK checkpoint packets using tracer-bullet vertical slices.
metadata:
  short-description: Create AFK execution checkpoint packets.
---

# To Tasks

Break a plan into independently-grabbable AFK checkpoint packets using vertical slices (tracer bullets).

AFK tasks are local checkpoint packets by default. They may be mirrored to an external tracker when requested, but the local tracking files are the AFK execution source of truth unless the user chooses another destination.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

Use any available source artifact: plan, spec, goal package, tracker issue, handoff, prototype notes, or rough feature context. The gap this skill fills is executable implementation planning.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Task titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the plan into **tracer bullet** checkpoint packets. Each packet is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

<vertical-slice-rules>

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Wide refactors are the exception to vertical slicing. A wide refactor is one mechanical change whose blast radius fans across the codebase, so a single edit breaks too many call sites for a vertical slice to land green. Sequence these as expand-contract instead:

- Expand: add the new form beside the old so existing behavior keeps working.
- Migrate: move call sites in batches sized by blast radius, such as per package or directory, each blocked by the expand packet.
- Contract: delete the old form once no caller remains, blocked by every migration packet.

When even migration batches cannot stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify packet.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)
- **What it delivers**: the end-to-end behavior this checkpoint makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Should approved slices be written as local AFK checkpoint packets, external tracker issues, or both?

Iterate until the user approves the breakdown.

### 5. Write the tasks

For each approved slice, write a local checkpoint packet. Use the checkpoint packet template below.

For local AFK tracking, create one checkpoint packet per slice under `docs/<task-slug>/tracking/I001-short-title.md`. Write packets in dependency order (blockers first) so you can reference real checkpoint identifiers in the "Blocked by" field.

Publish new tracker issues only when the user requested tracker publication or existing project context clearly expects it. If writing both local packets and external issues, create local files first and add tracker links after publication.

After writing local checkpoint packets, run `plannotator annotate --gate <tracking-folder>` when Plannotator is available. Treat returned annotations or user feedback as requested changes across the packet set before handing off to execution.

If the user does not approve the gate, apply their feedback, then run `plannotator annotate --gate <tracking-folder>` again for the revised packet set. Keep reopening the annotation gate until the user approves or explicitly asks to stop the review loop.

If only external tracker issues were created, skip this gate unless a local draft folder exists.

Do NOT close or modify any parent issue.

<checkpoint-template>
---
id: I001
title: Short Title
status: pending
blocked_by: []
source: docs/<task-slug>/<source-artifact>.md
review_gates:
  code: pending
---

# I001: Short Title

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
</checkpoint-template>
