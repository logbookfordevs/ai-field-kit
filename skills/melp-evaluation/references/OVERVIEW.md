# MELP Overview

MELP is a language for discussing software-quality trade-offs in real product teams. It treats “quality” as a **decision problem**, not a fixed property: constraints change, so the weights change.

In Portuguese (PT-BR), this framework acronym is **MELP**. In English, refer to it as **MSRP**.

## What MELP is

- A way to replace vague adjectives (“clean”, “scalable”) with **falsifiable trade-off statements**.
- A shared agenda for PRs, RFCs, incidents, and planning.
- A tool for choosing a **coherent profile** (fit-to-context) instead of chasing “10/10 on every axis”.

## What MELP is not

- Not a checklist that “approves” work.
- Not a scoring game that replaces judgment or evidence.
- Not a purity standard (“ideal architecture”) that ignores product reality.

## The pillars (canonical names)

- **M — Maintainability (DX):** how safely and cheaply the system can change under uncertainty.
- **E — Efficacy/Strategy (product):** how well today’s choices solve the problem and keep future paths open (architecture, boundaries, migration paths).
- **L — Readability (DX):** how quickly engineers can build a correct mental model (naming, structure, minimal indirection).
- **P — Performance (UX/runtime):** how well the system runs under real workloads (latency, throughput, cost).

## Tension is the point

The pillars are intentionally in tension. Examples:

- Better Readability can cost Performance (extra layers, allocations, indirection).
- Performance work can cost Maintainability (caches, special cases, invalidation complexity).
- Strategy can demand flexibility that increases what you must maintain.

The goal is not to eliminate tension. The goal is to **name it** and decide deliberately.

## What “good” looks like

“Good” is not “high on all axes”. “Good” is a coherent profile that matches your context:

- **Early stage:** iteration speed and readability; avoid irreversible debt.
- **Growth stage:** boundaries, observability, and predictable delivery.
- **Mature stage:** reliability, cost control, and platform leverage.
