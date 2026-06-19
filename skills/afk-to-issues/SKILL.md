---
name: afk-to-issues
description: Create an implementation plan as AFK execution checkpoint packets from a PRD/spec, implementation plan, goal package, tracker issue, or rough context using tracer-bullet vertical slices.
metadata:
  short-description: Create AFK execution checkpoint packets.
---

# To Issues
Create an implementation plan as independently-grabbable AFK execution checkpoint packets using vertical slices (tracer bullets).

AFK issues are local checkpoint packets by default. They may be mirrored to an external tracker, but the local tracking files are the AFK execution source of truth unless the user chooses another destination.

## Process

### 1. Gather context
Work from whatever is already in the conversation context. If the user passes an issue reference (issue number, URL, or path) as an argument, fetch it from the issue tracker and read its full body and comments.

Use any available source artifact: PRD/spec, existing implementation plan, goal package, tracker issue, handoff, prototype notes, or rough feature context. The gap this skill fills is executable implementation planning.

### 2. Explore the codebase (optional)
If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make implementation easier. "Make the change easy, then make the easy change." Any prefactoring should be planned before dependent vertical slices.

### 3. Draft vertical slices
Draft the implementation plan directly as **tracer bullet** checkpoint packets. Each packet is a thin vertical slice that cuts through all required integration layers end-to-end, not a horizontal slice of one layer.

<vertical-slice-rules>
- Each slice delivers a narrow but complete path through every required layer.
- A completed slice is demoable or verifiable on its own.
- Prefer many thin slices over few thick ones.
</vertical-slice-rules>

### 4. Quiz the user
Present the proposed breakdown as a numbered list. For each slice, show title, blockers, and user stories covered when available.

Ask whether the granularity and dependencies are right. Confirm whether approved slices should be written as local AFK tracking files, external tracker issues, or both.

Iterate until the user approves the breakdown.

### 5. Write the issues
For each approved slice, write or publish a new issue in dependency order (blockers first).

For local AFK tracking, create one checkpoint packet per slice under `docs/<task-slug>/tracking/I001-short-title.md`.

For external trackers, publish issues with the right project labels and dependency links. If writing both local and external issues, create local files first and add tracker links after publication.

After writing local checkpoint packets, run `plannotator annotate --gate <tracking-folder>` when Plannotator is available. Treat returned annotations as requested changes across the packet set before handing off to execution. If only external tracker issues were created, skip this gate unless a local draft folder exists.

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
