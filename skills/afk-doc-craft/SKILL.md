---
name: afk-doc-craft
description: Write, improve, or critique documentation using a reader-first playbook. Use when the user asks to create, rewrite, restructure, polish, or critique human-facing docs such as READMEs, guides, API docs, onboarding, troubleshooting, runbooks, implementation docs, and PR descriptions. Do not use for agent skill content, read-only documentation lookup, summarization, or context gathering.
---

# AFK Doc Craft

Use this skill to make documentation useful, clear, and worth reading.

Documentation is a product experience. The job is not only to preserve facts; it is to help a real reader build the right mental model with the least frustration.

Do not activate this skill for read-only documentation tasks. If the user only asks to read docs, inspect docs, find facts, summarize existing docs, or gather context from docs, use normal reading and analysis first. Activate this skill only when the expected output is authored documentation, documentation critique, or an edit to a documentation artifact.

## Operating Loop

1. Identify the document type and reader.
2. Establish what the reader is trying to do, decide, review, or understand.
3. Infer the reader's likely state: rushed, skeptical, curious, blocked, tired, or new to the topic.
4. Load the smallest reference set that fits the document.
5. Draft around the reader journey first, then add technical detail where it earns its place.
6. Run a calibration pass for clarity, usefulness, tone, and document-specific expectations.

Ask questions only when the missing context would materially change the document. Otherwise, make a reasonable assumption and state it.

## Reference Selection

Always apply:

- `references/general-documentation.md`

Apply when tone, storytelling, or explanation quality matters:

- `references/narrative-calibration.md`

Apply for pull request descriptions:

- `references/pr-descriptions.md`

Future document-specific references should live in `references/` and stay focused on one document type.

## Core Doctrine

- Prefer journeys and real scenarios over feature dumps.
- Put quick wins and high-signal context before exhaustive detail.
- Use technical detail to prepare the reader, not to prove that the writer did the work.
- Explain why when the why prevents future confusion, review churn, or repeated mistakes.
- Preserve joy through clarity, rhythm, apt examples, and reader empathy.
- Do not hide weak thinking behind personality, jokes, or decorative prose.

## Narrative Rule

Narrative is structure, not decoration.

Use it to create momentum:

```text
context -> tension -> evidence -> decision -> consequence -> next action
```

Do not force every document into `Problem / Findings / Solution`. That shape is useful when it fits. When it does not, choose headings that perform the same job for the reader.

## Final Pass

Before returning, check:

- Can the intended reader act on this without asking the obvious next question?
- Does the opening answer "why am I reading this?" quickly?
- Is the technical detail enough to orient the reader without burying them?
- Are the headings doing real navigation work?
- Did the tone help the reader keep going without turning the document into a performance?
