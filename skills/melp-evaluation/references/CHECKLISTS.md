# MSCP Checklists (fast)

Use these when you need a quick pass (e.g., PR review). For anything sticky, switch to the MSCP brief.

## M — Maintainability

- Are changes localized, or do they cascade across many modules?
- Do tests reduce uncertainty for the riskiest paths?
- Are boundaries/cohesion improving or getting blurrier?
- Is the change easy to revert or isolate?

## S — Strategy

- Does this solve the real problem under current constraints?
- What future path does this open (or close)?
- Is there an extension/migration story?
- What’s plan B if the choice fails (rollback, adapter, fallback)?
- Are regulatory/security risks explicit and accepted (or mitigated) before scoring?

## C — Clarity

- Can a reviewer construct a correct mental model of the decision scope quickly?
- Do names express the domain (verbs + nouns that tell the story)?
- Is indirection minimized and justified?
- Is complexity surfaced (explicit types/contracts/config) rather than hidden?

## P — Performance

- Do we know the likely bottleneck (and how we’ll measure it)?
- Are timeouts/retries/limits explicit for external calls?
- Do we have graceful degradation paths?
- Are performance claims backed by measurement (baseline + target)?
- Is the runtime cost of protections (encryption, verification, scanning) measured and budgeted?

## Boundary constraints (gate before scoring)

- Does the option meet the non-negotiable security baseline (for example, OWASP requirements and no PII exposure)?
- If baseline security fails, did we stop and fix compliance before M/S/C/P scoring?
