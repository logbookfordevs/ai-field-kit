---
name: afk-compass
description: Find the manual skill or execution package that fits the current task.
disable-model-invocation: true
---

# AFK Compass

AFK Compass is the user-invoked router for skills that stay out of automatic discovery.

## Route

1. Identify the outcome and current phase from the conversation. If one missing distinction would change the route, ask one question.
2. Choose the smallest matching route below. A skill the user names directly wins.
3. Return its exact invocation in the current host and one sentence explaining why it fits. Include one alternative only when the choice is genuinely close.
4. End after the recommendation so the user remains the activation boundary.

The route is complete when the response contains one exact invocation, or explicitly concludes that ordinary agent behavior fits better than a manual skill.

## Manual Routes

| Need | Skill |
|---|---|
| Relentlessly question a plan or design | `grill-me` |
| Question a plan while maintaining its ADRs and domain language | `grill-with-docs` |
| Settle bounded implementation, architecture, or UX trade-offs | `afk-code-grill` |
| Map a foggy effort too large for one session | `wayfinder` |
| Build a throwaway experiment to answer one design question | `prototype` |
| Synthesize the conversation into an agent-ready spec | `afk-to-spec` |
| Slice a plan or spec into dependency-aware tickets | `afk-to-tickets` |
| Implement existing checkpointed tickets | `afk-implement-tickets` |
| Review code, verify every finding, and discuss verdicts before fixes | `afk-code-review-check` |
| Report lint and typecheck findings without fixes | `afk-static-check` |
| Save or resume disposable session context | `handoff` |
| Coordinate substantive work with native teammates in the current session | `afk-architect` |
| Coordinate work across multiple runtimes or external agent processes | `orchestrator` |
| Load a named AFK skill profile | `afk-profile-use` |
| Create a portable AFK Custom Agent | `afk-create-agent` |
| Write or improve human-facing documentation | `afk-doc-craft` |
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
| Name a motion effect from a vague description | `animation-vocabulary` |
| Animate text in a frontend | `animate-text` |
| Audit and polish the interaction details of an interface | `make-interfaces-feel-better` |
| Create a general, plan, or architecture HTML artifact | `html`, `html-plan`, or `html-diagram` |
| Create a Plannotator-themed visual explanation | `plannotator-visual-explainer` |
| Analyze accumulated Plannotator plan feedback | `plannotator-compound` |
| Design or revise predictable agent instructions | `writing-for-agents` |

Recommend only skills available in the current host. If the best route is unavailable, name the missing skill and give the closest available invocation.
