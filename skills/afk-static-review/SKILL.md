---
name: afk-static-review
description: Run the repository's lint and typecheck checks and review their findings.
disable-model-invocation: true
---

First pin the requested scope, asking when unclear; use `scripts/changed-files.sh committed <ref>|staged|unstaged|dirty` to enumerate existing changed files safely. Run the repository's existing lint and typecheck commands. Report warnings and errors relevant to the requested scope, including non-blocking warnings; distinguish new findings from pre-existing ones, and make no fixes unless asked. End with a brief opinion on each finding's validity, especially when a rule appears intentionally ignored, and why.
