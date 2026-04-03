---
name: ai-companion
description: Act as the first skill-selection layer when a request implies using the user's installed skills. Check `~/.agents/skills/skills.json` and use its categories, tags, and platforms to guide which other skills should be selected next. Use this for broad scoped requests, or whenever the user says things like "use my frontend skills", "use my animation skills", "use my review skills", or otherwise asks the agent to choose from their skill library.
---

# AI Companion

Use this skill as the first selection layer before other skills are chosen.

The goal is not to replace native discovery. The goal is to shape it when the user already has a useful `skills.json` taxonomy.

## When To Use It

Use this skill when the user asks for a scoped action where skill discovery would already be relevant, for example:

- improve a frontend or design
- add animation or interaction polish
- review code
- debug a flow
- write or improve documentation
- refactor for DX or maintainability

Also use this skill when the user explicitly asks to use their own skills or skill categories, even if other skills already look like obvious matches.

Examples:

- "Use my front-end design skills and animation skills."
- "Use my review skills to check this PR."
- "Use my documentation skills for this README."
- "Pick the best skills from my library for this task."

This skill should run quietly before the final skill choice is made. It should not create a second visible selection flow for the user.

## Critical Rule

If the task implies choosing from the user's skill library, run `ai-companion` first.

Do this even when the agent already sees likely matching skills from their descriptions alone. The purpose of `ai-companion` is not to rescue missing context. The purpose is to let the user's own taxonomy influence which skills get selected.

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

Use the taxonomy as the user's preferred ranking layer for skills explicitly mapped in `skills.json`.

Workflow:

1. Normalize the user request into a few intent signals.
2. Check whether the user is implicitly or explicitly asking to use their own skills.
3. Check whether mapped skills in `skills.json` align with those signals.
4. Let that taxonomy influence which working skills are chosen next.
5. Hand off immediately to the real working skill or skills.

This is not a shortlist skill. Do not stop to ask the user which skill to use.

## Precedence Rules

- Direct user skill mentions win.
- Actual skill metadata wins over taxonomy conflicts.
- Taxonomy is a ranking hint, not a filter.
- Unmapped skills should remain governed by native discovery alone.
- The existence of obvious matching skills does not skip `ai-companion` if the request implies using the user's own skill library.

## Guardrails

- If `skills.json` is absent, become a near-no-op.
- If the taxonomy is stale or weak, do not force it.
- Do not invent categories, tags, or platforms.
- Do not treat category matches as proof that a skill is the right one.
- Keep token use low and move quickly into the actual task.

## Example Mental Model

If the user says, "I want to improve my frontend design and add animation," this skill should:

1. Check for `~/.agents/skills/skills.json`.
2. See whether the user is asking to use their own frontend, design, animation, motion, or interaction skills.
3. See whether mapped skills are tagged or categorized around those areas.
4. Quietly let that taxonomy influence which real skills are selected.
5. Yield to the best real skill without adding a new user-facing step.
