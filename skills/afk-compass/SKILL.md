---
name: afk-compass
description: Route broad, ambiguous, or multi-phase work to the right AFK and recommended external skills. Use as the first AFK skill-selection layer when a task may involve planning, docs, implementation, debugging, review, UI, handoff, or workflow coordination.
---

# AFK Compass

AFK Compass is the entry point for choosing which skill should guide the next move. It does not replace native skill discovery; it sharpens discovery by mapping the user's request to AFK's workflow skills, installed taxonomy, and recommended external companion skills.

## First Move
When a request arrives:
1. Identify the user's actual phase.
2. Check for a directly named skill and honor it first.
3. If the user asks for a category of their installed skills, inspect `~/.agents/skills/skills.json` for helpful taxonomy signals.
4. Choose the smallest useful skill set.
5. Move into the working skill immediately.

If `~/.agents/skills/skills.json` is missing, invalid, stale, or not relevant, continue with normal skill discovery.

Category requests include phrasing like "use my design skills", "use my review skills", "pick from my frontend skills", or "use any debugging skill I have." Taxonomy can rank matching installed skills; it never replaces the routing decision.

## Skill Routing
Use this map to choose the next skill:

```text
Task arrives
|
+-- Unsure what the user really wants? -----------> afk-deep-interview
+-- Need divergent ideas or directions? ----------> afk-brainstorming-facilitator
+-- Writing, rewriting, or reviewing docs? -------> afk-doc-craft
+-- PRD/spec/RFC/plan/tracking/handoff artifacts? -> afk-workflow
+-- Need a reviewed /goal package? --------------> plannotator-setup-goal
+-- Need a formal PRD/spec before code? ----------> spec-driven-development
+-- Have a spec and need tasks? ------------------> planning-and-task-breakdown
+-- Need UX or implementation trade-offs settled? -> afk-coding-tradeoffs
+-- Need to challenge a plan against docs/domain? -> grill-with-docs
+-- Need to pressure-test an existing draft? -----> afk-advanced-elicitation
+-- Implementing a change? -----------------------> incremental-implementation
|   +-- Needs checkpoints or parallel handoff? ---> afk-execution-tracking
|   +-- Needs tests first or proof loop? ---------> test-driven-development
|   +-- TypeScript validation needed? ------------> afk-typecheck
+-- Something broke or behavior is unclear? ------> afk-structured-debugging
+-- Reviewing code or PR quality? ----------------> afk-interactive-code-review
|   +-- Too complex after review? ----------------> code-simplification
+-- Frontend primitives or registry choice? ------> afk-ui-registry-preferences
+-- Frontend design, UI quality, or polish? -----> impeccable
+-- Skill authoring or refinement? ---------------> write-a-skill
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

## Sequencing
A full feature may move through several skills:

```text
afk-deep-interview
-> plannotator-setup-goal
-> spec-driven-development
-> planning-and-task-breakdown
-> afk-coding-tradeoffs
-> afk-execution-tracking
-> incremental-implementation
-> test-driven-development
-> afk-interactive-code-review
-> code-simplification
-> afk-doc-craft
```

Most tasks need only one or two steps. Do not turn AFK Compass into ceremony.

Use `plannotator-setup-goal` when the work should become a durable `/goal` package with reviewed facts and an approved execution plan. It is especially useful for broad objectives, goals with many scope decisions, or work that needs an explicit done condition before implementation. Skip it for narrow one-shot edits, quick bug fixes, or tasks where a lightweight `afk-workflow` artifact is enough.

## Skill Rules
- Check for applicable skills before starting meaningful work.
- Direct user skill mentions beat routing guesses.
- Multiple skills can apply, but keep the active set small.
- AFK-native skills shape the work; external recommendations add specialized process when available.
- Taxonomy in `skills.json` is a ranking hint, not a hard filter.
- When in doubt on non-trivial product or engineering work, clarify the desired outcome before implementation.
- Do not present an uninstalled recommended skill as available.
