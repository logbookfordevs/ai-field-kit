# Pull Request Descriptions

A PR description prepares a reviewer to review well. It should make the diff faster and less exhausting to understand without replacing the diff.

## Evidence Contract

Inspect the actual change target, relevant ticket or decision material, changed behavior, and available verification before writing. Distinguish observed evidence from author claims. Report tests, screenshots, and manual checks exactly as performed; label gaps instead of implying coverage.

This step is complete when the description can support every claim about what changed, what stayed true, and how the change was verified.

## Reviewer Contract

Every non-trivial description should answer:

- why the PR exists
- what changed, grouped by behavior or module
- where review attention matters most
- which contracts, invariants, or intentionally unchanged behavior must survive
- what could regress or remains uncertain
- how the change was verified

Call out the smallest high-risk surface explicitly. Most of a diff may be mechanical while one function, ordering rule, fallback, migration boundary, or interaction carries the behavioral risk.

## Choose a Shape

Use headings that fit the review rather than forcing one template.

- Bug or incident: `Problem / Evidence / Fix / Review Focus / Test Plan`
- Feature or shared component: `Context / What Changed / Review Focus / Test Plan`
- Refactor or migration: `Why / What Changed / What Must Stay True / Test Plan`
- Decision-heavy change: `Decision / Changes / Trade-offs / Verification`

Use narrative as orientation, not as the genre. Keep the opening direct and group technical detail by meaning rather than file order.

## Useful Detail

Include detail that:

- names the exact function, module, API, or invariant involved
- explains ordering or data shape when it matters
- separates behavioral changes from mechanical movement
- points reviewers toward risks, preserved contracts, and known gaps
- uses a short snippet or visual only when it clarifies the key change

Remove detail that merely inventories files, helpers, or types without helping the reviewer judge the change.

## Compact Templates

### Bug or incident

```md
## Problem
[What failed, who it affected, and why it matters.]

## Evidence
[What the code, behavior, or production evidence established.]

## Fix
[What changed and why its shape or ordering matters.]

## Review Focus
[The one to three places carrying the meaningful risk.]

## Test Plan
- [ ] [Verified check]
```

### Feature or shared component

```md
## Context
[Why this capability is needed.]

## What Changed
[Behavior- or module-oriented summary.]

## Review Focus
[Risk areas, contracts, and important API or interaction choices.]

## Test Plan
- [ ] [Verified check]
```

### Refactor or migration

```md
## Why
[Why the change is worth making.]

## What Changed
[Separate mechanical and behavioral work.]

## What Must Stay True
[Compatibility, public contracts, UI behavior, performance, or data shape.]

## Test Plan
- [ ] [Verified check]
```

The branch is complete when the reviewer knows why the PR exists, where to look hardest, what must remain true, and which verification claims are supported.
