# references/PATTERNS.md

## Patterns Library

Use these patterns as building blocks. Pick a few. Don’t stack everything everywhere.

### Narrative flow patterns
- Shared element transitions (layoutId / shared keys)
- Staggered reveals for lists/grids (small delays, consistent rhythm)
- State-driven layout morph (expand → details → collapse)
- Progressive disclosure (surface detail only when needed)

### Interactive “gameplay” patterns
- Magnetic hover (subtle pull toward cursor)
- Parallax tilt cards (bounded, small angles)
- Direction-aware hover (fill enters from cursor direction)
- Liquid fill feedback (progress-like heart, toggle, reaction)
- Tactile press (scale 0.98 + translateY 1px)
- Cursor-reactive illustrations (eyes/hand pointers, small follow)

### Immersive patterns
- OS metaphor: windows, dock, menu bar, “apps”
- Cozy desk: ambient audio panel, soft motion, layered depth
- Cockpit panels: modular surfaces, tight hierarchy, instrument vibe

### Sound patterns (optional)
- Click/confirm sounds on meaningful actions
- “Fill” sound that changes with progress
- Toggle on/off feedback
Rules: user-controllable, no autoplay, no critical info conveyed only by sound.

### When to avoid these
- Complex cursor tracking on low-power mobile contexts
- Infinite loops on dense pages
- Scroll hijacks (unless intentionally in a storytelling section and accessible)