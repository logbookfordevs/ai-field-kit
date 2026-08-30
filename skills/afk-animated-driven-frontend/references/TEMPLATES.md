# Templates

Use only the cards required by the work. Delete empty fields rather than delivering placeholders.

## Director's notebook

```md
Current stage:
Approved production boundary:
Creative battery:
Locked choices:
Open questions:
Rejected directions and reasons:
References / anti-references:
Technical findings:
Last greenlight:
Next co-directing decision:
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

## Shot card

```md
Sequence / scene / shot:
Dramatic job:
Subject and environment:
Shot size / perspective:
Camera or viewport movement:
Subject action / product interaction:
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
| Asset | Segment | Opening? | Runtime format | Dimensions / geometry | Transfer | Memory estimate | Warm step | Release |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

## Screening note

```md
Cut / scene / tracer:
Approved source it interprets:
Live build or recording:
Device / input / motion preference / fidelity tier:
Variants or compromises shown:
Creative observations:
Technical findings:
Director's recommendation:
Decision or notes requested from the user:
Next production boundary if approved:
```

## Handoff checklist

```md
- [ ] Director's notebook names the current stage and approved production boundary.
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
