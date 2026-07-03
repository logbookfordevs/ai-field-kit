---
name: afk-compass
description: Route broad, ambiguous, phase-change, artifact-boundary, storage-convention, explicit AFK workflow, AFK Sprint, AFK Turbo, or non-obvious skill-selection requests to the smallest useful AFK or companion skill. Use when the next skill is unclear.
---

# AFK Compass

AFK Compass maps the current situation to the smallest useful skill, reference, or named execution package.

## First Move
When a request arrives:
1. Identify the user's phase: choose, clarify, decide, specify, slice, execute, resume, review, or debug.
2. Honor directly named skills first.
3. If the user is asking what to use, recommend the smallest useful command or lane and stop.
4. If the user is asking for work to happen, route into the selected skill immediately.

## Selection Modes

### Recommend
Use this mode when the user asks what AFK skill, workflow, or command fits.

Output:
- The recommended skill or package.
- Why it fits this moment.
- One useful alternative only when the choice is real.
- The exact invocation when the skill is manual.

Stop after the recommendation unless the user also asked you to proceed.

### Route
Use this mode when the user is trying to do the work and Compass is only deciding the next tool.

Output one short routing sentence, then move into the selected skill. Do not re-explain every available option.

### Reference
Use this mode when the user needs AFK conventions, storage boundaries, or setup semantics rather than a workflow.

Read the relevant reference and answer from it.

## AFK Lanes

AFK stays composable. A lane names the likely path, but only the current phase should run.

### Idea to implementation

Use when a feature, product change, or technical slice needs to become code.

1. `grill-me`, `grill-with-docs`, or `afk-code-grill` when the idea or trade-offs are not settled.
2. `afk-to-spec` when the conversation needs an agent-ready spec.
3. `afk-to-tasks` when the spec needs executable slices.
4. `afk-implement-tasks`, `afk-sprint`, or `afk-turbo` when checkpointed implementation begins.

### Existing-work continuation

Use when the user is resuming a feature, workflow, branch, packet, or previous session.

- `afk-turbo` resume mode for durable Turbo goal packages, handoffs, or board context.
- `afk-pickup` for disposable handoff notes.
- `afk-implement-tasks` resume mode when checkpoint packets already exist and need implementation, validation, or handoff updates.

### Design and frontend judgment

Use when the task is UI, frontend architecture, or interaction quality.

- `prototype` when a runnable experiment is the fastest way to answer a design or behavior question.
- `afk-animated-driven-frontend` for motion-heavy frontend direction.

### Skill and workflow meta

Use when the task is about AFK itself, skill selection, or external-model perspective.

- `afk-ask` for an outside model's opinion.
- `afk-delegate` when another local agent should do supervised work.
- `handoff` or `afk-pickup` for session crossing.

## Routing Map

Route by user intent, not by literal tool names. Tool names below identify the current implementation.

```text
Task arrives
|
+-- Need relentless plan/design questioning? ----> grill-me
+-- Need divergent ideas or directions? ----------> afk-brainstorming-facilitator
+-- Explicit AFK Turbo or visual-board execution package? -> afk-turbo
+-- Explicit AFK Sprint or goal run with Markdown tracking? -> afk-sprint
+-- Explicit AFK workflow / Flow / run? --------> route only the current phase
+-- Resuming Turbo goal/board work? -----------> afk-turbo resume mode
+-- Resuming checkpointed work? ---------------> afk-implement-tasks resume mode
+-- Need artifact boundaries or storage conventions? -> read references/artifacts.md
+-- Need an agent-ready spec before code? ------> afk-to-spec
+-- Need executable slices/checkpoints? ---------> afk-to-tasks
+-- Need code choices or implementation trade-offs grilled? -> afk-code-grill
+-- Need docs/domain/terminology pressure? ------> grill-with-docs
+-- Implementing or delegating a change? --------> execution bundle selection
|   +-- Needs checkpoint packets first? ---------> afk-to-tasks
|   +-- Needs checkpoint task implementation? --> afk-implement-tasks
+-- Reviewing code or PR quality? ----------------> normal review workflow
+-- Need a quick throwaway experiment? -----------> prototype
+-- Need external-model perspective? -------------> afk-ask
+-- Need another local agent to do work? ---------> afk-delegate
+-- Need disposable session handoff? -------------> handoff, then afk-pickup
```

Only invoke skills that are installed or clearly available. If a routed skill is missing, state the gap and continue with the best available installed skill or normal workflow.

For explicit AFK workflow requests, explain that AFK is composable and route the current phase. Add Grill, spec, slicing, tracking, or execution discipline only when that is the current need.

## Manual Wrappers

Many AFK wrappers and workflows are intentionally manual. Compass may still recommend them by name when the request clearly fits.

When recommending a manual skill, give the invocation string and the reason. When routing into it from an active work request, announce the skill and continue.

Keep Compass output to selection: recommendation, invocation, or routing sentence.

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
