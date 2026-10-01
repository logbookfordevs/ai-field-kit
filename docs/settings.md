# Settings and skill storage

AFK reads and writes one `settings.json`. Its default location is
`~/.afk/settings.json`. Set `AFK_SETTINGS` to override the location for a launch:

```sh
AFK_SETTINGS=/path/to/settings.json node packages/afk/dist/index.js
```

Changing location in Settings copies the configuration to the selected file and
stores a local pointer in `~/.afk/settings-location.json`. It refuses to overwrite
an existing destination. The old file remains. The environment override takes
precedence over the pointer.

A folder synced by Drive or another provider can hold the file. That provider owns
sync; AFK does not sync skill files or project folders between machines.

## What the file contains

- Version 1, profile names/IDs, source references, selected members and enabled targets.
- Project names and folder paths.
- Global tool entries and favorite source bookmarks.
- Invocation preferences, individual activation state and managed-link receipts.

Use the UI to change these values so settings and filesystem operations agree.
Editing activation arrays directly does not create or remove discovery links.
Paths, receipts, and prepared state describe local storage; exporting them does
not make them valid on another machine.

## Import and export

Export configuration downloads the current JSON file. The CLI also supports:

```sh
node packages/afk/dist/index.js settings export /path/to/export.json
```

The CLI refuses to overwrite an existing export. In the web app, import lets you
review project paths before replacing the configuration. Disable current profiles
first. Imported profiles start inactive and unprepared; link receipts and individual
activation state are reset. Prepare and enable imported profiles explicitly.
Saved tool commands do not execute during import. Invocation preferences are stored,
but importing the file does not itself apply native metadata to skill files.

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
