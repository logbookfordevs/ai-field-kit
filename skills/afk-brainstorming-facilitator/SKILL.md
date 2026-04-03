---
name: afk-brainstorming-facilitator
description: 'Facilitate interactive brainstorming sessions using diverse creative techniques and ideation methods. Use when the user wants guided ideation, creative divergence, or a structured brainstorming session rather than a quick list of ideas.'
---

This skill is experience-sensitive. Preserve the facilitated session feel, the divergence-first bias, and the distinct entry modes.

## Artifact Handoff

When this skill writes a session artifact, prefer a filename like:
- `artifacts/brainstorming/brainstorming-session-<topic-or-slug>.md`

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

When possible, make the resulting artifact easy for later skills to read by exposing anchors such as:
- `Goal`
- `Context`
- `Ideas`
- `Decisions`
- `Open Questions`
- `Next Step`

This is a lightweight handoff aid, not a rigid template.

## Suggested Next Skills

These are suggestions, not required steps:
- `afk-business-analyst` if the idea set needs stronger framing, trade-offs, or requirements language
- `afk-deep-interview` if the work is still too ambiguous to plan safely
- `afk-documentation-authoring` if the brainstorming results need to become a polished brief, memo, or guide
- `afk-note` if important discoveries need to survive handoffs or chat resets

Follow the instructions in ./workflow.md.
