---
name: afk-cli
description: Manage AFK setup, skill profiles and invocation, favorite sources, tools, agent rules, and portable configuration through the CLI.
---

# AFK CLI

Turn the user's requested AFK outcome into changes, execute them, and verify their effects.

1. **Inspect.** Run `afk --help`, `afk manage --help`, `afk settings path`, and `afk manage state`. Use the installed operation catalog for current payloads. Establish Global or a named project scope from the request and state; resolve consequential choices that remain open. If required commands are absent, report the installed capability gap before dependent work.
2. **Choose.** Read the matching branch in [Workflows](references/workflows.md): settings definitions; profiles and skills; favorites and tools; agent rules; or portable configuration. Use AFK operations for filesystem effects and ownership changes.
3. **Apply.** Execute the authorized change. Pass operation payloads through a JSON file or `--input -`; serialize content as data instead of interpolating it into shell commands. For definition edits, preserve managed fields and validate the candidate before replacing the settings file. For rule sync, inspect the preview and pass its unchanged snapshot into the applying operation.
4. **Verify.** Read back the affected state and inspect the resulting files or command status. Run `afk doctor --json` after settings, activation, invocation, rules, or portability changes; repair findings within scope. Report the outcome, target, evidence, and any remaining gap. Saved definitions, prepared copies, activation, instruction reading, rule sync, and running-client discovery are separate outcomes.

Use live help rather than older catalog/setup commands. AFK manages local skills and configuration; external skill installation and updates belong to Skills CLI.
