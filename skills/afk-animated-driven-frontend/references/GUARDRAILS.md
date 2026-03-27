# references/GUARDRAILS.md

## Guardrails (Performance + Accessibility)

### Performance
- Prefer animating `transform` and `opacity`.
- Avoid animating layout properties (`top/left/width/height`) unless unavoidable.
- Keep continuous animations low-frequency and scoped.
- Isolate heavy effects (infinite loops, cursor tracking) into leaf components to prevent rerenders.
- Use requestAnimationFrame carefully; avoid running physics in React state.
- Beware of large backdrop blurs on scrolling containers (GPU repaint costs).

### Accessibility
- Respect `prefers-reduced-motion`:
  - reduce distance, reduce duration, remove infinite loops
  - preserve meaning via non-motion cues (color, copy, layout)
- Maintain focus continuity across transitions.
- Never hide critical information behind animation timing.
- Sound must be opt-in and easy to toggle.
- Haptics must be supplemental and never the sole confirmation path.
- Hotkeys must preserve keyboard accessibility and not trap focus.
- Avoid motion patterns that can cause discomfort (fast parallax, large oscillations).

### Interaction channels
- Treat sound, haptics, and hotkeys as feedback channels, not gimmicks.
- Each non-visual cue should correspond to a meaningful state change, confirmation, or shortcut-worthy action.
- Provide fallbacks when a channel is unavailable, unsupported, muted, or reduced by user preference.
- Prefer one strong confirmation cue over stacking sound + haptics + animation on every action.

### “Delight without chaos”
- Clarity first, delight second.
- If an effect competes with reading, it loses.
- If a playful behavior breaks expected UI affordances, provide a clear alternative path.
