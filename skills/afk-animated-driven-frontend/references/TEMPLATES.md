# Templates

Use only the cards required by the work. Delete empty fields rather than delivering placeholders.

## Production binder

The production binder is the durable memory for a cinematic frontend expected to cross sessions, tickets, or agents. Follow the active repository or user artifact convention. Otherwise use:

```text
docs/specs/<scope>/production/
├── director-notebook.md
├── treatment.md
├── script.md
├── shot-plan.md
├── production-cards.md
├── asset-ledger.md
├── screenings.md
└── motion-spec.md
```

Create `director-notebook.md` first and add the other files only when the work earns them. The filenames illustrate roles rather than a mandatory file set: combine small related records when that keeps the production clearer, and split an artifact when independent ownership or review requires it.

- Treat the director's notebook as the canonical continuity index. Link detailed artifacts instead of copying them into it.
- Update existing artifacts across greenlights. Create parallel treatment, script, or shot variants only while the co-directors are genuinely comparing them; after selection, make the approved direction canonical and preserve rejection rationale in the notebook.
- Link storyboards, drawings, animatics, recordings, prototypes, and traces from the artifact that governs them. Preserve an exact frame, state, take, path, or revision when it affects approval.
- Run a continuity pass after every greenlight and before any handoff, Wayfinder promotion, ticket transition, or pause between sessions.
- Keep ticket execution state in the ticket and cinematic continuity in this binder. Cross-link them when a ticket implements a production batch.
- Ticket only approved, independently screenable cuts with known blocking edges. The binder remains the production source when `afk-to-tickets` schedules that frontier.

## Director's notebook

```md
Production home:
Current stage:
Approved production boundary:
Creative battery:
Locked choices:
Open questions:
Rejected directions and reasons:
References / anti-references:
Technical findings:
Artifact index:
Last greenlight:
Next co-directing decision:

## Continuity log

- <date / gate> — <continuity entry or link>
```

## Continuity entry

```md
Gate / production batch:
Status: <approved | revision requested | unapproved pause>
Decision and approved boundary:
Why this direction:
Material rejected directions:
Creative findings:
Technical findings:
Evidence and exact revision:
Artifacts created or updated:
Open questions:
Next unapproved gate:
Recommended production move: <keep directing | shoot tracer | produce batch | dispatch unit | afk-to-tickets | Wayfinder | screen rough cut | enter post-production | deliver system | none>
```

## Production slate

```md
Recorded:
Current gate and approved boundary:
Recommended production move:
Why this move fits now:
Approved production frontier:
Still unresolved in the Director's Room:
Venue for the user to choose: <current room | ordinary handoff | skill-assisted handoff | fresh session | ticket workflow | other>
Next evidence or greenlight:
```

## Director's treatment

```md
Primary mode: <kinetic clarity | tactile play | cinematic narrative | immersive world>
Dials: motion <1-5>, space <1-5>, input <1-5>, immersion <1-5>, density <1-5>
Premise:
Audience-facing theme:
Product truth:
Conflict → change:
Primary feeling:
Irresistible action:
Device floor:
Input paths:
Reduced-motion direction:
Preproduction order: <script first | shot list / storyboard first | iterative>
Cinematographic thesis:
Reference frames / anti-references:
Reference bar:
Creative-master target / required hardware:
Distribution cuts and preserved meaning:

Story spine:
1. Promise —
2. Beat —
3. Gate —
4. Reversal —
5. Payoff —

Authority: <semantic state | timeline time | normalized progress>
Opening budget:
Worst-frame budget:
Fidelity tiers:
Greenlight requested:
```

## Script

Use a script when narration, interface copy, dialogue, silence, or beat order carries the experience. Visual-first work may begin with boards or a shot list and add the script as the sequence converges.

```md
Status: <exploring | selected | approved>
Approved treatment:
Delivery: <spoken narration | interface copy | dialogue | visual / silent | hybrid>
Audience journey:
Voice and performance direction:
Timing or interaction authority:

| Beat / scene | Dramatic change | Picture / action | Narration / copy / silence | Product interaction | Sound / haptic cue | Transition |
| --- | --- | --- | --- | --- | --- | --- |

Continuity constraints:
Open performance questions:
Rendered or recorded evidence:
Greenlight requested:
```

## Shot card

```md
Sequence / scene / shot:
Dramatic job:
Subject and environment:
Shot size / perspective:
Camera or viewport movement:
Subject action / product interaction:
Production medium / source strategy:
Reference-bar qualities this medium must carry:
Credible alternatives excluded / reasons:
Human production step / return material:
Composition, lighting, and grade intent:
Copy / narration / silence:
Transition in / out:
Sound / haptic intent:
Owning state / progress value:
Pointer / touch / keyboard paths:
Responsive coverage:
Reduced-motion / muted / low-fidelity coverage:
Warm-path requirements:
Rendered acceptance evidence:
```

## Segment card

```md
Segment:
Global range / span:
Narrative change:
Entry preconditions:
Owned resources:
enter:
scrub(0..1):
update(time, delta):
teardown:
Gate and cancellation policy:
Warm-path requirements:
Deep-link / replay behavior:
Reduced-motion behavior:
```

## Interaction card

```md
Interaction:
Role: <orient | reveal | focus | connect | confirm | transform | exit>
Invitation:
Contact feedback:
Progress feedback:
Commit:
Release / cancellation:
Pointer path:
Touch path:
Keyboard path:
Visual / sound / haptic coordination:
Rendered-event synchronization:
Performance ceiling:
Acceptance evidence:
```

## Effect card

```md
Effect and narrative job:
Owning state / progress value:
Mechanism:
Render order:
Assets and memory estimate:
Compile / decode / upload / prewarm plan:
High / medium / low fidelity behavior:
Mobile precision risks:
Reduced-motion substitute:
Cleanup owner:
First-use trace result:
```

## Asset ledger

```md
| Asset / plate | Dramatic job | Source strategy / producer | Provenance / license | Runtime form | Segment | Opening? | Transfer / memory | Warm step | Fallback / release | Status / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

## Screening note

```md
Cut / scene / tracer:
Approved source it interprets:
Live build or recording:
Device / input / motion preference / fidelity tier:
Variants or compromises shown:
Creative observations against the dramatic job and reference bar:
Technical findings:
Director's recommendation:
Decision or notes requested from the user:
Next production boundary if approved:
```

## Handoff checklist

```md
- [ ] Director's notebook names the current stage and approved production boundary.
- [ ] Every approved greenlight has a persisted continuity entry and exact evidence link.
- [ ] The latest production slate names one next move and separates the approved frontier from unresolved directing work.
- [ ] Treatment, script, boards, and production cards exist only where the production needs them and identify their approval state.
- [ ] Treatment, preproduction, tracer, production batches, and final cut retain their explicit greenlights.
- [ ] Approved and rejected directions preserve rationale and rendered evidence.
- [ ] Every motion has a named role.
- [ ] Every gate has invitation, progress, commit, cancellation, and parity.
- [ ] Natural traversal, replay, and direct entry converge.
- [ ] The opening path excludes later worlds and optional polish.
- [ ] First-use uploads and shader variants are warm before signature frames.
- [ ] Fidelity tiers preserve story, content, and controls.
- [ ] Real-device traces cover worst frames, not only averages.
- [ ] Reduced motion, keyboard, muted audio, and enhancement failure remain complete.
- [ ] Segment resources have explicit ownership and teardown.
```
