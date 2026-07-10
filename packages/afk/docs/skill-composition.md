# Skill Composition

AFK treats skills less like a flat list of prompts and more like a small component system.

For a visual companion to this page, open [`skill-composition.html`](skill-composition.html).

That shape comes from the same instinct that makes React pleasant at scale: keep the reusable pieces small, compose them into named experiences, and let larger workflows assemble the pieces without hiding what they depend on.

The goal is not to make skills abstract for its own sake. The goal is to make agent behavior easier to reason about. When a skill is tiny, the model can use it without dragging a whole workflow into context. When a wrapper is explicit, a person can ask for the named experience without remembering every primitive behind it.

## The Roles

AFK skills use `role` to describe why a skill exists in the system.

| Role | What it means |
|---|---|
| `primitive` | A small reusable behavior unit. It should be useful on its own and safe to compose. |
| `wrapper` | A named user-facing experience that combines primitives into a focused workflow. |
| `workflow` | A larger repeatable workflow that coordinates several skills or phases. |
| `utility` | A direct helper for a specific operational job. |
| `reference` | A knowledge map or preference surface that agents can consult. |
| `router` | A skill-selection or workflow-routing layer. |

This keeps the manifest readable as a system map. A primitive answers, "What reusable behavior exists?" A wrapper answers, "What experience should I ask for?" A workflow answers, "What larger motion can AFK run?"

## Auto Invocation

AFK keeps the field name `autoInvocation` because it says the real thing.

```json
{
  "autoInvocation": true
}
```

means the skill may be exposed to automatic model discovery.

```json
{
  "autoInvocation": false
}
```

means the skill should be manually attached or invoked.

This is not the same as "model versus user." A model-discoverable skill can still be invoked by a user. A manual skill is not forbidden to the model forever; it just should not sit in automatic discovery unless someone asks for it.

The usual AFK pattern is:

- primitives are often `autoInvocation: true`
- wrappers are often `autoInvocation: false`
- workflows are usually `autoInvocation: false`
- references depend on whether they are broadly useful or highly situational

## Composition

`composes` names the skills that a wrapper or workflow is built from.

```json
{
  "id": "afk-code-grill",
  "role": "wrapper",
  "autoInvocation": false,
  "composes": ["grilling", "truss-evaluation", "codebase-design"]
}
```

This reads like a component tree:

```text
afk-code-grill
  grilling
  truss-evaluation
  codebase-design
```

The wrapper gives the user a single thing to ask for. The primitives keep the reusable logic independent:

- `grilling` supplies the interview loop.
- `truss-evaluation` supplies the decision-quality lens.
- `codebase-design` supplies architecture vocabulary around modules, interfaces, seams, adapters, and test surfaces.

AFK setup uses this metadata to suggest composed skills when a wrapper is selected. The user still gets a review step, because composition is product guidance, not a hidden install trap.

## Profiles

Profiles are focus sets that temporarily narrow the active global skill library.
They live in `profiles.json`, while each skill item can still carry lightweight
profile metadata for catalog readers.

```json
{
  "profiles": []
}
```

Use profiles for curated activation sets such as `engineering`, `docs`, or
`frontend`. `afk show skills --visualize` reads local profile catalog and state
when available, then shows which profiles are enabled, which skills are
always-on, and which referenced skills are missing from the catalog.

## Reading The Manifest

A well-shaped skill entry should answer four questions quickly:

```json
{
  "id": "afk-code-grill",
  "label": "AFK - Code Grill",
  "role": "wrapper",
  "autoInvocation": false,
  "composes": ["grilling", "truss-evaluation", "codebase-design"],
  "profiles": [],
  "source": "https://github.com/logbookfordevs/ai-field-kit",
  "args": ["--skill", "afk-code-grill", "--global"],
  "default": true
}
```

- What is this? `role: wrapper`
- Can the model discover it automatically? `autoInvocation: false`
- What does it build on? `composes`
- Is it part of a curated activation set? `profiles`

That is the house style: small pieces, named compositions, explicit discovery behavior, and no mystery dependencies.

## Current Workflow Shape

The current AFK catalog keeps execution packages explicit and manual:

```text
afk-sprint
  plannotator-setup-goal
  afk-to-tickets
  afk-implement-tasks

afk-turbo
  grilling
  plannotator-setup-goal
```

Resume behavior is no longer a standalone skill. It lives as a mode inside `afk-turbo` and `afk-implement-tasks`, with `afk-compass` routing the user to the right mode.

Delegation is provided by `orchestrator`, a dedicated CLI and skill for launching, supervising, resuming, and stopping work across supported agent runtimes.

For planning pressure, use `grill-with-docs` when the work is focused enough to question and plan in one agent session. Use `wayfinder` when the idea is too large for one context window, has foggy unknowns, or needs an issue-tracker map that multiple sessions can work through.
