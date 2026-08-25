# Frontend Crossroads

Use this reference only when the user is choosing between nearby frontend routes. Route by the decision still open, not by the tools each skill can use.

## Design and implementation

| Open decision | Route |
|---|---|
| Discover and settle several connected frontend design decisions without an approved external design | `afk-design-grill` |
| Establish or reshape the visual world and the complete interface experience | `impeccable` |
| Create a standalone HTML artifact whose visual direction is still open | `design-artifact` with the narrowest available HTML specialist |
| Compare low-fidelity standalone structures before committing to a visual direction | `html-wireframe` from the HTML profile |
| Compare several deliberately rough UI directions or test a state model where proximity to the real project helps answer the question | `prototype` |
| Visualize and approve a polished whole surface, or test one credible bounded flow, as a self-contained design artifact | `html-prototype` from the HTML profile |

Both routes may be disposable, and the production stack alone does not choose between them. Route by the artifact's review job: `prototype` skips polish to answer one structural, behavioral, or state-model question, while `html-prototype` makes visual fidelity or one complete responsive flow credible enough to approve independently of production code. As a common heuristic, prefer `html-prototype` for a new or replacement website or marketing surface and `prototype` for a feature explored within an established product shell; either route may serve greenfield or brownfield work when the review job points the other way.

Recommend `prototype` only when its distinguishing context is material: a named host surface, real application data or density, or a logic/state model that benefits from guided free play. Otherwise prefer the standalone HTML route whose fidelity matches the open decision.

A rough `prototype` may answer structure or behavior but cannot approve visual fidelity. When the user needs several connected decisions to survive across artifacts, route to `afk-design-grill` instead of recommending one prototype skill in isolation.

## Visual-source fidelity

| Open decision | Route |
|---|---|
| Explore image-based visual alternatives before choosing a target | Product Design `ideate` |
| Faithfully realize a selected image, screenshot, mockup, or generated direction | Product Design `image-to-code` |
| Compare that implementation against its visual source | Product Design `design-qa` |

Impeccable may generate deliberately unfinished direction sketches while choosing a new or replacement visual world. Those sketches help select a world. Product Design owns the stricter image-source lane: alternatives, faithful realization, and source comparison.

When the user's problem is silent loss of identity-bearing color, typography, composition, imagery, illustration, SVG, texture, depth, perspective, or motion, route the whole decision-and-handoff problem to `afk-design-grill`. Route a selected image that already serves as the visual authority directly to `image-to-code`, followed by `design-qa`.

## Finish and review

| Open decision | Route |
|---|---|
| Critique the product experience and identify the most important design problems | `impeccable critique` |
| Audit measurable accessibility, performance, theming, or responsive implementation quality | `impeccable audit` |
| Refine an implemented interface into a coherent, production-ready experience | `impeccable polish` |

## Implementation choice

| Open decision | Route |
|---|---|
| Choose a mature UI registry, component primitive, or headless foundation | `afk-ui-registry-preferences` |

## Motion

| Open decision | Route |
|---|---|
| Decide where and why motion belongs across a surface, then make it coherent with its visual world | `impeccable animate` |
| Implement one already-chosen component animation or transition correctly | `animate` |
| Review an existing motion implementation for craft and interaction quality | `review-animations` |
| Shape or review fluid, gesture-driven direct manipulation | `apple-design` |
| Make motion, interaction, or immersion the frontend's defining experience | `afk-animated-driven-frontend` |

Use `impeccable animate` for the surface motion thesis and `animate` for a bounded construction problem. Compose them only when that ownership is explicit. Use `afk-animated-driven-frontend` when motion changes the product experience itself rather than decorating a largely static page.

## Recommendation

Return one exact invocation for the current host and one reason tied to the open decision. Mention one alternative only when the choice remains genuinely close. Profile-owned specialists must be available before recommending direct invocation; otherwise route through `afk-profile-use` or name the required profile.
