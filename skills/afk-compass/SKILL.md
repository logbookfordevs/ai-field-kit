---
name: afk-compass
description: Route broad, ambiguous, phase-change, artifact-boundary, storage-convention, explicit AFK workflow, AFK Sprint, AFK Turbo, or non-obvious skill-selection requests to the smallest useful AFK or companion skill. Use when the next skill is unclear; Compass is a selector, not a workflow runner.
---

# AFK Compass

AFK Compass chooses the next useful tool. It is a road sign, not the road.

Do not run a multi-step lifecycle from Compass. Route the current moment to one skill, reference, or named execution package, then let that selected tool work.

## First Move
When a request arrives:
1. Identify the user's actual phase.
2. Check for a directly named skill and honor it first.
3. Choose the smallest useful skill set.
4. Move into the working skill immediately.

## Routing

Route by user intent, not by literal tool names. Tool names below identify the current implementation.

```text
Task arrives
|
+-- Need relentless plan/design questioning? ----> grill-me
+-- Need divergent ideas or directions? ----------> afk-brainstorming-facilitator
+-- Explicit AFK Turbo or visual-board execution package? -> afk-turbo
+-- Explicit AFK Sprint or goal run with Markdown tracking? -> afk-sprint
+-- Explicit AFK workflow / Flow / run? --------> route only the current phase
+-- Resuming existing feature/workflow work? ---> afk-resume-workflow
+-- Writing, rewriting, or reviewing human-facing docs? -> afk-doc-craft
+-- Need artifact boundaries or storage conventions? -> read references/artifacts.md
+-- Need an agent-ready PRD/spec before code? ---> afk-to-prd-spec
+-- Need executable slices/checkpoints? ---------> afk-to-issues
+-- Need code choices or implementation trade-offs grilled? -> afk-code-grill
+-- Need docs/domain/terminology pressure? ------> grill-with-docs
+-- Implementing or delegating a change? --------> execution bundle selection
|   +-- Needs checkpoint packets first? ---------> afk-to-issues
|   +-- Needs tracked checkpoint execution? -----> afk-execution-tracking
|   +-- Needs tests first or proof loop? ---------> tdd
|   +-- Needs current official docs? ------------> source-driven-development
|   +-- Needs fresh-context adversarial check? --> doubt-driven-development
+-- Something broke, fails, throws, or regressed? -> diagnosing-bugs
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

For explicit AFK workflow / Flow requests, explain that AFK is composable and route the current phase only. Do not require Grill, PRD/spec, issues, tracking, or execution discipline unless that is the current need.

## Core Behaviors
These behaviors apply across every routed skill.

### Surface Assumptions
Before non-trivial work, state material assumptions about requirements, architecture, and scope. Do not silently fill gaps. If an assumption can change the outcome, ask or name it before proceeding.

### Manage Confusion
When instructions, docs, code, or observed behavior conflict, stop long enough to name the conflict and decide what evidence resolves it. Do not guess through confusion or choose the convenient interpretation.

### Push Back When Warranted
If the requested direction has a concrete downside, say so plainly, explain the trade-off, and offer a better path. Do not perform agreement when the work would get worse. After the user decides with full context, follow their call.

### Keep Scope Tight
Honor explicit scope limiters such as "just" and "focus just on." Avoid adjacent cleanup, surprise refactors, and extra artifacts unless the user asks for them. Prefer the boring path when it fits.

### Verify With Evidence
Do not treat "looks right" as done. Finish with proof appropriate to the work: tests, typechecks, lint, build output, runtime inspection, browser verification, or a clear reason verification could not run.

## Skill Rules
- Direct user skill mentions beat routing guesses.
- Multiple skills can apply, but keep the active set small.
- Re-check routing when the work changes phase.
- When in doubt on non-trivial product or engineering work, clarify the desired outcome before implementation.
