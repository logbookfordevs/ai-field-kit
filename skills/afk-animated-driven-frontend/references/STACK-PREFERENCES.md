# Stack Preferences

Inspect the repository before selecting tools. Reuse its headless foundation, styling system, renderer, animation stack, audio bus, and input utilities when they fit. Introduce one owner per concern.

## Escalation ladder

| Need | First choice | Escalate when |
| --- | --- | --- |
| CSS state feedback | CSS transitions / keyframes | sequencing or interruption becomes stateful |
| React choreography | `motion/react` | a long authored timeline or render-loop integration is central |
| Framework-agnostic motion | `motion` or Web Animations API | the project already owns a stronger timeline system |
| Timeline and scroll sequence | GSAP | existing project primitives already solve it cleanly |
| Spatial or shader world | existing Three.js stack; otherwise Three.js or React Three Fiber according to architecture | DOM/CSS cannot express the required scene or effect |
| Simple UI sound | existing audio layer or a small hook | scheduling, sprites, mixing, or spatial audio requires a dedicated engine such as Howler |
| Haptics | platform API or existing wrapper | richer device support is justified and degrades cleanly |
| Hotkeys | existing command system | scoped chords, discovery, and conflict handling justify a library |

Import from `motion` or `motion/react`, not `framer-motion`.

## Curated sources

When the user, organization, or repository provides a curated library of tools, assets, sound sources, or production references, search it before adding a dependency or inventing a new pipeline. Curated options remain candidates rather than mandates; apply the dependency gate and verify licensing, delivery, accessibility, and target-device cost.

## Ownership rules

- Keep DOM choreography and WebGL rendering in separate owners joined by semantic state or normalized progress.
- Keep per-frame values out of React state; use motion values, refs, external stores, or the renderer’s loop.
- Avoid overlapping animation engines inside one component subtree unless their boundary is explicit.
- Keep one audio clock and one mute/preference owner.
- Keep input normalization separate from scene interpretation.
- Express motion tokens in the project’s existing token system.

## Dependency gate

Before adding a package, confirm:

1. the repository does not already provide the capability;
2. the package owns a distinct concern rather than duplicating another engine;
3. its bytes and runtime work fit the opening and steady-state budgets;
4. it supports target browsers, SSR boundaries, reduced motion, and cleanup;
5. the project’s current package manager and version policy are followed.

Three.js, GLSL, GSAP, Howler, DRACO, and Vite formed ZERO’s proven stack. They are evidence of a coherent composition, not a cargo-cult recipe.
