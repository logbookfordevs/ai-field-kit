# Facts

- `afk manifests configure` becomes an editor-style interactive session where the user can choose a manifest type, review existing entries, choose an action, and return to the menu until they finish.
- The first version supports editing the rules, skills, MCPs, utils, and hooks manifests; presets are out of scope for this goal.
- For item-based manifests, the session supports adding new items, editing existing items, removing existing items, and toggling default-style fields such as `default` and skill `autoInvocation` where those fields exist.
- The editor does not include a duplicate or clone operation in this goal.
- The implementation starts with the existing `@inquirer/prompts` stack and AFK prompt themes; a new TUI dependency is added only if a specific required interaction cannot be built cleanly with Inquirer.
- The configure flow loads existing manifests by default when they are present, preserving current fields unless the user explicitly edits or removes them.
- The existing `--local`, `--from-current`, and `--dry-run` flags remain compatible with the new configure behavior.
- Before writing any manifest file, the session shows a preview of the changed JSON and requires explicit confirmation unless `--dry-run` is active.
- The editor validates manifest shape before writing, prevents duplicate item ids, and makes removals explicit rather than accidental.
- The command remains a manifest editor, not a setup executor: it changes manifest JSON only and does not run skill, MCP, utility, rule, or hook setup commands.
