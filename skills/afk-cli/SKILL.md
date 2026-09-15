---
name: afk-cli
description: Manage your AFK setup, catalogs, skills, and profiles through guided CLI workflows.
disable-model-invocation: true
---

# AFK CLI

AFK prepares and maintains an agent environment from composable catalogs. Use this skill to turn the user's requested outcome into commands, execute them, and verify the resulting state.

## Start with context

Run `afk --version` and `afk --help`, then inspect the relevant state from the table below. Read the selected command's `--help` before execution: these references teach workflows, while the installed version owns supported syntax. If AFK is missing or a command is unavailable, resolve installation or upgrading within the user's authorized scope using the [official installation instructions](https://github.com/logbookfordevs/ai-field-kit#readme).

Establish the working directory, project or global scope, target harnesses, source, and selected items from the request and existing configuration. Ask about unresolved consequential choices; continue with choices the user already made.

## Mental model

| Layer | Meaning | Inspect |
| --- | --- | --- |
| Source | Versioned catalog and referenced content maintained by AFK, a team, or the user. | `afk show --source <source>` |
| Catalog | Local definitions of what can be installed and its policy. | `afk show`; `afk doctor` |
| Installation | Prepared rules, skill folders, tools, hooks, MCP configuration, and Custom Agents. | Skill inspection commands or the affected harness/tool configuration. |
| Availability | Whether a skill is active or in disabled storage, independently of auto/manual invocation. | `afk skills list --json`; repeat with `--disabled`. |
| Profile | A named skill set, with separate definition, activation, and context-loading operations. | `afk profiles catalog list --json`; `afk skills profiles status`. |

Changing one layer does not imply the others changed. Refresh fetches catalog definitions; setup applies selected definitions; profile `use` reads instructions without activating anything.

## Choose a workflow

Read the matching reference before operating. Read multiple references when the request crosses their boundaries.

| User outcome | Reference | Starting commands |
| --- | --- | --- |
| Prepare a harness, apply rules, install tools/MCPs/hooks/Custom Agents, or adopt a preset | [Setup](references/setup.md) | `afk show`; `afk setup <area> --help` |
| Build a team catalog, add/edit entries, change sources, or import existing skills | [Catalogs and sources](references/catalogs.md) | `afk sources list`; `afk skills catalog status` |
| Install a skill, change invocation, disable it, update it, or remove it | [Skill lifecycle](references/skills.md) | `afk skills list --json`; `afk skills show <id> --json` |
| Create a working set, load its instructions, activate it, or restore the previous set | [Profiles](references/profiles.md) | `afk profiles catalog show <id> --json`; `afk skills profiles status` |
| Refresh or sync a kit, repair drift, or diagnose a failed operation | [Maintenance](references/maintenance.md) | `afk doctor`; the failed command's `--help` |

## Execution contract

1. **Inspect:** identify the affected layer and current state. Use the smallest workflow that reaches the requested outcome.
2. **Preview:** use `--dry-run` where supported and inspect its affected items and destinations. Replace example IDs and sources with verified selections. Flags belong to individual commands; check help rather than carrying flags between families.
3. **Apply:** execute the authorized change yourself. Prefer explicit selections to interactive pickers. `--yes` accepts defaults or confirmations; it is not a selection mechanism. Use it after checking what will be selected. A preview is the endpoint only when the user requested a preview.
4. **Verify:** read back the affected state and run `doctor` for catalog edits. Report the changes, scope, evidence, and remaining failures. Catalog validity proves structure; installation success and external integration health need their own evidence.

Prefer the CLI for managed operations. Some catalog editors require an interactive terminal; when the host cannot drive them or a required field has no command, use the direct-edit workflow in [Catalogs and sources](references/catalogs.md).
