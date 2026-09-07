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
| Faithfully recreate a selected image whose visible composition is approved as the implementation reference | Product Design `image-to-code`, including its blocking `design-qa` gate |

Impeccable may generate deliberately unfinished direction sketches while choosing a new or replacement visual world. Those sketches help select a world. Product Design owns the stricter image-source lane: alternatives, faithful realization, and source comparison.

When an image was selected during direction exploration, ask what the selection approves. If it approves the **visual world only**, preserve that identity and route by destination: `html-prototype` for a standalone artifact or real-app realization when application context is material. If it approves the **visible composition as the implementation reference**, route directly to `image-to-code`. Selection alone does not decide authority.

When the user's problem is silent loss of identity-bearing color, typography, composition, imagery, illustration, SVG, texture, depth, perspective, or motion, route the whole decision-and-handoff problem to `afk-design-grill`. `design-qa` remains an internal gate owned by Product Design build workflows, not an independent Compass route.

## Finish and review

| Open decision | Route |
|---|---|
| Critique the product experience and identify the most important design problems | `impeccable critique` |
| Audit measurable accessibility, performance, theming, or responsive implementation quality | `impeccable audit` |
| Refine an implemented interface into a coherent, production-ready experience | `impeccable polish` |

## Motion

| Open decision | Route |
|---|---|
| Decide where and why motion belongs across a surface, then make it coherent with its visual world | `impeccable animate` |
| Implement one already-chosen component animation or transition correctly | `animate` |
| Review an existing motion implementation for craft and interaction quality | `review-animations` |
| Shape or review fluid, gesture-driven direct manipulation | `apple-design` |
| Co-direct a cinematic experience where motion, interaction, or immersion defines the frontend | `afk-animated-driven-frontend` |

Use `impeccable animate` for the surface motion thesis and `animate` for a bounded construction problem. Compose them only when that ownership is explicit. Use `afk-animated-driven-frontend` when motion changes the product experience itself and the user wants to co-direct its treatment, shots, tracer, production batches, and final cut.

When the doubt is whether one frontend specialist can still own the exploration or the work has become a multi-session decision landscape, consult [`workflow-crossroads.md`](workflow-crossroads.md). A frontend specialist may be the entry point and later promote the unresolved decision graph to Wayfinder; Wayfinder may in turn use frontend specialists for individual decisions before the governing specialist resumes at convergence.

## Recommendation

Return one exact invocation for the current host and one reason tied to the open decision. Mention one alternative only when the choice remains genuinely close. Profile-owned specialists must be available before recommending direct invocation; otherwise route through `afk-profile-use` or name the required profile.
