# Production Media

Read this reference when a shot may use video, externally authored animation or 3D, generated or acquired media, recorded sound, or a hybrid composition. The governing idea is the **medium scout**: choose how the shot should be produced before choosing how the browser should render it.

The browser may be the camera, stage, performer, compositor, or projector. It does not need to be all five.

## Scout the medium

Consider these production routes for every signature shot:

- **Perform live** — DOM, CSS, Canvas, WebGL, procedural audio, or another runtime system produces the experience in response to the audience.
- **Author and export** — a motion, 3D, illustration, audio, or editing tool produces a controlled runtime asset.
- **Generate and finish** — an AI image, video, or audio generator supplies source material that is selected, edited, graded, mixed, looped, or composited before use.
- **Acquire or record** — licensed footage, animation, textures, ambience, music, foley, voice, or captured material supplies the take.
- **Composite** — authored or generated plates carry the expensive atmosphere while live DOM, Canvas, or WebGL supplies interaction, focus, masks, particles, annotations, and product truth.

Recommend one route or deliberate hybrid. Use the least operationally expensive medium that preserves the shot's dramatic job and required agency. More real-time rendering is not inherently more cinematic, and a baked asset is not inherently less interactive when the meaningful response lives in the layers around it.

## Use the production capabilities in the room

During development and preproduction, discover what the user or organization can already produce or access: footage, recordings, asset libraries, 3D or animation authoring, AI video or audio generation, and editing or grading tools such as DaVinci Resolve. Consult maintained, curated tool and asset libraries when available instead of relying on a static vendor list.

A human-operated production step is a valid part of the cut. When the recommended tool is not available to the agent, prepare a bounded production brief for the user or another production unit:

- dramatic job and approved source shot;
- duration, aspect ratio, resolution, frame rate, and delivery format;
- subject, camera, movement, lighting, grade, continuity, and anti-reference constraints;
- start and end frames, loop or transition requirements, edit handles, transparency, and audio stems when relevant;
- variants requested and the exact evidence needed for screening;
- provenance, license, cost, privacy, and upload constraints that require human approval.

Treat the returned material as dailies. Screen it against the approved shot before integrating it into a larger production batch.

## Choose with the shot, not the tool

Evaluate the routes against the same production facts:

| Question | What it changes |
| --- | --- |
| What must react continuously to the audience? | Keep only that response live; surrounding atmosphere may be baked. |
| Must copy, product state, focus, or controls remain exact and semantic? | Keep those layers in the DOM or another accessible live surface. |
| Is the camera path or visual transformation fixed? | Authored or generated footage may provide tighter art direction and steadier performance. |
| Must the visitor scrub, seek, reverse, or branch precisely? | Test the chosen media on the device floor; a real-time or segmented representation may be safer than arbitrary video seeking. |
| Does an external runtime add meaningful interaction? | Embed it only when that value exceeds its loading, privacy, availability, and fallback costs. |
| Can an export preserve the intended shot? | Prefer a controlled, versioned runtime asset over an unnecessary third-party runtime dependency. |
| Can a hybrid preserve fidelity and agency? | Use a plate for atmosphere and synchronize live overlays from the authoritative narrative driver. |

The recommendation must name what becomes fixed in the asset and what remains controllable at runtime.

## Direct video as a plate or performer

Video may establish a world, carry a fixed camera move, provide a high-fidelity transition, or act as one layer in a composite. It may play, pause, loop, seek, or change sources under the authoritative narrative driver, but those controls require rendered evidence on the target device.

- Keep semantic content and essential controls outside the pixels.
- Provide a poster or stable first frame and a reduced-motion substitute.
- Design interruption, reverse, visibility changes, delayed decoding, and autoplay restrictions.
- For loops, inspect the seam after editing, encoding, and playback rather than trusting the source take.
- When Canvas or DOM renders over video, derive every time-sensitive layer from the same committed state or media clock.

AI-generated video is production source material, not automatic final footage. Direct it with the approved shot, compare takes, and finish the selected material in an editor when continuity, timing, looping, compositing, stabilization, sound, or grade needs control.

## Produce sound instead of merely adding it

Source each cue according to its dramatic job: record foley or voice, acquire a licensed library asset, generate a take with a current audio tool, synthesize it live, or layer those sources. Preserve editable stems when the cut may change. Record source and license, screen synchronized cues with picture, and keep the experience complete when muted.

External generation or editing can improve the source; synchronization still belongs to the rendered event the audience perceives.

## Record the production decision

For each selected asset or plate, record:

- dramatic job and approved shot;
- production route, producer, source tool, and exact source revision;
- provenance, license, cost, and privacy constraints;
- runtime form, segment ownership, loading group, memory, and release;
- live layers, authoritative driver, and synchronization boundary;
- reduced-motion, muted, low-fidelity, and unavailable-media fallback;
- screening evidence and approval status.

Update the shot plan and asset ledger rather than creating another artifact unless the production genuinely needs an independent media brief.
