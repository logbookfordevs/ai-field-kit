# AFK 2.0 — Fieldwork

> **This checkout contains AFK 2.0.** For the previous AFK behavior, install a
> version before 2.0 or fork its tagged source from the
> [pre-2.0 releases](https://github.com/logbookfordevs/ai-field-kit/releases).

A local web workspace for the skills and tools you use with coding agents.

AFK 2.0 is released. Build this checkout to try changes listed under **Next Release**
in the [changelog](../../CHANGELOG.md) before they are published.

```sh
pnpm afk:build
node packages/afk/dist/index.js
```

AFK opens a local web app. Its five sections are Kit, Installed Skills,
Agent rules, Tools, and Settings. Nothing is published online.
Use **Exit AFK** in the header to stop the local server. Exiting preserves saved
configuration and skill activation; the browser tab shows a closed screen.

## Kit

The kit is the skills that travel with you, stored once in your settings file. Its tabs are
**This machine** (what differs here), **Core** (always-on skills grouped by repository),
**Packs** and **Try later**. See the [kit guide](../../docs/kit.md).

```sh
afk add <repository> [--skill <name>]... [--core | --pack <name> | --here | --later]
afk kit
afk kit add <skill>... [--pack <name>] [--source <repo>]
afk kit drop <skill> [--pack <name>]
afk kit keep <skill>
afk kit follow <repo>
afk kit check
afk sync [--agent <agent>] [--yes] [--run-tools]
```

`afk sync` shows its plan, installs missing Core skills through Skills CLI, and turns Core
skills back on. It never removes anything. A tool's saved install command runs only when
you approve it. A tool can list the skills it installs in `provides`; the kit tracks the
tool, and those skills update through the tool's own command.

Installed skills that aren't in your kit appear in This machine. Send each to Core, a
pack, or **This machine only**, or remove it. Skills without a repository source can't go to Core.

### Packs

Create a shared group from local skills or a repository. Skills CLI prepares
repository contents in a private temporary workspace; only selected members are
kept under `~/.agents/skills/.disabled/`. Existing skill availability is preserved.

Choose Global or a project beside a pack's button. Turning it on adds
symlinks on that scope's `.agents/skills` and `.claude/skills` discovery paths.
Turning it off removes AFK-owned exposure, preserving other pack owners and existing
user files. A pack that is on can be edited without turning it off. Stored
instructions remain available for reading.

```sh
afk packs use <pack-id>
afk packs enable <pack-id> 'Project name'
afk packs disable <pack-id> 'Project name'
```

`afk profiles` is an alias. Use the pack identifier shown in the app’s copied command; it is not necessarily
the display name. `use` prints every member's instructions and resource directory for an agent to
read. It does not turn skills on, register a slash command, or inject another chat.

### Move from stacks

> **Breaking:** settings are now version 2, which older AFK versions reject. Update AFK on
> every machine that shares a settings file.

A settings file that still has stacks can be read but not changed until you migrate. Run
`afk migrate` for a dry run, or use the app's **Move to your kit** screen. Choose the stack
that becomes Core with `--core <stack-id>`; the others become packs. Add `--apply` to write.
Your old file is kept permanently as `~/.afk/backups/pre-kit-*.json` and can be restored with
`afk settings restore`. Skill files are never moved. See the
[guide](../../docs/kit.md#move-from-stacks).

## Installed Skills

The list shows enabled skills by default; the availability filter can include disabled skills or show only those. Filter also by effective invocation, recorded source, pack
membership or name within the selected scope. **Clear filters** resets these
filters while retaining the scope. Bulk selections survive filtering.
Automatic discovery token estimates count available automatic skills separately
for Codex and Claude and follow only the Pack filter. Inspect offers an
on-demand estimate for full instructions or a supporting file. These are rough
text-length estimates, not tokenizer counts or billing.

Inventory follows the selected scope's `.agents/skills` directory. Project views
exclude global-only entries. Inspect instructions, toggle individual availability,
and choose native invocation preferences. Manual and Automatic preferences write
Claude frontmatter and Codex's `agents/openai.yaml` policy. Project symlinks get
an isolated local copy when overridden, preserving the shared original.

**Update skills**, or Update on one row, runs the protected Skills CLI workflow:
updates are staged in isolation and preserve availability and invocation settings.
Progress, output and cancellation are available in the dialog.
`afk skills update [name] -g` or `afk skills update [name] -p <project>` uses the same
workflow. Only installations tracked by Skills CLI can update. Skills a tool provides update
through the tool.

**Automatic skill updates** in Settings runs that same update for Global skills daily or
weekly at a local time you choose. It runs only while AFK is open; a run missed while AFK was
closed happens shortly after it starts. The schedule is stored per machine in
`~/.afk/skill-update-schedule.json`, with the last automatic result and its output.

Select skills for bulk enable, disable, invocation or deletion. Deletion reviews
stored files and links before a second click confirms removal. Packs that are on
and other scopes remain protected; packs that are off keep their members
and repository packs can restore missing members when turned on.
**Claude sharing** links the scope’s Claude skills folder to its canonical agents
folder; disconnecting removes only that folder link, preserving the stored skills.

## Try later

The Try later tab keeps repository bookmarks. Save one for all skills or use **Choose skills** to find and
select specific names. Search retains your selections. Copy an install
command or a sequential install-all script; each command respects the bookmark’s
selection. Choose a destination and agent when generating commands.
Adding and removing bookmarks do not install or uninstall skills. Create pack opens
a draft using the saved selection, or all current discovered members, while keeping the bookmark.

Packs and Core can be shared as a manifest. **Import pack** accepts pasted JSON or a direct
HTTPS manifest URL and shows a review before saving. **Export JSON** publishes a pack or
Core. **Refresh from its link** reviews remote changes before replacing saved edits and does
not update installed skills. See the [publisher schema and example](../../docs/kit.md#share-a-pack-with-a-manifest).

## Tools

Tools are always global. Save a name, install command, optional update command, and
optionally the skills the tool provides. An empty update command reuses install. Run explicitly from your home folder and
inspect the exit status and output. Install all and Update all review commands
and run them sequentially, reporting failures while continuing with other tools.
Keep the tab open for the batch to finish. Removing an entry does not uninstall the tool.

## Agent rules

Edit one `AGENTS.md` and supporting Markdown in your AFK folder. Type `{{` to
insert a reference. Save keeps the local document; Sync previews and applies saved
rules to Codex, Claude or custom file destinations. Existing instructions outside
AFK's marked region are preserved. Backups, conflict review and explicit replacement
protect edits made by other tools. Broken markers and missing references block sync.

Git or your storage provider can transport the folder. AFK does not fetch remote
rules or automatically apply changes. Running agents may need a new conversation
to pick up changed instructions.

## Settings

One `settings.json` stores definitions and selected activation. Choose a location
in the app, including a folder synced by your own storage provider. AFK does not
provide a synchronization service. A small machine-local pointer remembers the
chosen settings location.

Add projects through folder browsing. Import reviews local folder mappings and
leaves packs off until explicitly prepared and turned on. A version 1 file imports with an empty Core. Saved tool commands
never run during import. JSON export contains configuration only; AFK folder ZIP
export includes saved rules and references. ZIP import reviews destination mappings
and leaves agent files unchanged until an explicit sync.

```sh
AFK_SETTINGS=/path/to/settings.json afk
afk ui --no-open
afk settings export /path/to/export.json
afk settings backups
afk settings restore <name>
```

## Manage from your agent

The bundled `afk-cli` skill complements the web app. Run `afk guide` to retrieve
its absolute `SKILL.md` path, then ask your agent to read it. The command works
without a browser or configured settings; installing the skill separately is optional.

Agents can edit simple definitions using `afk settings schema`, validate a
candidate with `afk settings validate`, and inspect local consistency with
`afk doctor --json`. Doctor never repairs files or runs commands automatically.

`afk manage describe` lists the shared operations. Run a selected operation with
`afk manage <operation> --input <JSON file|->` for pack preparation, activation,
the kit, invocation, tools, rules preview/sync, and portable imports. These run without a
browser and return JSON. See the [agent guide](../../docs/agents.md) for payloads,
skill installation, and preservation rules.

Old setup/catalog/rules/hooks/MCP/custom-agent orchestration commands are outside
this CLI's scope. Previous behavior remains in released changelog entries and Git history; existing
user files are not automatically migrated or removed.

## More documentation

- [Settings and physical storage](../../docs/settings.md)
- [Agent management and CLI workflows](../../docs/agents.md)
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

## Update AFK itself

Run `afk update` to rerun the hosted release installer and install the latest AFK
release. `afk update --dry-run` prints the command without running it. This is
separate from updating installed skills and works without reading AFK settings.

## Run in the background

```sh
afk --background
afk status
afk restart
afk stop
```

Background start prints the local URL without opening a browser. Status shows the
URL, process ID, resident memory (RSS) and log location. Stop gracefully closes the background instance;
foreground sessions are independent. Runtime records and logs stay under `~/.afk/`,
separate from your portable settings. Starting again reuses the running instance.
`afk ui --background` is also accepted. **Exit AFK** can close a background server
from the app; closing the browser tab leaves it running. Background instances use
the settings selected when they start. `afk restart` uses the running server’s
current port and settings path, even if your terminal’s `AFK_SETTINGS` changed.
If no background instance is running, it suggests `afk --background`. Foreground
sessions are untouched. To switch via `AFK_SETTINGS`, stop and start explicitly.

### Choose a fixed port

```sh
afk --port 4310
afk --background --port 4310
```

With `--port`, the app uses `http://127.0.0.1:4310`. Without it, AFK picks an
available port. Ports must be integers from 1 to 65535; an occupied port causes
an error rather than a fallback. Browser-blocked ports such as 6666 are rejected
before starting; choose a web port such as 4310 or 8080. If the background instance already uses another
port, run `afk stop` before restarting with your chosen port. The port is a launch
option, not a saved setting. `afk ui` accepts the same options.

`afk status` reports the server’s current resident RAM in MiB, including Node.js
and native allocations. It excludes the browser tab and child tool processes.
Older running servers show memory as unavailable until restarted after updating.
`afk restart` is available in AFK 2.0.3 and newer.

### Install a curated pack (2.0.6+)

Run `afk install https://example.com/stack.json` to review a version 1 manifest,
choose an agent and destination, save it as a pack in your kit, and install its
selections through Skills CLI. The saved pack remains on installation failure;
reload an open app to see it. A manifest that selects one skill from two sources is rejected.
For automation: `afk install example.com/stack.json --agent codex -g --yes`.
Use `-p <folder>` for a project without registering it in AFK. No web
app is required. See [direct installation](../../docs/kit.md#install-directly-from-a-manifest)
for limits, partial failures, and npm/local-checkout invocation. This command requires AFK 2.0.6 or newer.

**Install** on a Try later bookmark opens **Install skills** for that repository,
with the bookmark's saved selection ticked. Use **Select all** there to install
every skill the repository has. Saved selections and packs retain their explicit
members.

For a GitHub branch containing `/`, use a source reference such as
`https://github.com/owner/repository#feat/my-branch`. Skills CLI interprets
`/tree/feat/my-branch` as branch `feat` and folder `my-branch`; AFK explains this
ambiguity without changing your source.
