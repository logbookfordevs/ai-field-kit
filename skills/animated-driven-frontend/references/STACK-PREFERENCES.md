# references/STACK-PREFERENCES.md

## Stack Preferences (with fallbacks)

Rule: Use what the project already has. Do not assume libraries exist.
If a library is missing and needed, suggest the install command before using it.

### Motion
Default:
- `motion/react` (React) or `motion` (agnostic) as the primary choreography engine.

Escalation:
- GSAP for timeline-heavy sequences and scrolltelling (ScrollTrigger).
- react-spring for nuanced physics control and “feel-first” interactions.
- Web Animations API / CSS for lightweight, dependency-free animation.

### 3D
Use only when depth strengthens narrative or environment:
- Three.js as base
- react-three-fiber for React ecosystems
- Keep 3D isolated (canvas layer) and avoid mixing 3D + heavy UI animation in the same component tree.

### Sound
Optional. Must be user-controllable, easy to mute, and respect accessibility.
Preference:
- `use-sound` for simple sound effects and toggles.

Guidelines:
- no autoplay without clear user intent
- provide a visible sound toggle with remembered state
- avoid sound-only feedback for critical actions

### Icons
Rule: If icons already exist in the repo, use them.
If none:
- Prefer Phosphor (easy to animate, consistent).
- Otherwise Lucide is acceptable.
- For special cases: inline SVG crafted for the exact animation.

### Styling
Follow project conventions (Tailwind, CSS Modules, etc).
Motion tokens should be expressed in the same system used by the codebase (theme tokens, CSS vars, TS constants).

### Dependency safety checklist
Before importing:
- check `package.json`
- avoid mixing overlapping animation stacks in the same component tree unless intentional and isolated