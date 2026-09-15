# Catalogs and sources

## Choose ownership before editing

- Team-wide, durable policy belongs in the source repository.
- Machine-specific definitions live in `~/.agents/afk/catalog`.
- Project-owned catalog files live in `./afk/catalog`, selected with `--local` on catalog commands.

Editing a cache does not publish upstream. Installed files are a separate layer; apply setup only if installation is also requested.

## Inspect, import, or edit

```bash
afk show skills profiles
afk skills catalog status
afk skills catalog import --dry-run
afk skills catalog import
```

Import backfills entries for already-installed skills only when their original source can be recovered from the skills CLI lock metadata. It is different from installing a repository with `afk skills add`.

Use `afk <area> catalog --help` for the appropriate editor: skills, rules, agents, mcps, tools, hooks, or profiles. Skill editors include defaults, invocation policy, and bulk policy changes. Profile-specific editing is covered in [Profiles](profiles.md).

### Direct edits

When the editor is interactive-only in an unattended host or a field lacks a command:

1. Read the target file and its existing version. Use the [catalog schemas and examples](https://github.com/logbookfordevs/ai-field-kit/blob/main/packages/afk/README.md#catalog-examples) for the affected manifest; in an AFK checkout, read its parser when a behavior is unclear.
2. Preserve unrelated entries and fields. Resolve actual IDs, sources, and relative-path ownership before editing. Profile catalog members and skill compositions must reference existing skill IDs.
3. Validate with `afk doctor` or `afk doctor --local`, then inspect with `afk show <area>` using the same scope.
4. Apply the relevant setup/runtime command only if the user requested the resulting installation or activation.

`skills.json` separates `default` (setup selection), `invocation` (auto/manual/source policy), and `startDisabled` (storage policy). `source` plus installer `args` identify what to fetch. Keep these choices distinct.

## Create a shareable catalog

From the intended repository root:

```bash
afk refresh --local --empty --dry-run
afk refresh --local --empty
```

Inspect existing files before empty initialization. Author only the required entries and referenced content; keep unused manifests empty. Validate with `afk doctor --local`, inspect through `afk show --source ./afk/catalog`, then preview setup from that source. Publish only when requested.

GitHub repository sources discover `afk/catalog` or `packages/afk/catalog`; a tree URL can select another directory. Rule layers and Custom Agent paths are relative to the source repository, while a skill's install source identifies its upstream repository.

## Source operations have different effects

| Intent | Command |
| --- | --- |
| Inspect another source without changing the cache | `afk show --source <source>` |
| Save a favorite shortcut | `afk sources add <source>` |
| List default and favorite sources | `afk sources list` |
| Refresh once from another source | `afk refresh --source <source>` |
| Adopt and refresh a continuing default | `afk refresh --default-source <source>` |
| Refresh only one category | `afk refresh skills --source <source>` |

Favorites neither validate a source nor make it the default. AFK remembers one default, not one per category. `--ref` selects a catalog revision; it does not pin all referenced installers.

Normal refresh prioritizes incoming entries with matching IDs. Imported skills absent upstream, local-only profiles/agents, and absent version 2 rule layers have preservation rules; MCP, tool, hook, and preset content is replaced. Inspect local edits first. `--override` intentionally replaces targeted catalogs and discards local-only entries; use it only for that requested outcome.
