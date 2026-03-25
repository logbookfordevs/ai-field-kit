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

### Haptic patterns (optional)
- Tap confirmation for committed actions
- Soft snap when a draggable or slider reaches a meaningful threshold
- Toggle pulse for mode changes
- Error bump for invalid or blocked actions
Rules: brief, meaningful, never continuous, never the only cue.

### Keyboard and shortcut patterns
- Command palette open/focus
- Mode toggle shortcuts (preview/edit, dock open/close, panel expand/collapse)
- Spatial navigation for OS-like or cockpit-like interfaces
- Shortcut hints revealed on hover, focus, or help overlays
Rules: discoverable, scoped, and aligned with the mental model of the UI.

### When to avoid these
- Complex cursor tracking on low-power mobile contexts
- Infinite loops on dense pages
- Scroll hijacks (unless intentionally in a storytelling section and accessible)
- Shortcut-heavy interaction models on low-complexity pages
- Haptic or sound spam for every hover or passive state
