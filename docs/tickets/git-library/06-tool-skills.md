---
id: 06
title: Tool skills: off folder and reapplied choices
status: done
blocked_by: [02]
source: docs/specs/git-library.md — "On and off without a `.disabled` folder" (tool bullet), "Invariants"
---

# 06 — Tool skills: off folder and reapplied choices

## What To Build
Tool-provided skills stay real folders the tool writes. Turning one off moves it to `~/.afk/off/`, outside every agent folder; turning it on moves it back. After every tool run, AFK reapplies saved invocation choices to the skills the tool provides, and warns when a tool run recreated a skill that is off. Tool skills report themselves read-only to the editor.

## Acceptance Criteria
- [x] Turning a tool skill off moves it to `~/.afk/off/` and removes it from agent folders; on restores it.
- [x] After a tool run, saved choices are applied to its provided skills.
- [x] A tool run that recreates a skill that is off produces a visible warning naming the skill.
- [x] Tool skills are never copied into the library.

## Blocked By
- 02.

## Execution Bundle
- tdd
- Test Seam: Tool run with a fake command that writes a skill folder on a temporary home.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint` and `pnpm afk:test` pass
- [x] Acceptance criteria demonstrated on a temporary home, never the real `~`
