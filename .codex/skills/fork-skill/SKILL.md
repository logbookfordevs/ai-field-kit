---
name: fork-skill
disable-model-invocation: true
description: Create or update a literal skill fork with only necessary local adaptations.
---

# Fork Skill

A fork preserves an upstream skill as its source of truth. Start from a literal copy, then change only what the target environment requires.

Using another skill as inspiration is a rewrite. For that work, use `writing-great-skills` and do not describe the result as a fork.

## 1. Pin the source and adaptations

Identify:

- the authoritative source repository or path
- the exact source ref or commit
- the complete source skill package, including `SKILL.md`, agent metadata, references, scripts, and assets
- the target path and public name
- the local adaptations the user actually requested

Read every source file that the package contains or directly references. If the user has not named an adaptation, upstream behavior and wording are the default.

This step is complete when the source snapshot is pinned and every intended adaptation is listed before editing.

## 2. Establish the literal baseline

For a new fork, copy the complete source package before adapting it.

For an existing fork, place the pinned upstream package in a temporary directory and compare it with the fork. Treat every difference as unexplained until it maps to an intended adaptation.

Preserve upstream structure, ordering, terminology, templates, defaults, and invocation policy wherever the local environment does not require a change.

This step is complete when a recursive diff can show the untouched upstream baseline against the target.

## 3. Apply the adaptation patch

Make the smallest patch that integrates the skill locally. Typical adaptations include:

- skill and package identifiers
- commands or skill names that differ locally
- repository-specific paths, storage conventions, or artifact formats
- integration points unavailable in the target environment
- local invocation policy when the user explicitly wants it changed
- wording or posture changes the user explicitly requested
- local review or handoff gates that extend the upstream process

For every changed hunk, state why the upstream text or behavior cannot remain unchanged. Restore any hunk whose justification is only unsolicited cleanup, simplification, branding, or rephrasing.

Keep upstream prose verbatim around each adaptation. Add local wording only where the behavior genuinely diverges, and keep that wording next to the divergence it explains.

This step is complete when each changed hunk maps one-to-one to the adaptation list.

## 4. Audit fork fidelity

Compare the finished fork recursively against the pinned source. Classify every difference as:

- required local adaptation
- source update intentionally not adopted, with the incompatibility stated
- accidental drift to restore from upstream

Check specifically for omitted frontmatter, invocation flags, completion criteria, templates, closing instructions, referenced files, and supporting assets. These edges are easy to lose when copying only the visible body.

Resolve every accidental drift before continuing.

This step is complete when the diff contains no unexplained difference.

## 5. Validate and report

Validate the target package in proportion to its contents:

- parse YAML frontmatter and agent metadata
- resolve every relative link and context pointer
- run included scripts or validation commands when safe
- confirm identifiers, invocation policy, and catalog metadata agree
- confirm local adaptations do not contradict preserved upstream instructions

Report:

- pinned source and ref
- files copied or updated
- exact local adaptations
- intentionally unadopted upstream changes
- validation performed

The fork is complete only when all source files are accounted for, every remaining diff is explained, and validation passes.
