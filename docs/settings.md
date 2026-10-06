# Settings and skill storage

AFK reads and writes one `settings.json`. Its default location is
`~/.afk/settings.json`. Set `AFK_SETTINGS` to override the location for a launch:

```sh
AFK_SETTINGS=/path/to/settings.json node packages/afk/dist/index.js
```

Changing location in Settings copies the configuration, canonical `AGENTS.md` and
supporting `references/` to the selected AFK folder and
stores a local pointer in `~/.afk/settings-location.json`. It refuses to overwrite
an existing destination. The old file remains. The environment override takes
precedence over the pointer.

A folder synced by Drive or another provider can hold the file. That provider owns
sync; AFK does not sync skill files or project folders between machines.

The default `~/.afk` remains valid. A custom folder can have any name and contains
`settings.json`, optional `AGENTS.md` and supporting Markdown under `references/`.
Selecting an existing AFK folder loads its configuration without applying rules to
agent files. Disconnect managed rule destinations and disable profiles before
switching configurations so their ownership is not abandoned.

## What the file contains

- Version 1, profile names/IDs, source references, selected members and enabled targets.
- Project names and folder paths.
- Global tool entries and favorite source bookmarks. A bookmark’s optional `skills`
  array stores selected names; omitting it means all skills. Empty, duplicate or
  wildcard selections are rejected rather than broadened.
  Repository folder paths shown by Find skills are discovery metadata and are
  not saved in the settings file.
- Invocation preferences, individual activation state and managed-link receipts.
- Rule destination definitions and local receipts for managed regions/reference copies.
- Optional `welcomeDismissed`, remembering that you closed the first-access Welcome. Reopen it from About AFK.

The UI and headless AFK operations keep managed values and filesystem effects in
agreement. Agents may edit favorite sources, tool definitions, and inactive
project definitions while preserving managed fields. `afk settings schema`
describes the format; `afk settings validate [file]` checks a candidate without
importing it. `afk doctor --json` also inspects local consistency and never applies
repairs. See [agent workflows](agents.md) for the boundary.
Editing activation arrays directly does not create or remove discovery links.
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
review project paths before replacing the configuration. Disable current profiles
and individual skills and resolve managed links first. Imported profiles start inactive and unprepared; link receipts and individual
activation state are reset. Prepare and enable imported profiles explicitly.
Saved tool commands do not execute during import. Invocation preferences are stored,
but importing the file does not itself apply native metadata to skill files.

JSON import/export contains configuration only; existing local rules and destination
ownership are retained during JSON import. **Export AFK folder ZIP** includes saved
Markdown as well as portable settings. ZIP import validates files before replacing
them, backs up current content, reviews local destination mappings and resets
ownership. Disable profiles and disconnect managed rules before importing a bundle.
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
AFK-owned links when needed. Disabling a profile removes only owned exposure;
other profiles, individual activation and preexisting user files are preserved.

A project invocation override of a shared skill uses an isolated copy under
`<project>/.agents/skills/.afk-overrides/<skill>/`. Resetting it reconnects owned
links to the shared copy. Physical project-local skills use their own original
metadata rather than inheriting unrelated global copies.

Global skills can still be available to an agent working in a project. The project
inventory deliberately shows only that project's entries; it is not an effective
combined view and cannot suppress global discovery.

## Sources and stacks

Existing `favoriteSources` entries retain their format. An optional `stacks` array
holds `{manifest, origin?}` entries using the [version 1 stack contract](skill-stacks.md).
The manifest ID is unique within stacks; origin is a direct HTTPS JSON URL used
only for explicit refresh. These are portable definitions, separate from profile
activation and local skill ownership. Settings/ZIP export and import include them.
Doctor validates manifests without fetching origins or requiring their skills to
be installed. Use stack preview/save operations for reviewed remote replacements.
