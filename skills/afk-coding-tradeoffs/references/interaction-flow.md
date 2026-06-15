# Interaction Flow

Use this reference when shaping the interactive pacing for `afk-coding-tradeoffs`.

The session should feel like a thoughtful engineering and UX trade-off discussion, not interrogation.

## Operating Feel

Preserve these behaviors:

- present unresolved areas as choices, not just prompts
- allow the user to choose, skip, go deeper, or stop
- keep the discussion moving in rounds
- show what remains unvisited so the user knows the shape of the session
- use simple visual layouts when they improve scanability
- discuss one trade-off area at a time by default
- avoid matrix or worksheet mode unless the user explicitly asks for it

## Candidate Picker

Prefer a compact initial picker that lets the user choose one or more areas without turning the session into a worksheet.

```text
Coding Trade-off Areas
(Select one or more. We will discuss them one by one.)

[ ] Interaction behavior
    Should this flow be modal, drawer-based, inline, or something else?

[ ] Component ownership
    Should this behavior live in one shared controller or stay composable per item?

[ ] Data / state strategy
    What actually needs to be reactive, and what can stay outside render state?

[ ] Library commitment
    Do we want a library here, and if so, which style of usage keeps the code clearer?

[ ] Custom trade-off area: ________________________
[ ] Stop discussion and create context with current decisions
```

If the user adds a custom area, include it before discussion starts. If multiple areas are selected, discuss them one by one in sequence.

## Selected-Area Questions

Good question shape:

- concrete
- contrastive when helpful
- easy to answer with a choice or short freeform reply
- informed by prior context or codebase reality when available
- high leverage according to the Interesting Trade-off Filter

When helpful, present options like this:

```text
Choose the closest fit:

1. Compact and fast
   Fewer steps, lighter UI, minimal guidance

2. Guided and explicit
   Clear progress, more prompts, safer defaults

3. Power-user oriented
   More flexibility, more configuration, less hand-holding

f. None of these - I want something different
x. Stop here for now
```

After each area, checkpoint:

```text
Current status: Interaction model is mostly clear.

What next?
1. Go one level deeper on this area
2. Move to the next trade-off area
3. Capture this and create the context artifact
f. Something else
x. Stop
```

## Avoid

Do not:

- expand every area immediately
- ask for compact coded answers like `1a, 2b, 3c`
- dump every option for every unresolved topic before the user chooses a direction
- give recommendations for several areas before any one is selected
- ask the user to respond with a full numbered matrix

Bad example:

```text
1. Runtime: pick 1/2/3
2. Visual style: pick 1/2/3
3. Architecture: pick 1/2/3
4. Rewrite scope: pick 1/2/3
Reply like 1-2, 2-1, 3-3, 4-2
```

That is a batched worksheet, not the default AFK discussion experience.
