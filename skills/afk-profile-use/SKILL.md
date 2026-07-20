---
name: afk-profile-use
description: Load an AFK skill profile for the current request.
disable-model-invocation: true
---

# AFK Profile Use

Use the profile named by the user for the current request.

1. Run `afk skills profiles use <profile>`.
2. Treat the returned skill list as user-requested context.
3. For each relevant listed skill whose instructions are not already available, run `afk skills get <skill>` and apply its instructions.
4. When the user explicitly requests every profile skill, run `afk skills profiles use <profile> --all` and apply every returned skill.

Run the AFK commands yourself. Complete when the user's request has been handled under the loaded skill instructions.
