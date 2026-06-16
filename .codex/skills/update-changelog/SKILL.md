---
name: update-changelog
description: Keep CHANGELOG.md product-facing and release-ready. Use when adding, reviewing, or cleaning changelog entries.
---

# Update Changelog

Use this skill whenever a code, docs, or UX change needs a `CHANGELOG.md` entry.

## Rules

- Write for users, contributors, and upgrade reviewers, not for the implementer.
- Put each change in exactly one section:
  - `Added`: new user-facing capability.
  - `Changed`: existing behavior, UX, command shape, docs, install, or release semantics changed.
  - `Fixed`: broken user-visible behavior now works.
  - `Removed`: capability or surface intentionally went away.
- Do not add implementation receipts such as test runner migrations, helper extraction, CI plumbing, package-manager metadata, design-tool config, or refactor mechanics unless they affect installation, publishing trust, contributor workflow, or user behavior.
- Keep release/process notes only when they change what users or maintainers can rely on, such as safer tagged npm publishing.
- If a feature is new, do not also describe it as a fix unless there was a specific broken behavior users already hit.
- Put unreleased work under `Next Release`; do not add new entries to already-released versions.

## Quick Check

Before finishing:

1. Search the changelog for duplicated wording across `Added`, `Changed`, and `Fixed`.
2. Remove stale implementation-only bullets.
3. Verify the entry matches the actual current behavior in README/help/code.
4. Keep the wording concise and concrete.
