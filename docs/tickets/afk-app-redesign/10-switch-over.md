---
id: 10
title: Switch over to the new app
status: done
blocked_by: [02, 03, 04, 05, 06, 07, 08, 09]
source: docs/adr/0013-react-for-the-local-app.md — "Expand, then switch"; docs/specs/afk-app-redesign/brief.md — "Constraints"
---

# 10 — Switch over to the new app

## What To Build
Serve the new app at `/` and remove `/next/`. Delete the string-template UI (`packages/afk/web/*.js`, its markup and styles) and its `node:vm` tests, keeping assets the new app uses. Update `packages/afk/web/DESIGN.md`, PRODUCT.md (sections and model), development docs and the changelog. Re-run the interface audit against the new app.

## Acceptance Criteria
- [x] `afk start` opens the new app at `/`; no old UI files remain.
- [x] Re-run audit reports none of the original 15 findings. (14 resolved in the re-audit; #15 completed in the review-fix pass.)
- [x] Docs describe the new sections.
- [x] All checks pass.

## Blocked By
- 02–09.

## Execution Bundle
- normal validation
- Test Seam: TDD skipped: removal and switch-over; covered by the suites from 01–09 and the re-run audit.

## Verification
- [x] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [x] Checked in a real browser at 1440px and 390px against a temporary home
