# Manage AFK with an agent

The `afk-cli` skill lets your agent manage the same local skills, profiles,
favorites, tools, Agent rules, and settings as the web app. AFK bundles the skill
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

Read the actual `name`, profile `id`, project name, and destination IDs from
state. A saved project name is a scope; `Global` is the default for the focused
profile/skill commands.

## Edit simple definitions

Agents can edit favorite sources, tool definitions, and inactive project
definitions in settings. Preserve profiles, invocation preferences, managed
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

## Prepare, activate, or read a profile

Ask your agent to discover a source and save a profile with selected skill names.
The `discover` and `profile/save` operations handle source inspection and local
preparation. Saving does not activate the profile. Disable all targets before
editing or removing an existing definition.

```sh
afk profiles enable "My profile" Global
afk profiles disable "My profile" Global
afk profiles use "My profile"
```

Use the profile name, matched without case sensitivity, or its ID. Quote names containing spaces. Duplicate names require an ID. With the `afk-cli` skill installed, `/afk-cli use profile "My profile"` asks the agent to read the same group. Enabling exposes prepared skills through
owned links; disabling withdraws those links while preserving other owners and
existing files. `use` prints locally prepared member instructions, including
disabled members. The calling agent must read that output; the command leaves
availability unchanged. Invocation policy is a separate `invocation` operation.

Favorite sources are bookmarks. Adding a favorite does not prepare or install
skills. Tool definitions also stay passive until an authorized `tool/run`:

```sh
afk manage tool/run --input - <<'JSON'
{"id":123,"update":true}
JSON
```

Read the saved command and replace `123` with the actual tool ID. An empty update
command reuses install. Inspect output and exit status to verify execution.
Use `source/install` or `stack/install` for authorized installation, and inspect
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

Use `rules/state` to locate the canonical AFK folder. Edit its `AGENTS.md` and
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

## Transfer or change the AFK folder

Use `workspace`/`location` for folder selection or moves; direct file moves do
not maintain AFK's local pointer. `settings export` and `import` transfer settings
only. `bundle/export`, `bundle/preview`, and `bundle/import` transfer the portable
folder with saved rules and references.

Review local project/destination mappings before import. Disable active profiles
and individual skills and resolve managed links first. ZIP import also requires
disconnecting managed rule destinations before replacing their ownership. Imported
configuration does not install skills, execute tools, or sync rules. Prepare,
activate, and preview/sync the requested effects separately on the receiving
machine. A storage provider can transport the folder; AFK does not reconcile
concurrent edits or apply another machine's ownership automatically.
