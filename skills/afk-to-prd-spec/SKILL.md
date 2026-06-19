---
name: afk-to-prd-spec
description: Turn conversation context, grilled plans, PM PRDs, or feature notes into an agent-ready PRD/spec artifact.
metadata:
  short-description: Create or normalize an agent-ready PRD/spec.
---

# To PRD Spec

This skill takes the current conversation context and codebase understanding and produces an agent-ready PRD/spec. Do NOT interview the user by default — synthesize what you already know.

If `grill-me` or `grill-with-docs` already sharpened the context, use that output. This skill turns available context into the artifact; it does not replace grilling when the user still wants that pressure step.

The artifact location should follow the repo convention or AFK artifact conventions. If no convention exists, write to `docs/<task-slug>/<task-slug>.prd-spec.md`. If issue tracker context exists and the user expects tracker publication, publish or prepare tracker-ready markdown instead.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the PRD/spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest meaningful seam possible. The fewer seams across the codebase, the better; one honest high-level seam is ideal when it covers the behavior.

Check with the user that these seams match their expectations.

3. Write the PRD/spec using the template below. If a PM PRD already exists, preserve its product intent and strengthen only what is missing for agent execution: behavior, acceptance criteria, implementation decisions, testing seams, or out-of-scope boundaries.

4. After writing a local PRD/spec, run `plannotator annotate --gate <path-to-prd-spec>` when Plannotator is available. Treat returned annotations as requested changes and update the artifact before handing it to slicing or execution. If Plannotator is unavailable, say the artifact path and continue.

<prd-spec-template>

## Problem Statement

The problem that the user or stakeholder is facing, from their perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A long, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should cover all meaningful aspects of the feature.

## Behavior

Describe the expected user flow, states, permissions, edge cases, error handling, empty states, and any behavior that must be true for implementation.

## Acceptance Criteria

A checklist of observable conditions that prove the feature is complete.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules or seams will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD/spec.

## Further Notes

Any further notes about the feature.

</prd-spec-template>
