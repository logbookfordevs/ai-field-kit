---
name: afk-code-grill
description: Grill implementation and UX trade-offs inside a bounded coding scope before implementation.
metadata:
  short-description: Grill implementation and UX trade-offs before coding.
---

# Code Grill

This is a wrapper for bounded code decisions. Compose `grilling` for the interview loop, `truss-evaluation` for the decision lens, and `codebase-design` when module, interface, seam, or test-surface shape matters.

Use it when the work is already scoped but still has choices that can materially change UX, correctness, maintainability, ownership, library commitments, state shape, or component composition.

Do not use it for broad discovery, full planning, generic architecture theater, or style debates the repo already answers.

## Operating Shape

1. Name the bounded slice in one sentence.
2. Inspect only the context needed to avoid asking answered questions.
3. Identify the 1-3 trade-offs that would actually change the implementation.
4. Ask one sharp question at a time using the `grilling` loop.
5. Recommend a direction when the evidence is enough.
6. End with a tiny decision note only when it will help execution or handoff.

Default pace: one decision, one question, one recommendation.

## Good Questions

Ask about choices like:

- modal, drawer, inline, or separate page
- shared controller or local ownership
- registry component or custom build
- optimistic update, blocking submit, or background sync
- reactive state or ref/non-render state
- custom hook, framework primitive, or colocated logic
- dense table, kanban, timeline, or split view
- explicit fallback or generic fallback

Do not ask about:

- `type` vs `interface`
- formatting or naming already covered by the repo
- trivial `useState` vs `useReducer`
- library choices already fixed by project rules
- abstractions that do not change behavior, clarity, or future cost

## Question Format

Keep questions contrastive and easy to answer:

```text
Trade-off: [decision name]
Context: [one sentence from code/docs/user input]

I see three sane options:
1. [option] - wins if [condition]
2. [option] - wins if [condition]
3. [option] - wins if [condition]

My default: [option], because [reason].
```

If the user answers freeform, synthesize it into a decision and continue.

## Primitive Dependencies

Use `truss-evaluation` as the decision lens:

- Maintainability: will this be easy to change?
- Strategy: does it fit where the product/codebase is going?
- Clarity: will the next engineer understand it?
- Performance: does it avoid meaningful waste or latency?

If `truss-evaluation` is missing, say this skill is designed to work with Truss and ask the user to install it:

```bash
npx skills add https://github.com/leoreisdias/truss-framework
```

Do not produce a full matrix unless the user asks for one.

Use `codebase-design` when the trade-off touches module depth, interface shape, seam placement, adapter design, or testability.

## Output

Usually end inline:

```md
Decision: [chosen direction]
Why: [short reason]
Accepted trade-off: [cost we knowingly accept]
Implementation note: [what the builder should do next]
```

Write an ADR only when the decision is hard to reverse, surprising, or likely to be reopened later. If writing one, follow the repo's convention; otherwise use `docs/<task-slug>/decisions/`.
