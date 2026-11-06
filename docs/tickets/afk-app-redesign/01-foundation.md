---
id: 01
title: Foundation: React app, shell and shared components
status: pending
blocked_by: []
source: docs/adr/0013-react-for-the-local-app.md; docs/specs/afk-app-redesign/brief.md — "Layout and interaction", "Constraints"; docs/specs/afk-app-redesign/prototype.html (shell, navigation, components)
---

# 01 — Foundation: React app, shell and shared components

## What To Build
Create the React 19 + TypeScript app (Vite) inside the AFK package, built at package time and served by the existing server at `/next/` with the session token injected as today. Port AFK's design tokens and bundled fonts as CSS custom properties. Add a typed client over the existing operations (`/api/...`), the app shell (desktop left navigation with Overview, Skills, Packs, Sources, Agent rules, Tools, Backup, Settings; phone top bar with a section menu), routing, and the shared components the screens reuse: row, switch, segmented two-way choice, dialog, menu, tags, path card, empty state, toast, progress. Set up Vitest + React Testing Library. Each nav item shows a placeholder page until its ticket lands. The old UI at `/` is untouched.

## Acceptance Criteria
- [ ] `pnpm afk:build` builds the app; the published package contains it; `afk start` serves the old UI at `/` and the new one at `/next/` with a valid session.
- [ ] Typed client covers the operations the screens use, with errors surfaced as values, not thrown into rendering.
- [ ] Shell works at 1440px and 390px: no horizontal scroll, no off-screen navigation, visible focus, skip link, current item marked.
- [ ] Shared components are keyboard-operable with accessible names; dialog traps and returns focus; menu uses native buttons without fake menu roles.
- [ ] Tokens and fonts match `packages/afk/web/DESIGN.md`.

## Blocked By
- None - can start immediately

## Execution Bundle
- tdd
- Test Seam: Component tests (React Testing Library) for shell navigation and each shared component; a server test that `/next/` serves the built app with the token injected.

## Verification
- [ ] `pnpm afk:typecheck`, `pnpm afk:lint`, `pnpm afk:test` and `pnpm afk:build` pass
- [ ] Checked in a real browser at 1440px and 390px against a temporary home
