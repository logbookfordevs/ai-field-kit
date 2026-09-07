---
name: update-forked-skills
description: Audit and update repository-owned skill forks from their official upstream packages.
argument-hint: "[skill names or paths]"
disable-model-invocation: true
---

# Update Forked Skills

Keep literal skill forks close to upstream without overwriting local adaptations.

Before starting, read `.codex/skills/fork-skill/SKILL.md` completely and use it
as the methodology source of truth.

## 1. Pin the live local forks

Use the skills named by the user. If none are named, identify repository-owned
forks from their source metadata, history, changelog, and documentation. Exclude
skills merely installed or cataloged directly from an upstream repository.

For each fork, inspect:

- the complete package, including `SKILL.md`, agent metadata, references,
  scripts, and assets
- uncommitted changes and the latest commits touching every package file
- the latest substantive upstream-content sync, which may differ from the
  latest local policy, metadata, or adaptation commit
- the local adaptations those changes preserve

Treat the working tree as the newest local state. Preserve overlapping
uncommitted work and re-read a file if it changes during the audit.

Complete when every target fork has a local baseline and an explicit adaptation
list.

## 2. Pin current upstream

Resolve the authoritative upstream repository and fetch or clone it into a
temporary directory. Record the current commit and read every file in each
upstream package.

Inspect package history after the local baseline commit or date. Read each
relevant commit diff; an end-state diff alone cannot show whether a change is
new, already ported independently, or later reverted.

Complete when every upstream package and relevant post-baseline commit is
accounted for.

## 3. Classify upstream drift

Compare the pinned packages recursively and classify each upstream change as:

- **portable**: a new upstream improvement that preserves local adaptations
- **already equivalent**: the fork already has the same behavior
- **local conflict**: it changes an intentional local contract, integration,
  invocation policy, artifact convention, or folder structure
- **irrelevant**: package-wide metadata or documentation with no missing local
  capability

Prefer upstream wording and structure for portable changes. Preserve the fork's
names and intentional adaptations. A newer upstream commit is evidence to
inspect, not a reason to copy it.

Complete when every newer upstream change has one classification and a reason.

## 4. Report before editing

Present a per-skill comparison containing:

- the live local baseline and latest local work
- the pinned upstream commit and newer relevant commits
- what changed upstream
- the classification and rationale
- the smallest proposed patch, if any

Separate required updates from optional metadata cleanup. State when no update
is needed.

Stop after this report. Continue to editing only after the user explicitly
approves the proposed changes.

## 5. Apply the approved patch

After approval, apply only the accepted portable hunks. Map each hunk to the
classification report and keep upstream prose unchanged around necessary local
adaptations.

If the working tree changed after the report, re-run the affected comparison
before editing. Ask again when the new state changes the proposed patch.

Complete when the recursive diff contains only explained local adaptations and
intentionally unadopted upstream changes.

## 6. Validate

Validate in proportion to each package:

- parse YAML frontmatter and agent metadata
- resolve every relative link and context pointer
- run safe included scripts and repository checks
- inspect `git diff` and `git status`
- confirm unrelated and pre-existing changes remain untouched

Report the pinned upstream commits, adopted and rejected changes, files updated,
and validation performed.
