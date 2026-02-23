# MELP Templates

## Template: MELP scorecard + recommendation (default)

**Decision:** <what are we deciding?>
**Context:** <deadline pressure + constraints + definition of success>

**Options**
- A: <…>
- B: <…>
- (C / Do nothing): <…>

**Scores (1–5)**
- **M Maintainability:** <1–5>
  - Evidence:
  - Trade-off:
- **E Efficacy/Strategy:** <1–5>
  - Evidence:
  - Trade-off:
- **L Readability:** <1–5>
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
| E |  |  |  |
| L |  |  |  |
| P |  |  |  |

**Call:** <A/B> because <…>. **Risk:** <…>. **Next step:** <…>.

## Template: PR mini-check (fast)

- **Maintainability:** is the change localized? are critical risks covered by tests?
- **Efficacy/Strategy:** is the path justified? do we have an extension/migration story?
- **Readability:** are names and boundaries obvious? can a reviewer follow the flow without opening 5 files?
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
- **Efficacy/Strategy:** <risk + extension/migration story>
- **Readability:** <naming/structure suggestion>
- **Performance:** <measurement/guardrail request>
