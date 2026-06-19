---
name: afk-pickup
description: Find and resume from a disposable handoff document saved in the user's OS temporary directory.
argument-hint: "Optional handoff path, repo name, topic, or 'latest'"
metadata:
  short-description: Find and resume from temp-directory handoff notes.
---

Find a handoff document from a previous session and use it to resume the work.

## Search Order

1. If the user passed a path, check it directly first. Also check the same basename under `/tmp`, `/private/tmp`, and `$TMPDIR`.
2. If there is no path or the direct path is missing, run `scripts/find-temp-handoffs.sh` from this skill folder, passing the user's repo name, topic, or `latest` text if present.
3. Read the best match only after confirming it is plausible for the current repo/topic. Prefer files that mention the current repo, workspace path, branch, validation state, next steps, or "handoff".
4. If there are multiple plausible matches, show the top few paths and ask which one to use.

## Guardrails

- Search `/tmp` before broad user folders. On macOS, `$TMPDIR` and `/tmp` are different locations, and `/tmp` is usually a symlink to `/private/tmp`.
- Do not drift into `~/Downloads`, Desktop, or the whole home directory unless the user explicitly says the handoff may be there.
- Do not hand-roll complex `find` expressions with ungrouped `-o`; use the bundled script or direct `ls`/`test -f` checks for exact paths.

Treat temp handoffs as disposable and possibly stale. Do not move, rewrite, or delete them unless asked.
