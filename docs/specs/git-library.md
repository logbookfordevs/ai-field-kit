# Git-backed library

Status: Approved 2026-11-05. Decision record: [ADR 0012](../adr/0012-git-library-replaces-drive-settings-and-kit-sync.md).
Date: 2026-11-05. Scope slug: `git-library`.
Research: [Skills Manager backup](../research/git-library/skills-manager-backup.md).
Wireframes: [git-library-wireframes.html](git-library-wireframes.html).

## Problem

AFK spreads one person's setup across four places, and none of them is a complete backup:

- **Portable settings** in a `settings.json` kept in a Google Drive folder. A blank file overwrote it twice (Oct 27 and Oct 28, 2026).
- **Machine state** in `~/.afk/local/<configurationId>.json`, including the invocation choices. After a wipe, every Manual choice is gone.
- **Skill files** in `~/.agents/skills` and the `.disabled` store, written by Skills CLI and tool commands. They are not backed up anywhere; restore reinstalls them from upstream.
- **Skills CLI receipts** in `~/.agents/.skill-lock.json`.

The failures seen on 2026-11-05 come from this split:

- Reinstalling through Kit sync wrote default skill files while saved Manual choices stayed in settings. The UI showed "Manual only" while agents could still invoke the skill.
- Restore ran 10 repository installs in a row. One hung, blocked shutdown, and every CLI command failed with `fetch failed`.
- Install and update progress comes from a child process AFK doesn't control, so the UI can't tell running from frozen.

## Outcome

AFK owns the storage of the skills it manages and saves that setup to one private Git repository, like a saved game. On a new or wiped machine, **Restore my library** brings everything back in one download: Core skills with their Manual/Automatic choices already in their files, packs, tools, Try later and Agent rules.

## Scope

**In:** one machine, saving continuously to its repository, and restoring from it onto an empty machine.

**Out, for now:** keeping two machines in step. With one machine nothing else writes to the repository, so there is no pulling, merging or conflict handling. The repository layout below keeps that possible later.

## Goals

- A backup that holds everything needed to rebuild the setup, with history to go back to any earlier save.
- Restore in one download, without reinstalling from upstream.
- Manual and Automatic choices survive installs, updates, tool runs and restore.
- Install skills from a zip, a `.skill` file or a folder, not only from repositories.
- Edit skills inside AFK.
- Keep AFK light: one global `~/.agents/skills`, no per-agent workspaces, no marketplace. AFK stays a local web app.

## Non-goals

- Multi-machine sync, merging and conflict resolution.
- Per-agent skill folders and per-agent toggles (Skills Manager's model).
- A skills marketplace or catalog.
- Backing up project folders. Project skills belong to the project's own repository.
- Building a GitHub sign-in. Git's existing credentials are used.
- A desktop app. Revisit after the library ships.

## Model

### What is saved

| Saved in the repository | Stays on this machine only |
| --- | --- |
| Core skills, full files | Skills that are off |
| Uploaded skills (zip, `.skill` or folder), whether in Core or a pack | Pack skill files that come from a repository (fetched when the pack is turned on) |
| Pack definitions | Machine-only skills |
| Tool definitions | Pack activation |
| Try later bookmarks | Project folder paths |
| Manual/Automatic choices | Links and Agent-rules ownership receipts |
| `AGENTS.md` and references | |

The rule: the repository saves what can't be downloaded again. On this machine, the saved part is 43 Core skills totalling 8.7 MB, against about 192 MB of installed skills. The heavy skills are all off or in packs.

### Repository layout

```text
<library>/                    default location: ~/.afk/library
├── .afk/
│   ├── skills/<name>.json    source, skillPath, upstream revision, invocation choice
│   ├── packs/<id>.json
│   ├── tools/<id>.json
│   ├── bookmarks/<id>.json
│   └── settings.json         remaining small settings (Core list, rule destinations)
├── skills/<name>/            Core and uploaded skills, as agents read them
├── rules/
│   ├── AGENTS.md
│   └── references/
└── .gitignore                AFK-managed: caches and OS clutter
```

One JSON file per object keeps history readable and leaves room for multi-machine merging later. Each skill record holds what Skills CLI keeps in its lock file (`source`, `skillPath`, the upstream revision) plus the skill's invocation choice. AFK reads these files directly; there is no database.

### Storage and links

AFK owns the storage, as Skills Manager does. A skill that is on is a link from each enabled agent folder (see [Agent folders](#agent-folders)) into its stored copy, for example `~/.agents/skills/<name>` → `<library>/skills/<name>`. Pack skills from a repository live in the pack cache and are linked the same way while the pack is on. An uploaded pack skill is linked straight from the library; turning its pack on downloads nothing.

### On and off without a `.disabled` folder

AFK stores every Global skill it manages, so turning one off removes its links and moves nothing:

| Skill | Stored in | Saved in backup |
| --- | --- | --- |
| Core, uploaded | `~/.afk/library/skills/` | Yes |
| Pack skill from a repository | `~/.afk/packs-cache/` | No (definition only) |
| Machine-only | `~/.afk/machine/` | No |

- The Global `.disabled` store retires. Existing `.disabled` contents move into this storage during migration.
- One stored copy per skill. Reinstalling a skill replaces that copy, so the "Two copies" case no longer arises for stored skills.
- **Tool-provided skills** are the exception: a tool writes a real folder into an agent folder. Turning one off moves it to `~/.afk/off/`, outside every agent folder, and turning it on moves it back. Whether a tool's next update recreates a skill that is off must be tested per tool. The repository saves the tool and the invocation choices for its skills; after a tool runs, AFK reapplies those choices. They open read-only in the editor.
- **Skills installed outside AFK** appear for review, as today's "not in your kit": *Add to library* (moved into storage and linked) or *Keep on this machine* (moved into `~/.afk/machine/` and linked). Keeping a skill machine-only can offer to bookmark its source in Try later.

### Agent folders

Agents don't all read the same folder. Skills CLI 1.7.6's agent table lists 80 agents; in projects most read `.agents/skills`, but globally only Codex, Cline, Warp and Zed read `~/.agents/skills`. Claude Code reads `~/.claude/skills`, Cursor `~/.cursor/skills`, Gemini CLI `~/.gemini/skills`, GitHub Copilot `~/.copilot/skills`, OpenCode `~/.config/opencode/skills`.

**Settings → Agent folders** lists the folders AFK links skills into:

- `~/.agents/skills` is always on, named as the shared folder with the agents that read it.
- Known agents come from a table AFK ships (taken from Skills CLI's), each with its global and project folder. Agents detected on this machine (their config folder exists) are listed first, each with a switch.
- **Add a folder** takes a name, a global path and an optional project path, for agents AFK doesn't know.
- Every skill that is on gets a link in each enabled folder; turning a skill off removes all of them. Enabling a folder links every skill that is on; disabling it removes only AFK's links there.
- The Manual/Automatic choice lives in the skill's files, so it applies through every link. AFK writes the two mechanisms that matter: Claude Code's `disable-model-invocation` frontmatter, which other agents such as Pi also follow, and Codex's `agents/openai.yaml`. Agents that read neither can't be controlled. Where AFK's agent table knows which mechanism an agent follows, a tooltip on the choice says so; otherwise it says nothing.
- Enabled folders are saved in the backup as `~`-relative paths and recreated on restore.

Today's fixed `~/.claude/skills` link becomes the Claude Code entry, on by default.

Each agent is shown with its icon, as Skills Manager does. Its 52 agent icons (`public/agent-icons/`, mapped in `src/lib/agentIcons.ts`) are in an MIT repository; AFK can reuse them with that notice, or take each from the agent's own brand assets. The logos remain their owners' trademarks and are used only to identify the agent. Custom folders and agents without an icon get a lettered placeholder.

### Projects

Projects stay simple, like Skills Manager's project workspaces: AFK manages the skills that live in a project's own repository.

- **Install, update, delete and the Manual/Automatic switch**, acting directly on the project's files. Installs go through Skills CLI in project mode, into the project's agent folders (`.agents/skills`, read by most agents in projects, plus `.claude/skills` and any others enabled).
- These are the project's files, often shared with a team, so changes show up in the project's Git status by design. Adding a project to AFK is the opt-in to managing its skills; AFK can be used to maintain a team's skills.
- No packs and no library skills in projects for now. Packs stay Global.
- No turning project skills on and off, so the project `.disabled` folder and `.afk-overrides` copies retire. The Manual/Automatic switch edits the skill's own files.
- Projects are not part of the backup. Their skills are already in the project's repository.

## Flows

### First run

AFK asks *Restore my library* or *Start a new library*, and can be skipped to use AFK without a backup. The CLI equivalent is `afk library connect <owner/repo | url>` or `afk library init`.

### Start a new library

1. AFK creates a private GitHub repository through the GitHub CLI, or accepts any Git remote URL. It uses Git's own credentials and stores no token.
2. It shows what will be saved and what stays local (the table above), then migrates this machine's setup (see [Migration](#migration)) and pushes.
3. The screen states that skill files are not scanned for secrets, so the repository must stay private.

### Save

- Every change AFK makes is one commit with a readable message: an install, an update run, an edit, an invocation change, a pack or bookmark change.
- AFK pushes 2 minutes after the last change, and on **Save now**.
- If the push fails (offline, credentials), commits wait locally and the sidebar says so. Nothing is lost.
- History lists past saves. *Go back to this save* restores the library to that point as a new commit, so it can itself be undone.

### Restore

1. Pick the repository from the GitHub CLI list or paste a URL. AFK checks that it is an AFK library before cloning.
2. AFK clones into a temporary folder and moves it into place only when the clone is complete, so an interrupted restore leaves nothing half-written (Skills Manager's #504).
3. It links Core skills and applies invocation choices.
4. A skill already on the machine with identical files is adopted. Different files: the library copy wins and the local copy is moved aside to a dated folder, listed in the summary.
5. It lists the tools; the user ticks which commands run. Choices are reapplied after each.
6. Packs start off. Turning one on fetches its skills then.

### Install

1. **From a repository:** Skills CLI runs in an isolated temporary home, as the protected updater does, with a deadline and cancellation.
2. **From a zip, `.skill` file or folder:** AFK finds each `SKILL.md`, shows what it found and its size, and notes that the skill can't auto-update. For Core or a pack, its files are saved in the repository; the pack definition references that saved copy instead of a source. A pack with an uploaded skill can't be exported as a shareable manifest, as with machine-only skills today.
3. Destinations as today: Core, a pack, this machine only, or Try later (repositories only).
4. AFK copies the skills into the library or the pack cache, records their source, applies saved invocation choices, links them and commits.
5. A failure leaves the library unchanged.
6. Opening Install from a Try later bookmark fills in the repository and its saved selection, then still asks for the destination.

### Update

1. AFK updates skills in staging (the existing protected updater), applies saved invocation choices, replaces their library folders and records the new revision.
2. One commit per update run. Scheduled updates keep working.

### Edit

- The Skills screen opens a skill's files in an editor: plain text with a Markdown preview.
- Save is one commit ("Edit wizard"), reapplies the invocation choice and is pushed with the next save.
- The invocation line in the frontmatter is managed by the Manual/Automatic choice, not edited by hand.
- Editing a skill that auto-updates asks first: *Keep my version* (stop its updates) or *Let updates replace my edits*.
- Tool skills open read-only.

### Local checks

Two situations on this one machine need the user. AFK lists them under **Needs attention** on the Backup screen:

- **Edited outside AFK.** A library file changed without the editor. *Keep edit* commits it; *Discard* restores the saved version.
- **Replaced by Skills CLI.** A direct `npx skills update` replaced a link with a plain folder. *Take the update* moves the new files into the library, reapplies the choice, relinks and commits. *Restore library version* puts the link back. Whether Skills CLI does this must be tested first.

## Invariants

- Every change AFK makes to the library is one commit with a readable message.
- Skill folders and their records in `.afk/` agree after every AFK operation. A failed operation leaves the library as it was.
- A saved invocation choice is applied to a skill's files after every install, update, restore, edit and tool run that writes them.
- A failed push never discards a commit.
- Every external process (Git, Skills CLI, tool commands) has a deadline, can be cancelled, and reports progress the UI shows.

## What this retires

- Settings location in a storage-provider folder, and **Move current setup here** / **Load existing setup**.
- AFK folder ZIP export and import. The repository is the backup.
- The `~/.afk/backups` rotation for settings. Git history replaces it.
- Kit's sync plan and `afk sync` reinstalling Core from upstream. Restore replaces them.
- The Global `.disabled` store, replaced by AFK's storage and unlinking. Tool skills that are off use `~/.afk/off/`.
- Project on/off: the project `.disabled` folder and `.afk-overrides` copies.
- Packs and shared library skills in projects. Packs are Global for now.
- The fixed `~/.claude/skills` link, replaced by the Claude Code entry in Agent folders.
- AFK's dependence on `~/.agents/.skill-lock.json` for library skills.

Core, packs, Try later, tools and Agent rules stay as concepts. Their data moves into `.afk/`.

## Migration

`afk library init` (and *Start a new library*) builds the first commit from this machine:

1. Copy every Core skill from its current location into `skills/`, pack skills into the pack cache, and machine-only skills and the Global `.disabled` contents into their storage.
2. Write `.afk/` from the portable settings, the Skills CLI lock records for those skills, and this machine's invocation choices.
3. Copy `AGENTS.md` and `references/` into `rules/`.
4. Replace the existing skill folders with links, keeping the originals in a dated backup until the user confirms.

Dry run by default; `--apply` writes. The current `settings.json` stays where it is and is no longer written after migration.

## Reliability requirements

From the 2026-11-05 failures; they ship first:

- External processes have deadlines; a stalled network call fails the operation, not the app.
- Shutdown has a deadline and reports what it abandoned.
- `afk status` reports a recorded server that is alive but not answering, with the fix, instead of `fetch failed`.
- Long operations expose state (phase, current item, elapsed time, last output line) that the UI shows, and keep running when their dialog closes.

## Decisions

1. Backup and restore for one machine. Multi-machine sync is out of scope.
2. The repository saves Core skills in full; packs are definitions; off skills and machine-only skills are not saved.
3. Pack activation stays per machine.
4. Skills installed outside AFK appear for review. The Kit / This machine / Packs experience stays.
5. Edits outside AFK are flagged, not saved silently.
6. Tool skills stay outside the repository; restore lists tool commands for approval.
7. A built-in editor: plain text with Markdown preview.
8. AFK stays a local web app.
9. One Skills page (wireframe direction B): Core grouped by source, Packs, This machine only, Try later and To review as tabs. It replaces the separate Kit and Installed Skills pages.
10. Uploaded skills can go to Core, a pack or this machine. In Core or a pack they are saved in full, because they can't be downloaded again.
11. AFK stores every Global skill it manages, including machine-only ones; off means unlinked. The Global `.disabled` store retires.
12. Agent folders: `~/.agents/skills` always, plus switchable known agents and custom folders, saved in the backup.
13. Projects: install, update, delete and Manual/Automatic for the project's own skills, editing its files directly. No packs, no on/off, no backup.
14. Invocation is written for Claude Code's and Codex's mechanisms only. Which agents follow them is shown in a tooltip where known.
15. Agent folders show each agent's icon.

## Slices

1. Reliability pass: deadlines, shutdown deadline, honest `status`, visible progress.
2. Local library: storage and links, `.afk/` records, portable invocation choices, migration. No remote yet.
3. Install (repository, zip, folder) and update into the library.
4. Backup: create or connect the repository, save and push, history, restore on an empty machine.
5. Editor and local checks.
6. Retire the replaced surfaces and update the docs.
