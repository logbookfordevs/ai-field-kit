---
name: afk-compass
description: Find the manual skill or workflow that fits the current task.
disable-model-invocation: true
---

# AFK Compass

AFK Compass is the user-invoked router for skills that stay out of automatic discovery.

## Route

1. Identify the outcome and current phase from the conversation. If one missing distinction would change the route, ask one question.
   If the uncertainty is between frontend design, prototyping, or motion routes, read [`references/frontend-crossroads.md`](references/frontend-crossroads.md).
   If the work crosses idea-shaping, specification, ticket grooming, implementation, review, or a context boundary, read [`references/workflow-crossroads.md`](references/workflow-crossroads.md).
2. Choose the smallest matching route or flow. A skill the user names directly wins.
3. Before claiming what a skill's process includes, or recommending that a step be skipped or combined, read that skill's current `SKILL.md` and any reference governing the claim. The table below is orientation, not process authority.
4. Return the exact invocation or ordered invocations for the current host, or a copyable ordinary implementation prompt when no manual execution skill is wanted. Give one sentence explaining why the route fits. Add phase-boundary guidance only when it changes how the flow should run. Include one alternative only when the choice is genuinely close.
5. End after the recommendation so the user remains the activation boundary.

The route is complete when the response contains one exact invocation, an ordered flow with its consequential boundaries, or a copyable prompt for ordinary agent behavior.

## Manual Routes

| Need | Skill |
|---|---|
| Relentlessly question a plan or design | `grill-me` |
| Question a plan while maintaining its ADRs and domain language | `grill-with-docs` |
| Settle bounded implementation, architecture, or UX trade-offs | `afk-code-grill` |
| Settle frontend design without an approved external design | `afk-design-grill` |
| Map a foggy effort too large for one session | `wayfinder` |
| Compare UI variants inside the real product or test a logic/state model through a throwaway experiment | `prototype` |
| Compare low-fidelity standalone frontend structures | `html-wireframe` |
| Build a polished standalone frontend mockup or bounded interactive flow | `html-prototype` |
| Synthesize the conversation into an agent-ready spec | `afk-to-spec` |
| Slice a plan or spec into dependency-aware tickets | `afk-to-tickets` |
| Implement existing checkpointed tickets | `afk-implement-tickets` |
| Review code, verify every finding, and discuss verdicts before fixes | `afk-code-review-verdicts` |
| Review lint and typecheck findings without fixes | `afk-static-review` |
| Save or resume disposable session context | `handoff` |
| Coordinate substantive work with native teammates in the current session | `afk-architect` |
| Coordinate work across multiple runtimes or external agent processes | `orchestrator` |
| Load a named AFK skill profile | `afk-profile-use` |
| Create a portable AFK Custom Agent | `afk-create-agent` |
| Write or improve human-facing documentation | `afk-docs-for-humans` |
| Ask another local model for a preserved second opinion | `afk-ask` |
| Produce a critical before-or-after engineering briefing | `facts` |
| Restate the last answer plainly | `bro` |
| Restate the human's request for confirmation before work begins | `readback` |
| Recap the current session to resync yourself | `recap` |
| Get an independent decision from a fresh agent with no inherited conversation | `clean-room` |
| Collect missing decisions from another person | `to-questionnaire` |
| Learn a topic across multiple sessions | `teach` |
| Design a motion-led immersive frontend | `afk-animated-driven-frontend` |
| Choose a UI registry, component primitive, or headless foundation | `afk-ui-registry-preferences` |
| Shape or review fluid, gesture-driven interfaces using Apple's interaction principles | `apple-design` |
| Review motion implementation | `review-animations` |
| Animate text in a frontend | `animate-text` |
| Create a general, plan, or architecture HTML artifact | `html`, `html-plan`, or `html-diagram` |
| Create a Plannotator-themed visual explanation | `plannotator-visual-explainer` |
| Analyze accumulated Plannotator plan feedback | `plannotator-compound` |
| Create a portable guided walkthrough of a diff | `plannotator-guide` |
| Design or revise predictable agent instructions | `writing-for-agents` |

Recommend only skills available in the current host. If the best route is unavailable, name the missing skill and give the closest available invocation.
