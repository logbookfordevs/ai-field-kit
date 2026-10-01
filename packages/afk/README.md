# AFK — Fieldwork

A local web workspace for the skills and tools you use with coding agents.

This pivot is currently available from this checkout. The published package may
still expose the previous CLI until a new release is published.

```sh
pnpm afk:build
node packages/afk/dist/index.js
```

AFK opens a local web app. Its five sections are Profiles, Installed Skills,
Favorite skill sources, Tools, and Settings. Nothing is published online.
Use **Exit AFK** in the header to stop the local server. Exiting preserves saved
configuration and skill activation; the browser tab shows a closed screen.

## Profiles

Create a shared group from local skills or a repository. Skills CLI prepares
repository contents in a private temporary workspace; only selected members are
kept under `~/.agents/skills/.disabled/`. Existing skill availability is preserved.

Choose Global or a project beside a profile's activation button. Enabling adds
symlinks on that scope's `.agents/skills` and `.claude/skills` discovery paths.
Disabling removes AFK-owned exposure, preserving other profile owners and existing
user files. Stored instructions remain available for reading.

```sh
afk profiles use <profile-id>
afk profiles enable <profile-id> 'Project name'
afk profiles disable <profile-id> 'Project name'
```

Use the profile identifier shown in the app’s copied command; it is not necessarily
the display name. `use` prints every member's instructions and resource directory for an agent to
read. It does not enable skills, register a slash command, or inject another chat.

## Installed Skills

Inventory follows the selected scope's `.agents/skills` directory. Project views
exclude global-only entries. Inspect instructions, toggle individual availability,
and choose native invocation preferences. Manual and Automatic preferences write
Claude frontmatter and Codex's `agents/openai.yaml` policy. Project symlinks get
an isolated local copy when overridden, preserving the shared original.

The update control copies a Skills CLI command; it never executes an update.
Skills CLI owns update behavior and only updates installations it tracks.

## Favorite sources

Save repository bookmarks. Copy a link, an install command, or a sequential
install-all script. Choose a destination and agent when generating commands.
Adding and removing bookmarks do not install or uninstall skills.

## Tools

Tools are always global. Save a name, install command, and optional update command.
An empty update command reuses install. Run explicitly from your home folder and
inspect the exit status and output. Removing an entry does not uninstall the tool.

## Settings

One `settings.json` stores definitions and selected activation. Choose a location
in the app, including a folder synced by your own storage provider. AFK does not
provide a synchronization service. A small machine-local pointer remembers the
chosen settings location.

Add projects through folder browsing. Import reviews local folder mappings and
leaves profiles inactive until explicitly prepared and enabled. Saved tool commands
never run during import. Export downloads the configuration.

```sh
AFK_SETTINGS=/path/to/settings.json afk
afk ui --no-open
afk settings export /path/to/export.json
```

Old setup/catalog/rules/hooks/MCP/custom-agent orchestration commands are outside
this CLI's scope. Previous behavior remains in released changelog entries and Git history; existing
user files are not automatically migrated or removed.

## More documentation

- [Settings and physical storage](../../docs/settings.md)
- [Development and release boundaries](../../docs/development.md)
- [Product specification](../../docs/specs/afk-pivot.md)

## Development

From the repository root:

```sh
pnpm afk:build
node packages/afk/dist/index.js ui --no-open
pnpm afk:typecheck
pnpm afk:test
```

The server binds loopback and requires a per-session token for local APIs.
