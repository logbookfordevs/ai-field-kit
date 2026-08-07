---
name: afk-static-check
description: Run the repository's lint and typecheck checks and report their findings.
disable-model-invocation: true
---

Run the repository's existing lint and typecheck commands. Report warnings and errors relevant to the requested scope, including non-blocking warnings; distinguish new findings from pre-existing ones, and make no fixes unless asked. End with a brief opinion on each finding's validity, especially when a rule appears intentionally ignored, and why.
