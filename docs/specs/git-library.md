# Git-backed library

Status: Proposed, for review. Not approved for implementation.
Date: 2026-11-05. Scope slug: `git-library`.
Research: [Skills Manager backup](../research/git-library/skills-manager-backup.md).

## Problem

AFK spreads one person's setup across four places that drift apart:

- **Portable settings** in a `settings.json` that a storage provider such as Google Drive moves between machines.
- **Machine state** in `~/.afk/local/<configurationId>.json`, including invocation preferences, so a new machine loses every Manual choice.
- **Skill files** in `~/.agents/skills` and the `.disabled` store, written by Skills CLI and tool commands that AFK only reconciles afterwards.
- **Skills CLI receipts** in `~/.agents/.skill-lock.json`.

The failures seen on 2026-11-05 all come from this split:

- Reinstalling through Kit sync wrote default skill files while saved Manual choices stayed in settings. The UI showed "Manual only" while agents could still invoke the skill.
- A hung `npx skills add` blocked shutdown. The server stopped answering while its process lived on, and every CLI command failed with `fetch failed`.
- Install and update progress comes from a child process AFK doesn't control, so the UI can't tell running from frozen.

## Outcome

One private Git repository is the library: every skill AFK manages, the settings that define packs, tools, bookmarks and rules, and the invocation choices. A machine is a checkout of that repository plus links into the agents' global folder. Changing something on one machine and syncing makes every other machine match.

## Goals

- One source of truth that travels: skills, invocation choices, packs, tools, bookmarks, Agent rules.
- A new machine is ready after connecting the repository, without reinstalling from upstream.
- Updates run once, on any machine, and reach the others by sync.
- Manual and Automatic choices survive installs, updates and tool runs, on every machine.
- Keep AFK light: one global `~/.agents/skills`, no per-agent workspaces, no marketplace.

## Non-goals

- Per-agent skill folders and per-agent toggles (Skills Manager's model).
- A skills marketplace or catalog.
- Syncing project folders. Project skills belong to the project's own repository.
- Building a GitHub sign-in. Git's existing credentials are used.

## Model

### The repository

```text
<library>/                    default checkout: ~/.afk/library
├── .afk/
│   ├── skills/<name>.json    source, skillPath, upstream revision, invocation choice
│   ├── packs/<id>.json
│   ├── tools/<id>.json
│   ├── bookmarks/<id>.json
│   └── settings.json         the remaining small settings (kit Core list, rule destinations)
├── skills/<name>/            full skill content, as agents will read it
├── rules/
│   ├── AGENTS.md
│   └── references/
└── .gitignore                AFK-managed section: oversized skills, caches, OS clutter
```

Portable state is one JSON file per object, not one settings file, so two machines that change different packs or skills never touch the same file. Removing an object deletes its file, which Git carries reliably (an empty folder would not be).

Each skill record holds what Skills CLI keeps in its lock file (`source`, `skillPath`, the upstream revision) plus the skill's invocation choice. Syncing the revision with the content means a machine that pulls a peer's update knows it is current.

AFK keeps no database. It reads these files directly, so a pull needs no rebuild step beyond deployment.

### What stays on the machine

`~/.afk/local` keeps only what is true of one computer: project folder paths, pack activation, AFK-owned links, skills marked machine-only, Agent-rules ownership receipts, and the repository remote and sync status. Credentials stay with Git.

### Deployment

The checkout is also the store. An available Global skill is a link `~/.agents/skills/<name>` → `<library>/skills/<name>`, plus the existing `~/.claude/skills/<name>` link. A skill that is off has no link; there is no `.disabled` store for library skills. Pack activation and project exposure keep their current link rules, pointing into the checkout.

Because agents read the checkout through links, an edit made in any agent folder is an edit to the working tree and is picked up by the next sync.

### Skills AFK does not own

Two kinds of skill stay outside the repository, as today:

- **Tool-provided skills.** A tool's command installs and updates them. The repository stores the tool definition and the invocation choices for the skills it provides. After a tool runs, AFK reapplies those choices to the files the tool wrote.
- **Machine-only skills**, kept and listed as today.

## Flows

### Connect

1. **Settings → Library → Connect** offers *Create a private GitHub repository* when the GitHub CLI is signed in, or *Use an existing remote* for any Git URL. AFK uses Git's own credentials and stores no token, so it needs no broad OAuth scope (a concern raised against Skills Manager in its #406).
2. The first connection on a machine that already has a setup migrates it (see [Migration](#migration)) and pushes.
3. A machine with no setup is offered *Restore from the library*. AFK clones into a temporary folder and swaps it into place only when the clone is complete, so an interrupted restore leaves nothing half-written (Skills Manager's #504). It then links Core skills and lists the tools whose skills are missing so the user can approve running them.
4. A local skill with the same name as a library skill but different content stops the restore and is offered for *Keep both*, never overwritten.

Skill content is committed as-is and isn't scanned for secrets. The Connect screen says so, and the repository must be private.

### Install

1. Skills CLI runs in an isolated temporary home, as the protected updater already does, with a timeout and cancellation.
2. AFK copies the selected skills into `<library>/skills`, records their source, applies saved invocation choices, links them and commits.
3. A failure leaves the library unchanged.

### Update

1. AFK updates the skills in staging (the existing protected updater), applies saved invocation choices to the staged copies, then replaces their library folders and records the new upstream revision.
2. One commit per update run. Other machines receive it by syncing; they don't run the update themselves.
3. Scheduled updates keep working and only need to run on one machine.

### Change invocation

Writes the choice to the skill's record and its files in the same commit. Files and choice can no longer disagree inside the library. The drift notice from `94ee8c8` stays for skills outside it.

### Sync

**When.** AFK commits after each of its own operations. It pushes after a quiet period (proposed: 2 minutes), pulls on start and every 15 minutes while running, and offers **Sync now**. Edits made outside AFK are committed as "Edited outside AFK: <skills>" at the next sync. Skills Manager never pulls while idle, so a machine left open stays behind (its #524); AFK's periodic pull avoids that.

**How.** System `git`, with deadlines on every network call. Before merging, uncommitted changes are committed and the current head is tagged as a snapshot.

**Merge.** Per skill, three-way against `git merge-base`, as Skills Manager does:

- A skill's content (its folder's tree hash) and its record merge separately, so an edit on one machine and an invocation change on another combine.
- A skill changed on only one side takes that side.
- A skill changed differently on both sides keeps the local version and is listed under **Needs attention**.
- Pack, tool and bookmark files changed on both sides also go to Needs attention rather than "newest wins", because they are user decisions.

**Needs attention** offers *Keep mine*, *Use theirs* and *Keep both* (the other copy saved as `<name>-<machine>`). Each choice snapshots first and commits its result, which reaches other machines as a normal change. The pending list is machine-local; Skills Manager's hidden-ref tracking is not worth its complexity for one user.

**After a pull.** AFK deploys what changed: links new skills, removes links for deleted ones, and reapplies invocation choices to tool-provided skills. Skills Manager only adds skills after a pull, so removals never reached other machines' agents (#524).

## Invariants

- Every change AFK makes to the library is one commit with a readable message.
- Skill folders and their records in `.afk/` agree after every AFK operation. A check that fails leaves the working tree as it was.
- A saved invocation choice is applied to a skill's files after every install, update, restore and tool run that writes them.
- Sync never deletes uncommitted work. Local changes are committed before pulling.
- Every external process (Git, Skills CLI, tool commands) runs with a timeout, can be cancelled, and reports progress the UI can show.

## What this retires

- Settings location in a storage-provider folder, and **Move current setup here** / **Load existing setup**.
- AFK folder ZIP export and import. The repository is the transfer.
- The `~/.afk/backups` rotation for settings. Git history replaces it.
- Kit's **This machine** sync plan and `afk sync` reinstalling from upstream. Restore and sync replace them; the plan reduces to links and tool runs.
- The `.disabled` store and AFK's dependence on `~/.agents/.skill-lock.json` for library skills.

Core, packs, Try later, tools and Agent rules stay as concepts. Their data moves into `.afk/`.

## Migration

`afk library init` (and the Connect screen) builds the first commit from the current machine:

1. Copy every Core skill and every pack member from its current location into `skills/`.
2. Write `.afk/` from the portable settings, the Skills CLI lock records for those skills, and this machine's invocation preferences.
3. Copy `AGENTS.md` and `references/` into `rules/`.
4. Replace the existing skill folders with links into the checkout, keeping the originals in a backup until the user confirms.

Dry run by default; `--apply` writes. The current `settings.json` stays where it is and is no longer written after migration.

## Reliability requirements

These come from today's failures and apply before sync ships:

- External processes have deadlines; a stalled network call fails the operation instead of the app.
- Shutdown has a deadline and reports what it abandoned.
- `afk status` reports a recorded server that is alive but not answering, with the fix, instead of `fetch failed`.
- Long operations expose state (phase, current item, elapsed time, last output line) that the UI polls and shows.

## Decisions

1. **Pack activation stays per machine.** Core is deployed everywhere; turning a pack on or off affects only this machine.
2. **Full skill content is stored in the repository**, not a manifest of sources.
3. **Skills installed outside AFK** appear for review, as today's "not in your kit", with *Add to library* or *Keep on this machine*. The Kit / This machine / Packs experience stays.

## Slices

1. Reliability pass: deadlines, shutdown deadline, honest `status`, visible progress.
2. Local library: checkout, `.afk/` records, deployment links, portable invocation, migration. No remote yet.
3. Install and update into the library.
4. Remote sync: connect, push and pull, conflicts, restore on a new machine.
5. Retire the replaced surfaces and update the docs.
