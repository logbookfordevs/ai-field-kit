# MSCP Overview

MSCP is a language for discussing software-quality trade-offs in real product teams. It treats “quality” as a **decision problem**, not a fixed property: constraints change, so the weights change.

Use **MSCP** as the canonical acronym in this repo.

## What MSCP is

- A way to replace vague adjectives (“clean”, “scalable”) with **falsifiable trade-off statements**.
- A shared agenda for PRs, RFCs, incidents, and planning.
- A tool for choosing a **coherent profile** (fit-to-context) instead of chasing “10/10 on every axis”.

## What MSCP is not

- Not a checklist that “approves” work.
- Not a scoring game that replaces judgment or evidence.
- Not a purity standard (“ideal architecture”) that ignores product reality.

## The pillars (canonical names)

- **M — Maintainability (DX):** how safely and cheaply the system can change under uncertainty.
- **S — Strategy (product):** how well today’s choices solve the problem and keep future paths open (architecture, boundaries, migration paths).
- **C — Clarity (DX):** the speed and accuracy with which an engineer can construct a correct mental model of the decision scope (a function, module, PR, or system).
- **P — Performance (UX/runtime):** how well the system runs under real workloads (latency, throughput, cost).

## Security as a transversal boundary constraint

Security is intentionally not a fifth pillar. In practice, it behaves less like a tradeable axis and more like a boundary constraint: a non-negotiable baseline (for example, OWASP requirements and no PII exposure) that must hold regardless of optimization. Security concerns typically surface through Strategy (risk posture, regulatory exposure) and Performance (runtime cost of protections). Treating Security as transversal preserves MSCP's conceptual clarity and avoids overlap.

## Tension is the point

The pillars are intentionally in tension. Examples:

- Better Clarity can cost Performance (extra layers, allocations, indirection).
- Performance work can cost Maintainability (caches, special cases, invalidation complexity).
- Strategy can demand flexibility that increases what you must maintain.

The goal is not to eliminate tension. The goal is to **name it** and decide deliberately.

## What “good” looks like

“Good” is not “high on all axes”. “Good” is a coherent profile that matches your context:

- **Early stage:** iteration speed and clarity; avoid irreversible debt.
- **Growth stage:** boundaries, observability, and predictable delivery.
- **Mature stage:** reliability, cost control, and platform leverage.
