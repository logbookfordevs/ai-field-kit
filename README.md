# AI Field Kit

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
| Settings | Choose the settings file, import/export, define project folders | One configuration |

Profiles prepare repository skills through Skills CLI in a private temporary
workspace. Newly selected copies stay disabled under your home agents directory.
Activation creates links in the selected discovery paths; disabling removes only
AFK-owned exposure. Existing files and skills needed by another profile are preserved.

**Use with your agent** shows instructions and a copyable command. AFK prints
the group's instructions for the calling agent to read; it does not inject another
chat or register a slash command.

Favorite sources and skill updates are copy-only. Tools run saved commands only
when you choose Install or Update. Removing a tool entry does not uninstall it.

## Documentation

- [App guide and CLI reference](packages/afk/README.md)
- [Settings, storage, and import/export](docs/settings.md)
- [Development and verification](docs/development.md)
- [Product specification](docs/specs/afk-pivot.md)
- [Domain glossary](CONTEXT.md)
- [Changelog](CHANGELOG.md)

AFK no longer manages catalogs, rules, hooks, MCP configuration, custom agents,
setup presets, or general installation orchestration. Existing user files are not
automatically migrated or removed. Historical releases remain documented in the
changelog and Git history.

## Repository

- `packages/afk/src/fieldwork/`: CLI, settings, local APIs, skill preparation and activation.
- `packages/afk/web/`: local app and its scoped design system.
- `docs/`: current guides, decisions, specifications, and approved design references.
- `apps/site/`: existing website, pending a separate update for this pivot.
- `scripts/`: build, installation, and release support.

The live website is [ai-field-kit.logbookfordevs.com](https://ai-field-kit.logbookfordevs.com/).
Its current setup instructions are historical until the website rollout is completed.

AFK is a tool from [Logbook for Devs](https://logbookfordevs.com/).
