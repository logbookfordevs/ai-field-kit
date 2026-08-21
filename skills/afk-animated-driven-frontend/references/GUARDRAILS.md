# Guardrails

Apply every relevant section. Spectacle is successful only when the product remains legible, operable, and fluid.

## Meaning and agency

- Preserve the information, consequence, and next action when motion is removed.
- Use authored gates for meaningful participation, not to delay access.
- Return agency after a directed sequence.
- Keep controls recognizable or teach the interaction before demanding precision.
- Give surprise a stable recovery path.

## Motion accessibility

- Treat `prefers-reduced-motion` as a distinct direction: shorter distances, fewer spatial transformations, no unnecessary loops, and discrete state changes where scrubbing would be disorienting.
- Preserve focus, reading order, selection, and announcements across visual reparenting or route transitions.
- Provide pointer, touch, and keyboard paths for required interactions.
- Keep hover additive; touch and keyboard users receive the same meaning.
- Avoid large-field rapid parallax, oscillation, flashes, and involuntary camera movement.
- Offer pause, skip, or simplified traversal for long authored sequences.

## Optional channels

- Start sound from an intentional user action, expose a persistent mute control, remember preference appropriately, and keep critical meaning visual or textual.
- Use haptics as brief confirmation, never continuous ambience or the only error/success signal.
- Scope hotkeys, avoid browser and assistive-technology conflicts, reveal bindings near their controls, and release listeners on teardown.

## DOM performance

- Prefer `transform` and `opacity` for continuous DOM animation.
- Batch reads before writes; avoid forced layout in pointer, scroll, and render loops.
- Keep continuous values outside framework render state.
- Isolate pointer tracking, canvas, particles, and loops in leaf owners.
- Bound blur, filters, masks, shadows, and large translucent layers by measured cost.
- Pause invisible or offscreen work and honor page visibility.

## Rendered-world performance

- Budget decoded and GPU memory, not only transferred bytes.
- Warm uploads, shader variants, and post-process passes before their signature frame.
- Disable passes with no visible contribution.
- Scale pixel ratio, samples, geometry, and ambient detail through a fidelity ladder.
- Dispose segment-owned geometry, materials, textures, targets, listeners, and audio nodes.
- Measure worst frames on the target device floor.

## Loading and failure

- Isolate the opening group from later worlds and optional polish.
- Render useful semantic content while enhanced layers load or fail.
- Keep decoder/transcoder delivery under product control.
- Use timeouts and explicit error states for gates waiting on resources.
- Avoid progress indicators that claim completion before decode, upload, and warm-up are ready.

## Virtual progress

- Preserve native scroll unless exact cross-system synchronization justifies virtualization.
- Normalize wheel, touch, and keyboard input into one adapter.
- Define overscroll, nested scroll regions, browser zoom, restoration, and history behavior.
- Pause easing while hidden and reconcile safely on return.
- Expose a non-virtual or discrete reduced-motion path.

## Acceptance evidence

Capture:

- an interaction recording on the device floor;
- a performance trace covering first use of every signature effect;
- reduced-motion and keyboard traversal;
- slow-load or failed-enhancement behavior;
- the lowest fidelity tier;
- natural traversal and direct entry to later segments.

A passing average frame rate does not excuse visible long frames, and a polished desktop capture does not establish mobile viability.
