# Manage AFK with an agent

The `afk-cli` skill lets your agent manage the same library, backup, skills, packs,
sources, tools, agent folders, projects, Agent rules and settings as the web app. AFK bundles the skill
and its workflow references. Run `afk guide` to get the absolute `SKILL.md` path,
then have your agent read that file. This works without installing the skill into
the agent's skill directory; `afk --help` includes this instruction.

The canonical source is [skills/afk-cli](../skills/afk-cli/SKILL.md). An optional
installation makes the skill discoverable through your agent's skill system.
For a local skill checkout:

```sh
npx skills add ./ --skill afk-cli
```

Or install from the upstream repository:

```sh
npx skills add logbookfordevs/ai-field-kit --skill afk-cli
```

An optional skill installation does not install the AFK executable. Check
`afk --help` and `afk manage --help` in your installed version before using these commands.
From this checkout, build with `pnpm afk:build` and substitute
`node packages/afk/dist/index.js` for `afk`.

## Inspect and choose a change

```sh
afk guide
afk settings path
afk settings show
afk settings schema
afk manage state
afk manage --help
afk manage describe
afk doctor --json
```

`manage` runs headlessly and prints JSON. It uses the same operations as the web
app without starting a browser or web service. The catalog describes payloads;
inspect a selected payload with `afk manage describe <operation>`. Commands take
an object from a JSON file or standard input. For example, inspect
a skill with a literal payload:

```sh
afk manage skill/read --input - <<'JSON'
{"name":"afk-cli","scope":"Global"}
JSON
```

Read the actual `name`, pack `id`, project name, and destination IDs from
state. A saved project name is a scope; `Global` is the default for the focused
pack/skill commands.

## Edit simple definitions

Agents can edit favorite sources, tool definitions (including `provides`), the
`kit`, and inactive project definitions in settings. Preserve packs, invocation preferences, managed
links, independent availability, and Agent-rules ownership records. Use AFK
operations for their physical effects.

Work on a candidate JSON file, then validate it before replacing the resolved
settings file:

```sh
afk settings show > /tmp/afk-settings-candidate.json
# Edit only the requested definitions in the candidate.
afk settings validate /tmp/afk-settings-candidate.json
```

Check that the source file still matches what you read before replacing it.
`settings show` supplies defaults if the file is absent; `settings schema` is
guidance, while `settings validate` uses AFK's runtime validator. Validation
checks JSON structure only. Follow a settings edit with `afk doctor --json` and
read back the affected definitions. Doctor reports schema and local drift and
does not repair anything automatically.

For project rename/folder changes, prefer the operation that maintains associated
state. Supply a file created by your JSON editor or serializer:

```sh
afk manage project/save --input /tmp/afk-project.json
```

For example, that file can contain
`{"name":"Workbench","path":"/absolute/path/to/project"}`. Editing an existing
project also supplies its current name as `previous`.

## Use the kit

Run `afk kit` to compare Core with this machine, or `kit/state` for the same data as
JSON. Add and drop skills with `afk kit add` and `afk kit drop`, or `kit/add` and
`kit/drop`. These change Core, not the installed files. A Core skill missing here
installs with `kit/install` (`to: "core"`) from its source. Use
`afk manage describe kit/add` for the payload.

If a write fails with a message that settings use the old stacks format, run
`afk migrate`. It is a dry run and writes nothing. Show the report, let the user choose
which stack becomes Core (`--core <stack-id>`), and add `--apply` only after they approve.
See [Move from stacks](kit.md#move-from-stacks).

## Prepare, turn on, or read a pack

Ask your agent to discover a source and save a pack with selected skill names.
The `discover` and `pack/save` operations handle source inspection and the
pack definition. Skills download when the pack is first turned on, or at save
time with `prepare: true`. Saving does not turn the pack on. A pack that is on can be edited;
turn it off everywhere before removing it.

```sh
afk packs enable "My pack" Global
afk packs disable "My pack" Global
afk packs use "My pack"
```

Use the pack name, matched without case sensitivity, or its ID. Quote names containing spaces. Duplicate names require an ID. `afk profiles` works as an alias. With the `afk-cli` skill installed, `/afk-cli use pack "My pack"` asks the agent to read the same group. Turning on exposes prepared skills through
owned links; turning off withdraws those links while preserving other owners and
existing files. `use` prints locally prepared member instructions, including
disabled members. The calling agent must read that output; the command leaves
availability unchanged. Invocation policy is a separate `invocation` operation.

Use `pack/manifest` to turn a pack (or `core`) into a publishable manifest, and
`pack/import-preview` then `pack/import` to save a reviewed manifest as a pack.

Favorite sources are bookmarks. Adding a favorite does not prepare or install
skills. Tool definitions also stay passive until an authorized `tool/run`:

```sh
afk manage tool/run --input - <<'JSON'
{"id":123,"update":true}
JSON
```

Read the saved command and replace `123` with the actual tool ID. An empty update
command reuses install. Inspect output and exit status to verify execution.
Use `kit/install`, `kit/upload-install` or `source/install` for authorized installation, and inspect
`skills/install-state` for progress and results. `skills/install-cancel` stops
remaining installation work while keeping completed or partial files.
Use `afk skills update [name] -g` or `afk skills update [name] -p <project>` for
protected updates, or the shared `skills/update` operation. AFK delegates to
Skills CLI in isolation and preserves availability and invocation preferences;
`skills/update-state` and `skills/update-cancel` expose progress and cancellation.
Direct Skills CLI updates bypass this availability protection.

Headless results are JSON; operation failures print JSON to stderr and exit
nonzero. `tool/run` also exits nonzero when the saved command fails, while keeping
its output and original exit code in the result. Doctor exits nonzero for errors;
its warnings still need review. A valid schema is not a claim that a live agent
has loaded the files.

## Save rules, then preview and sync

Use `rules/state` to locate the canonical rules folder (`rules/` in the library). Edit its `AGENTS.md` and
Markdown under `references/`, or use `rules/save`. Save alone leaves agent
destination files unchanged. Configure destinations through `rules/destination`.

Preview selected IDs and keep the returned JSON for the applying command:

```sh
afk manage rules/preview --input - > /tmp/afk-rules-preview.json <<'JSON'
{"ids":["codex"]}
JSON
```

Replace `codex` with the chosen saved destination ID and inspect the preview.
Construct the applying payload with a JSON serializer so content stays data:

```sh
node --input-type=module - <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
const preview = JSON.parse(readFileSync('/tmp/afk-rules-preview.json', 'utf8'));
const ids = preview.targets.map(target => target.id);
writeFileSync('/tmp/afk-rules-sync.json', JSON.stringify({ ids, preview }), { mode: 0o600 });
JS
afk manage rules/sync --input /tmp/afk-rules-sync.json
afk manage rules/state
afk doctor --json
```

Sync rechecks the canonical files and destinations against the reviewed snapshot.
If they changed, preview again. AFK owns only its marked region and copied
references; surrounding user content remains intact. Inspect the destination
files after applying. Running agents may require a reload or a new conversation
to discover the changes.

If a target has edited managed content, your agent should show the conflict for
your deliberate adopt/overwrite choice. `rules/adopt` returns a draft for review
and saving; `rules/overwrite` requires the reviewed region and preview. Neither
choice should be inferred from a request to sync. Disconnect can remove owned
content or leave files while forgetting management.

## Library, backup and restore

`backup/state` reports whether a library exists, its remote, saves waiting to be
pushed, history and Needs attention items. With no library, `library/init-preview`
shows what starting one would move, and `library/init` applies that exact preview
(`{"expected": <preview>}`); the CLI equivalent is `afk library init [--apply]`, then
`afk library confirm` once the user has checked the result. `backup/connect` or
`backup/create` connect a remote, `backup/save` pushes now and `backup/restore` goes back
to an earlier save as a new one. On a machine with no library, `restore/inspect` then
`restore/start`, or `afk library connect <owner/repo | url>`, restore it; tools run only
when the user names them.

`agent-folders/state` lists the folders AFK links skills into; `agent-folders/enable`,
`disable`, `add` and `remove` change them as one library save. Projects manage their own
repository skills; `skills-sharing/*` links a project's Claude folder to its
`.agents/skills` and does not apply to Global.

Restore and backup move the library through Git. AFK does not reconcile two machines
editing the same library at once.
