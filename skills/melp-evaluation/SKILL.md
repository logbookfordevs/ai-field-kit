---
name: melp-evaluation
description: Evaluate and compare solutions using MELP (Maintainability, Efficacy/Strategy, Readability, Performance). Use when the user asks “which approach is better?”, wants trade-off analysis, scoring, a structured critique of code/architecture/PRs, or a decision record that is explicit about trade-offs and future constraints.
---

# MELP Evaluation

MELP is a language for discussing software-quality trade-offs in real product teams.

## Quick start

1. Ask for the decision context (deadline pressure, constraints, and what “success” means).
2. If there are options, insist on **2–4 real options** (including “do nothing” when valid).
3. Score **M/E/L/P from 1–5** with evidence (avoid vague claims like “clean” or “scalable”).
4. Write a recommendation that explicitly states what you’re **optimizing for** and what you’re **accepting** as a trade-off.

## Pillars (canonical names)

- **M — Maintainability (DX):** how safely and cheaply the system can change.
- **E — Efficacy/Strategy (product):** how well today’s choices solve the problem and keep future paths open.
- **L — Readability (DX):** how quickly engineers can build a correct mental model of the system.
- **P — Performance (UX/runtime):** how well the system runs under real workloads (latency, throughput, cost).

## Workflow

1. **Clarify intent:** what decision are we making (PR, refactor, dependency, architecture, feature approach)?
2. **State constraints:** deadline pressure, team size, runtime/SLO constraints, risk tolerance.
3. **List options:** 2–4 plausible options with the minimum detail needed to compare.
4. **Evaluate MELP:** score each pillar 1–5 with a few evidence bullets.
5. **Recommend:** choose an option, call out the non-negotiables, and propose next steps (tests, rollout, measurement, revisit date).

## References (read only what you need)

- `references/OVERVIEW.md`: what MELP is/isn’t, when to use it, and the MSRP (English) alias.
- `references/RUBRIC.md`: the 1–5 rubric per pillar (signals, alerts, what “good” looks like).
- `references/SCORING.md`: how to score consistently and write falsifiable trade-offs.
- `references/TEMPLATES.md`: ready-to-use templates (scorecard, option comparison, PR mini-check, ADR).
- `references/EXAMPLES.md`: worked examples with scores + rationale.
- `references/ANTI-PATTERNS.md`: common ways MELP gets misused and how to avoid them.
- `references/CHECKLISTS.md`: fast checklists per pillar.
