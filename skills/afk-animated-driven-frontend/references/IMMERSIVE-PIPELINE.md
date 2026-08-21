# Immersive Pipeline

Read this reference for WebGL, shaders, large media, post-processing, or continuously rendered effects. The governing idea is the **warm path**: work required by an upcoming signature frame is decoded, uploaded, compiled, and initialized before that frame arrives.

## Budget the experience

Set budgets before polishing:

- critical-path transferred bytes and total transferred bytes;
- decoded CPU memory and estimated GPU memory;
- time to first meaningful interaction;
- target frame time and maximum acceptable spike on the device floor;
- draw calls, active post-process passes, texture dimensions, and pixel ratio by fidelity tier.

Track worst frames and long tasks, not only average FPS. A single upload or shader-compilation stall can spoil an otherwise smooth sequence.

## Asset pipeline

### Choose per asset

Production source files are not runtime assets. Inventory geometry, textures, videos, type, and animation; decide per item:

- whether it belongs on the opening path or a later loading group;
- the smallest geometry and animation representation that preserves the silhouette;
- texture dimensions based on screen coverage, not source resolution;
- compression family and quality based on visual sensitivity;
- whether mipmaps are useful;
- whether the effect is cheaper and sharper as procedural code;
- the exact segment that acquires and releases it.

Disk size is not memory size. An ordinary compressed image expands when decoded; estimate uncompressed memory from dimensions and channels. Consider DRACO for suitable geometry and KTX2/Basis with ETC1S for GPU-native texture compression, then verify quality and target-device support rather than selecting by transfer size alone.

### Make compression visible

Build or use a side-by-side previewer for original and runtime assets. Compare representative zoom levels and target devices. Tune hero assets independently from peripheral assets; one global compression setting either wastes budget or destroys important detail.

Useful controls include texture size, codec mode, quality, mipmaps, color space, and alpha handling. Store chosen settings as reproducible asset metadata or build commands.

### Consolidate deliberately

Atlas related textures when it reduces requests, bindings, or draw calls. Address regions through UV scale and offset. Split an atlas when a large upload would exceed the frame budget or when unrelated segments would keep unused regions resident.

Replace simple gradients, masks, and repeatable backgrounds with small procedural shaders when that reduces bytes without creating a worse GPU cost. Prefer baked lighting or state textures when exact art direction matters more than dynamic light response.

### Own the decoder path

Bundle required geometry decoders and texture transcoders with the application or on infrastructure the product controls. A locally hosted asset still fails when its decoder is fetched from an unreliable third party. Version the decoder and encoded assets together.

## Warm-path loading

Download completion does not mean render readiness. Treat the path as four stages:

1. **Fetch** the encoded asset.
2. **Decode** off the main thread where the platform permits it; `createImageBitmap()` is one browser path for bitmap assets.
3. **Upload** to the GPU in bounded idle or per-frame slices.
4. **Prewarm** materials, shaders, passes, and representative draw paths.

Queue future uploads during quiet beats. Use `requestIdleCallback()` or an equivalent scheduler conservatively, include a fallback and timeout, and force upload through the renderer’s initialization path or a representative warm draw. Tile exceptionally large textures when one upload would create a long frame. Before crossing a gate, synchronously finish only the small set required by the next scene; the gate supplies a natural preparation window.

Keep late worlds in separate loading groups. The opening should not wait for a large exploratory map, optional post-processing pass, or asset used several beats later.

## Render graph

Write post-processing as an ordered graph with an explicit reason for every edge. A common immersive chain is:

1. scene and depth;
2. procedural background;
3. refractive or scene-sampling surfaces;
4. gesture trails and environmental masks;
5. tiered depth or lens effects;
6. grade, grain, and the chosen tone-mapping boundary;
7. crisp deferred text or UI composites;
8. foreground impact effects.

Order changes meaning: refraction needs the background; crisp text often belongs after blur and tone treatment; a shatter or flash may need to land above the complete frame. Document unusual ordering next to graph construction.

Initialize the always-on spine first. Lazily create optional passes, prewarm them in an earlier quiet beat, and disable them when they have no visible contribution. Avoid paying a full-screen pass for empty output.

## Fidelity ladder

Measure a rolling frame-time window and use hysteresis:

- downgrade after sustained budget misses;
- upgrade only after a longer stable recovery;
- apply a cooldown between tier changes;
- ignore startup noise and tab-resume spikes;
- remember the device’s stable tier for the session when appropriate.

Tier only polish:

| Lever | High | Medium | Low |
| --- | --- | --- | --- |
| Pixel ratio | device-aware cap | reduced cap | conservative cap |
| Blur / depth samples | full | fewer | off or static substitute |
| Secondary geometry | full | simplified | omitted |
| Text / effect resolution | full | reduced | minimum legible |
| Ambient particles | full | sparse | off |
| Story, controls, copy | identical | identical | identical |

During an interaction with strong visual energy, temporarily borrowing quality can hide expensive work: lower pixel ratio or suspend peripheral passes while motion already masks fine detail. Restore after the cost and avoid visible tier pumping.

## Effect transfer patterns

These are transferable constructions, not presets. Choose the one whose mechanism expresses the beat.

### Propagating frost, ink, or corruption

Use ping-pong render targets. Expand a trail or mask monotonically across horizontal, vertical, and diagonal samples; modulate propagation by a texture or noise field so the edge is irregular. Seed the release or melt from a meaningful gesture feature such as its centroid. Bound iteration count by fidelity tier.

### Art-directed lighting without live lights

Bake important lighting states into textures and crossfade two atlas regions. Premultiply transparent color before interpolation to prevent dark fringes. This trades general lighting for exact art direction, stable cost, and cheaper skinned meshes.

### Burn, dissolve, and material transformation

Combine a distance field with noise, advance a threshold, and derive adjacent char and emissive edge bands from the same signed distance. Discard fragments as soon as their outcome is known so expensive noise or lighting work does not run unnecessarily.

### Shredding and independent fragments

Encode a group or strip index per vertex. Derive release time from spatial progress, then apply indexed variation for fall, rotation, or flutter. Generate normals from the same deformation function when possible, avoiding another texture and keeping light response coherent with motion.

### Seamless tunnel or repeating world

Build geometry from a brand-relevant cross-section and drive pulses from world-space distance. Use periodic coordinates so repeated sections remain visually continuous as the camera advances.

### Text pulling into focus

Composite narrative text in a late pass and drive a small symmetric blur kernel—such as a center sample plus six hexagonal neighbors—toward zero from reveal progress. Disable the pass when no relevant text is visible. Keep semantic DOM text or an accessible equivalent even when the visual treatment is rendered.

### Impact synchronization

Let buildup affect the whole frame, then release with a deliberately shorter snap. Schedule sound or haptics from the committed rendered frame. Prewarm the impact material and upload its assets before the gate can complete.

## Shader discipline

- Declare precision intentionally; use `highp float` where the effect’s ranges require it. Mobile GPUs may implement medium precision with materially smaller ranges than desktop hardware.
- Test Adreno- and Mali-class devices early; precision faults often appear as synchronized randomness, banding, or unstable thresholds.
- Premultiply alpha before blending transparent texture states.
- Derive several visual properties from one field or deformation function to keep effects coherent and reduce assets.
- Exit fragment work early when a threshold proves the pixel invisible.
- Scale loop counts, samples, and render-target sizes through the fidelity ladder.
- Compile representative variants during warm windows; a material that exists but has not drawn may still hitch.

## Iteration discipline

Prototype the signature effect quickly, then spend the real effort evaluating it:

1. capture the effect on the device floor;
2. inspect the frame timeline around first use and interaction commit;
3. change one mechanism or timing variable;
4. compare variants in motion;
5. retain the simplest version that produces the intended beat;
6. trace every remaining spike until it has an owner.

Generated shader code is a sketch. Keep it only after visual comparison, precision testing, bounded-cost analysis, and real-device profiling.

## Source lineage

The asset conversion, self-hosted decoder, KTX2/DRACO, compression preview, atlas, upload queue, adaptive quality, render-pass, shader, mobile-precision, and real-device profiling lessons are generalized from [“ZERO: The Engineering Behind a Defiant Interactive Narrative”](https://tympanus.net/codrops/2026/07/17/zero-the-engineering-behind-a-defiant-interactive-narrative/) by Sindhur Dutta (Codrops, July 17, 2026). ZERO’s reported stack was Three.js, GLSL, GSAP, Howler, DRACO, and Vite; treat that as one proven composition, not a mandatory dependency list.
