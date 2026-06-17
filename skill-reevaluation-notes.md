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

### Manifest Architecture

Decision: keep `autoInvocation` as the installation/discovery control and add architecture metadata beside it.

- `autoInvocation` stays because it precisely means whether the skill is exposed to automatic model discovery. Model-invoked skills can still be invoked by the user.
- Add `role` to describe the skill's compositional shape: primitive, wrapper, flow, utility, reference, or router.
- Add `composes` to describe the primitives or supporting skills a wrapper or flow is built from.
- Add `profiles` now as an empty array for every skill; profile behavior will be implemented later.
- Setup/installation should keep working from selected skill ids as it does today.
- Skill management features such as richer configure, profile activation, and role-oriented management belong under the future `afk skills ...` surface.

Setup behavior to implement now:

- Render skill choices with role and auto/manual labels.
- Show composed skills under their wrappers/flows.
- When a selected skill composes other skills, include those composed skills in the install plan, with a review step so the user can unselect them.

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

Decision:

- Remove explicit `AFK` / `HITL` slice labels from checkpoint packets.
- Keep review gates independent from autonomy.
- Represent human decisions, missing context, dependencies, and external blockers through explicit `blocked_by` entries or packet notes instead of a top-level slice type.
- Think forward from AFK's desired execution model, not backward from compatibility.

### Codebase Design

Decision: include `codebase-design` as a model-invoked primitive.

Reason:

- It appears aligned with Leonardo's native engineering workflow: architecture decisions, code strategy, and choosing between multiple viable implementation paths.
- It connects naturally to the Truss Evaluation pillars: Maintainability, Strategy, Clarity, and Performance.
- It also connects to `afk-code-grill`, which was originally shaped around architecture and implementation trade-off pressure.

Composition model:

- `codebase-design` is the architecture vocabulary primitive: deep modules, interfaces, seams, adapters, test surfaces, leverage, and locality.
- `truss-evaluation` is the decision-quality primitive: Maintainability, Strategy, Clarity, and Performance.
- `grilling` is the interview primitive: one sharp question at a time, code exploration before asking, and recommended defaults.
- `afk-code-grill` becomes the wrapper for bounded code/UX/architecture trade-off decisions. It should compose `grilling`, `truss-evaluation`, and `codebase-design` instead of duplicating their full content.

Invocation:

- Keep `codebase-design` model-invoked so the agent can use it directly when module/interface/seam/testability design is the topic.
- Make/keep `afk-code-grill` as the manually invoked wrapper for Leonardo's focused code-decision workflow.
- `afk-code-grill` can invoke `codebase-design` when the trade-off is architectural, while `codebase-design` can also be invoked independently by the model in ordinary architecture/design conversations.

Implementation direction:

- Prefer bringing `codebase-design` raw or lightly adapted first.
- Update `afk-code-grill` later to reference the primitives it composes instead of carrying duplicated behavior.
