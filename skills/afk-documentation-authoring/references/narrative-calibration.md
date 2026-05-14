# Narrative Calibration

Use this reference when a document needs to be readable, engaging, persuasive, or easier to review.

## Principle

Narrative is not a costume for documentation. It is the path the reader walks.

Good narrative helps the reader feel:

- "I know why this exists."
- "I know what changed."
- "I know what matters most."
- "I know where to look next."

If the story draws attention to itself more than it clarifies the work, it is too much.

## The Narrative Spine

A useful technical narrative often follows this spine:

```text
context -> tension -> evidence -> decision -> consequence -> next action
```

This does not need to appear as headings. It is an internal shape.

- Context: what world are we in?
- Tension: what changed, broke, grew awkward, or became worth improving?
- Evidence: what did we find in the code, product, data, or workflow?
- Decision: what did we choose?
- Consequence: what should the reader expect now?
- Next action: what should the reader do, review, test, or remember?

## Borrow From Great Technical Writing

Borrow:

- curiosity
- concrete examples
- experiments and evidence
- plain-English demystification
- rhythm between explanation and proof
- respect for the reader's attention

Do not borrow:

- blog-post theatrics for project docs
- long personal asides
- suspense where the reviewer needs directness
- clever phrasing that competes with technical clarity

## Calibration By Document Type

Use less visible storytelling when the document is operational or review-oriented.

- PR description: narrative level 2/5. Use story as orientation and review guidance.
- RFC: narrative level 3/5. Make the decision pressure and trade-offs clear.
- PRD or product brief: narrative level 3/5. Explain motivation, user value, and constraints.
- README or guide: narrative level 3/5. Make the journey smooth and encouraging.
- Tutorial or explainer: narrative level 4/5. Curiosity and pacing can be more visible.
- Blog/article: narrative level 5/5. Voice, reveals, and delight can carry more weight.

## Signs It Is Too Dry

- It starts with a file list or feature dump.
- The reader cannot tell why the change exists.
- The document says what happened but not what matters.
- The reviewer still has to reconstruct the story from the diff.
- Every sentence has the same weight.

## Signs It Is Too Much

- The document announces "the story" when a simpler heading would work.
- The prose delays important technical facts.
- The tone sounds like a blog post, pitch, or performance.
- The reader has to skim around personality to find review guidance.
- The conclusion adds sentiment without adding action.

## Good Technical Warmth

Use warmth to reduce friction:

- "The important bit is..."
- "This is the part worth reviewing carefully."
- "The shape is intentionally boring here."
- "If this looks suspicious, it is probably this constraint."

Keep warmth close to the work. The reader should feel accompanied, not entertained at the cost of clarity.

## Calibration Pass

After drafting, ask:

- Is the first paragraph a real orientation, not a decorative opening?
- Can a busy reader skim the headings and understand the path?
- Did I keep the best technical detail close to the claim it supports?
- Did I remove personality that does not help the reader act?
- Does the ending tell the reader what to do next?
