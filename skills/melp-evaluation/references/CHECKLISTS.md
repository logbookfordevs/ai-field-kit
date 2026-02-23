# MELP Checklists (fast)

Use these when you need a quick pass (e.g., PR review). For anything sticky, switch to the MELP brief.

## M — Maintainability

- Are changes localized, or do they cascade across many modules?
- Do tests reduce uncertainty for the riskiest paths?
- Are boundaries/cohesion improving or getting blurrier?
- Is the change easy to revert or isolate?

## E — Efficacy/Strategy

- Does this solve the real problem under current constraints?
- What future path does this open (or close)?
- Is there an extension/migration story?
- What’s plan B if the choice fails (rollback, adapter, fallback)?

## L — Readability

- Can a reviewer follow the main flow without opening 5+ files?
- Do names express the domain (verbs + nouns that tell the story)?
- Is indirection minimized and justified?
- Is complexity surfaced (explicit types/contracts/config) rather than hidden?

## P — Performance

- Do we know the likely bottleneck (and how we’ll measure it)?
- Are timeouts/retries/limits explicit for external calls?
- Do we have graceful degradation paths?
- Are performance claims backed by measurement (baseline + target)?
