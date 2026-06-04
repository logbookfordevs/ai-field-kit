---
name: afk-deep-interview
description: Intent-first Socratic clarification before planning or execution. Use when a request is broad, ambiguous, underspecified, or risky enough that a structured interview should turn it into a clear, testable brief.
argument-hint: "[quick|standard|deep] <idea, request, or vague description>"
---

# Deep Interview

Deep Interview is a structured clarification mode for turning vague ideas into execution-ready direction.

Its job is to reduce ambiguity before planning or implementation by asking one high-leverage question at a time, pressure-testing assumptions, and crystallizing the result into a usable brief or specification.

## Why This Skill Exists

Many bad outcomes come from starting too early with unclear intent.

Users often describe:
- what they think the solution is
- not why they want it
- not what must stay out of scope
- not which trade-offs are unacceptable
- not what success actually looks like

This skill fixes that by applying disciplined questioning before action.

## Use When

- The request is broad, fuzzy, or missing acceptance criteria
- The user says things like "interview me", "ask me everything", "don't assume", or "help me clarify this first"
- The work is high-risk enough that misalignment would be expensive
- A cleaner brief, spec, or decision record is needed before planning or implementation

## Do Not Use When

- The task already has clear targets, boundaries, and acceptance criteria
- The user explicitly wants immediate execution without more discovery
- The user only wants lightweight brainstorming
- A strong plan or spec already exists and clarification is no longer the bottleneck

## Operating Contract

This is a deliberate clarification loop, not casual chat.

Preserve these behaviors:
- ask one question per round
- show what is clear, weak, or unresolved
- revisit weak answers instead of changing topics too quickly
- pressure-test assumptions before declaring readiness
- let the user stop, continue, or proceed with warning
- explain why the current question matters
- make checkpoints explicit instead of dragging the user through an invisible process

## Depth Profiles

- `quick`: fast clarification pass, useful before lightweight planning
- `standard`: default mode, balanced rigor
- `deep`: high-rigor exploration for expensive or high-stakes work

If the user does not specify a depth, use `standard`.

Recommended round caps:

| Profile | Max Rounds |
|---------|------------|
| quick | 5 |
| standard | 12 |
| deep | 20 |

## Execution Policy

- Ask exactly one question per round.
- Ask about intent and boundaries before implementation details.
- Once intent and boundaries are clear enough, allow a short pass on remaining high-leverage gray areas in product behavior, UX, or decision framing that would materially affect downstream work.
- Target the highest-leverage unresolved uncertainty each round.
- Treat every answer as something to test, not just record.
- Stay on the same thread when the answer is still vague.
- Do not crystallize early just because a few sections sound polished.
- Do not proceed cleanly while `Non-goals` or `Decision Boundaries` remain unclear.
- Prefer evidence-backed confirmation questions for existing projects.
- Never ask the user for facts that can be discovered directly from available context.
- Keep the round structure visible so the user understands why the next question is being asked.

## Interview Dimensions

Track clarity across these dimensions:

- `Intent`: why the user wants this
- `Outcome`: what end state they want
- `Scope`: how far the work should go
- `Constraints`: limits that must hold
- `Success Criteria`: how completion will be judged
- `Context`: relevant existing codebase, product, or business context
- `Local Gray Areas`: product-, behavior-, or UX-facing uncertainties that are not broad enough to justify a separate discovery process, but are still important enough to record before execution

Mandatory readiness gates:
- `Non-goals` are explicit
- `Decision Boundaries` are explicit
- at least one earlier answer has been revisited with a deeper follow-up

## Readiness Check

Keep progress visible without pretending to quantify certainty.

Track each relevant dimension as:
- `clear`: specific enough to guide downstream work
- `weak`: directionally answered but still likely to cause rework
- `unresolved`: missing, conflicting, or not yet inspected

For weak or unresolved dimensions, include a short reason and use it to choose the next question.

## Workflow

### 1. Preflight Intake

Before the first interview question:
- restate the task in plain language
- identify whether this is greenfield or brownfield work
- gather any obvious contextual facts that can be discovered without bothering the user
- form an initial hypothesis about likely intent, constraints, and uncertainty

If the work targets an existing codebase, product, or process, gather enough context to avoid asking uninformed questions.

### 2. Initialize the Interview

- Choose the depth profile
- Set the round cap
- Announce the starting profile
- Identify the first priority dimension to investigate

Preferred kickoff shape:

```text
Deep Interview started
Profile: standard
First focus: intent
```

Set expectations clearly:
- this is a one-question-at-a-time process
- the interview may revisit earlier answers
- the goal is to produce a reliable downstream brief, not just collect opinions

### 3. Run the Socratic Loop

Repeat until:
- all relevant dimensions are clear enough and readiness gates are satisfied
- the user explicitly stops
- the round cap is reached
- the user chooses to proceed with warning

For each round:

1. Choose the weakest or highest-leverage dimension
2. Ask one question
3. Evaluate the answer
4. Update the readiness notes
5. Show progress
6. Decide whether to stay on the thread, shift dimensions, or use a challenge mode

Preferred question header:

```text
Round {n}
Focus: {dimension}
Status: {clear / weak / unresolved summary}

{question}
```

After the user answers, prefer a visible micro-loop:

```text
What I heard
- ...

What remains weak
- ...

Next move
- stay on this thread / shift to {dimension} / challenge assumption
```

### 4. Apply the Pressure Ladder

When an answer is still weak, deepen before moving on.

Default pressure ladder:
1. Ask for a concrete example, counterexample, or evidence signal
2. Probe the hidden assumption, dependency, or belief underneath the answer
3. Force a boundary or trade-off
4. Reframe symptoms into root cause or essence

Breadth without pressure is not progress.

### 4.5. Surface Remaining Gray Areas

After the core intent, scope, non-goals, and decision boundaries are reasonably clear, check whether any local gray areas still matter enough to cause downstream rework.

Examples:
- unresolved UX behavior choices
- important interaction, flow, or feedback choices
- local decision boundaries that downstream work should not have to guess
- product or experience ambiguities that are now narrow enough to capture explicitly

Common gray area categories at this stage:
- interaction model
- user flow shape
- empty-state or fallback behavior
- feedback behavior
- information density and priority
- what content or signals should be visible to the user
- local product behavior choices that change the experience without reopening the whole scope

Do this only when:
- the macro problem is already clear enough
- the remaining uncertainty is local, not foundational
- capturing it now would materially improve the downstream brief

Do not turn this into a second full workflow.
The goal here is to absorb the most useful overlap from downstream decision discussion, not to replace a dedicated trade-off session when one is truly needed.

### 5. Use Challenge Modes

Use these modes when they would sharpen the interview:

- `Contrarian`: challenge untested assumptions
- `Simplifier`: push toward a smaller, sharper scope
- `Ontologist`: ask for essence-level reframing when the user keeps describing symptoms

Use a challenge mode only when it changes the next question or reveals a hidden assumption.

When entering a challenge mode, signal it explicitly so the user understands the shift:

```text
Challenge mode: Simplifier
Reason: scope is expanding faster than clarity
```

### 6. Report Progress Transparently

After each round, show:
- clear dimensions
- weak or unresolved dimensions
- readiness-gate status
- the likely next focus

Example:

```text
Progress Check

Clear:
- Outcome
- Constraints

Weak or unresolved:
- Non-goals
- Decision Boundaries

Next likely focus:
- scope boundary
```

### 7. Offer Safe Controls

Do not trap the user in the process.

Allow:
- continue
- go one level deeper
- proceed with warning
- stop

But do not offer early escape before at least one real pressure pass has happened.

Preferred checkpoint shape:

```text
What next?
1. Continue interviewing
2. Go one level deeper on this point
3. Crystallize what we have
4. Proceed with warning
x. Stop
```

Use checkpoints:
- after a meaningful clarification milestone
- after a challenge mode
- when readiness changes materially
- when the interview has stayed on one thread for multiple rounds

### 8. Crystallize the Output

When the interview is ready to conclude, convert it into a reusable artifact.

Possible outputs:
- a clarified brief
- a requirements spec
- a scope memo
- a decision record
- a planning handoff summary

Recommended sections:
- `Intent`
- `Desired Outcome`
- `In Scope`
- `Out of Scope / Non-goals`
- `Decision Boundaries`
- `Constraints`
- `Success Criteria`
- `Local Gray Areas`
- `Assumptions Exposed`
- `Open Questions`
- `Residual Risks`
- `Recommended Next Step`

If useful, also include:
- transcript summary
- evidence vs inference notes
- relevant project context findings

The transition into crystallization should be explicit. For example:

```text
Clarity is now high enough to crystallize.
I can turn this into a brief/spec now, or we can keep pushing on the remaining weak spots.
```

When writing a file, follow the repo or user artifact convention. If none exists, follow the AFK default from `afk-workflow`.

## Brownfield Guidance

If the request targets an existing system, repository, or workflow:
- gather context first
- prefer evidence-backed confirmation questions
- ask things like "I found X in Y. Should this follow that pattern?"
- do not ask the user to describe internals that can be inspected directly

## Exit Conditions

Stop when one of these is true:
- the relevant dimensions are clear enough and readiness gates are satisfied
- the user explicitly says stop
- max rounds are reached
- the user chooses to proceed with warning despite residual uncertainty

If the interview ends before clarity is strong enough, preserve that fact explicitly in the final artifact.

If the user chooses `proceed with warning`, clearly state:
- what is still unresolved
- what downstream work should not assume
- what kind of rework risk remains

## Residual-Risk Rule

If the user exits early, important dimensions remain weak, or the round cap is reached:
- mark the result as partially clarified
- preserve unresolved assumptions
- state what downstream work should treat as risky

Do not pretend the interview succeeded cleanly when it did not.

## Output Quality Bar

The final artifact should:
- be more actionable than the original request
- preserve the real intent, not just the stated solution
- make boundaries explicit
- separate facts from assumptions
- surface trade-offs clearly
- capture any remaining high-leverage local gray areas instead of leaving them implicit
- reduce the chance of downstream misalignment

The interview experience should also meet a quality bar:
- the user always knows why the current question matters
- progress is visible through concrete readiness changes, not just more questions
- repeated pressure is tied to a named weak dimension
- the final artifact is more than a lightly reformatted summary

## Non-Goals

This skill is not for:
- direct implementation
- casual brainstorming
- long lectures about process
- pretending quantitative certainty where none exists

Its job is clarity, not execution.

## Recommended Handoff

After crystallization, the natural next step is usually one of:
- planning
- specification writing
- implementation
- deeper research on a now-clear question

The interview artifact should be treated as the current source of truth for intent, scope, boundaries, and success criteria.

Task: {{ARGUMENTS}}
