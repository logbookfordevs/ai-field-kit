# MELP Rubric (1–5)

Use this rubric to score each pillar from **1 (weak)** to **5 (excellent)**. The goal is consistency and evidence, not perfection.

## M — Maintainability (DX)

**Definition:** cost of change under uncertainty.

**Signals**
- Changes are small and localized for common tasks.
- Tests provide real confidence.
- Low coupling, high cohesion; boundaries are meaningful.

**Alerts**
- Every change becomes “surgery” across the codebase.
- Fragile or missing tests.
- Patchwork shortcuts and accidental complexity.

**Scoring guide**
- **1:** Changes routinely cascade; confidence is low; boundaries are unclear.
- **3:** Most changes are manageable; some hotspots are risky or poorly covered.
- **5:** Changes are predictable and cheap; tests + boundaries make refactors safe.

## E — Efficacy/Strategy (product)

**Definition:** choosing a path that works today without trapping you tomorrow.

**Signals**
- Solves the current need and identifies plausible extensions.
- Decisions are justified and recorded (even briefly).
- Known risks have a plan B (migration/rollback/fallback).

**Alerts**
- One-shot design glued to the current case.
- Hard vendor lock-in without an exit story.
- High cost to change direction.

**Scoring guide**
- **1:** The approach “works now” but creates obvious future traps.
- **3:** Reasonable path with some extension story; a few risks remain unmitigated.
- **5:** Clear rationale + future-proofing where it matters; explicit revisit points.

## L — Readability (DX)

**Definition:** how quickly a competent engineer can build a correct mental model and answer “what happens if I change this?”

**Signals**
- Names tell the story of the domain (semantic naming).
- Files are small and focused; structure is predictable.
- Complexity is surfaced, not hidden behind cleverness.

**Alerts**
- Generic names (`util.ts`, `doThing()`).
- Magic numbers/strings; implicit behavior.
- Abstraction-by-fear: layers of indirection to avoid choosing a model.

**Scoring guide**
- **1:** A reviewer can’t follow the main flow without opening many files and guessing intent.
- **3:** The main flow is discoverable; a few areas are confusing or overly indirect.
- **5:** The system is navigable; intent is obvious; indirection is minimal and justified.

## P — Performance (UX/runtime)

**Definition:** delivering value under real load, inside real SLOs.

**Signals**
- Latency targets are met (especially tail latency p95/p99 where relevant).
- Stable resource usage (CPU, memory, bandwidth, third-party calls).
- Graceful degradation (timeouts, backpressure, limits, fallbacks).

**Alerts**
- Timeouts and “mystery spikes”.
- N+1 patterns and unnecessary serialization.
- Micro-optimizations without measurement.

**Scoring guide**
- **1:** Performance risks are unknown/ignored; likely bottlenecks are unbounded.
- **3:** Basic guardrails exist; some uncertainty remains about real bottlenecks.
- **5:** Clear targets + measurement; predictable behavior under load; safe failure modes.
