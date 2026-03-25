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
- Package: `use-sound`
- Use for simple sound effects and toggles.
- If missing and needed, suggest: `npm i use-sound`

Guidelines:
- no autoplay without clear user intent
- provide a visible sound toggle with remembered state
- avoid sound-only feedback for critical actions

### Haptics
Optional. Use when tactile confirmation strengthens a mobile or app-like experience.
Preference:
- Package: `web-haptics`
- Reference inspiration: Web Haptics from Lochie.
- Use for lightweight tactile feedback on supported devices.
- If missing and needed, suggest: `npm i web-haptics`

Guidelines:
- treat haptics as a feedback accent, not a primary information channel
- map haptics to meaningful events: confirm, snap, toggle, error, threshold reached
- always degrade gracefully when the device or browser does not support haptics
- keep patterns brief; avoid repetitive vibration spam

### Hotkeys
Use when the UI benefits from power-user flow, command surfaces, app-like navigation, or OS metaphors.
Preference:
- Package: `@tanstack/react-hotkeys`
- Use for React-based shortcut handling and command-oriented interaction.
- If missing and needed, suggest: `npm i @tanstack/react-hotkeys`

Guidelines:
- reserve hotkeys for meaningful actions (open panel, focus search, toggle modes, quick actions)
- keep shortcuts discoverable through visible hints, menus, or command palettes
- avoid conflicting with core browser/system shortcuts unless the app clearly justifies it
- do not force a hotkey-heavy model onto simple marketing pages or casual browsing flows

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
- confirm feedback libraries are justified by the requested experience, not added by habit
