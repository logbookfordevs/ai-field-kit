---
name: afk-archive-artifact
description: Archive a discussion, planning, or refinement artifact without losing traceability. Use when a related workflow artifact is done, paused, superseded, rejected, or merged and should move out of the active path.
---

# Archive Artifact

Use this skill to retire an artifact cleanly without deleting history.

This is a lightweight archival skill, not a project-management system.

It is meant for related discussion, planning, or refinement artifacts, typically living under an `artifacts/` path or another repo-local artifact convention, not for generic repository cleanup.

## Use When

- a planning or discussion artifact is complete
- a draft has been superseded by a newer version
- work is paused and should move out of the active area
- the user wants a clean workspace without losing traceability

## Do Not Use When

- the artifact is still the active source of truth
- the user only wants to rename or reorganize active work
- deleting the artifact would be risky and the user has not asked for archival
- the target is not part of a related discussion, planning, or refinement artifact flow

## Core Behavior

- archive, do not delete
- preserve the original file
- create or update an `ARCHIVE.md` note explaining what happened
- keep the archived material easy to inspect later

## Default Archive Location

Prefer:
- `artifacts/archive/`

If `artifacts/` conflicts with the repo's structure, use:
- `docs/artifacts/archive/` when `docs/` exists

Otherwise, follow the repo's existing convention conservatively.

## Archive Model

Do not encode status into the folder path.

Prefer:
- `artifacts/archive/<artifact-file>`
- `artifacts/archive/ARCHIVE.md`

Store the status and explanation in `artifacts/archive/ARCHIVE.md`.

This keeps archive structure simple and avoids turning the folder tree into a lifecycle state machine.

## Supported Statuses

Use a short status such as:
- `done`
- `superseded`
- `paused`
- `rejected`
- `merged`

If the user does not specify one, infer the best fit conservatively and say what you chose.

## ARCHIVE.md

When archiving, create or update `ARCHIVE.md` with short, practical metadata.

Recommended contents:

```md
# Archive Note

- Status: paused
- Archived From: artifacts/context/context-checkout.md
- Archived At: 2026-04-03
- Reason: Waiting on product decision before resuming
- Replacement: artifacts/context/context-checkout-v2.md
```

Use `Replacement` only when relevant.

Keep the note short. Its job is orientation, not storytelling.

## Archive Action

- move the artifact file from the active `artifacts/` area into `artifacts/archive/`
- create or update `artifacts/archive/ARCHIVE.md`
- keep the archived filename legible and traceable

## Safety Rules

- never destroy the archived content
- do not overwrite an unrelated archived artifact
- if a filename collision exists, add a safe suffix instead of replacing existing material
- preserve the ability to restore or inspect the archived work later

## Suggested Inputs

When needed, clarify only the minimum:
- what should be archived
- status
- short reason
- replacement artifact, if one exists

Decision rules:
- If one archive target is obvious, do not ask.
- If multiple plausible targets exist, ask which one should be archived.
- Use the artifact filename as the archive filename unless a safe suffix is needed.
- If the archived filename collides with an existing archive, ask or add a safe suffix.

## Suggested Next Use

This is a support skill, not a main stage in the planning flow.

Use it after:
- `afk-discuss-phase-context`
- `afk-deep-interview`
- `afk-business-analyst`
- `afk-brainstorming-facilitator`
- `afk-advanced-elicitation`

when their output file is no longer active and should move out of the main working area.
