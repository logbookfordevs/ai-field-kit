---
name: afk-unarchive-artifact
description: Restore an archived discussion, planning, or refinement artifact back into the active artifacts area. Use when a previously archived artifact needs to become active work again.
---

# Unarchive Artifact

Use this skill to restore an archived artifact back into the active `artifacts/` area.

This is a lightweight restoration skill, not a lifecycle framework.

## Use When

- an archived artifact needs to become active work again
- paused work is resuming
- an older artifact needs revision or follow-up
- a branch is being created to revisit previously archived work

## Do Not Use When

- the artifact should stay archived
- the target is not part of a related discussion, planning, or refinement artifact flow
- the user only wants to inspect the archive without restoring it

## Core Behavior

- restore, do not duplicate unless needed for safety
- move the artifact from `artifacts/archive/` back into active `artifacts/`
- preserve traceability
- update `artifacts/archive/ARCHIVE.md` when useful to note the restoration

## Default Restore Model

- active artifacts live in `artifacts/`
- inactive artifacts live in `artifacts/archive/`
- branches handle parallel work

Prefer restoring the artifact file back into the active `artifacts/` area with its legible filename.

## Safety Rules

- do not overwrite an active artifact without clear user intent
- if the active filename collides, ask or add a safe suffix
- restore only the artifact the user intends

## Suggested Inputs

When needed, clarify only the minimum:
- what should be restored
- whether there are multiple plausible archived artifacts
- whether the restored filename should change because of a collision

Decision rules:
- If one archived target is obvious, do not ask.
- If multiple plausible archived targets exist, ask which one should be restored.
- Restore the archived filename as-is unless a safe suffix is needed.
- If the restored filename collides with an active artifact, ask or add a safe suffix.

## Suggested Next Use

This is a support skill, not a main stage in the planning flow.

After restoring an artifact, likely next steps are:
- `afk-advanced-elicitation` to strengthen it
- `afk-discuss-implementation-decisions` to resolve new gray areas
- `afk-deep-interview` if the work is still too ambiguous
