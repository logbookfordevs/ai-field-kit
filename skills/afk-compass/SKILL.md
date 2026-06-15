---
name: afk-compass
description: Route broad, ambiguous, multi-phase, explicit AFK workflow, AFK Turbo, or goal-package requests to the right AFK and companion skills. Use at the start and at phase changes; Free Route routes, Orchestration tracks, and Turbo boards.
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

### AFK Free Route
Use this mode by default. Pick the smallest useful skill for the current request, including direct routing to debugging, review, TDD/proof loops, source verification, doubt checks, UI, docs, or normal execution. Do not create workflow artifacts or tracking unless the selected route needs them.

### AFK Orchestration Mode
Use this mode when the user asks for an "AFK workflow", "feature workflow", "start a workflow", "AFK run", or otherwise signals that they want AFK to coordinate the feature lifecycle across phases.

In orchestration mode:

- Treat the work as phase-managed. Re-enter Compass after source gathering, user answers, drafts, plans, and execution gates.
- Use `afk-execution-tracking` as the continuity surface.
- Use `grill-with-docs` for brownfield work and `grill-me` for greenfield work before PRD/spec work and before executable slicing. Use `afk-brainstorming-facilitator` first only when the target is not clear enough to pressure-test.
- Use `afk-artifact-workflow` for artifact boundaries, storage, and next-artifact suggestions. Do not treat it as the whole orchestration.
- Use `afk-to-prd-spec` when no PRD/spec exists or the existing artifact lacks behavior needed for implementation.
- Use `afk-to-issues` before implementation to create executable checkpoint packets from the PRD/spec, plan, goal package, tracker issue, or current context.
- Use `afk-code-grill` to grill meaningful product, UX, component, ownership, library, or implementation choices one decision at a time. Pair it with `afk-ui-registry-preferences` when UI primitives, registry components, or headless foundations are part of the decision.
- At implementation or delegation time, select one or more execution disciplines for each implementation task: `tdd`, `source-driven-development`, or `doubt-driven-development`. Multiple disciplines can apply; `afk-execution-tracking` records state and evidence, but does not replace TDD, source verification, or doubt checks.
- Default to `tdd` for software behavior changes. Skip only when there is no meaningful behavior risk, such as pure docs, static content, trivial config, generated artifacts, or when literal test-first is impractical; in those cases, state why and choose the nearest proof mechanism before implementation.
- Use `source-driven-development` when implementation correctness depends on current framework, library, SDK, API, or platform documentation.
- Use `doubt-driven-development` for non-trivial or risky decisions that need fresh-context adversarial review before they stand.
- When delegating execution, include the selected execution bundle and expected evidence in the worker prompt; selected skills do not cross agent boundaries automatically.

### AFK Turbo Mode
Use Turbo when the user wants high-throughput progress toward a broad outcome.

Turbo uses GoalBuddy's local live board and PM loop as the execution surface. Start or register the local board before execution and include a clickable board URL when available. Do not also use `afk-execution-tracking`; the GoalBuddy board is the continuity surface.

Routes:

- **Turbo Board:** use targeted AFK preflight only where it removes a blocker, then run GoalBuddy.
- **Turbo Facts:** use `plannotator-setup-goal` when the target needs reviewed facts, accepted done conditions, or sharper scope before execution, then run GoalBuddy from those artifacts.

Preserve AFK execution discipline in GoalBuddy tasks: TDD for behavior, source checks for APIs/libs, doubt checks for risky decisions, and concrete validation.

### Goal Package Mode
Use when the user wants reviewed facts, context, and native `/goal` execution with Markdown-based AFK execution tracking instead of a visual board and PM loop.

Route:
1. Use one targeted AFK preflight only if it materially sharpens Plannotator input.
2. Use `plannotator-setup-goal` to create reviewed facts, plan, and `goal.md`.
3. Hand off the native `/goal` command for the prepared `goal.md`.
4. Track the native `/goal` execution with `afk-execution-tracking`.

## Skill Routing
Use this map to choose the next skill:

Route by user intent, not by literal tool names. Tool names below identify the current implementation for the agent.

```text
Task arrives
|
+-- Need relentless plan/design questioning? ----> grill-me
+-- Need divergent ideas or directions? ----------> afk-brainstorming-facilitator
+-- Need high-throughput outcome execution? -----> AFK Turbo Mode
+-- Resuming existing feature/workflow work? ---> afk-resume-workflow
+-- Writing, rewriting, or reviewing human-facing docs? -> afk-doc-craft
+-- PRD/spec/RFC/plan/tracking/handoff artifacts? -> afk-artifact-workflow
+-- Need reviewed facts + native /goal with Markdown tracking? -> Goal Package Mode
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

- Source gathering -> PRD/spec: use `afk-artifact-workflow` for artifact boundaries, then `grill-me` for greenfield work or `grill-with-docs` for brownfield work, then `afk-to-prd-spec` when an agent-ready PRD/spec is being created before code.
- PRD/spec draft -> executable slices: use `afk-to-issues` when the source artifact is ready to become independently grabbable checkpoint packets.
- Draft or plan -> domain pressure: use `grill-with-docs` when terminology, domain boundaries, `CONTEXT.md`, ADRs, or code/docs consistency could change the artifact. In AFK Orchestration, run the relevant grill pass before PRD/spec work and before executable slicing.
- Plan or design -> decision-tree pressure: use `grill-me` when the user asks to be grilled, wants relentless questioning, or needs a plan/design stress-tested through one-question-at-a-time interrogation.
- Open product, UX, component, ownership, library, or implementation choices -> use `afk-code-grill` as a Grill-style decision pass, pairing `afk-ui-registry-preferences` when UI primitives or registries matter.
- Orchestration -> implementation: `afk-to-issues` creates checkpoint packets, `afk-execution-tracking` tracks their execution, and each implementation task gets at least one execution discipline: `tdd`, `source-driven-development`, or `doubt-driven-development`.
- Turbo -> execution: use GoalBuddy's local live board and proof loop; do not create parallel AFK execution tracking.
- Goal package -> execution: hand off native `/goal` and track it with `afk-execution-tracking`.
- Any draft or workflow artifact -> reader-facing polish: use `afk-doc-craft` only when the artifact needs human-facing documentation quality, not for agent-facing instruction surfaces or skill content.

Most Free Route tasks need only one or two steps. Do not turn AFK Compass into ceremony.

## Skill Rules
- Direct user skill mentions beat routing guesses.
- Multiple skills can apply, but keep the active set small.
- When in doubt on non-trivial product or engineering work, clarify the desired outcome before implementation.
