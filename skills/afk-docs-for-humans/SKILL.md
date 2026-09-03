---
name: afk-docs-for-humans
description: Write, revise, or critique durable human-facing documentation: guides, PR descriptions, explainers, and decision documents.
disable-model-invocation: true
---

# AFK Docs for Humans

Human-facing documentation helps a reader build the right mental model and act without avoidable friction. For agent-facing instructions such as `AGENTS.md`, `CLAUDE.md`, skills, prompts, rules, or policies, use `writing-for-agents` instead.

## Workflow

1. **Ground the document.** Identify whether the task is to create, revise, or critique; inspect the artifact and the available sources of truth. Verify consequential inputs against code, commands, product behavior, tickets, decisions, or material supplied by the user. Preserve established terminology and intentional constraints. This step is complete when each consequential topic has an authoritative source or an explicit uncertainty to carry into the document.
2. **Set the reader contract.** Establish the intended reader, their job, starting knowledge, likely friction, and next action. Ask only when a missing answer would materially change the document; otherwise state the assumption. This step is complete when the document has one clear primary reader and outcome.
3. **Load branch guidance.** Read `references/pr-descriptions.md` for pull request descriptions. Read `references/narrative-calibration.md` for tutorials, explainers, decision documents, product briefs, or articles whose pacing and narrative shape materially affect comprehension. Read `references/visual-explanations.md` when logic, runtime flow, UI structure, file responsibility, interactions, or a change would be faster to understand visually than through prose alone.
4. **Design the path.** Structure around the reader's journey rather than the author's inventory. Lead with the fastest useful orientation, then the common path, consequential constraints, friction and failure recovery, and exhaustive reference only where needed. This step is complete when the headings alone reveal the document's path.
5. **Produce the requested artifact.**
   - For a new document, write the complete reader journey.
   - For a revision, preserve supported facts, public contracts, useful voice, and out-of-scope material unless the evidence or user requests a change.
   - For a critique, report specific reader problems with evidence and concrete improvement examples; rewrite only when requested.
6. **Verify the result.** Trace factual claims back to their sources. Check commands, examples, links, and stated verification when feasible; label anything not verified. Remove detail that merely repeats the source without helping the reader act or judge.
7. **Run the acceptance gate.** Return only when every applicable condition below holds.

## Reader Doctrine

- Prefer real journeys and scenarios over feature dumps.
- Put quick wins and high-signal context before completeness.
- Use code or examples first when the reader must implement; use rationale first when they must decide or understand.
- Explain why when it prevents future confusion, review churn, or rediscovery.
- Use diagrams, screenshots, tables, or examples when they materially reduce mental load.
- Write like a precise teammate: direct, warm when useful, honest about constraints, and free of decorative performance.

## Acceptance Gate

- Every consequential factual claim is supported or marked uncertain.
- The opening quickly tells the intended reader why the document matters.
- The structure follows the reader's job, and the headings provide useful navigation.
- The common path is actionable without hiding important constraints or failure modes.
- Technical detail improves action or judgment rather than demonstrating author effort.
- Terminology, public contracts, and intentional decisions remain accurate and consistent.
- The reader knows what to do, decide, review, or remember next.
