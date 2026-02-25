# MSCP Templates

## Template: MSCP scorecard + recommendation (default)

**Decision:** <what are we deciding?>
**Context:** <deadline pressure + constraints + definition of success>
**Boundary constraints (must hold before scoring):**
- Security baseline: <OWASP/compliance/PII constraints that are non-negotiable>

**Options**
- A: <…>
- B: <…>
- (C / Do nothing): <…>

**Scores (1–5)**
- **M Maintainability:** <1–5>
  - Evidence:
  - Trade-off:
- **S Strategy:** <1-5>
  - Evidence:
  - Trade-off:
- **C Clarity:** <1-5>
  - Evidence:
  - Trade-off:
- **P Performance:** <1–5>
  - Evidence:
  - Trade-off:

**Recommendation**
- Pick: <Option A/B/...>
- Why: <2–5 bullets>
- Non-negotiables: <tests/guardrails/rollout/measurement>
- Revisit: <date or trigger>

## Template: Option A vs B comparison (short)

| Pillar | Option A | Option B | Notes |
|---|---:|---:|---|
| M |  |  |  |
| S |  |  |  |
| C |  |  |  |
| P |  |  |  |

**Call:** <A/B> because <…>. **Risk:** <…>. **Next step:** <…>.

## Template: PR mini-check (fast)

- **Maintainability:** is the change localized? are critical risks covered by tests?
- **Strategy:** is the path justified? do we have an extension/migration story?
- **Clarity:** can a reviewer construct a correct mental model quickly and accurately without opening 5 files?
- **Performance:** are timeouts/retries/limits explicit? do we know the likely bottleneck?

## Template: Ultra-short ADR (6 lines)

Context: <real problem>
Alternatives: <A, B, C>
Decision: <what and why>
Risks: <known>
Mitigation: <plan B / rollback>
Review: <when to revisit>

## Template: Comment-ready PR feedback (no code anchoring)

Write as if the reader can see the diff already (do not include file paths, line numbers, or code blocks):

- **Maintainability:** <one concrete improvement request>
- **Strategy:** <risk + extension/migration story>
- **Clarity:** <improve speed and accuracy of understanding the decision scope (naming, structure, flow, and reduced indirection)>
- **Performance:** <measurement/guardrail request>
- **Boundary constraints:** <confirm security baseline is met; if not, request remediation before trade-off scoring>
