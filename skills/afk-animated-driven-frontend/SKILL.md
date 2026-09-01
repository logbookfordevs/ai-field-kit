---
name: afk-animated-driven-frontend
description: Co-direct cinematic, motion-led frontends through human-approved treatments, shot plans, tracer scenes, and production engineering.
disable-model-invocation: true
---

# Animated-Driven Frontend

Invoking ADF opens a **Director's Room** for one cinematic, motion-led frontend production. The user's idea, taste, references, and critique are the creative battery; the agent brings cinematographic options, frontend craft, and the production engineering needed to make approved choices survive contact with real devices.

ADF is installed as a skill and experienced as a production. The Director's Room is its governing co-directing context, not a requirement to keep every task in one chat. It may continue, compact, or reopen fresh from the production binder. Specialist sessions operate as production units; their findings return as dailies before they change the approved production.

This is a specialist workflow, not an automatic site generator. It may govern an experience from its first premise to final cut, but it does so through deliberate collaboration rather than one uninterrupted end-to-end run.

## Co-directing contract

The user and agent are co-directors:

- The **user** owns intent, taste, non-negotiables, and the creative greenlight.
- The **agent** draws out the idea, proposes credible alternatives, exposes trade-offs, prototypes risky shots, engineers approved sequences, and brings rendered evidence back for critique.
- Both keep a **director's notebook** of locked choices, open questions, references, rejected directions, technical findings, and the current production stage.

Work autonomously inside the stage or batch the user has greenlit, then stop at the next creative gate. A request to design, create, or build opens development; it does not pre-approve treatment, storyboard, tracer, production, or final cut. Successful code, tests, or performance measurements prove technical facts, not creative acceptance. Only the user's explicit approval advances a gate. The user may grant a larger batch deliberately; record its boundary before proceeding.

Treat production time honestly. Name costly shots, assets, and technical risks; work in reviewable cuts; and allow seconds of excellent experience to earn hours of iteration when the result demands it.

Direct a **creative master** before designing its distribution cuts. The most widely compatible tier must preserve content, agency, and meaning; it does not set the artistic ceiling for capable devices. Broaden reach through deliberate fidelity, motion, input, and media tiers rather than reducing the approved master to the lowest common denominator.

## Production continuity

Treat the production as multi-session by default. At the first development meeting, create or resume one durable **production binder** using the active repository or user artifact convention. When no convention exists, use `docs/specs/<scope>/production/`. Read the production-binder rules in [`references/TEMPLATES.md`](references/TEMPLATES.md) completely before writing it.

The binder's `director-notebook.md` is the canonical continuity index. Create it first, keep it current, and link from it to the detailed artifacts the production actually earns: treatment, script, shot plan, storyboard or animatic, production cards, asset ledger, screening notes, and motion spec. Create these lazily rather than manufacturing a complete paperwork set. A narration- or message-led experience usually earns a script early; a visual-first experience may let boards and shot exploration lead before the script converges.

After every explicit greenlight, run a **continuity pass** before entering the next stage:

1. Record the approved decision, production boundary, rationale, material rejected directions, and the next unapproved gate.
2. Persist the gate artifact and update the notebook's stage, locked choices, findings, open questions, and artifact index.
3. Link the exact prototype, live cut, recording, trace, or other evidence that informed the decision; keep large media in its existing artifact home rather than duplicating it.
4. Give the user a concise **production slate** naming what was recorded, the next gate, and the Director's Room's recommended production move.

Recording an approved decision does not require a second approval. Before a handoff, Wayfinder promotion, ticket transition, or pause between sessions, run the same pass and label unapproved work accurately. If the production home is not writable, return a self-contained continuity entry and say that durable persistence remains pending.

When ADF governs an implementation ticket, keep execution status, validation, and code-review evidence in the ticket; keep cross-ticket creative continuity and greenlights in the production binder. Link the two instead of duplicating their contents.

## Specialist boundary

This skill can begin from a creative idea, an existing surface, a Grill or Docs outcome, a Wayfinder ticket, or a converged Wayfinder map. It can also lead without Wayfinder when one coherent motion-led experience remains the problem. In every entry path, the user remains co-director.

Determine the current production stage from the supplied artifacts and director's notebook. Preserve explicit greenlights carried by an earlier session or Wayfinder output, avoid reopening settled decisions without new contradictory evidence, and resume at the first unapproved gate.

When the work splits into several independently substantial, interdependent decisions that no longer fit one coherent specialist session, offer to promote the unresolved decision graph to Wayfinder. Preserve the director's notebook, approved and rejected treatments, prototypes, evidence, and open questions in the handoff. Wayfinder may use this skill to resolve cinematic frontend leaves; after convergence, this skill can resume as governing specialist from the approved output in a fresh implementation session.

## Bound Grilling to the current gate

Use the composed `grilling` skill when the current unapproved production gate still contains material creative decisions. Root its design tree in the one greenlight being prepared and include only decisions that gate requires. Treat carried approvals and the director's notebook as constraints, find environmental facts yourself, and leave taste and consequential choices to the user.

When the gate's frontier is empty and the user confirms shared understanding, return to this workflow and present the gate artifact for approval. When the tree instead reveals several substantial interdependent branches beyond one coherent cinematic frontend problem, preserve its unresolved frontier and offer the Wayfinder promotion described above.

## Call the next production move

ADF discovers through production rather than finishing all discovery before implementation. At every greenlight where work can move forward, the Director's Room must recommend one next move and explain why it fits the current production topology:

- **Keep directing** — the next consequential choice still needs conversation, references, or bounded Grilling.
- **Shoot a tracer** — one creative or technical unknown is best answered by real implementation and dailies.
- **Produce the next batch** — one coherent approved cut is ready for the current room or one bounded production unit.
- **Dispatch a production unit** — one bounded cut belongs in another session; send the binder context, approved source, evidence request, and return path.
- **Schedule production** — several approved, independently screenable cuts have known blocking edges and acceptance evidence; recommend the user manually invoke `afk-to-tickets` for that approved frontier.
- **Call Wayfinder** — several substantial interdependent creative unknowns exceed one coherent production problem.
- **Screen the rough cut** — every intended sequence has approved coverage; assemble them and ask the user whether to declare picture lock.
- **Enter post-production** — the user has declared picture lock.
- **Deliver the system** — the user has approved the final cut; run delivery validation and prepare the maintainable handoff.

Tickets organize known production work; ADF explores creative unknowns through production. Ticket only the approved production frontier. Keep unresolved scenes in the Director's Room, and add later tickets through rolling greenlights rather than converting uncertainty into implementation commitments. A long or difficult tracer remains a tracer; duration alone does not justify tickets.

When the Director's Room recommends scheduling, recommend the user pair the resulting tickets with `afk-implement-tickets` by default while ADF remains governing specialist for cinematic dailies and creative acceptance. The user chooses whether work stays in the current room, moves through an ordinary or skill-assisted handoff, opens in a fresh session, or uses another executor. Venue changes do not change the production's binder, authority, or greenlights.

## Production workflow

### 1. Development meeting

Inspect the product intent, existing stack and primitives, visual language, device floor, input paths, accessibility requirements, asset sources, and any user- or organization-curated tools. Draw out the creative battery: premise, audience-facing theme, product truth, conflict and change, primary feeling, irresistible action, reference frames, anti-references, and non-negotiables. Establish a **reference bar**: name what the references demand in art direction, material, camera, depth, rhythm, sound, and finish without mistaking them for literal designs to copy.

Start or resume the production binder and director's notebook from [`references/TEMPLATES.md`](references/TEMPLATES.md), then keep them current throughout the production.

Classify the work:

- **UI choreography** — state transitions, layout motion, feedback, microinteractions.
- **Narrative sequence** — authored scenes connected by scroll, time, or interaction.
- **Immersive world** — a continuously rendered environment with spatial effects or 3D.

Choose the lightest class capable of the intended experience **at its reference bar**. For a narrative sequence, immersive world, or explicitly cinematic or cinematographic direction, read [`references/CINEMATIC-DIRECTION.md`](references/CINEMATIC-DIRECTION.md) completely before proposing a treatment.

When a treatment may depend on video, externally authored animation or 3D, generated or acquired media, sound assets, or a hybrid composition, read [`references/PRODUCTION-MEDIA.md`](references/PRODUCTION-MEDIA.md) completely before proposing it. Choose how the shot should be produced before choosing how the browser should render it.

Completion: the director's notebook captures the creative battery, reference bar, experience class, device floor, input paths, fallback, locked choices, and open questions.

**Greenlight — development:** present your read of the idea and the production path. Wait for the user to correct or approve it.

### 2. Direct the treatment

Choose narrative-first or visual-first preproduction according to what carries the idea. Write the experience as a cinematic treatment with a **promise**, **beats**, **gates**, optional **reversal**, and **payoff**. Make the conflict-to-change relationship and the product truth legible. Give every motion a role: orient, reveal, focus, connect, confirm, transform, or exit.

- A **promise** establishes the premise the audience believes it is entering.
- A **beat** changes what the audience knows, sees, or feels.
- A **gate** asks for meaningful input before the next change.
- A **reversal** changes the meaning of an earlier promise or beat.
- The **payoff** converts authored momentum into useful agency.

When direction is genuinely open, present a small set of meaningfully different treatments and explain what each makes the audience feel, understand, and do. When the user already has a strong direction, sharpen that direction instead of manufacturing alternatives. Choose a mode and dials from [`references/MODES.md`](references/MODES.md) and [`references/DIALS.md`](references/DIALS.md) only after the treatment has a spine.

Completion: every beat advances the idea, every gate earns the pause, the cinematographic thesis is visible, and the ending returns useful agency.

**Greenlight — treatment:** show the treatment and the consequential alternatives or tensions. Wait for the user to lock one direction.

### 3. Pre-produce the cut

Use the approved treatment to create only the planning artifacts the production needs: script, shot list, storyboard, animatic, or a combination. A visual-first experience may begin with shot list or storyboard and let the script follow; a message-led experience usually begins with the script. Map each scene to framing, perspective, camera or viewport movement, subject action, transition, copy, product interaction, sound or haptic intent, and reduced-motion coverage.

Run a **medium scout** for every signature shot: decide whether it should be performed live in the browser, authored and exported, generated and finished, acquired or recorded, or composited from more than one medium. Judge each route against the reference bar before engineering convenience. When the user or organization provides a curated production library, consult it through its configured access method and search the closest capability categories before selecting a renderer, animation system, authoring tool, asset source, sound source, or haptic layer. Curated candidates inform the scout; they do not override the shot, existing stack, authoritative documentation, or device constraints.

Identify any bounded human production step and the exact material that must return as dailies. Then run the technical scout. Choose one authoritative driver for the sequence: semantic UI state, timeline time, or normalized virtual progress. Define segment ownership, asset groups, warm-path needs, fidelity tiers, and the riskiest signature shot. Read [`references/NARRATIVE-SYSTEMS.md`](references/NARRATIVE-SYSTEMS.md) for multiple beats, scroll progress, gesture gates, deep links, or replay.

Completion: the co-directors can inspect the intended sequence, reference bar, production-media strategy, credible medium candidates, and deliberate exclusions before production; the signature risk has a bounded tracer plan whose evidence can actually judge it.

**Greenlight — preproduction:** present the script, boards, or shot plan at the fidelity needed to judge the direction. Wait for approval of the signature shot and tracer boundary.

### 4. Shoot the tracer and review dailies

Build only the riskiest signature interaction at first. Make real input drive the real visual response on a target device. Compare timing, easing, framing, visual treatment, and feedback variants; initial code is raw material, not quality evidence. For a gesture, validate semantic invariants rather than an exact path. For a hold, drag, or scrub, expose normalized progress and let the scene interpret it.

Bring back **dailies**: a live build or recording that shows the motion in context, plus the device, input path, reduced-motion direction, technical findings, and the exact creative decision needed. A still image may support the screening but cannot approve movement, pacing, sound, or feel.

The tracer must be production-representative for every quality it asks the co-directors to judge. Blocking may use placeholders; a material, illustrated world, camera journey, composited plate, soundscape, or tactile signature needs representative evidence for that dimension. If the required asset, medium, tool, or human production step is unavailable, return a blocking study or production brief and label what it proves. Do not present technical plumbing as evidence that the cinematic direction works.

Screen creative evidence first: dramatic job, reference bar, composition, material, camera, rhythm, continuity, sound, and feeling. Then report engineering evidence and the constraints it places on the shot. Passing tests and frame budgets cannot compensate for an unreadable art-direction result.

Completion: the tracer establishes both technical feasibility and enough rendered evidence for the user to judge its cinematic direction.

**Greenlight — tracer:** wait for approval, revision notes, or a selected variant. Expand into the page only after the user explicitly opens production.

### 5. Produce approved sequences

Implement one approved scene or production batch at a time. Derive animation, text, effects, loading, sound, haptics, and overlays from the authoritative spine instead of synchronizing independent clocks. Model long experiences as self-contained segments with `enter`, `scrub`, optional `update`, and `teardown` responsibilities. Seeking to a later segment must reconstruct the same state as natural traversal.

Coordinate visual, sonic, tactile, and keyboard feedback around the same state change. Prefer one dominant cue with supporting accents. Synchronize time-sensitive sound to the rendered event that makes it meaningful. Use the project's existing design system and animation stack. Read [`references/STACK-PREFERENCES.md`](references/STACK-PREFERENCES.md) before introducing a dependency and [`references/PATTERNS.md`](references/PATTERNS.md) when selecting interaction primitives.

At the end of each approved batch, screen dailies against the treatment and shot plan. Record the user's notes and update the director's notebook before continuing.

Completion: the batch has legible entry, active, completion, cancellation, and exit behavior; it matches its approved dramatic job; and the user has evidence to decide the next cut.

**Greenlight — production batch:** wait for notes, approval, or explicit authorization for the next named batch.

When every intended sequence has approved coverage, screen the assembled rough cut. Only the user can declare **picture lock** and open post-production.

### 6. Post-produce the experience

Once the user greenlights **picture lock**, finish the approved cut in passes:

1. **Edit** — tune duration, rhythm, continuity, transitions, anticipation, impact, and release.
2. **Picture and VFX** — refine composition, spatial depth, typography, masks, materials, and effect integration.
3. **Color** — correct legibility and tonal balance before applying a coherent grade.
4. **Sound and touch** — add purposeful ambience, impacts, risers, tonal cues, silence, and haptics; preserve meaning when optional channels are absent.
5. **Technical finish** — protect frame pacing, loading, memory, accessibility, and responsive coverage without flattening the approved direction.

Treat frame pacing, loading, and memory as art direction. Establish a fidelity ladder from the creative master downward; lower tiers may simplify rendering and cinematic coverage while preserving content, interaction, story, and an honest route through the experience. Decode, upload, compile, and prewarm future work during known quiet windows. For WebGL, shaders, large media, post-processing, or continuously rendered effects, read [`references/IMMERSIVE-PIPELINE.md`](references/IMMERSIVE-PIPELINE.md) completely before implementation. Apply [`references/GUARDRAILS.md`](references/GUARDRAILS.md) to every class of work.

Completion: a screening cut shows the intended edit, grade, sound or silent mix, tactile cues, responsive coverage, and fidelity ladder on the device floor. Budgets exist for startup, bytes, memory, and worst-frame time; the opening path is isolated; upcoming beats are warm; and lower tiers preserve the experience's meaning.

**Greenlight — final cut:** present the screening cut and remaining trade-offs. Wait for the user's approval or notes.

### 7. Deliver the system

After final-cut approval, test natural and reverse traversal, interruption, resize, background and foreground, deep link or seek, slow loading, input changes, and replay. Validate pointer, touch, keyboard, reduced motion, muted audio, and the lowest fidelity tier. Use real mobile hardware early enough for findings to change the cut.

When a technical fix would materially change approved framing, pacing, feedback, or behavior, reopen the affected cut with the user instead of silently redefining it.

Deliver maintainable primitives, semantic names, tokenized timing, quality-tier rules, asset decisions, the director's notebook, and a short motion spec. Use the production cards, screening notes, and final handoff in [`references/TEMPLATES.md`](references/TEMPLATES.md).

Completion: another developer can change one scene, shot, effect, or quality tier without reverse-engineering the experience, and the delivered system matches the co-directors' approved final cut.

## Non-negotiables

- Treat explicit user greenlights as the authority for treatment, preproduction, tracer, production batches, and final cut.
- Preserve native scrolling unless an authored virtual spine materially enables the narrative; when virtualized, provide keyboard, reduced-motion, restoration, and escape behavior.
- Preserve content and agency across the fidelity ladder. Degrade polish first.
- Preserve the creative master on the capable tier. Treat compatibility as distribution design, not permission to lower the reference bar.
- Keep continuous values outside React render state; project them into the view at the rendering cadence.
- Prefer `transform` and `opacity` for DOM motion and bounded work for continuous effects.
- Keep focus, reading order, selection, history, and controls coherent through visual transitions.
- Make sound user-initiated and mutable; make haptics supplemental; make shortcuts discoverable.
- Test shader precision, memory, and frame pacing on real mobile GPUs when WebGL is involved.
