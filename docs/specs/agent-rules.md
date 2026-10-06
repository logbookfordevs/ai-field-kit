# Agent rules

AFK has one shared, editable `AGENTS.md` beside the selected `settings.json`,
with supporting Markdown under `references/`. This is a bounded addition to
Fieldwork, not a return to catalogs, setup presets or conditional rule layers.
The approved UI reference is [the Open Design bundle](../references/agent-rules/open-design/afk-agent-rules.html).

## Editing and applying

The workbench opens real saved files. Drafts survive section navigation; Save
writes the canonical files and never changes agent files. Reference completion
uses `{{file.md}}` keys, including nested paths. Renaming can update usages.
Unresolved keys and missing local references block sync until fixed or removed.

Sync applies saved content to explicitly selected destinations. Unsaved edits
offer Save & sync or syncing the last saved version. Preview lists region changes,
reference copies and backups. Applying rechecks both canonical and destination
contents against the reviewed snapshot; a stale preview requires a fresh review.

Codex and Claude have built-in global destinations. Custom destinations provide
a name and an absolute file path. They can also point to a project file; there
is no automatic project routing or profile-dependent rule selection.

New built-in destinations use `~/.codex/AGENTS.md` and `~/.claude/AGENTS.md`.
Previously configured paths are retained with their ownership records. Claude's
[Project instructions setting](https://code.claude.com/docs/en/memory#agentsmd)
controls AGENTS.md loading; existing project CLAUDE.md files can take precedence.
Check `/context` in Claude to confirm the rules are loaded.

## File ownership

Only the text between `<!-- AFK:RULES:START -->` and
`<!-- AFK:RULES:END -->` belongs to AFK. Bytes outside that region are preserved.
Missing files are created; existing files get a region and a backup first.
Unchanged files are not rewritten or backed up. Target files are regular files,
not whole-file symlinks. Unsafe symlink destinations and collisions are rejected.

Supporting files are copied into a destination-local `afk-rules/<destination-id>/references/`
namespace, with reference paths adapted. AFK tracks the content it wrote and
preserves unrelated files. An edited managed region or reference is a conflict.
Duplicate or broken markers require manual repair; AFK never guesses the boundary
or appends a duplicate set of instructions to recover it.

Conflict management can bring target edits into a canonical draft or explicitly
replace a valid region with saved content after backup. Draft adoption itself
does not save or sync. Disconnect offers removing only owned content, or leaving
the destination files intact and forgetting management. Removing a destination
never deletes the whole user file.

## Portable folder

The AFK folder contains `settings.json`, `AGENTS.md` and `references/`. Its basename
need not literally be `afk`; existing `~/.afk` remains compatible. Move copies these
files to an unused destination and retains the original. Selecting an existing
folder loads its configuration without writing agent files. Profiles must be
disabled and managed rule destinations disconnected before replacing ownership.

Git, Drive and iCloud can transport this folder. AFK does not fetch repository
URLs, watch cloud changes, commit/push files or automatically apply downloaded
rules. Agent paths and ownership belong to one machine and must be reconciled there.

JSON export/import remains configuration-only. AFK folder ZIP export includes
saved Markdown; unsaved drafts are excluded. ZIP import validates the entire
archive, reviews local destination mappings, backs up current portable files and
resets readiness, activation and ownership. It never installs skills, executes
tools or writes agent destinations. Traversal, duplicate entries, unsupported
files and oversized archives are rejected before replacement.

## Boundaries

Rule sync does not promise automatic rereading by a running agent. Start a new
conversation or use that client's reload behavior when needed. Ordinary reference
paths identify files; they are not a universal instruction-import protocol.
Backups and sync receipts are local recovery records, not a cloud merge service.
