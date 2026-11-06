---
id: 09
title: Settings and Agent rules
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Scope"; Git library spec "Agent folders", "Projects"
---

# 09 — Settings and Agent rules

## What To Build
Settings: your library (paths, start/connect), agent folders with icons, detected agents first, the shared folder naming its readers, custom folders and Show all; projects; scheduled updates; invocation defaults. Agent rules ported with its existing behaviour (canonical document, references, preview and sync to destinations).

## Acceptance Criteria
- [ ] Agent folders show each agent's icon and use the existing agent-folder operations.
- [ ] Every existing Settings and Agent rules action is reachable.
- [ ] Works at 1440px and 390px.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for agent folders (detected ordering, custom folder validation) and the rules preview/sync flow with a mocked client.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
