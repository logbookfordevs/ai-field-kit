# Scoring MSCP Consistently

MSCP works when it replaces adjectives with **evidence** and **falsifiable statements**.

## Evidence standards (what “counts”)

Prefer evidence a teammate can quickly verify:

- Diff shape: “this feature touches 6 files across 3 packages”
- Navigability: “main flow is traceable from routes → loaders → views with consistent naming”
- Constraints: “this adds a critical-path dependency; we need timeouts + fallback”
- Operational reality: “p95 must stay under X; current baseline is Y”

Avoid:

- “This is cleaner.”
- “This will scale.”
- “This feels enterprise.”

## Calibration rules

- **Score relative to the current context**, not a hypothetical ideal.
- Use **1–5** as a coarse signal; do not pretend precision.
- If you can’t justify a number, write the trade-off first, then infer the score.
- When uncertain, prefer **3** and list what you’d need to learn to move it up/down.

## Boundary constraints before scoring

Check non-negotiable baselines before any M/S/C/P scoring. Security is a transversal boundary constraint, not a fifth pillar.

- If the option fails the agreed security baseline (for example, OWASP requirements or no PII exposure), it is **not score-eligible** yet.
- Fix baseline compliance first, then score trade-offs across the four pillars.
- In rationale, record where security pressure appears most directly: **Strategy** (risk/regulatory exposure) and **Performance** (runtime cost of protections).

## The MSCP brief (one-page decision record)

For non-trivial decisions (dependency, refactor, architecture, feature approach), write a short MSCP brief near the code (ADR-style).

Minimal template:

1. **Context:** what are we building, for whom, and what is the deadline pressure?
2. **Options:** 2–4 real options (include “do nothing” when valid).
3. **Trade-offs:** one paragraph per pillar (what improves, what worsens).
4. **Risks:** what can fail, and what signal will tell us early?
5. **Decision:** what we pick, what we intentionally give up, and when we will revisit.

## Decide fast vs invest

- Move fast when the decision is reversible.
- Invest when it is sticky (contracts, data models, platform boundaries).

Heuristic: if the **cost of reversal** is high, slow down and write the brief.
