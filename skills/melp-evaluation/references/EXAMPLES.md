# MELP Worked Examples

These examples are intentionally small. The point is to show how to write **evidence-based trade-offs**, not to “win” on every pillar.

## Example 1: Add caching for a slow endpoint

**Decision:** Improve p95 latency on a frequently-hit endpoint.
**Options:** (A) Add cache with TTL + explicit invalidation path, (B) Add DB index + query rewrite, (C) Do nothing.

**Scores (1–5)**
- **M:** 3 — cache adds invalidation paths and more moving parts.
- **E:** 4 — combines quick win (TTL) with a plan to move to a more durable fix.
- **L:** 3 — more branches; needs strong naming + docs around cache policy.
- **P:** 5 — direct improvement on tail latency with guardrails.

**Recommendation:** Start with (B) if feasible quickly; otherwise (A) with explicit invalidation + monitoring, and a revisit date.

## Example 2: Introduce a third-party dependency

**Decision:** Use a vendor API for a core capability.
**Options:** (A) Vendor API now, (B) Build in-house, (C) Hybrid adapter with fallback.

**Scores (1–5)**
- **M:** 4 — adapter pattern localizes changes.
- **E:** 5 — hybrid keeps paths open and reduces lock-in risk.
- **L:** 4 — clear boundary (`VendorClient`, `DomainService`) keeps code navigable.
- **P:** 3 — adds network dependency; requires timeouts + fallback.

**Recommendation:** Prefer (C) with explicit timeouts, retry policy, and a documented exit story.

## Example 3: Refactor a “god module”

**Decision:** Reduce change blast-radius in a large module.
**Options:** (A) Extract bounded modules incrementally, (B) Big-bang rewrite, (C) Leave it.

**Scores (1–5)**
- **M:** 5 — incremental boundaries reduce future surgery.
- **E:** 4 — preserves shipping while improving architecture; set checkpoints.
- **L:** 4 — module naming + file focus improves mental model.
- **P:** 3 — refactors can regress perf; require baseline + measurement.

**Recommendation:** (A) with a small ADR per extraction and perf baselines to prevent regressions.

## Example 4: Add an abstraction layer “for cleanliness”

**Decision:** Add a new abstraction to “standardize” a pattern.
**Options:** (A) Add abstraction now, (B) Keep it direct, (C) Extract only shared helpers.

**Scores (1–5)**
- **M:** 3 — abstraction can help later, but adds surface area now.
- **E:** 2 — unclear future need; risks locking design too early.
- **L:** 2 — extra indirection makes the main flow harder to follow.
- **P:** 4 — direct code is often faster; indirection can add overhead (small but real).

**Recommendation:** Prefer (B) or (C) until repetition is proven; avoid abstraction-by-fear.
