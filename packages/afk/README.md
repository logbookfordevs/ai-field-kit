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

AFK opens a local web app. Its six sections are Profiles, Installed Skills,
Sources & Stacks, Tools, Agent rules, and Settings. Nothing is published online.
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

Filter by availability, effective invocation, recorded source, saved profile
membership or name within the selected scope. **Clear filters** resets these
filters while retaining the scope. Bulk selections survive filtering.
Automatic discovery token estimates count available automatic skills separately
for Codex and Claude and follow only the Profile filter. Inspect offers an
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
workflow. Only installations tracked by Skills CLI can update.

Select skills for bulk enable, disable, invocation or deletion. Deletion reviews
stored files and links before a second click confirms removal. Enabled profiles
and other scopes remain protected; disabled profile definitions keep their members
and repository profiles can restore missing members when enabled.
**Claude sharing** links the scope’s Claude skills folder to its canonical agents
folder; disconnecting removes only that folder link, preserving the stored skills.

## Sources & Stacks

Save repository bookmarks for all skills or use **Choose skills** to find and
select specific names. Search retains your selections. Copy an install
command or a sequential install-all script; each command respects the bookmark’s
selection. Choose a destination and agent when generating commands.
Adding and removing bookmarks do not install or uninstall skills. The default
card gallery has a List alternative. Create profile opens a draft using the saved
selection, or all current discovered members, while keeping the bookmark.

Stacks group explicit skill selections from multiple original repositories. Create
one from any saved source, choosing explicit members, import pasted JSON, or fetch a direct HTTPS
manifest URL. Review the groups before saving. Copy install script uses the chosen
destination and agent, sequentially; copying does not execute it.
Install runs here after target review; All skills bookmarks offer a one-off picker
that leaves the bookmark unchanged. Progress and output are retained during the
server session, and cancellation keeps completed or partial installations. Refresh manifest reviews
remote changes before replacing saved edits and does not update installed skills.
See the [publisher schema and example](../../docs/skill-stacks.md).

## Tools

Tools are always global. Save a name, install command, and optional update command.
An empty update command reuses install. Run explicitly from your home folder and
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
leaves profiles inactive until explicitly prepared and enabled. Saved tool commands
never run during import. JSON export contains configuration only; AFK folder ZIP
export includes saved rules and references. ZIP import reviews destination mappings
and leaves agent files unchanged until an explicit sync.

```sh
AFK_SETTINGS=/path/to/settings.json afk
afk ui --no-open
afk settings export /path/to/export.json
```

## Manage from your agent

The bundled `afk-cli` skill complements the web app. Run `afk guide` to retrieve
its absolute `SKILL.md` path, then ask your agent to read it. The command works
without a browser or configured settings; installing the skill separately is optional.

Agents can edit simple definitions using `afk settings schema`, validate a
candidate with `afk settings validate`, and inspect local consistency with
`afk doctor --json`. Doctor never repairs files or runs commands automatically.

`afk manage describe` lists the shared operations. Run a selected operation with
`afk manage <operation> --input <JSON file|->` for profile preparation, activation,
invocation, tools, rules preview/sync, and portable imports. These run without a
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
`afk restart` is included in the next release; use a source build until published.
