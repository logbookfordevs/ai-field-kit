# AI Field Kit — AFK 2.0

> **Welcome to AFK 2.0.** This is the new, focused AFK. Want the previous setup,
> catalog, layered rules, hooks, or custom-agent behavior? Install a version before 2.0,
> or fork its tagged source from the [pre-2.0 releases](https://github.com/logbookfordevs/ai-field-kit/releases).

AFK is a local web workspace for the skills and tools you use with coding agents.
Keep reusable skill profiles ready, enable them globally or for a project, and
read a whole profile on demand without enabling it.

The new app is implemented in this checkout. It is not yet a published release;
the published package and website still describe the previous CLI.

## Run the local build

Requires Node.js 20 or newer and the repository's configured pnpm version.

```sh
pnpm install
pnpm afk:build
node packages/afk/dist/index.js
```

AFK opens a browser on a loopback address. Use **Exit AFK** in the header or
Ctrl+C in the terminal to stop it. Exiting preserves your configuration and
skill activation.

## What you can manage

| Section | Purpose | Scope |
| --- | --- | --- |
| Profiles | Prepare selected skills once, enable a group, or read its instructions | Shared definitions; activation per target |
| Installed Skills | Inspect local files, toggle availability, set invocation preferences | Global or a selected project |
| Favorite skill sources | Save repository bookmarks and copy install commands | Shared bookmarks; copied commands choose a destination |
| Tools | Save and explicitly run install/update commands | Always global |
| Agent rules | Edit shared rules and references, preview and sync managed regions | Shared document; explicit destination files |
| Settings | Choose the AFK folder, import/export, define project folders | One configuration |

Profiles prepare repository skills through Skills CLI in a private temporary
workspace. Newly selected copies stay disabled under your home agents directory.
Activation creates links in the selected discovery paths; disabling removes only
AFK-owned exposure. Existing files and skills needed by another profile are preserved.

**Use with your agent** shows instructions and a copyable command. AFK prints
the group's instructions for the calling agent to read; it does not inject another
chat or register a slash command.

Favorite sources and skill updates are copy-only. Tools run saved commands only
when you choose Install or Update. Removing a tool entry does not uninstall it.

## Manage AFK through your agent

The [afk-cli skill](skills/afk-cli/SKILL.md) gives agents the same management
capabilities as the app. It ships with AFK: run `afk guide` and have your agent read
the returned `SKILL.md` path. A separate skill installation is optional.
Edit simple definitions with schema guidance, run
`afk doctor --json` to check local consistency, and use headless AFK operations
for changes to skill files, activation links, and managed rule regions.
The [agent guide](docs/agents.md) explains installation and workflows.

## Documentation

- [App guide and CLI reference](packages/afk/README.md)
- [Managing AFK with an agent](docs/agents.md)
- [Settings, storage, and import/export](docs/settings.md)
- [Agent rules and conflict handling](docs/specs/agent-rules.md)
- [Development and verification](docs/development.md)
- [Product specification](docs/specs/afk-pivot.md)
- [Domain glossary](CONTEXT.md)
- [Changelog](CHANGELOG.md)

AFK no longer manages catalogs, conditional rule layers, hooks, MCP configuration, custom agents,
setup presets, or general installation orchestration. Existing user files are not
automatically migrated or removed. Historical releases remain documented in the
changelog and Git history.

## Repository

- `packages/afk/src/fieldwork/`: CLI, settings, local APIs, skill preparation and activation.
- `packages/afk/web/`: local app and its scoped design system.
- `skills/afk-cli/`: agent management workflow and on-demand references.
- `docs/`: current guides, decisions, specifications, and approved design references.
- `apps/site/`: existing website, pending a separate update for this pivot.
- `scripts/`: build, installation, and release support.

The live website is [ai-field-kit.logbookfordevs.com](https://ai-field-kit.logbookfordevs.com/).
Its current setup instructions are historical until the website rollout is completed.

AFK is a tool from [Logbook for Devs](https://logbookfordevs.com/).
