# Pull Request Descriptions

Use this reference when writing or rewriting a PR description.

## Purpose

A PR description prepares the reviewer to review well.

It should answer:

- why this PR exists
- what changed
- what the reviewer should inspect hardest
- what behavior, contract, or invariant must stay true
- how the author verified it

The reviewer will still read the diff. The description should make that diff easier, faster, and less exhausting to read.

## Narrative Level

Use story as orientation, not as the genre.

Good PR narrative feels like a clear teammate saying:

"Here is the situation, here is what I found, here is what changed, and here is where your review attention matters."

Avoid PR descriptions that feel like:

- a file-by-file changelog only
- a blog post
- a pitch
- a LinkedIn-style lesson
- a dramatic retelling of ordinary implementation work

## Flexible Section Shapes

`Problem / Findings / Solution` is a strong shape for bug fixes, incidents, and investigative work.

Use it when the PR really has:

- a user-facing or system-facing problem
- a meaningful discovery in the code or behavior
- a fix whose ordering, scope, or consequence matters

Do not force it when the PR is a feature, chore, refactor, redesign, migration, dependency update, or accepted product decision.

Alternative section shapes:

- `Context / What Changed / Review Focus / Test Plan`
- `Why / Implementation / Contracts Preserved / Test Plan`
- `Before / After / Review Focus / Test Plan`
- `Decision / Changes / Trade-offs / Verification`
- `What Changed / Risk Areas / Test Plan`

Choose headings that create the cleanest path for this specific review.

## Recommended Spine

Most PR descriptions should include these jobs, even if the headings differ:

1. Orientation: why the PR exists in 1-3 short paragraphs.
2. Change summary: what changed, grouped by behavior or module.
3. Review focus: where the reviewer should spend the most attention.
4. Contracts and risks: what must remain true, what could regress, or what is intentionally unchanged.
5. Verification: tests, manual checks, screenshots, or known gaps.

## Technical Detail

Keep technical detail, but make it serve the reviewer.

Good detail:

- names the exact function, module, API, or invariant involved
- includes short code snippets only when they clarify the key change
- explains ordering when order matters
- points to risk areas instead of summarizing every line
- separates high-signal behavior from mechanical extraction

Weak detail:

- repeats the diff without interpretation
- lists every helper and type without telling the reviewer why they matter
- buries the actual reason for the PR
- turns the PR body into a complete implementation diary

## Review Focus

Every non-trivial PR should tell the reviewer where to look hardest.

Examples:

- "Review the fallback path in `buildLocationFromPlaceId`; that is where payload shape can drift."
- "The important invariant is still one active invite per referral."
- "The risky part is preserving single-select behavior while adding multi-select primitives."
- "Most of the diff is mechanical; the behavior change lives in `send()`."

This is often more valuable than a long summary.

## Tone

Write like a thoughtful teammate, not a release note generator.

Use:

- direct orientation
- precise claims
- short paragraphs
- honest trade-offs
- mild warmth when it helps

Avoid:

- excessive cleverness
- jokes
- over-personalized signoffs
- "story" as a visible gimmick
- dramatic language for ordinary changes

## Templates

### Bug Fix Or Incident

```md
## Problem

[What failed, who it affected, and why it matters.]

## Findings

[What the code or production evidence showed.]

## Fix

[What changed and why the shape/order matters.]

## Review Focus

[The 1-3 places where review attention matters most.]

## Test Plan

- [ ] [Check]
```

### Feature Or Shared Component

```md
## Context

[Why this capability is needed now.]

## What Changed

[Behavior/module-oriented summary.]

## Review Focus

[Risk areas, preserved contracts, or important API shape.]

## Test Plan

- [ ] [Check]
```

### Refactor, Chore, Or Migration

```md
## Why

[Why this cleanup/migration is worth doing.]

## What Changed

[Grouped summary of the mechanical and behavioral parts.]

## What Should Stay The Same

[Compatibility, public contracts, UI behavior, performance, or data shape.]

## Test Plan

- [ ] [Check]
```

## Final Checklist

- The first section answers why this PR exists.
- The description gives the reviewer a useful mental model before the diff.
- The technical summary is grouped by meaning, not just file order.
- Review focus is explicit.
- `Problem / Findings / Solution` is used only if it fits.
- The tone is readable without becoming performative.
- The test plan is specific enough to catch the likely regressions.
