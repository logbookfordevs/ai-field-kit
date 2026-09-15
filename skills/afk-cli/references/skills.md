# Skill lifecycle

## Inspect both storage states

```bash
afk skills list --json
afk skills list --disabled --json
afk skills show <id> --json
afk skills catalog status
```

Default inspection sees enabled shared global skills. For a harness-specific project library, use supported selectors such as `--scope project --agent codex`. Custom roots use `--agent custom --agent-path <path>` on supported inspection/mutation commands.

## Install and register

```bash
afk skills add <owner/repo> --skill <id> --yes
```

`add` delegates to the skills installer, always includes the shared global target, and imports new shared entries into AFK's catalog. It is not a project-only install command. For project installation, inspect `afk setup skills --help` and select project scope and source.

For a newly imported skill intended only for a working set:

```bash
afk skills add <owner/repo> --skill <id> --profile-only <profile> --yes
```

This associates it with the profile and disabled storage. `--profile <profile>` associates without requesting profile-only storage; `--start-disabled` requests disabled storage without a profile. Inspect the resulting catalog and storage state, especially for previously installed entries.

## Change availability or discovery

| User intent | Operation | Effect |
| --- | --- | --- |
| Keep installed but stop ordinary discovery | `afk skills disable <id>` | Moves the folder into `.disabled`. |
| Restore availability | `afk skills enable <id>` | Moves it back to active storage. |
| Require explicit invocation | `afk skills invocation disable <id>` | Changes invocation policy; does not disable storage. |
| Allow automatic invocation | `afk skills invocation enable <id>` | Changes invocation policy; availability remains separate. |
| Read instructions for this task | `afk skills get <id>` | Prints local content, including disabled skills, without moving folders. |

Preview mutations with `--dry-run`. Bare `afk skills invocation` opens a batch editor; explicit subcommands avoid that picker. Read requested instructions returned by `get` and apply them when context loading is the task.

## Update or remove

`afk skills update <id> --dry-run` previews an update using installed lock provenance. Remove the preview flag to execute; `--all` selects all cataloged tracked skills in scope. `--enabled` and `--disabled` narrow storage state. For a catalog source migration or preset-wide maintenance, use [Maintenance](maintenance.md).

`afk skills delete <id> --dry-run` previews permanent folder deletion; use `--yes` after establishing that deletion is requested. Disabling is the reversible availability change. Removing a catalog entry and deleting its installed folders are different operations; check profile memberships before deleting shared content.

Complete by inspecting the requested storage and invocation state, catalog registration, and update/delete results.
