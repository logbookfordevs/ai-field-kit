---
name: animated-driven-frontend
description: Design and implement animated UIs as cinematic, interactive, and immersive experiences. Use when the user asks for motion direction or choreography (timing, easing, sequencing), microinteractions (hover, press, drag, toggle), route or layout transitions (shared elements), motion systems (tokens, primitives, patterns), creative coding, immersive place metaphors (OS-like UI), tactile or sonic feedback, keyboard-driven interactions, or optional sound and 3D.
---

# Animated-Driven Frontend

Use this skill to turn UIs into directed experiences: clear narrative flow, responsive interactivity, and optional worldbuilding. Motion is not decoration by default. It is a communication layer.

## When to use
Use this skill when the user requests animated UI direction, interaction choreography, motion systems, playful/creative coding interactions, or immersive UI metaphors.

## Default preference (with escalation)

* Default motion library: **`motion` / `motion/react`** (Framer Motion successor) for UI choreography.
* Never use `framer-motion` in this codebase.
* Escalate to **GSAP** for scrolltelling or timeline-heavy sequences.
* Use **react-spring** when nuanced physics control is central.
* Use **3D** (Three.js / react-three-fiber) only when depth or spatial metaphor strengthens the narrative.
* Sound is optional; if used, it must be user-controllable and accessible.
* Haptics are optional; use them when tactile confirmation strengthens the experience, especially on mobile or app-like surfaces.
* Keyboard interactions and shortcuts are part of the interaction language when they improve flow, responsiveness, or OS-like immersion.

For full stack selection rules and dependency checks, see: `references/STACK-PREFERENCES.md`.

## Core principles

* Motion communicates state, intent, and hierarchy. Avoid “movement for movement’s sake”.
* Clarity first, delight second.
* Performance is part of aesthetics.
* Interactivity is gameplay: the user should feel they can “touch” the UI.
* Feedback can be visual, sonic, tactile, or keyboard-mediated. Choose the channels that reinforce the intended feeling without overwhelming the UI.
* Surprise is allowed, but never at the cost of comprehension.
* Respect accessibility: `prefers-reduced-motion`, focus continuity, and readable states.

## Modes

Choose a mode before designing motion. For full definitions and examples, see: `references/MODES.md`.

* **cinematic-clarity**: guided flow, subtle direction, editorial polish.
* **playful-showcase**: interactive delight, reactive elements, “creative coding” energy.
* **immersive-worldbuilding**: environment-first UI (place/OS metaphor), deep immersion.
* **full-spectrum**: author mode; combine all, with guardrails.

## Design dials

Use dials to calibrate outputs without changing the mode.

* **motion-intensity**: static → fluid → cinematic
* **spatial-variance**: symmetric → offset → asymmetric
* **visual-density**: gallery → standard app → data-dense

Dial definitions and defaults live here: `references/DIALS.md`.

## Execution workflow

1. Clarify intent: what changes, why, and what the user should perceive/feel.
2. Pick a mode + set dials.
3. Choose feedback channels: visual motion, sound, haptics, keyboard interactions.
4. Define motion roles: entrance, emphasis, feedback, transition, exit.
5. Assign tokens: duration, easing/spring, delay, stagger.
6. Prototype the smallest viable motion. Validate performance early.
7. Add interactive "gameplay" where it strengthens memorability.
8. Validate accessibility, fallback behavior, and state continuity.
9. Ship with maintainable primitives and names.

If you need a grab-bag of building blocks, see: `references/PATTERNS.md`.

## Engineering guardrails

Use these as non-negotiables. Details and recipes: `references/GUARDRAILS.md`.

* Prefer `transform` + `opacity` animations.
* Avoid layout thrashing and heavy re-renders.
* Isolate continuous/CPU-heavy effects.
* Sound is opt-in and must be easy to mute.
* Haptics must be additive, never the only cue, and degrade gracefully when unsupported.
* Hotkeys should feel intentional, discoverable, and aligned with the product's interaction model.

## What to produce

Depending on the request, produce one or more of:

* a short motion spec (states, roles, tokens, constraints)
* recommended component primitives (e.g., `MotionProvider`, token maps)
* implementation guidance or code snippets aligned to the project stack

Templates live in: `references/TEMPLATES.md`.
