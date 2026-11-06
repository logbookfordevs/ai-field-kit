---
id: 05
title: Sources and the install dialog
status: pending
blocked_by: [01]
source: docs/specs/afk-app-redesign/brief.md — "Direction" (Sources); docs/specs/afk-app-redesign/prototype.html Sources screen and install dialog; Git library spec "Install"
---

# 05 — Sources and the install dialog

## What To Build
Sources page: Add something new (From a repository, From a zip/.skill/folder), Try later with its own "Save a repository" (named bookmark) and per-bookmark Install, and the followed Core sources with Follow and Update. The install dialog: look inside a repository, pick skills, choose the destination (Core, a pack, this machine, Try later for repositories), validated on submit; uploads with size and the no-auto-update note; live progress with cancel.

## Acceptance Criteria
- [ ] Install from repository and from upload reach every destination through the existing operations.
- [ ] Opening Install from a bookmark prefills the repository and its saved skills and still asks for the destination.
- [ ] Saving a repository asks for a name.
- [ ] Works at 1440px and 390px, including both install sources on a phone.

## Blocked By
- 01.

## Execution Bundle
- tdd
- Test Seam: Component tests for the install dialog flow per destination and the bookmark prefill, with a mocked client.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
