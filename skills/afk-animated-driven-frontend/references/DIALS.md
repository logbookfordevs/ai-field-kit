# references/DIALS.md

## Design Dials

Dials calibrate intensity without changing the chosen mode.

### Motion Intensity (1–10)
1–3: mostly static. hover/press states only.
4–6: fluid UI. entrance/exit, small layout transitions, staggered reveals.
7–10: cinematic choreography. shared elements, scrolltelling (careful), richer physics.

Guidance:
- raise intensity only where it increases comprehension or memorability
- never hide essential information behind motion

### Spatial Variance (1–10)
1–3: symmetric, grid-stable, predictable layouts.
4–6: offset compositions, asymmetry hints, layered sections.
7–10: bold asymmetry, playful composition, strong visual rhythm.

Guidance:
- always collapse complex variance to a stable single-column on mobile
- variance should look intentional, not random

### Visual Density (1–10)
1–3: gallery mode. lots of space, slow rhythm, premium minimal.
4–6: standard app. balanced spacing, everyday UX.
7–10: cockpit mode. dense information, faster scanning, strict hierarchy.

Guidance:
- density increases require stronger typography hierarchy and spacing discipline
- never use density to compensate for unclear information architecture

Suggested defaults (safe):
- cinematic-clarity: variance 4–5, motion 4–6, density 4–6
- playful-showcase: variance 6–8, motion 6–8, density 3–5
- immersive-worldbuilding: variance 5–7, motion 5–7, density 3–6
- full-spectrum: variance 6–9, motion 7–9, density 3–6