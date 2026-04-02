---
name: ai-companion
description: Improve native skill discovery by checking for `~/.agents/skills/skills.json` and using its categories, tags, and platforms as lightweight ranking hints. Use this for broad scoped requests where normal skill discovery would already happen, such as frontend polish, animation, code review, debugging, documentation, refactoring, or DX-focused work.
---

# AI Companion

Use this skill as a tiny discovery booster before normal execution.

The goal is not to replace native discovery. The goal is to improve it when the user already has a useful `skills.json` taxonomy.

## When To Use It

Use this skill when the user asks for a scoped action where skill discovery would already be relevant, for example:

- improve a frontend or design
- add animation or interaction polish
- review code
- debug a flow
- write or improve documentation
- refactor for DX or maintainability

This skill should run quietly alongside normal discovery. It should not create a second visible selection flow for the user.

## First Step

Check whether this file exists and is usable:

```text
~/.agents/skills/skills.json
```

If the file is missing, unreadable, invalid, or not helpful for the current request, stop immediately and let native discovery continue unchanged.

## What To Read

If `skills.json` is available, read only the minimum useful signals:

- `scopes`
- `skills`
- per-skill `tags`
- per-skill `platforms`

Skills are matched by folder name.

Do not do deep taxonomy analysis if a quick read is enough to rank likely matches.

## How To Use The Taxonomy

Use the taxonomy only as a ranking hint for skills explicitly mapped in `skills.json`.

Workflow:

1. Normalize the user request into a few intent signals.
2. Check whether mapped skills in `skills.json` align with those signals.
3. Boost the ranking of matching mapped skills.
4. Hand off immediately to the real working skill.

This is not a shortlist skill. Do not stop to ask the user which skill to use.

## Precedence Rules

- Direct user skill mentions win.
- Actual skill metadata wins over taxonomy conflicts.
- Taxonomy is a ranking hint, not a filter.
- Unmapped skills should remain governed by native discovery alone.

## Guardrails

- If `skills.json` is absent, become a near-no-op.
- If the taxonomy is stale or weak, do not force it.
- Do not invent categories, tags, or platforms.
- Do not treat category matches as proof that a skill is the right one.
- Keep token use low and move quickly into the actual task.

## Example Mental Model

If the user says, "I want to improve my frontend design and add animation," this skill should:

1. Check for `~/.agents/skills/skills.json`.
2. See whether mapped skills are tagged or categorized around frontend, design, animation, motion, or interaction.
3. Quietly boost those mapped skills during discovery.
4. Yield to the best real skill without adding a new user-facing step.
