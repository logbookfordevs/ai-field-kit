# Settings and skill storage

AFK reads and writes one `settings.json`. Its default location is
`~/.afk/settings.json`. Set `AFK_SETTINGS` to override the location for a launch:

```sh
AFK_SETTINGS=/path/to/settings.json node packages/afk/dist/index.js
```

Changing location in Settings copies the configuration, canonical `AGENTS.md` and
supporting `references/` to the selected AFK folder and
stores a local pointer in `~/.afk/settings-location.json`. **Move current setup here**
works with existing folders: destination `settings.json`, `AGENTS.md` and
`references/` are retained in a `.afk-backup-<id>` folder before replacement.
Your current files win conflicts, preserving the current configuration identity
and its local activation. Reference files unique to either folder are kept.
**Load existing setup** instead uses the destination configuration without copying.
Other files stay untouched, and skills stay in their existing storage. A failed
move restores destination files.
The original AFK folder remains. The environment override takes
precedence over the pointer.

A folder synced by Drive or another provider can hold the file. That provider owns
sync; AFK does not sync skill files or project folders between machines.

The default `~/.afk` remains valid. A custom folder can have any name and contains
`settings.json`, optional `AGENTS.md` and supporting Markdown under `references/`.
Selecting an existing AFK folder loads its configuration without applying rules to
agent files. Disconnect managed rule destinations and turn packs off before
switching configurations so their ownership is not abandoned.

## Background runtime files

The background server keeps a machine-local record at
`~/.afk/background/server.json` and appends output to `~/.afk/background.log`.
The record contains its PID, loopback URL and session token, with private file
permissions. These files are separate from the selected AFK folder and its export.
Do not copy them to another machine. `afk status` verifies the recorded server;
`afk stop` requests shutdown only after verifying its identity. `afk restart`
uses the verified running server’s current port and settings path to launch its
replacement. It leaves foreground sessions alone and does not start an idle instance.

The server port is a launch option, not part of `settings.json`. Use
`afk --background --port 4310` for a fixed URL; omit `--port` for an available
port chosen at startup. A running instance on another port must be stopped first.

A background server uses the configuration selected at startup. To launch with a
different `AFK_SETTINGS` value, stop the current background instance first.

## What the file contains

- Version 2, configuration identity, the kit, and pack names/IDs, source references and selected members.
- The kit: `kit.core`, a list of `{source, name?, skills, follow?}` entries, one per original
  repository. These are the always-on skills, Global only. A skill appears in one Core source.
  `follow` asks AFK to offer new skills that repository adds; it never installs them.
- Packs, stored in the `profiles` array so existing IDs and activation state keep working.
  Optional `description`, `origin` (a direct HTTPS manifest URL used for explicit refresh) and
  `sourceNames` are display metadata and don't change a pack's definition.
- Project names and folder paths.
- Global tool entries. A tool may list `provides`, the skills it installs and updates; the kit then
  tracks the tool instead of each skill.
- Favorite source bookmarks, shown as Try later. A bookmark may carry an optional
  `description` you write (up to 280 characters). Its optional `skills`
  array stores selected names; omitting it means all skills. Empty, duplicate or
  wildcard selections are rejected rather than broadened.
  Repository folder paths shown by Find skills are discovery metadata and are
  not saved in the settings file.
- Rule destination definitions.
- Optional `welcomeDismissed`, remembering that you closed the first-access Welcome. Reopen it from About AFK.

The UI and headless AFK operations keep managed values and filesystem effects in
agreement. Agents may edit favorite sources, tool definitions, and inactive
project definitions while preserving managed fields. `afk settings schema`
describes the format; `afk settings validate [file]` checks a candidate without
importing it. `afk doctor --json` also inspects local consistency and never applies
repairs. See [agent workflows](agents.md) for the boundary.
Before each save replaces `settings.json`, AFK keeps the previous version in `~/.afk/backups/` (the last 20 distinct versions, on this machine only, never in a synced folder). `afk settings backups` lists them with their counts of packs, stacks, sources, projects and tools; `afk settings restore <name>` restores one and snapshots the current file first. A save is refused when the file on disk belongs to a different configuration, which is how a blank file can be prevented from replacing a real one; importing a configuration or an AFK folder replaces it deliberately. Copies named `pre-kit-*.json`, made when a version 1 file is first changed, are kept permanently outside the 20-file rotation and are listed and restored the same way.

Machine state lives in `~/.afk/local/<configurationId>.json`: pack activation and readiness, invocation preferences, individual activation, managed links, rule ownership receipts and the skills you marked as machine-only. It stays on this machine when the AFK folder travels. On another machine, pack definitions start off and unprepared, and `afk sync` installs the Core skills that are missing. Existing legacy settings are migrated only when local files establish ownership; migration is written on the next save.

Settings marks missing project folders and offers **Choose folder** or **Remove project**. AFK does not copy project files. Turn off active managed skills before changing or removing their project definition.
Paths, receipts, and prepared state describe local storage; exporting them does
not make them valid on another machine.

## Import and export

The web app offers AFK folder ZIP transfer first. Expand **Settings only · JSON**
for configuration-only transfer.

Export configuration downloads the current JSON file. The CLI also supports:

```sh
node packages/afk/dist/index.js settings export /path/to/export.json
```

The CLI refuses to overwrite an existing export. In the web app, import lets you
review project paths before replacing the configuration. Turn current packs off,
disable individual skills and resolve managed links first. Imported packs start off and unprepared; link receipts and individual
activation state are reset. Turn imported packs on explicitly, and run `afk sync` for Core.
A version 1 file imports with an empty Core; see [Move from stacks](kit.md#move-from-stacks).
Saved tool commands do not execute during import. Invocation preferences are stored,
but importing the file does not itself apply native metadata to skill files.

JSON import/export contains configuration only; existing local rules and destination
ownership are retained during JSON import. **Export AFK folder ZIP** includes saved
Markdown as well as portable settings. ZIP import validates files before replacing
them, backs up current content, reviews local destination mappings and resets
ownership. Turn packs off and disconnect managed rules before importing a bundle.
Import never writes agent files; review and sync intentionally afterward.

The [Agent rules specification](specs/agent-rules.md) explains managed regions,
reference paths, conflict recovery and disconnect behavior. Another machine's
synced configuration does not prove ownership of its destination files.

## Physical layout

New selected repository skills are copied once to:

```text
~/.agents/skills/.disabled/<skill>/
```

Global activation exposes them through links at:

```text
~/.agents/skills/<skill>
~/.claude/skills/<skill>
```

Project activation exposes shared copies through:

```text
<project>/.agents/skills/<skill>
<project>/.claude/skills/<skill>
```

An existing active skill can remain in its original location. Disabling an
individual physical skill moves it to that scope's disabled folder and retargets
AFK-owned links when needed. Turning a pack off removes only owned exposure;
other packs, individual activation and preexisting user files are preserved.

A project invocation override of a shared skill uses an isolated copy under
`<project>/.agents/skills/.afk-overrides/<skill>/`. Resetting it reconnects owned
links to the shared copy. Physical project-local skills use their own original
metadata rather than inheriting unrelated global copies.

Global skills can still be available to an agent working in a project. The project
inventory deliberately shows only that project's entries; it is not an effective
combined view and cannot suppress global discovery.

## Format version 2

Version 2 adds `kit` and removes `stacks` and `savedSkills`; a version 2 file that
contains either is rejected. Older AFK versions reject version 2 with an error, so
update every machine that shares a settings file.

A version 1 file without stacks upgrades silently the next time AFK saves it. A
version 1 file with stacks can be read, but every write is refused until you
migrate it with `afk migrate` or the app's **Move to your kit** screen. Migration
keeps a permanent copy of the old file; see [Move from stacks](kit.md#move-from-stacks).

Existing `favoriteSources` entries retain their format. Doctor validates pack manifests
without fetching origins or requiring their skills to be installed.
