---
name: afk-code-review
description: Review a branch, PR, work-in-progress diff, or changes since a fixed point along two axes: Standards and Spec. Use when the user asks for a code review, PR review, branch review, or review since a commit/branch/tag.
---

# AFK Code Review

Run a **two-axis review** of the diff between `HEAD` and a fixed point:

- **Standards**: does the change follow repo standards and code-quality heuristics?
- **Spec**: does the change implement what the issue, PRD, task, or stated request asked for?

Keep the axes separate. A change can satisfy the spec while violating standards, or follow standards while implementing the wrong behavior.

## Process

### 1. Pin the fixed point

Use the fixed point the user supplied: a commit SHA, branch, tag, `main`, `HEAD~5`, or PR base. If they did not supply one, ask for it.

Capture these once:

```bash
git rev-parse <fixed-point>
git diff --name-only <fixed-point>...HEAD
git diff <fixed-point>...HEAD
git log <fixed-point>..HEAD --oneline
```

Continue only when the fixed point resolves and the diff is non-empty.

### 2. Find the review sources

Find the **Spec** source in this order:

1. Issue, PR, or task references in commit messages, branch names, PR body, or user-provided context.
2. A path the user supplied.
3. Matching files under `docs/`, `specs/`, `.scratch/`, `goals/`, or AFK tracking folders.
4. If nothing is found, ask the user where the spec is. If there is no spec, skip the Spec axis and say so.

Find **Standards** sources from repo guidance such as `AGENTS.md`, `CLAUDE.md`, `CODING_STANDARDS.md`, `CONTRIBUTING.md`, lint/test conventions, and nearby examples.

### 3. Expand impact beyond the diff

Treat the change as **contract-touching** when it changes any of these:

- Request/response fields (added, removed, renamed, required, optional)
- Endpoint paths or HTTP methods
- Validation rules (required fields, limits, conditional requirements)
- Shared constants/enums used for persistence, analytics, or branching
- Lifecycle/status transitions that affect behavior in multiple entrypoints

For contract-touching changes, extract contract tokens from the diff and search the branch for every caller or consumer:

```bash
git grep -n "<tokenA>\\|<tokenB>" HEAD -- '*.js' '*.jsx' '*.ts' '*.tsx'
```

Build an **Impact Map** before reviewing findings:

- Changed files
- Unchanged but impacted files
- Potential blind spots
- Any paths marked out of scope, with a concrete reason

Do not finalize a contract-touching review until each discovered caller is reviewed or explicitly ruled out of scope.

### 4. Run the axes

Prefer parallel sub-agents or fresh contexts so the axes do not contaminate each other. If delegation is unavailable, run the two passes separately in this order.

#### Standards Axis

Review changed files and impacted unchanged files against the standards sources. Also apply the smell baseline below as judgement calls, not hard violations. Repo standards override the baseline. Skip anything tooling already enforces.

- **Mysterious Name**: a name does not reveal what it does or holds.
- **Duplicated Code**: the same logic shape appears in multiple hunks or files.
- **Feature Envy**: behavior reaches into another object's data more than its own.
- **Data Clumps**: the same fields or params keep travelling together.
- **Primitive Obsession**: a primitive or string stands in for a domain concept.
- **Repeated Switches**: the same branch cascade on the same type recurs.
- **Shotgun Surgery**: one logical change forces scattered edits.
- **Divergent Change**: one file changes for unrelated reasons.
- **Speculative Generality**: abstractions or hooks serve no current requirement.
- **Message Chains**: callers navigate through long object chains.
- **Middle Man**: code mostly delegates onward without adding behavior.
- **Refused Bequest**: an inheritance relationship is mostly ignored or overridden.

Report only actionable findings. For each finding, include severity, file/line reference, evidence, and the concrete risk.

#### Spec Axis

Review the diff against the spec source. Look for:

- Missing or partial requirements
- Behavior the spec did not ask for
- Requirements that look implemented but have incorrect behavior
- Tests or verification missing for required behavior

Quote or cite the spec line, issue section, task packet, or user request that anchors each finding.

### 5. Aggregate

Present findings first, grouped under `## Standards` and `## Spec`. Keep the axes separate; do not merge or rerank them into one list.

End with:

- Finding count per axis
- Worst issue within each axis, if any
- Test or verification gaps
- A concise approval stance

## Guided Mode

Use guided mode only when the user asks to walk the review step by step, inspect files interactively, or review with pauses.

In guided mode:

1. Build a logical reading order from foundations to dependent features.
2. Show the order and the Impact Map before file-by-file analysis.
3. Review one file at a time with `git diff <fixed-point>...HEAD -- <path>`.
4. After each file, ask whether to proceed to the next file.
5. Finalize with the same two-axis aggregation.

Do not pause file-by-file outside guided mode.

## Comment Drafting Rule

If the user asks for help drafting a PR comment, provide only the comment substance. Do not include file paths, line numbers, or code blocks that the PR UI already provides.
