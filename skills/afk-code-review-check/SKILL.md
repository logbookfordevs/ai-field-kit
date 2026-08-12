---
name: afk-code-review-check
description: Run AFK Code Review, verify its findings against the code, and discuss the verdicts before changing code.
disable-model-invocation: true
---

Run the `afk-code-review` skill to completion and capture its findings.

Treat those returned findings as unverified review input. Inspect every finding against the actual code; do not assume automated feedback is correct. For each finding, give a clear verdict (Confirmed / Partly / Not a bug / Intended) with concise code evidence. Say whether it was introduced by the current changes, was pre-existing, or reflects deliberate scope.

Review only the incoming findings. Do not independently review the rest of the diff or search for issues that were not submitted.

Do not change any code until we have discussed the verdicts and validated findings.
