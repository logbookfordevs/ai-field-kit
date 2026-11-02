# AFK Fieldwork specification

Status: AFK 2.0 is released; see the changelog for subsequent unreleased changes.
Approved direction: 2026-10-01.

## Purpose and boundaries

AFK manages local skills, a portable kit (Core, shared packs and source bookmarks), and tool
commands. The CLI opens a local web app and exposes focused reading/activation
operations. Catalogs, setup presets, conditional rule layers, hooks, MCP configuration, custom-agent
provisioning, and general setup orchestration are outside its scope.

The five sections are Kit, Installed Skills, Agent rules, Tools, and Settings. Tools,
Agent rules and Settings have no project picker. The Kit's Packs tab puts the target
beside each activation action; Installed Skills uses a page-level inventory scope.

## Kit

The kit is the set of skills that travels with the user, stored once in the settings
file (`kit.core` plus the packs). A machine is reconciled against it; the kit is not an
install plan. Its page has tabs: **This machine**, **Core**, **Packs** and **Try later**.

**Core** is always-on skills grouped by repository, stored as `{source, name?, skills,
follow?}`. It is Global only, and a skill belongs to one Core source. AFK ships no default
Core. **Follow** is a flag on a Core source: checking upstream offers new skills and never
installs them.

**This machine** compares the kit with the Global inventory. Core skills that are missing
or off are listed with a sync action. Installed, available Global skills that are not in
Core, a pack, a tool's `provides` or the machine-only list are shown as not in the kit.
Each can go to Core, a pack, **This machine only**, or be removed. A skill without a
repository source can't go to Core; it must be linked to a tool or kept machine-only.
Machine-only choices are stored in the machine-local state, not the portable file.

A tool entry may list `provides`, the skills it installs. The kit tracks the tool instead of
those skills. Installed Skills labels them, and skill updates skip them or reject them by
name; users update them with the tool's command.

**Sync** (`afk sync`, `kit/sync`) takes an exact plan from `kit/state` and rejects a plan that
no longer matches. It installs missing Core skills through Skills CLI, turns off Core skills
back on, and never removes anything. A tool's install command runs only when the user
approves it: `runTools` in the operation, `--run-tools`, or an interactive yes. Dropping a
skill from the kit keeps its files; other machines then show it as not in the kit.

**Try later** is the source bookmarks described below.

### Move from stacks

Settings version 2 adds `kit` and rejects `stacks` and `savedSkills`. A version 1 file
with stacks can be read, but `SettingsStore.save` refuses every write until it is
migrated, through the app's **Move to your kit** screen or `afk migrate` (a dry run
unless `--apply`). The user chooses which stack becomes Core; others become packs.
Pack definitions are unchanged, so machine-local activation survives. `migration/apply`
rejects a file that changed since the dry run, `assertNothingLost` guards the write, and
the old file is kept as `~/.afk/backups/pre-kit-*.json`, outside the backup rotation and
restorable with `afk settings restore`. Migration never moves skill files. A version 1 file
without stacks upgrades on its next save. Older AFK versions reject version 2.

## Packs

Packs are the earlier profiles and stacks. They are stored in the `profiles` settings
array, so IDs and member data are unchanged. A definition stores a name and identifier,
selected skill names, readiness, and enabled targets, plus either one source reference or
`groups` of `{source, skills}` for several repositories (`source` repeats the first group
and `skills` lists every member in order). Each skill comes from exactly one source.
Optional `description`, `origin` and `sourceNames` are display metadata and are not part of
the definition hash that ties machine-local activation to a pack. Create a pack from a
repository, existing Global skills, or a pasted or fetched manifest.

A pack that is on can be edited. It stays on, added skills are exposed in each enabled
target, dropped skills lose only AFK-owned links, and a failure restores the previous pack.

Repository discovery delegates to Skills CLI in an isolated temporary workspace
and home. Users select members; only selected missing copies are retained under
`~/.agents/skills/.disabled/`. Existing available skills are preserved. Saving a
remote pack prepares its members; there is no remote-only invocation path.
Failures are visible, and the pack is not saved as ready on failure. Any selected
copies already prepared remain available for retry.

Global and project activation are independent. Selecting a target changes the
shown state only. Enabling creates owned discovery links; disabling withdraws only
owned exposure, preserving overlapping packs, independent activation, and
preexisting user files. Activation is additive, with no focus mode.

Turn a pack off in every target before removing it. Removal deletes
the definition, not stored skill files. Skill names identify stored copies; another
source with the same name does not get a separate namespace. Review existing
members before reusing names across sources.

**Read once** opens guidance and a copyable command for the pack ID.
`afk packs use <name-or-id>` (`afk profiles` is an alias) reads all locally prepared member instructions, including
disabled members, and prints supporting resource directories. It does not change
activation, register a slash command, or inject another chat. A calling agent must
run the command and read its output. Instructions already read stay in that
conversation after a later disable.

## Installed Skills

Global lists canonical `~/.agents/skills` entries and its disabled storage.
Project scope lists only that project's `.agents/skills` entries and disabled
storage; global-only entries are excluded. Metadata files and broken links are
ignored. The view is not a combined effective inventory: global skills may still
be discoverable to an agent working in a project.

Skills inside subfolders of the selected scope's skills folder are listed in a
separate In subfolders group, one disclosure per folder, up to four folder
levels deep. Dot folders, symlinked folders and the inside of a skill's own
folder are not searched. These entries show description and invocation metadata
and support Inspect only; they are excluded from selection, availability,
invocation changes, updates, deletion, packs and the discovery
estimate, because the tool that created the folder owns them. Name search and
the invocation filter apply to them; availability, source and pack filters
hide them. The state operation returns them as `nestedInventories`, and
`skill/read` reads one when given its `folder`.

Selection is scoped to the displayed inventory. Checkboxes and Select shown
support bulk availability, invocation and deletion. Search/filter changes retain
selection and expose the hidden count; changing scope clears it. Non-destructive
success keeps selection for another action, while partial results retain failed
members. Operations run sequentially and return per-member outcomes; successful
changes are not rolled back when another member fails. Bulk deletion reviews all
members and blockers before a single confirmation click, rejects stale reviews
before starting, and removes only eligible reviewed copies.

**Share skills with Claude** controls the selected scope’s local folder layout.
Sharing creates the canonical skills folder and Claude directory if missing, then
links `.claude/skills` to `.agents/skills`. Existing matching links are recognized.
An empty Claude skills directory can be replaced after review; populated folders,
files and unrelated links are preserved and reported as conflicts. Disconnecting
removes only the folder link, keeping all canonical skill files. This local
filesystem state is inspected directly, rather than exported as a portable
configuration preference. Pack and individual activation avoid duplicate
operations when the discovery folders share one underlying directory.

The invocation filter uses effective Claude/Codex metadata, including differences
between agents and unknown metadata. It combines with availability, recorded
source, pack membership and
name search within the selected scope without changing skill state. The discovery
estimate counts available automatic skills and follows only the Pack filter.
Other filters change the list only; pack membership includes packs that are off.

Inspection reads real SKILL.md and supporting files inside the selected skill
folder. Individual availability is separate from packs; turn owning packs off
before toggling a member directly. Independently available skills survive a pack
turning off. Existing files are not replaced merely because a pack names the skill.

Invocation settings are distinct from availability. Manual and Automatic write
Claude's `disable-model-invocation` and Codex's `allow_implicit_invocation` policy.
An override of a shared project skill makes an isolated local copy; reset reconnects
owned links to shared storage so later Global changes flow through. A physical
project-local skill restores its own original metadata. These controls do not
claim support for every agent.

Update skills runs `afk skills update -g` or `afk skills update -p <project>` through
shared operations. Skills CLI updates tracked installations in an isolated home
and workspace. Changed copies replace their existing physical storage locations;
availability links and AFK invocation preferences remain intact. Failures before
application leave originals unchanged; application failures restore backed-up
copies. Concurrent local edits abort application. Progress and output remain
available for the current app session after closing the dialog. Direct Skills CLI
updates bypass this protection; untracked prepared copies remain untracked.

Permanent deletion is separate from disabling. Delete beside Inspect opens a review of
the affected folders and links; a second click on Delete permanently confirms it.
No typed skill name or second dialog is required. Packs that are on block deletion;
packs that are off retain their members. Deleting Global storage marks affected
packs unprepared; turning on a repository pack restores missing members before
activation. Local-only packs require restoring files or editing membership.
Available physical copies and AFK-owned links
to same-scope disabled storage can be deleted without a separate disable step.
Owned availability links are reviewed and removed together with the storage;
other scopes and unrelated unowned links block deletion. Global deletion also
reviews and removes the matching Claude copy or link, without deleting unrelated
symlink targets. Shared Claude skills folders are recognized without double
removal. A shared project link must be
deleted through its original storage scope. The preview lists duplicate copies
that remain. Supporting files are deleted too. Changed files or links invalidate
the review, and a failed settings save restores the folder and links. AFK cannot discover links in unconfigured projects.

## Agent management

The `afk-cli` skill and its references ship with the CLI. `afk guide` prints the
absolute entry-file path without opening the app or reading settings. CLI help
instructs agents to read that file before management; skill installation is optional.

The skill complements the app with a hybrid interface. Agents can edit
source bookmarks, the kit, saved tools (including `provides`), and inactive project
definitions while preserving managed fields. Settings schema is editor guidance; validation checks structure,
and read-only doctor reports schema and local filesystem drift.

Headless `manage` operations use the same execution layer as the web app, accept
JSON file/stdin payloads, and return JSON. Packs, the kit and sync, invocation changes, skill
availability, rule regions, ownership, location changes, and imports use these
operations. Rule sync requires an unchanged reviewed preview; explicit conflict
replacement also requires its reviewed region and preview. A saved tool runs
only through the explicit execution operation. External skill installation and
updates remain Skills CLI's responsibility.

These checks establish saved local state, not that a running agent has discovered
new instructions. Concurrent processes and storage providers remain independent
writers; the workflow rechecks original files before replacing simple definitions.

## Try later (source bookmarks)

Shared bookmarks store a name, source reference, an optional user-written
description (never fetched) and optional selected skill names. They render as
a compact searchable list in the Try later tab; secondary actions sit in a per-row menu.
All skills is the default and omits `skills`; Choose skills saves a nonempty,
unique list of names. Both modes support adding, editing, removing, copying one
install command, and copying a sequential install-all script. The source reference
remains visible below the name for text selection and copying. Each command uses
the saved selection rather than expanding it to all.
Changing the source link clears its previous selection. Discovery stages files in
temporary storage, shows descriptions and supports search with retained selection;
saving a bookmark does not prepare a pack or copy skills into user inventory.
When Skills CLI reports original repository paths, the picker groups skills into
expandable folders with selection counts. Search includes folder paths and opens
matching branches. The same tree appears when choosing remote pack members.
Sources without folder metadata retain a flat list; AFK does not infer folders
from skill names. Folder paths are temporary discovery metadata, not bookmark
configuration.
Existing selected bookmarks can be edited without another discovery request.
Their saved members appear without folder grouping until Find skills runs again.
Names missing from a later scan stay selected and visibly marked until removed.
New upstream skills do not join an explicit selection automatically.
Command generation can select Global/project destination and an optional agent.
Copying commands never executes them. Separate Install actions run Skills CLI
after target review; removing bookmarks does not uninstall anything.
Create pack opens a draft with the source name and selected members, or discovers
all current members for All skills. Review and saving are explicit; the bookmark and
activation remain unchanged. Packs retain explicit selections rather than following
later source edits.

Packs can be published and shared as `skill-stack.v1` manifests. Import accepts pasted
JSON or a direct HTTPS JSON URL. Both paths validate the same manifest and show a review
before saving it as a pack with the ID `stack-<manifest id>`. An origin URL enables
explicit refresh; the proposed replacement is reviewed against the saved pack, and stale
saves are rejected. **Export JSON** on a pack or Core returns a manifest; a pack with
skills from this machine only can't be exported. Importing and exporting never install,
turn on, or change skills. Doctor validates manifests without network requests. The
[kit guide](../kit.md) owns publisher details.

## Tools

Always global. Each entry has a name, install command, and optional update command;
an empty update reuses install. Install/Update explicitly run the saved command
from the home directory and show output and exit status. Results persist during
the server session even if the dialog closes. Duplicate concurrent runs for the
same entry are rejected. Removing an entry only removes it from management.
Install all and Update all review the saved commands before running them
sequentially. Failures and already-running entries are reported without stopping
the remaining tools; an empty update command still reuses install.

## Settings and projects

Agent rules adds one canonical Markdown document with supporting references and
explicit destination sync. The editor, managed regions, conflict handling and
portable folder behavior are specified in [Agent rules](agent-rules.md).

One settings file holds shared definitions, targets, preferences, and local link
receipts. Default and custom locations, precedence, physical paths, and import
semantics are detailed in [Settings and storage](../settings.md).

Add projects through a home-rooted folder browser with ancestor and parent
navigation, then select the folder and name it. Project creation does not turn on
packs. Rename preserves target names/preferences; changing a folder requires
its packs to be off first.

Export downloads JSON. Import reviews folder mappings, replaces configuration,
clears local ownership receipts and individual activation state, and marks packs
off and unprepared. Current packs must be turned off first. A version 1 file imports
with an empty Core. Imported preferences are stored but not applied to native files
automatically. Saved tool commands do not run. Turn packs on and run `afk sync`
intentionally on the destination machine.

A storage provider may sync the chosen settings file. AFK does not sync files,
reconcile concurrent machines, or automatically apply another machine's activation.

## Lifecycle and verification

`afk --port <number>` selects a fixed loopback port for either launch mode.
Omitting it selects an available port. Values must be integers from 1 to 65535;
occupied ports fail rather than falling back. Browser-blocked ports are rejected
before launch; failed startup verification stops its child before removing receipts. A running background instance on a
different port must be stopped before switching. The port is not saved in settings.

`afk --background` starts a detached instance without opening a browser.
`afk ui --background` is an alias. `afk status` verifies the background server and
shows its URL, PID and log path; `afk stop` requests authenticated graceful shutdown.
`afk restart` verifies the instance, retrieves its current settings path, waits
for shutdown and launches a replacement on the same port. Changed shell settings
do not redirect the restart. Older servers use their authenticated state response
to recover the path; an unreadable path fails before shutdown. If no instance is
running, restart suggests a background start without launching one.
A second start reuses a running instance. These commands leave foreground sessions
alone. Runtime records stay under `~/.afk/` and are not portable configuration.

The server binds loopback, checks host/origin, and requires the current session
token for APIs. Exit AFK stops accepting connections and shows a closed screen;
Ctrl+C also closes the server. Configuration and activation remain unchanged.
In-flight operations can finish as shutdown drains existing connections.

Verification includes typecheck, lint, build, regression tests, installer checks
and focused browser checks; record current results with each change. The approved
design was reviewed at desktop/mobile widths; real
inventory startup and the Exit action were verified. Native metadata and link
behavior are tested. Discovery in live Claude Code/Codex conversations, disabled
folder treatment across all clients, publication, and website rollout remain
separate verification/delivery work.

## References

- [Approved design direction](afk-pivot-design.md)
- [App guide and CLI](../../packages/afk/README.md)
- [Storage decision](../adr/0009-shared-skill-storage-and-scoped-activation.md)
- [Skills CLI](https://github.com/vercel-labs/skills)
- [Claude Code skills](https://code.claude.com/docs/en/skills)

## First access and interface guidance

The local app opens a dismissible Welcome after its first successful load. It
explains pack activation versus reading a pack once and saved rules versus destination
sync, with actions leading to the actual workflow. Dismissal is stored in settings
and survives a server restart or port change. About AFK can reopen it.

Pack creation has separate repository and local modes, searchable names and
descriptions, and a selection count. Filtering retains chosen members. Installed
Skills shows effective native invocation metadata and the behavior restored by
clearing an override. Narrow screens keep a compact section selector and app
utilities available while scrolling.

### Installing saved sources and syncing

Install runs Skills CLI for a saved source, and sync runs it for missing Core skills, using
the chosen scope and an explicit agent. Copied scripts retain their existing interactive
behavior. App installation skips prompts after the user chooses the target, processes
sources sequentially and retains progress/output during the session. Closing the dialog
does not cancel the job. Cancellation stops the child process and later sources;
completed or partial files remain. Installation can replace existing skills and
make them available; the protected Installed Skills updater is the path for
preserving an existing disabled state. Saving or editing a bookmark or pack still
does not install anything. `afk install <url>` saves a manifest as a pack and then installs
it; a manifest selecting one skill from two sources is rejected. Agent operations expose the
same installation actions.

### Portable configuration and local state

An AFK folder carries definitions (the kit, packs, bookmarks, tools), and canonical rules. Pack activation, readiness, invocation preferences, machine-only choices and ownership receipts persist separately under the machine home, keyed by configuration identity. Reusing the folder on another machine does not install skills or turn on packs; `afk sync` reconciles Core with that machine after review. Project folder repair updates a mapping only and never transfers project files.
