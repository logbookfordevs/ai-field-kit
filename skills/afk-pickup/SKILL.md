---
name: afk-pickup
description: Find and resume from a handoff document saved in the user's OS temporary directory.
argument-hint: "Optional handoff path, repo name, topic, or 'latest'"
metadata:
  short-description: Find and resume from temp-directory handoff notes.
---

Find a handoff document from a previous session and use it to resume the work.

If the user passed a path, read that file. Otherwise, search the user's OS temporary directory for recent markdown/text files that look like handoff documents. Prefer files that mention the current repo, workspace path, topic, or "handoff".

If there are multiple plausible matches, show the top few and ask which one to use.

Treat temp handoffs as disposable and possibly stale. Do not move, rewrite, or delete them unless asked.
