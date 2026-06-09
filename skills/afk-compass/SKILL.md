---
name: afk-compass
description: Route broad, ambiguous, multi-phase, or explicit AFK workflow/run requests to the right AFK and recommended external skills. Use at the start and at phase changes to choose the smallest useful next skill; Compass does not imply workflow artifacts unless `afk-artifact-workflow` is selected.
---

# AFK Compass

AFK Compass chooses which skill should guide the next move. It does not replace native skill discovery or force workflow artifacts; it sharpens discovery by mapping the user's request to AFK's workflow skills and recommended external companion skills.

## First Move
When a request arrives:
1. Identify the user's actual phase.
2. Check for a directly named skill and honor it first.
3. Choose the smallest useful skill set.
4. Move into the working skill immediately.

## Routing Modes

### Freestyle Routing
Use this mode by default. Pick the smallest useful skill for the current request, including direct routing to debugging, review, TDD, incremental implementation, UI, docs, or normal execution. Do not create workflow artifacts unless `afk-artifact-workflow` is actually selected.

### AFK Orchestration Mode
Use this mode when the user asks for an "AFK workflow", "feature workflow", "start a workflow", "AFK run", or otherwise signals that they want AFK to coordinate the feature lifecycle across phases.

In orchestration mode:

- Treat the work as phase-managed. Re-enter Compass after source gathering, user answers, drafts, plans, and execution gates.
- Use `afk-artifact-workflow` for artifact boundaries, storage, and suggesting the next useful workflow artifact once current sources or artifacts are staged. Do not treat it as the whole orchestration.
- Use `spec-driven-development` when a PRD/spec is being created before code.
- Use `grill-with-docs` before drafting the PRD/spec only when terminology, domain boundaries, ADRs, `CONTEXT.md`, or code/docs consistency are already risky. If it did not run before the PRD/spec draft, consider it before implementation planning and state why it is being used or skipped.
- Use `afk-coding-tradeoffs` when meaningful product, UX, component, ownership, library, or implementation choices remain open. Pair it with `afk-ui-registry-preferences` when UI primitives, registry components, or headless foundations are part of the decision.
- Use `planning-and-task-breakdown` when the user asks for an implementation plan or the spec is ready to become tasks.
- Ask before enabling `afk-execution-tracking`, unless the user explicitly requested tracked execution or the work clearly needs checkpoints, approval gates, handoff notes, parallel agents, interruption recovery, or durable progress state.
- Default to `test-driven-development` for software behavior changes. Skip only when there is no meaningful behavior risk, such as pure docs, static content, trivial config, generated artifacts, or when literal test-first is impractical; in those cases, state why and choose the nearest proof mechanism before implementation.
- Use `incremental-implementation` for multi-file, large, risky, or task-breakdown-driven implementation. Skip it for minimal single-file or single-function changes.
- Use `afk-advanced-elicitation` when the user asks for deeper critique, says they are still doubtful or confused, or keeps bouncing between decisions after a draft or direction exists.

## Skill Routing
Use this map to choose the next skill:

```text
Task arrives
|
+-- Need relentless plan/design questioning? ----> grill-me
+-- Need divergent ideas or directions? ----------> afk-brainstorming-facilitator
+-- Writing, rewriting, or reviewing docs? -------> afk-doc-craft
+-- PRD/spec/RFC/plan/tracking/handoff artifacts? -> afk-artifact-workflow
+-- Need a reviewed /goal package? --------------> plannotator-setup-goal
+-- Need a formal PRD/spec before code? ----------> spec-driven-development
+-- Have a spec and need tasks? ------------------> planning-and-task-breakdown
+-- Need UX or implementation trade-offs settled? -> afk-coding-tradeoffs
+-- Need docs/domain/terminology pressure? ------> grill-with-docs
+-- Need to pressure-test an existing draft? -----> afk-advanced-elicitation
+-- Implementing a change? -----------------------> incremental-implementation
|   +-- Needs checkpoints or parallel handoff? ---> afk-execution-tracking
|   +-- Needs tests first or proof loop? ---------> test-driven-development
+-- Something broke or behavior is unclear? ------> afk-structured-debugging
+-- Reviewing code or PR quality? ----------------> normal review workflow
|   +-- Too complex after review? ----------------> code-simplification
+-- Frontend primitives or registry choice? ------> afk-ui-registry-preferences
+-- Frontend design, UI quality, or polish? -----> impeccable
+-- Need a quick throwaway experiment? -----------> prototype
+-- Need external-model perspective? -------------> afk-ask
+-- Need disposable session handoff? -------------> handoff, then afk-pickup
+-- Need terminal/session coordination? ----------> cmux or tmux
```

Only invoke skills that are installed or clearly available. If a routed skill is missing, state the gap and continue with the best available installed skill or normal workflow.

## Core Behaviors
These behaviors apply across every routed skill.

### Surface Assumptions
Before non-trivial work, state material assumptions about requirements, architecture, and scope. Do not silently fill gaps. If an assumption can change the outcome, ask or name it before proceeding.

### Manage Confusion
When instructions, docs, code, or observed behavior conflict, stop long enough to name the conflict and decide what evidence resolves it. Do not guess through confusion or choose the convenient interpretation.

### Push Back When Warranted
If the requested direction has a concrete downside, say so plainly, explain the trade-off, and offer a better path. Do not perform agreement when the work would get worse. After the user decides with full context, follow their call.

### Keep Scope Tight
Honor explicit scope limiters such as "just" and "focus just on." Avoid adjacent cleanup, surprise refactors, deleted comments, extra features, or unrelated docs unless the user asks for them.

### Enforce Simplicity
Actively resist overcomplication. Prefer the boring path when it fits. Add abstractions only when they reduce real complexity, match existing patterns, or protect a meaningful contract.

### Verify With Evidence
Do not treat "looks right" as done. Finish with proof appropriate to the work: tests, typechecks, lint, build output, runtime inspection, browser verification, or a clear reason verification could not run.

## Phase Re-checks
Re-check routing when the work changes phase. Do not keep using the previous skill by inertia after source gathering, a user answer, or a completed artifact changes the next job.

Common phase moves:

- Source gathering -> PRD/spec: use `afk-artifact-workflow` for artifact boundaries, then `spec-driven-development` when a formal PRD/spec is being created before code.
- PRD/spec draft -> implementation plan: use `planning-and-task-breakdown` when the spec is ready to become tasks.
- Draft or plan -> domain pressure: use `grill-with-docs` when terminology, domain boundaries, `CONTEXT.md`, ADRs, or code/docs consistency could change the artifact. Use it before drafting the PRD/spec only when that risk already exists; otherwise draft first, then grill before implementation planning.
- Plan or design -> decision-tree pressure: use `grill-me` when the user asks to be grilled, wants relentless questioning, or needs a plan/design stress-tested through one-question-at-a-time interrogation.
- Open product, UX, component, ownership, library, or implementation choices -> use `afk-coding-tradeoffs`, pairing `afk-ui-registry-preferences` when UI primitives or registries matter.
- Implementation -> use `test-driven-development` for behavior changes, `afk-execution-tracking` when checkpoints or durable state are needed, and `incremental-implementation` when the implementation is broad enough.
- Any draft or workflow artifact -> reader-facing polish: use `afk-doc-craft` only when the artifact needs human-facing documentation quality, not for agent skill content.

Most freestyle tasks need only one or two steps. Do not turn AFK Compass into ceremony.

Use `plannotator-setup-goal` when the work should become a durable `/goal` package with reviewed facts and an approved execution plan. It is especially useful for broad objectives, goals with many scope decisions, or work that needs an explicit done condition before implementation. Skip it for narrow one-shot edits, quick bug fixes, or tasks where a lightweight `afk-artifact-workflow` artifact is enough.

## Skill Rules
- Direct user skill mentions beat routing guesses.
- Multiple skills can apply, but keep the active set small.
- AFK-native skills shape the work; external recommendations add specialized process when available.
- When in doubt on non-trivial product or engineering work, clarify the desired outcome before implementation.
- Do not present an uninstalled recommended skill as available.
