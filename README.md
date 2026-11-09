![AFK 2.0 — a paper field notebook for your skill kit, tools and shared rules](docs/assets/afk-readme-hero-v2.webp)

# AI Field Kit — AFK 2.0

> **Welcome to AFK 2.0.** This is the new, focused AFK. Want the previous setup,
> catalog, layered rules, hooks, or custom-agent behavior? Install a version before 2.0,
> or fork its tagged source from the [pre-2.0 releases](https://github.com/logbookfordevs/ai-field-kit/releases).

AFK is a local web workspace for the skills and tools you use with coding agents.
Keep a kit of skills that travels with you across machines, group the occasional
ones into packs, turn a pack on globally or for a project, and read a whole pack
on demand without turning it on.

AFK 2.0 is released. Unreleased changes in this checkout are listed under
**Next Release** in the [changelog](CHANGELOG.md).

## Run the local build

Requires Node.js 20 or newer and the repository's configured pnpm version.

```sh
pnpm install
pnpm afk:build
node packages/afk/dist/index.js
```

AFK opens a browser on a loopback address. Use **Exit AFK** below the navigation (under **More** on phones) or
Ctrl+C in the terminal to stop it. Exiting preserves your configuration and
skill activation.

## What you can manage

| Section | Purpose | Scope |
| --- | --- | --- |
| Overview | What needs you, whether you're backed up, and quick actions: find a skill or add something new | Your setup |
| Skills | One searchable list of every skill, filtered by where it comes from; turn skills on or off, choose how agents invoke them, edit, update, move and delete | Global, or a selected project's own skills |
| Packs | Turn a pack on or off, see and edit its members, import or create one | Global |
| Sources | Install from a repository or a zip, `.skill` file or folder; Try later bookmarks; followed repositories | Global |
| Agent rules | Edit shared rules and references, preview and sync managed regions | Shared document; explicit destination files |
| Tools | Save and explicitly run install/update commands | Always global |
| Backup | Save your library to a private Git repository, go back to an earlier save, review edits made outside AFK | Your library |
| Settings | Your library, projects, agent folders and automatic updates | This machine |

Your skills, packs, tools, bookmarks, invocation choices and agent rules live in a
**library**: a Git repository at `~/.afk/library` where every change is one save.
Start one from the app (**Start a new library**) or with `afk library init --apply`.
**Backup** sends it to a private GitHub repository or any Git remote once a day at
22:00 (or whenever you click **Back up now**), and **Restore my library** (or `afk library connect owner/repo`) brings it
back on a new machine. See the [library guide](docs/kit.md).

Every skill appears once in **Skills**, labelled with where it comes from: **Core** (saved
in full in your library, on every machine), a **pack** (a named group you turn on when
needed, in **Packs**), **this machine** only, or a **tool**. Skills installed outside AFK
show up on **Overview** under **Needs you** and as the *To review* filter in Skills, so you
can decide where they belong. **Try later** bookmarks live in **Sources**.

Install with **Add something new** (Overview or Sources) or `afk add <repository>`, which asks
whether a skill belongs in Core, a pack, on this machine only or under Try later. You can
also upload a zip, a `.skill` file or a folder.

Packs prepare repository skills through Skills CLI in a private temporary
workspace and keep them in AFK's pack storage. Turning a pack on links them into your
agent folders; turning it off
removes only AFK-owned exposure. Existing files and skills needed by another pack are preserved.
A pack that is on can be edited without turning it off.

**Read once** shows a pack's instructions and a copyable command. AFK prints
the instructions for the calling agent to read; it does not inject another
chat or register a slash command.

Skill updates preserve on/off state and invocation choices. Skills that a tool
installs are labeled and update through the tool. Tools run saved commands
only when you choose Install or Update, individually or in a reviewed batch.
Removing a tool entry does not uninstall it.

Publishers can share a pack or Core with the [versioned manifest contract](docs/kit.md#share-a-pack-with-a-manifest)
and [example](docs/examples/skill-stack.v1.json). Import pasted JSON or a direct HTTPS
manifest URL, review it, then save it as a pack.

> **Breaking change:** settings are now version 2. Older AFK versions reject them, so
> update AFK on every machine that shares a settings file. Files that still hold
> stacks are not written until you run `afk migrate` or use the app's
> **Move to your kit** screen. See [Move to the kit](docs/kit.md#move-from-stacks).

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
- [The kit: Core, packs and sync](docs/kit.md)
- [Settings, storage, and import/export](docs/settings.md)
- [Agent rules and conflict handling](docs/specs/agent-rules.md)
- [Development and verification](docs/development.md)
- [Product specification](docs/specs/afk-pivot.md)
- [Domain glossary](CONTEXT.md)
- [Changelog](CHANGELOG.md)

AFK no longer manages catalogs, conditional rule layers, hooks, MCP configuration, custom agents,
setup presets, or general agent-environment provisioning. Existing user files are not
automatically migrated or removed. Historical releases remain documented in the
changelog and Git history.

## Repository

- `packages/afk/src/fieldwork/`: CLI, settings, local APIs, skill preparation and activation.
- `packages/afk/app/`: local app (React) and its scoped design system; `pnpm afk:build` builds it into `packages/afk/web/`.
- `skills/afk-cli/`: agent management workflow and on-demand references.
- `docs/`: current guides, decisions, specifications, and approved design references.
- `apps/site/`: public website and documentation.
- `scripts/`: build, installation, and release support.

The live website is [ai-field-kit.logbookfordevs.com](https://ai-field-kit.logbookfordevs.com/).

AFK is a tool from [Logbook for Devs](https://logbookfordevs.com/).

## Update skills

Use **Update all** on the Skills page, or `afk skills update -g` /
`afk skills update -p <project>`, to update tracked skills while preserving
availability and AFK invocation preferences.

## Update AFK itself

Run `afk update` to rerun the hosted release installer and install the latest AFK
release. `afk update --dry-run` prints the command without running it. This is
separate from updating installed skills and works without reading AFK settings.

## Start, stop and status

```sh
afk            # same as afk start
afk start
afk status
afk restart
afk stop
```

`afk` and `afk start` run AFK in the background and open it in your browser. If it
is already running, they open the running app instead of starting another. Add
`--no-open` to start without opening a browser. Status shows the URL, process ID,
resident memory (RSS) and log location. Stop gracefully closes the background
instance. Runtime records and logs stay under `~/.afk/`, separate from your library.
**Exit AFK** can close the background server from the app; closing the browser tab
leaves it running. `afk restart` uses the running server's current port and settings
path, even if your terminal's `AFK_SETTINGS` changed. To switch via `AFK_SETTINGS`,
stop and start explicitly.

`afk --foreground` runs AFK attached to the terminal instead; Ctrl+C or **Exit AFK**
closes it. `afk --background` still works for scripts: it starts in the background
without opening a browser.

### Choose a fixed port

```sh
afk start --port 4310
afk --foreground --port 4310
```

With `--port`, the app uses `http://127.0.0.1:4310`. Without it, AFK picks an
available port. Ports must be integers from 1 to 65535; an occupied port causes
an error rather than a fallback. Browser-blocked ports such as 6666 are rejected
before starting; choose a web port such as 4310 or 8080. If the background instance already uses another
port, run `afk stop` before starting with your chosen port. The port is a launch
option, not a saved setting.

`afk status` reports the server’s current resident RAM in MiB, including Node.js
and native allocations. It excludes the browser tab and child tool processes.
Older running servers show memory as unavailable until restarted after updating.
`afk restart` is included in the next release; use a source build until published.
