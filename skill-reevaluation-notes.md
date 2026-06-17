# Skill Reevaluation Notes

Working notes for the current AFK skill review. Do not treat this file as implementation state yet; apply these decisions only after the review is complete.

## House Style Direction

AFK should adopt a composable skill mental model inspired by React componentization:

- **Primitives** are small reusable behavior units.
- **Wrappers** compose primitives into named user-facing experiences.
- **Flows** compose wrappers and primitives into larger repeatable workflows.
- Invocation mode should follow the skill's role in that composition, not only whether the skill is useful.

This should later be reflected in the README narrative and, eventually, the AFK website.

## Decisions So Far

### Grilling Split

Follow Matt Pocock's composability perspective for the grilling family:

- Add `grilling` as a model-invoked primitive.
- Change `grill-me` to user-invoked.
- Change `grill-with-docs` to user-invoked.
- Add/keep `domain-modeling` as model-invoked because `grill-with-docs` composes `grilling` with `domain-modeling`.

Interpretation:

- `grilling` is the shared interview engine.
- `grill-me` is the stateless wrapper around `grilling`.
- `grill-with-docs` is the stateful/domain-aware wrapper around `grilling` plus `domain-modeling`.

## Open Questions

### AFK To PRD / To Issues Drift From Matt

Decision: improve AFK's forked planning skills with recent useful Matt upstream ideas.

For `afk-to-prd-spec`:

- Update the testing seam guidance to absorb Matt's sharper principle.
- Current AFK idea: use the highest seam possible.
- Matt idea: the fewer seams across the codebase, the better; the ideal number is one.
- Proposed AFK wording: prefer the highest meaningful seam possible, and prefer the fewest seams that honestly prove the behavior. One honest high-level seam is ideal when it covers the behavior.

For `afk-to-issues`:

- Add Matt's prefactoring concept.
- Proposed AFK framing: look for opportunities to prefactor the code to make implementation easier. "Make the change easy, then make the easy change." Any prefactoring should be planned before dependent vertical slices.
- Keep the wording tight. Do not add defensive constraints that the surrounding tracer-bullet context already implies.

Open decision:

- Reevaluate whether AFK should keep explicit `AFK` / `HITL` slice labels now that Matt removed them from `to-issues`.
- Think forward from AFK's desired execution model, not backward from compatibility.
- Current concern: if `AFK` / `HITL` labels do not drive review gates or execution behavior, they may be cosmetic.
- Possible replacement: represent human decisions as explicit blockers, assumptions, decision gates, or unresolved questions instead of a top-level slice type.

### Codebase Design

Strong leaning: include `codebase-design` somehow.

Reason:

- It appears aligned with Leonardo's native engineering workflow: architecture decisions, code strategy, and choosing between multiple viable implementation paths.
- It connects naturally to the Truss Evaluation pillars: Maintainability, Strategy, Clarity, and Performance.
- It also connects to `afk-code-grill`, which was originally shaped around architecture and implementation trade-off pressure.

Unresolved options:

- Bring `codebase-design` in raw as its own skill.
- Fork/adapt `codebase-design` into an AFK-native skill.
- Merge its vocabulary and criteria into `afk-code-grill`.
- Keep both `codebase-design` and `afk-code-grill`, with `codebase-design` acting as the architecture vocabulary primitive and `afk-code-grill` acting as the decision/interview wrapper.

Current instinct:

- The fourth option may fit the emerging house style best: primitive plus wrapper.
- Do not decide yet.
