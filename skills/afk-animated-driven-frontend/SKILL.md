---
name: afk-animated-driven-frontend
description: Forge motion-led interfaces and immersive narratives as coherent, adaptive systems.
disable-model-invocation: true
---

# Animated-Driven Frontend

Build a directed experience, not a collection of effects. Motion carries state, attention, causality, and story; interaction lets the user touch that story; engineering keeps the illusion intact.

## Workflow

### 1. Read the stage

Inspect the product intent, existing stack and primitives, visual language, target inputs, device floor, asset sources, and accessibility requirements. Name the primary feeling and the action the experience should make irresistible.

Classify the work:

- **UI choreography** — state transitions, layout motion, feedback, microinteractions.
- **Narrative sequence** — authored beats connected by scroll, time, or interaction.
- **Immersive world** — a continuously rendered environment with spatial effects or 3D.

Choose the lightest class capable of the intended experience. Completion: the class, device floor, input paths, and non-motion fallback are explicit.

### 2. Write the story spine

Describe the experience as **beats**, **gates**, and a **payoff**:

- A **beat** changes what the user knows, sees, or feels.
- A **gate** asks for meaningful input before the next change.
- The **payoff** converts authored momentum into useful agency.

Give every motion a role: orient, reveal, focus, connect, confirm, transform, or exit. Remove effects without a role. Choose a mode and dials from [`references/MODES.md`](references/MODES.md) and [`references/DIALS.md`](references/DIALS.md) only after the spine exists.

Completion: every beat advances the idea, every gate earns the pause, and the ending gives the user somewhere meaningful to go.

### 3. Prove the magic

Build a **tracer bullet** for the riskiest signature interaction before constructing the full page. Make the real input drive the real visual response on a target device. Compare timing, easing, visual treatment, and feedback variants; initial code is raw material, not evidence of quality.

For a gesture, validate a few semantic invariants rather than matching an exact path. For a hold, drag, or scrub, expose normalized progress and let the scene interpret it. Preserve a clear alternate path for keyboard, reduced-motion, and unsupported environments.

Completion: the signature interaction is compelling, understandable, interruptible, and reproducible with each required input mode.

### 4. Build one spine

Choose one authoritative driver for the authored sequence: semantic UI state, timeline time, or normalized virtual progress. Derive animation, text, effects, loading decisions, and overlays from that spine instead of synchronizing independent clocks.

Model long experiences as self-contained segments with `enter`, `scrub`, optional `update`, and `teardown` responsibilities. Gates may pause or redirect progress without corrupting it. Seeking to a later segment must reconstruct the same state as natural traversal.

Read [`references/NARRATIVE-SYSTEMS.md`](references/NARRATIVE-SYSTEMS.md) when the experience has multiple beats, scroll-driven progress, gesture gates, deep links, or replay. Completion: ownership, progress ranges, gate transitions, interruption behavior, and deterministic replay are specified.

### 5. Choreograph the channels

Assign motion tokens and coordinate visual, sonic, tactile, and keyboard feedback around the same state change. Prefer one dominant cue with supporting accents. Synchronize time-sensitive sound to the rendered event that makes it meaningful, not to an unrelated timer.

Use the project’s existing design system and animation stack. Read [`references/STACK-PREFERENCES.md`](references/STACK-PREFERENCES.md) before introducing a dependency and [`references/PATTERNS.md`](references/PATTERNS.md) when selecting interaction primitives.

Completion: each state has legible entry, active, completion, cancellation, and exit behavior; feedback remains understandable when any optional channel is absent.

### 6. Engineer the illusion

Treat frame pacing, loading, and memory as part of the art direction. Establish a **fidelity ladder** whose lower tiers remove polish while preserving content, interaction, and story. Keep the critical path small; decode, upload, compile, and prewarm future work during known quiet windows. Profile frame spikes on the device floor rather than trusting averages or desktop emulation.

For WebGL, shaders, large media, post-processing, or continuously rendered effects, read [`references/IMMERSIVE-PIPELINE.md`](references/IMMERSIVE-PIPELINE.md) before implementation. Apply [`references/GUARDRAILS.md`](references/GUARDRAILS.md) to every class of work.

Completion: budgets exist for startup, bytes, memory, and worst-frame time; the opening path is isolated; upcoming beats are warm; quality can step down without changing the experience’s meaning.

### 7. Validate the whole performance

Test the natural path, backward movement, interruption, resize, background/foreground, deep link or seek, slow loading, input changes, and repeated playback. Validate pointer, touch, keyboard, reduced motion, muted audio, and the lowest quality tier. Use real mobile hardware early enough to change the design.

Judge both comprehension and feel: the user knows what changed, why it changed, what they control, and what happens next. Tune with rendered evidence. A beautiful still, generated prototype, or green synthetic benchmark does not establish a fluid interaction.

Completion: no required path depends on motion, sound, hover, or high-end rendering; no first-use compilation or upload hitch lands inside a signature beat; replay and natural traversal converge on the same state.

### 8. Leave a system

Deliver maintainable primitives, semantic names, tokenized timing, quality-tier rules, asset decisions, and a short motion spec. Record the reason for unusual render ordering or synchronization contracts next to their owner. Use [`references/TEMPLATES.md`](references/TEMPLATES.md) for the spec and implementation cards.

Completion: another developer can change one beat, effect, or quality tier without reverse-engineering the whole experience.

## Non-negotiables

- Preserve native scrolling unless an authored virtual spine materially enables the narrative; when virtualized, provide keyboard, reduced-motion, restoration, and escape behavior.
- Preserve content and agency across the fidelity ladder. Degrade polish first.
- Keep continuous values outside React render state; project them into the view at the rendering cadence.
- Prefer `transform` and `opacity` for DOM motion and bounded work for continuous effects.
- Keep focus, reading order, selection, history, and controls coherent through visual transitions.
- Make sound user-initiated and mutable; make haptics supplemental; make shortcuts discoverable.
- Test shader precision, memory, and frame pacing on real mobile GPUs when WebGL is involved.
