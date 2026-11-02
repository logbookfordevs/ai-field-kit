# 0011: The kit replaces stacks and profiles

Status: Accepted

## Decision

AFK stores the skills a user wants as a **kit** in the settings file: Core (always-on
skills grouped by repository) and **packs**. Each machine is reconciled against the kit
with `afk sync`, which shows an exact plan first. Stacks, the saved skills list and
install scripts are removed. Settings move to version 2.

- **Desired state, reconciled per machine.** A stack was an install plan to replay, and a
  saved skills list was a snapshot of one machine. Neither said what a new machine should
  have. The kit lists what is wanted, and sync computes the difference from the machine's
  inventory. Sync installs and turns on; it never removes.
- **`SettingsStore.save` is the single migration gate.** A version 1 file with stacks can
  be read, but `save` refuses every write until the user migrates, so no code path can
  write around the choice. Migration is a pure function checked by `assertNothingLost`.
  The user picks which stack becomes Core; AFK ships no default.
- **Pack definitions stay byte-identical.** Packs keep the `profiles` array and their IDs.
  Machine-local activation is keyed by a hash of source, skills and groups, so changing
  any of those would orphan that state. New fields (`description`, `origin`,
  `sourceNames`) are not hashed. A stack that already had a linked profile keeps the
  profile's members.
- **Tools own what they install.** A tool may declare `provides`. The kit tracks the tool,
  not each skill. Updating those skills goes through the tool, so `skills/update` skips or
  refuses them. A tool's install command runs during sync only when the user approves it.
- **A permanent pre-migration copy.** The old file is kept as
  `~/.afk/backups/pre-kit-*.json`, outside the 20-file rotation, so a migration can always
  be undone with `afk settings restore`. Applying a migration rejects a file that changed
  since the dry run.

## Reason

Users read stacks, profiles and bookmarks as three versions of one idea, a named group of
skills, and had no way to carry their own setup to a second machine. One kit with Core and
packs removes the duplicate nouns and gives a new machine a single command. Keeping pack
data unchanged avoids the cost of rebuilding local activation on every machine.

## Consequences

- Older AFK versions reject version 2. Every machine sharing a settings file must update.
- The manifest format `skill-stack.v1` stays, as the way to publish and import packs.
- Skills without a repository source can't go to Core. They must be linked to a tool or
  kept machine-only, stored in `~/.afk/local` and never in the portable file.
- Dropping a skill from the kit keeps its files; other machines show it as undecided.
- Followed Core repositories can offer new skills. Nothing installs without an explicit add.
- Migration does not move skill files. Settings from before version 2 import with an empty
  Core.
- The superseded proposal is [stack-profile-merge](../specs/stack-profile-merge.md).
