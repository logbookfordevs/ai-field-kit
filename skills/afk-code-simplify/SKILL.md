---
name: afk-code-simplify
description: Simplify working code without changing behavior. Use when code already works but feels heavier, less readable, or more complex than it should be, and the goal is to improve clarity, maintainability, and reviewability without turning the change into a feature rewrite.
metadata:
  short-description: Refactor working code for clarity without changing behavior.
---

# Code Simplification

Use this skill when the code already works, but it is harder to read, reason about, maintain, or review than it should be.

This skill is not for adding behavior. It is for making existing behavior easier to live with.

The experience should feel disciplined and conservative:
- understand first
- simplify second
- preserve behavior exactly
- keep the diff reviewable

## Goal

Reduce unnecessary complexity while preserving exact behavior.

Typical outcomes:
- clearer control flow
- smaller or better-named units
- less duplication
- fewer misleading names
- cleaner diff for future reviewers

## Use When

- a feature works, but the implementation feels heavier than necessary
- code review reveals readability or complexity problems
- a function, module, or component is difficult to follow
- code written under time pressure now needs cleanup
- recent changes introduced duplication or awkward structure
- the user explicitly asks to simplify, clean up, or make code easier to understand

## Do Not Use When

- the code's behavior is not yet understood
- the task is really a feature change, not simplification
- the code is already clean enough and the refactor would just create churn
- the code is performance-critical and the "simpler" version would likely make it worse without measurement
- the module is about to be replaced or deleted anyway

## Core Principles

- Preserve behavior exactly.
- Prefer clarity over cleverness.
- Follow project conventions rather than imposing stylistic novelty.
- Simplify recently changed or in-scope code first.
- Keep simplification reviewable and incremental.
- Do not optimize for fewer lines; optimize for faster understanding.

## Simplification Checks

Before changing code, ask:

```text
- What is this code responsible for?
- What calls it and what does it call?
- What edge cases or error paths matter here?
- What tests or behaviors define "unchanged"?
- Why might it have been written this way?
```

If you cannot answer those questions, read more context before simplifying.

## Good Simplification Targets

- deep nesting that can become clearer guard clauses
- long functions with multiple responsibilities
- misleading or generic names
- nested ternaries and dense inline conditionals
- repeated conditionals that want a named predicate
- dead code that is truly no longer needed
- duplicated logic that can become one well-named helper
- wrappers or abstractions that add no meaningful value

## Common Traps

- over-inlining and losing useful conceptual names
- merging unrelated logic just to reduce file count
- removing abstractions that exist for testability or extensibility
- changing behavior accidentally while "cleaning things up"
- broad drive-by refactors that make the diff noisy

## Workflow

### 1. Understand the current behavior

- Read the relevant source and nearby context.
- Identify what must stay behaviorally identical.
- Use existing tests, docs, and call sites as behavioral anchors when available.

### 2. Identify simplification opportunities

Look for the smallest useful wins first:
- one clearer function boundary
- one naming cleanup with real signal
- one repeated conditional extracted cleanly
- one dead branch removed safely

Prefer a few concrete simplifications over a sweeping rewrite.

### 3. Simplify incrementally

- Make one meaningful simplification at a time.
- Keep the change scoped and reviewable.
- If the simplification grows into a redesign, stop and re-scope.

### 4. Preserve exact behavior

Every proposed simplification should survive these questions:

```text
- Same outputs for the same inputs?
- Same side effects and ordering?
- Same error behavior?
- Same meaningful edge-case behavior?
```

If confidence is weak, say so instead of pretending the simplification is safe.

### 5. Verify the result

After simplification, check:
- is the code actually easier to understand?
- does it better match project patterns?
- is the diff still easy to review?
- would a teammate understand it faster than before?

## Output Shape

Prefer this structure when presenting a simplification review or proposal:

1. `What Feels Heavy`
2. `Simplification Opportunities`
3. `Recommended Changes`
4. `Behavior Risks`
5. `Verification`

If you are actively rewriting code, keep the final explanation short and focused on what became simpler and what behavior was intentionally preserved.

## Anti-Rationalizations

| Rationalization | Better move |
|---|---|
| "Fewer lines means simpler code" | Measure simplification by comprehension, not line count. |
| "I can clean up this whole area while I'm here" | Keep simplification scoped unless the user asked for a broader sweep. |
| "This helper seems unnecessary" | Check whether it provides a useful concept name before removing it. |
| "The code works, so readability doesn't matter" | Working code still becomes tomorrow's maintenance burden. |
| "This refactor is small, I don't need to verify behavior" | Simplification without behavioral verification is just a stealth rewrite. |

## Red Flags

- the refactor changes behavior while pretending not to
- the diff grows into a redesign
- names get shorter but not clearer
- abstractions are removed without understanding why they existed
- the "simplified" version is denser or harder to scan
- the refactor touches many unrelated files for little readability gain

## Suggested Next Skills

These are suggestions, not required steps:
- use `afk-structured-debugging` first if the code is broken and root cause is still unclear
- use `afk-advanced-elicitation` if you want a stronger critique of the simplification plan before editing
- use `afk-documentation-authoring` if the simplification should be accompanied by clearer technical docs or decision notes
