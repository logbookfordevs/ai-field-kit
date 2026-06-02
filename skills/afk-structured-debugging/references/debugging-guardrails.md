# Debugging Guardrails

Use these guardrails when the investigation starts drifting toward guessing.

## Red Flags

- proposing fixes before understanding the failure
- suggesting broad rewrites without localizing the issue
- treating a symptom patch as the root-cause fix
- ignoring reproducibility confidence
- skipping verification after the proposed fix
- explaining async bugs without showing the sequence

## Anti-Rationalizations

| Rationalization | Better move |
|---|---|
| "I'll just patch the symptom for now" | State whether the patch is mitigation or root-cause fix, and prefer the real cause when possible. |
| "The error message is enough to know the bug" | Reproduce and localize before claiming confidence. |
| "The build is broken, but I can keep coding" | Stop the line and restore a trustworthy state first. |
| "I already know the fix, so I don't need to explain the logic" | Explain expected vs actual behavior so the user can validate the reasoning. |
| "This bug is random" | Classify the uncertainty and capture the most likely non-repro paths instead of shrugging. |
