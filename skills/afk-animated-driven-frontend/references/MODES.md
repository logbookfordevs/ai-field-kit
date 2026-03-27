# references/MODES.md

## Modes

Modes select the *philosophy of motion* for the whole experience. Pick a mode early and keep it consistent per screen/flow.

### 1) cinematic-clarity
Use when: product UI, enterprise apps, UX-heavy flows, anything where reliability + comprehension are the priority.

What it feels like: editorial direction. Smooth cuts, guided attention, calm confidence. The user is “floating on a buoy” and the current gently takes them where they need to go.

Primary tactics:
- subtle entrance/exit (opacity + translate + blur used carefully)
- clear state transitions (shared elements, layout transitions)
- microinteractions for feedback (press, hover, focus), not spectacle
- restrained sound (usually none)
- few surprises; every motion has meaning

Good references:
- Focusbrew (narrative and environment are strong, but if you reduce the “OS” metaphor, its transitions and calm states fit this mode well)
- Most premium SaaS product pages with strong clarity and gentle motion

### 2) playful-showcase
Use when: personal portfolio, creative brand sites, interactive storytelling pages, “I want it memorable” projects.

What it feels like: creative coding playground. The UI reacts to the user and invites exploration.

Primary tactics:
- cursor-reactive elements (magnetic hover, parallax tilt, directional hover)
- tactile micro-physics (springs, overshoot, squish, liquid fills)
- small surprises (easter eggs, unexpected hover behavior)
- optional sound feedback (always user-controllable)
- “delight layer” is allowed to be visible and proud

Good references:
- Josh Comeau’s site (playful interactive elements + strong clarity)
- David Haz’s site (distinct visuals, reactive cursor, high-tech vibe)
- nkt-frlv.dev (especially the energetic intro behavior)

### 3) immersive-worldbuilding
Use when: you want the user to feel like they entered a place (OS metaphor, cockpit, studio, room, “cozy desk”).

What it feels like: worldbuilding. The interface is not just UI; it’s a setting with rules.

Primary tactics:
- environment metaphors (windows, dock, desktop, console, studio panels)
- persistent ambient motion (subtle, low-frequency)
- layered depth cues (blur, parallax, z-plane separation, optional 3D)
- sound as ambience or state feedback (opt-in)
- narrative is not only navigation, but atmosphere

Good references:
- Focusbrew (strong OS metaphor and cozy “place” feeling)

### 4) full-spectrum
Use when: it’s your project, you want maximum impact, or you intentionally want “GOTY UI energy”: narrative + visuals + gameplay.

What it feels like: directed cinema + special effects + interaction. Still coherent, still engineered.

Primary tactics:
- combine cinematic flow + playful interactivity + immersive environment
- stronger creative coding patterns
- carefully scoped higher-motion sections (avoid “everything everywhere”)
- strict performance and accessibility guardrails

Rule that protects this mode:
Delight must never reduce clarity. If the user is confused, you overdid it.