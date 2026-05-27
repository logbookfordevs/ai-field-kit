# General Documentation

Use this reference for every documentation task.

## Reader Contract

Start from the reader's job, not the author's inventory.

Before writing, establish:

- who will read this
- what they are trying to accomplish
- what they already know
- what they are likely to misunderstand
- what they need first versus what can wait

If those answers are obvious from the task, proceed. If they are not and the choice changes the document, ask.

## Structure

Prefer journeys and scenarios:

- "Set this up for the first time"
- "Migrate from the old flow"
- "Debug the common failure"
- "Review this behavior safely"
- "Understand why this decision exists"

A feature list can exist, but it should usually come after the reader has a working mental model.

## Progressive Disclosure

Put the fastest useful layer first:

1. quick orientation or quick start
2. common path
3. important decisions and constraints
4. troubleshooting and edge cases
5. complete reference

Do not make a tired reader wade through completeness before they get usefulness.

## Code And Examples

Prefer concrete examples over abstract explanation.

Use code first when the reader is trying to implement something. Use rationale first when the document is primarily about a decision, trade-off, incident, or review.

Examples should be realistic enough to teach the actual use case. Avoid sterile examples that compile but do not explain the real problem.

## Human Tone

Write like a competent teammate who wants the reader to succeed.

Good tone can include:

- direct sentences
- plain-English transitions
- small moments of warmth
- honest constraints
- realistic examples

Avoid:

- corporate filler
- condescending explanations
- exaggerated excitement
- jokes that distract from the work
- cute language that hides technical truth

## Anticipate Friction

Good docs answer the question the reader is about to ask.

Include friction reducers when useful:

- "If this fails..."
- "The surprising part is..."
- "This constraint exists because..."
- "Review this area carefully..."
- "This changed from the previous behavior..."

These sections should solve real confusion, not pad the document.

## Decisions And Why

Document the why when future readers would otherwise rediscover it painfully.

Especially capture:

- public API or shared interface changes
- architectural decisions
- compatibility constraints
- rejected alternatives
- behavior that looks strange but is intentional
- operational gotchas

Skip the why when the code or change is obvious.

## Visuals

Use diagrams, screenshots, tables, or examples when they reduce mental load.

Do not add visuals as decoration. A visual earns its place when it makes the flow, state, diff, or data shape easier to understand.

## Review Checklist

- The opening gives the reader a reason to continue.
- The structure follows the reader's job.
- The document starts useful and gets deeper later.
- Technical detail is present where it improves action or judgment.
- The tone is human without becoming performative.
- The doc preserves important decisions and constraints.
- The reader knows what to do next.
