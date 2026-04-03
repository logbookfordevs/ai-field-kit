---
name: afk-advanced-elicitation
description: 'Refine or stress-test a recent draft using structured critique methods. Use when the user asks for deeper critique, red-teaming, first-principles review, Socratic questioning, pre-mortems, or another deliberate improvement pass.'
---

# Advanced Elicitation

Use this skill to pressure-test, deepen, and improve a draft, answer, plan, section, or decision.

The skill is interactive by default: recommend a few critique methods, let the user choose, apply the method to the current artifact, show the result, and keep iterating until the user is satisfied.

The experience should feel like a guided improvement lab: structured, iterative, and easy to steer without losing momentum.

## Inputs

- The current artifact to improve. This may be:
  - the assistant's most recent output
  - a user-provided draft
  - a section produced by another skill
- The user's goal, if stated
- The bundled method registry at `./methods.csv`

If the target artifact is ambiguous, briefly confirm which text or decision should be examined before applying methods.

## Operating Rules

- Stay focused on the artifact currently under review.
- Preserve the original intent unless the selected method explicitly challenges it.
- Prefer showing concrete revisions over abstract commentary.
- When proposing changes, make it clear what improved and why.
- Ask before treating a proposed rewrite as the new accepted version.
- Keep critique actionable, specific, and proportional to the importance of the artifact.
- Use normal assistant voice. Do not assume any external persona, framework state, or orchestration layer.
- Follow the interactive loop in order: select methods, apply a method, show the result, ask whether to accept it, then continue or stop.
- If the user rejects a proposed revision, keep the prior accepted artifact as the working version.
- Re-offer choices after each completed pass unless the user clearly wants to stop.

## Bundled Resource

Read `./methods.csv` as the method registry.

CSV columns:
- `category`: broad method family
- `method_name`: display name
- `description`: what the method does and when it helps
- `output_pattern`: suggested shape for the response

The CSV is the only required data source for this skill.

## Workflow

### 1. Load context

- Read `./methods.csv`.
- Review the artifact and relevant conversation context.
- Assess:
  - content type
  - complexity
  - risk level
  - audience or stakeholder pressure
  - whether the user needs critique, ideation, or adversarial testing

### 2. Select methods

Choose 3-5 methods that best match the situation.

Selection guidance:
- Include at least one high-confidence default if the use case is obvious.
- Balance foundational methods with specialized ones when helpful.
- Prefer methods that produce materially different insight, not five near-duplicates.
- If the user already named a method, include it unless it is clearly a poor fit.

### 3. Present options

Use a compact menu like this:

```text
Advanced Elicitation Options
Choose a number, `r` to reshuffle, `a` to list all methods, or `x` to stop:

1. [Method Name]
2. [Method Name]
3. [Method Name]
4. [Method Name]
5. [Method Name]
r. Show a different set of methods
a. List all methods with short descriptions
x. Stop here
```

You may show fewer than 5 options when the best fit is narrow.

Interaction guidance:
- Put the most promising one or two methods first.
- Keep the menu scannable.
- If helpful, add a one-line recommendation such as "Best starting point" or "Good for finding hidden risks."
- A lightweight text menu is preferred over a paragraph of options.

### 4. Handle responses

#### If the user selects a method
- Apply the selected method using its CSV description as guidance.
- Adapt the depth and format to the artifact under review.
- Produce a response that includes:
  - the selected method
  - what it tested or revealed
  - a revised version or structured critique
  - the most important changes or findings
- Ask whether to accept the revision, keep the original, or continue iterating.
- If accepted, treat that revision as the new current artifact for the next round.
- If rejected, keep the previous accepted artifact as the working version.
- Re-offer the menu unless the user indicates they are done.

Preferred follow-up pattern:

```text
Apply these changes?
y. Yes, use this revision
n. No, keep the previous version
r. Revise this pass further
x. Stop here
```

#### If the user enters `r`
- Present a different set of 3-5 methods from `methods.csv`.
- Try to increase variety across categories.

#### If the user enters `a`
- List all methods in a compact, skimmable format with short descriptions.
- Let the user choose by number or method name.

#### If the user enters `x`
- Stop the elicitation loop.
- Return the latest accepted artifact, or the original if no change was accepted.

#### If the user gives direct feedback instead of a menu choice
- Treat the feedback as refinement guidance.
- Revise the current artifact directly if the request is clear.
- Then offer either the updated artifact or a new method menu, whichever is more helpful.

#### If the user selects multiple methods
- Apply them sequentially against the latest accepted artifact.
- Preserve a clear record of what each pass changed.

### 5. Method execution guidance

- Use the CSV description to interpret the method.
- Treat `output_pattern` as a guide, not a rigid template.
- Scale up or down depending on the importance of the artifact.
- Favor concrete improvements, sharper thinking, or clearer trade-offs.
- For persona-based methods, simulate viewpoints only when that makes the result more useful.
- Avoid performative critique. The goal is better output, not critique for its own sake.
- Each pass should build on the latest accepted version, not overwrite the whole exercise with a disconnected rewrite.
- If the method is adversarial, preserve usefulness: expose weakness, then improve or clarify the artifact.
- If the method is exploratory, make the result easy to act on rather than leaving it at raw analysis.

## Output Shape

When applying a method, prefer this structure:

1. `Method`: the selected method
2. `Focus`: what aspect was tested or improved
3. `Result`: revised content, critique, or decision analysis
4. `Key Changes`: the most meaningful improvements or concerns
5. `Next Options`: continue, accept, try another method, or stop

The output should feel iterative and comparative. Users should be able to see what changed from the previous version and decide whether the new pass is worth keeping.

## Artifact Handoff

This skill usually improves an existing artifact rather than creating a new canonical one.

When possible:
- preserve the original filename
- keep shared anchor sections intact
- strengthen clarity inside sections such as `Goal`, `Context`, `Scope`, `Decisions`, `Open Questions`, and `Next Step`

## Integration

When another skill or workflow invokes this one:
- operate only on the provided artifact
- keep changes local to that artifact unless asked otherwise
- return the latest accepted version at the end of the loop

If no interactive loop is possible, choose the single best-fit method, apply it once, and clearly label the result as a suggested revision.

## Suggested Next Skills

These are suggestions, not required steps:
- move into planning or execution outside this skill once the artifact is strong enough
- `afk-documentation-authoring` if the refined artifact should become polished documentation for humans
- `afk-dx-coding-playbook` if the refined artifact is code-facing and needs stronger DX or maintainability guidance
- use `afk-note` if important final decisions or caveats should be preserved across handoffs
