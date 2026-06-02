---
name: afk-structured-debugging
description: Investigate tests, builds, logs, and runtime bugs with a structured root-cause process. Use when behavior does not match expectations, failures need to be localized, or the user needs a clear explanation of what should happen, what is actually happening, and how to fix it without guessing.
metadata:
  short-description: Systematic debugging with root-cause analysis and clear recovery steps.
---

# Structured Debugging

Use this skill when something is broken and guessing would make it worse.

This skill should feel like a careful debugging partner:
- stop the bleed first
- preserve evidence
- explain the current logic clearly
- find the root cause instead of only treating symptoms
- leave the system in a safer state than before

## Goal

Turn a bug, failure, or confusing runtime behavior into:
- a clear statement of expected vs actual behavior
- a localized explanation of where the issue likely lives
- a root-cause hypothesis or confirmed cause
- one or more practical fixes
- a guard against recurrence when appropriate

## Use When

- tests fail after a change
- the build breaks
- runtime behavior does not match expectations
- logs or console output show an unexpected error
- a bug report needs structured investigation
- the user wants the current logic explained before changing anything

## Do Not Use When

- the task is still about discovery or feature design, not failure analysis
- the user only wants a speculative code rewrite without diagnosis
- the issue is already fully understood and only implementation remains

## Core Principles

- Stop adding unrelated changes until the failure is understood.
- Preserve evidence before attempting broad fixes.
- Reproduce before claiming confidence.
- Reduce the problem until the failure surface is easier to reason about.
- Fix the root cause, not the nearest visible symptom.
- Prefer clear explanations over hand-wavy debugging folklore.
- When timing or async behavior matters, make the sequence visible.
- End with concrete next steps, not just observations.

## Stop-the-Line Rule

When something unexpected happens:

```text
1. Stop adding features or unrelated edits
2. Preserve the evidence
3. Reproduce the issue
4. Localize the failure
5. Reduce to the smallest useful failing case
6. Fix the root cause
7. Guard against recurrence
8. Resume only after verification
```

Do not push past a broken test, build, or runtime failure just to keep momentum.

## Workflow

### 1. Clarify the failure

Establish:
- what the user expected
- what actually happened
- where the failure appears
- whether the issue is reproducible now

Prefer a short summary shaped like:
- `Expected`
- `Actual`
- `Evidence`
- `Current Confidence`

### 2. Preserve evidence

Before proposing broad fixes, keep the useful evidence:
- exact error messages
- logs
- failing commands
- reproduction steps
- screenshots or UI observations
- relevant diff context when the issue followed a recent change

If the evidence is incomplete, ask for only the minimum missing details.

### 3. Reproduce

Try to make the issue happen reliably.

If it reproduces:
- continue to localization

If it does not reproduce:
- say so explicitly
- document the current uncertainty
- reason through likely classes of non-reproducible bugs:
  - timing-dependent
  - environment-dependent
  - state-dependent
  - intermittent external dependency failures

When the issue is not reproducible, prefer:
- better logging
- narrower repro steps
- isolation runs
- environment comparison

### 4. Localize

Identify where the failure most likely lives:
- UI or frontend behavior
- API or backend behavior
- database or persistence layer
- build or tooling layer
- external service integration
- test itself

Use the evidence to narrow the failure surface before recommending code changes.

### 5. Reduce

Try to reduce the problem to the smallest useful failing unit:
- minimal repro input
- smallest failing command
- one failing test instead of the whole suite
- one narrowed code path instead of the entire feature

Reduction matters because it separates signal from noise.

### 6. Explain the logic clearly

When the user asks how the current logic works, explain:
- what the system is doing now
- what should happen instead
- where the divergence occurs

If the bug involves timing, async behavior, intervals, queues, retries, events, or sequencing, always include ASCII sequence or timeline diagrams.

Preferred format:

```text
### What Should Happen:
<ASCII diagram>

### What's Actually Happening:
<ASCII diagram>
```

Keep diagrams aligned and easy to scan.

### 7. Identify the root cause

Prefer a root-cause explanation over a symptom description.

Good:
- "The API response shape changed, but the UI still assumes `user.id` is always present."
- "The test is flaky because shared state leaks between runs."
- "The duplicate UI rows are caused by the join, not the render loop."

Weak:
- "The component crashes here."
- "The fix is to add a null check."

Ask, implicitly or explicitly:
- why is this happening?
- what upstream condition made this possible?
- what fix would remove the underlying cause?

### 8. Propose fixes and guards

Always suggest at least 2 ways to fix or mitigate the issue when that is practical.

For each option, explain:
- what it changes
- why it helps
- trade-offs or risks

When appropriate, include a guard against recurrence such as:
- a regression test
- stronger validation
- logging or alerting
- safer fallback behavior

### 9. Verify

End with concrete verification guidance.

Prefer checks such as:
- rerun the failing test
- rerun the build
- manually verify the broken flow
- confirm the error no longer appears
- confirm no new regression is introduced nearby

## Error Patterns

For failure-type checklists, see [error-patterns.md](references/error-patterns.md).

## Safe Fallbacks

When the ideal fix is not immediately available, prefer safe degradation over silent breakage:
- explicit empty states
- guarded rendering
- conservative defaults
- warnings that preserve traceability

Do not present a fallback as the root-cause fix when it only masks the issue.

## Output Shape

Prefer this structure:

1. `Bug Summary`
2. `Expected vs Actual`
3. `Where It Likely Breaks`
4. `Root Cause`
5. `Fix Options`
6. `Verification`

When timing or sequencing matters, put the ASCII diagrams before the plain-language explanation.

## Red Flags

For red flags and anti-rationalizations, see [debugging-guardrails.md](references/debugging-guardrails.md).

## Anti-Rationalizations

Use the guardrails reference when tempted to keep coding without a clear cause.
