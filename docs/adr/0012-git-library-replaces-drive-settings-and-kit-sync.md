# 0012: A Git-backed library replaces the Drive settings file and Kit sync

Status: Accepted

## Decision

AFK stores every Global skill it manages and saves the user's setup to one private Git
repository, as a backup with history. A wiped or new machine restores from it in one
download. The full design is the [Git-backed library spec](../specs/git-library.md).

- **AFK owns skill storage.** Core and uploaded skills live in `~/.afk/library`, pack
  skills in a pack cache, machine-only skills in `~/.afk/machine`. Agents see them through
  links in each enabled agent folder. Off means unlinked, so the Global `.disabled` store
  retires and a skill has one stored copy.
- **The repository saves what can't be downloaded again.** Core and uploaded skills in
  full; packs, tools, Try later, invocation choices, agent folders and Agent rules as
  data. Off skills, pack skills from repositories, machine-only skills and projects are
  not saved.
- **Invocation choices become portable.** They move from `~/.afk/local` into the
  repository and into each skill's files, and are reapplied after every install, update,
  restore, edit and tool run.
- **One machine, backup and restore.** Saving pushes; restoring clones. There is no
  pulling, merging or conflict handling. One JSON file per object keeps that possible later.
- **Agent folders are configurable.** `~/.agents/skills` always, plus known agents and
  custom folders, because most agents read their own global folder.
- **Projects are repository skill management.** Install, update, delete and the
  Manual/Automatic switch edit the project's own files. No packs, on/off or backup.
- **AFK stays a local web app.**

## Reason

Settings, invocation choices, skill files and Skills CLI receipts lived in four places,
and none was a complete backup. On 2026-11-05 a reinstall through Kit sync lost Manual
choices, restore ran ten repository installs in a row and one hung AFK, and the
Drive-synced settings file had been overwritten by a blank file on Oct 27 and Oct 28. A
repository holding the files themselves restores in one download, keeps history, and
removes the reinstall path that failed.

## Consequences

- Supersedes the Drive-hosted settings location, AFK folder ZIP export, the
  `~/.afk/backups` rotation, Kit sync's reinstall plan, the Global and project `.disabled`
  folders, `.afk-overrides`, and packs in projects. [ADR 0011](0011-kit-replaces-stacks-and-profiles.md)'s
  kit concepts (Core, packs, Try later, tools) stay; their data moves into the repository.
- Skills without a repository source can now be saved: uploads go to Core or a pack.
- A migration moves existing skills into AFK's storage and replaces them with links,
  keeping the originals until the user confirms.
- Skill files are pushed unscanned, so the repository must stay private.
- Tool skills remain real folders the tool writes; turning one off moves it to `~/.afk/off/`.
- Reliability work (deadlines on external processes, a shutdown deadline, honest status,
  visible progress) ships first, before any of this.
