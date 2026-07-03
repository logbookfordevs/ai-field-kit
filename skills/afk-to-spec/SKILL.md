---
name: afk-to-spec
description: Turn the current conversation into a spec and save it as an AFK artifact, or publish it to the project issue tracker when requested — no interview, just synthesis of what you've already discussed.
metadata:
  short-description: Create or normalize an agent-ready spec.
---

# To Spec

This skill takes the current conversation context and codebase understanding and produces a spec. Do NOT interview the user — just synthesize what you already know.

Save the spec as a local AFK artifact by default. The artifact location should follow the repo convention or AFK artifact conventions. If no convention exists, write to `docs/<task-slug>/<task-slug>.spec.md`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the spec, and respect any ADRs in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones. Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better - the ideal number is one.

Check with the user that these seams match their expectations.

3. Write the spec using the template below. Publish it to the project issue tracker only when the user requested tracker publication or existing project context clearly expects it. If publishing, apply the `ready-for-agent` triage label when the label vocabulary is known.

4. After writing a local spec, run `plannotator annotate --gate <path-to-spec>` when Plannotator is available. Treat returned annotations or user feedback as requested changes and update the artifact before handing it to slicing or execution.

If the user does not approve the gate, apply their feedback, then run `plannotator annotate --gate <path-to-spec>` again for the revised file. Keep reopening the annotation gate until the user approves or explicitly asks to stop the review loop.

If Plannotator is unavailable, say the artifact path and continue.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a mobile bank customer, I want to see balance on my accounts, so that I can make better informed decisions about my spending
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

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

A list of testing decisions that were made.

Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
