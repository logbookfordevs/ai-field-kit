# Settings and skill storage

AFK keeps what you want to back up in your library, and what belongs to this machine
in `~/.afk`. See [Your library and the Skills page](kit.md) for Backup and Restore.

## Before and after the library

Before you start a library, AFK reads and writes one `settings.json`, by default
`~/.afk/settings.json`. If you chose another location in an earlier version of AFK, such
as a Drive folder, AFK keeps loading it from there (the pointer is
`~/.afk/settings-location.json`), so you can still start a library from that setup. Set
`AFK_SETTINGS` to use a different file for one launch:

```sh
AFK_SETTINGS=/path/to/settings.json afk
```

Once a library exists, AFK reads and writes its settings there instead. The old
`settings.json` stays where it is and is no longer written.

## What the library holds

`~/.afk/library` is a Git repository. AFK makes one commit for each change.

```text
skills/<name>/            Core skills, saved in full
.afk/settings.json        version, Core, agent rule destinations, agent folders, Welcome
.afk/packs/<id>.json      pack definitions
.afk/tools/<id>.json      tool commands and the skills they provide
.afk/bookmarks/<slug>.json  Try later bookmarks
.afk/skills/<name>.json   each skill's source, revision and Manual/Automatic choice
rules/                    AGENTS.md and references/
```

Files named `.afk-*` are AFK's own bookkeeping and are not committed.

## What stays on this machine

- `~/.afk/local/<configurationId>.json`: pack activation, managed links, rule ownership,
  projects and the skills you keep on this machine only.
- `~/.afk/packs-cache/`: pack skills once downloaded.
- `~/.afk/machine/`: skills kept on this machine only.
- `~/.afk/off/`: tool skills you turned off.
- `~/.afk/library-backups/`: the original folders kept after starting a library, until
  `afk library confirm` deletes them.

Turning a skill off removes its links; its files stay in storage. Turning it on links it
again into every enabled agent folder.

## Agent folders

Settings lists the folders AFK links your skills into. `~/.agents/skills` is always on.
Claude Code (`~/.claude/skills`) is on by default; other agents AFK knows are listed
with a switch, detected ones first, and you can add a custom folder for any other agent.
Switching a folder on links every skill that is on, including skills a tool installed;
switching it off removes only AFK's links there. The list is saved in your library, so a
restore links the same folders. Each agent's row says, where known, whether it follows
Claude Code's or Codex's Manual/Automatic mechanism.

## Projects

Adding a project in Settings lets AFK manage the skills in that project's own repository:
install, update, delete and Manual/Automatic. Changes show up in the project's Git status.
Project skills are always on, packs stay Global, and nothing about a project is saved in
your library. A project's Claude folder can link to its `.agents/skills` folder from the
project's skill list.

Settings marks missing project folders and offers **Choose folder** or **Remove project**.
AFK never copies or deletes project files when you change a project definition.

## Background runtime files

The background server keeps a machine-local record at
`~/.afk/background/server.json` and appends output to `~/.afk/background.log`.
The record contains its PID, loopback URL and session token, with private file
permissions. Do not copy them to another machine. `afk status` verifies the recorded
server; `afk stop` requests shutdown only after verifying its identity. `afk restart`
uses the verified running server's current port and settings path to launch its
replacement. It leaves foreground sessions alone and does not start an idle instance.

The server port is a launch option, not a setting. Use `afk --background --port 4310`
for a fixed URL; omit `--port` for an available port chosen at startup. A running
instance on another port must be stopped first. A background server uses the
configuration selected at startup; stop it before launching with a different
`AFK_SETTINGS` value.

## Editing settings by hand or with an agent

The UI and headless AFK operations keep settings and files in agreement. Agents may
edit Try later bookmarks, tool definitions and inactive project definitions while
preserving managed fields. `afk settings show` prints the current settings,
`afk settings schema` describes the format, and `afk settings validate [file]` checks a
candidate without applying it. `afk settings export <file>` writes the current portable
settings to a new file. `afk doctor --json` inspects local consistency and never applies
repairs. See [agent workflows](agents.md) for the boundary.

A save is refused when the settings file on disk belongs to a different configuration,
so a blank file can't replace a real one.

The settings contain:

- Version 2, configuration identity and Core: `kit.core`, a list of
  `{source, name?, skills, follow?}` entries, one per repository. A skill appears in one
  Core source. `follow` asks AFK to offer new skills that repository adds; it never
  installs them.
- Packs, in the `profiles` array, with their skills and sources. Optional `description`,
  `origin` (a direct HTTPS manifest URL used for explicit refresh) and `sourceNames` are
  display metadata.
- Tools. A tool may list `provides`, the skills it installs and updates.
- Try later bookmarks (`favoriteSources`). A bookmark may carry a `description` (up to
  280 characters) and a `skills` selection; omitting it means all skills. Empty, duplicate
  or wildcard selections are rejected.
- Agent rule destinations, and the optional `welcomeDismissed`.

## Format version 2

Version 2 adds `kit` and removes `stacks` and `savedSkills`; a version 2 file that
contains either is rejected. Older AFK versions reject version 2, so update every machine
that still shares a settings file.

A version 1 file without stacks upgrades silently the next time AFK saves it. A version 1
file with stacks can be read, but every write is refused until you migrate it with
`afk migrate` or the app's **Move to your kit** screen. Migration keeps a permanent copy
of the old file; see [Move from stacks](kit.md#move-from-stacks).
