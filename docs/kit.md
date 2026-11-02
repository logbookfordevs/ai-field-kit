# The kit

The kit is the set of skills that travels with you. It lives in your settings file, so
every machine that shares that file sees the same kit. The kit is a list of what you want.
Each machine is then reconciled against it, instead of replaying a saved install plan.

The Kit page has four tabs:

- **This machine** shows where your kit and this computer differ.
- **Core** holds the always-on skills.
- **Packs** holds groups you turn on when needed.
- **Try later** holds repository bookmarks.

## Core

Core is the skills you want on every machine, always on. It is grouped by original
repository and stored in `kit.core` as `{source, name?, skills, follow?}` entries. A skill
belongs to one Core source. Core is Global only; use a pack for a project.

AFK ships no default Core. You choose what goes in it.

Add skills from This machine, from the `afk kit add` command, or by choosing them from a
repository with **Add from a repository**. **Export JSON** in Core publishes it as a
manifest (see [Share a pack with a manifest](#share-a-pack-with-a-manifest)).

### Follow a repository

Mark a Core source as followed with **Follow new skills** or `afk kit follow <repository>`.
**Check now**, or `afk kit check`, lists skills the repository has added since. AFK offers
them and never installs them automatically. Add the ones you want with
`afk kit add <skill> --source <repository>`.

## Packs

A pack is a named group of skills, possibly from several repositories. Turn it on for
Global or a project, or read its instructions once without turning it on. Packs replace
the earlier profiles and stacks.

- Skills download once into a private disabled store. Turning a pack on links them into the
  selected scope. Turning it off removes only AFK-owned links.
- A skill belongs to one source in a pack. A pack that selects one skill from two
  sources is rejected.
- A pack that is on can be edited. It stays on, added skills are exposed, and dropped
  skills lose only AFK-owned links. If an edit fails, AFK restores the pack.
- Remove a pack after it is off everywhere. Stored skill files remain.

Packs are stored in the `profiles` array of the settings file, with their original IDs.
Activation is local to each machine and keyed by a hash of the pack's source, skills and
groups. The optional fields `description`, `origin` and `sourceNames` are display
metadata and don't change that hash.

```sh
afk packs use "My pack"
afk packs enable "My pack" Global
afk packs disable "My pack" "Project name"
```

`afk profiles` still works as an alias. Names match without case sensitivity; duplicate
names need the pack ID.

## Try later

Try later is the earlier source bookmarks (`favoriteSources`), unchanged. A bookmark can
select specific skills. Saving one installs nothing. Use a bookmark to copy a command, run
an install, or create a pack draft.

## Skills that aren't in your kit yet

This machine lists installed, available Global skills that are not in Core, a pack, a tool
or machine-only. For each one, choose:

- **Core**, to keep it on every machine.
- **Pack**, to add it to a pack.
- **This machine only**, to keep it here and stop being asked. The choice is stored in
  `~/.afk/local`, never in the portable file. `afk kit keep <skill>` does the same.
- **Remove**, to delete it from this machine.

A skill without a repository source can't go to Core, because another machine couldn't
install it. Link it to a tool or keep it on this machine only.

## Tools that provide skills

A tool can list the skills it installs and updates in `provides`. The kit then tracks the
tool instead of each skill. Installed Skills labels those skills, and `afk skills update`
and the app's update skip them or refuse to update them by name. Update them with the
tool's own command.

## Sync

```sh
afk sync [--agent <agent>] [--yes] [--run-tools]
```

Sync makes this machine match the kit. It shows the plan, then asks before changing
anything:

- It installs missing Core skills through Skills CLI, grouped by repository.
- It turns Core skills back on that are installed but off.
- It lists tools whose provided skills are missing. A tool's saved install command runs
  only when you approve it: interactively, with `--run-tools`, or by ticking it in the
  app's sync review.

Sync never removes anything. `--yes` skips the confirmation for skills but not for tool
commands. The agent defaults to `universal`; the other choices are `codex`, `claude-code`,
`cursor` and `opencode`.

Dropping a skill from the kit keeps its files. Other machines then show it as not in
your kit.

## Commands

```sh
afk kit
afk kit add <skill>... [--pack <name>] [--source <repo>]
afk kit drop <skill> [--pack <name>]
afk kit keep <skill>
afk kit follow <repo>
afk kit unfollow <repo>
afk kit check
```

`afk kit` compares the kit with this machine. Nothing here installs a skill; run
`afk sync` for that. Run `afk manage describe` for the matching operations (`kit/state`,
`kit/add`, `kit/drop`, `kit/machine-only`, `kit/follow`, `kit/upstream`, `kit/sync`).

## Share a pack with a manifest

The manifest format is unchanged and is still named `skill-stack.v1`. It is now how packs
and Core are published and shared. The canonical [version 1 schema](schemas/skill-stack.v1.schema.json)
and [complete example](examples/skill-stack.v1.json) define the publisher contract:

- `version`: exactly `1`.
- `id`: stable identifier, distinct from the display name.
- `name`: display name; `description` is optional.
- `sources`: ordered, nonempty groups with `name`, `source`, and `skills`.
- `source`: the original Skills CLI repository reference, kept unchanged.
- `skills`: a nonempty list of unique explicit skill names; no wildcards.
- `$schema`: optional editor guidance; AFK never fetches or executes it.

Unknown fields and executable directives are rejected. A manifest has at most
100 groups and 1000 names per group. Names, identifiers and source references
cannot contain control characters. Source references cannot begin with a dash.

Publish JSON at a directly fetchable HTTPS URL (for GitHub, use the raw file URL).
Users can paste the JSON or its URL into **Import pack**. Redirects are rejected;
use the final raw JSON URL. A 15-second timeout and 1 MB response limit apply.
Import reviews the manifest before saving and never downloads skills or installs packages.
The URL is kept as the pack's `origin`, used only for **Refresh from its link**, which shows
the remote change before replacing your saved edits. Refreshing doesn't update installed skills.

An imported manifest becomes a pack with the ID `stack-<manifest id>`. A manifest that
selects one skill from two sources is rejected.

To publish, use **Export JSON** on a pack or on Core. It is available when every source
is a repository; a pack that includes skills from this machine only can't be exported.
Agents can use `pack/manifest` with a pack ID or `core`.

## Install directly from a manifest

```sh
afk install https://example.com/stack.json
```

An interactive terminal shows the manifest's repositories and explicit skill selections,
asks for an agent and a Global or project destination, and confirms before saving the
manifest as a pack and running Skills CLI. The pack appears in Packs using the same
settings file (`AFK_SETTINGS` applies). Reload an open app to see it. An existing pack
with the same ID is replaced by the reviewed manifest and URL; repeated installs don't
create duplicates. If the pack changes during review, the command aborts before
installing. Declining the confirmation saves nothing. The pack stays if installation fails
or is cancelled, so its presence does not prove a successful installation.

Supported agents are `universal`, `codex`, `claude-code`, `cursor`, and `opencode`.
Project scope accepts an existing folder; it does not need to be a configured AFK project.

For automation, specify both target options and confirmation:

```sh
afk install https://example.com/stack.json --agent codex --global --yes
afk install example.com/stack.json --agent claude-code --project ./my-project --yes
npx @logbookfordevs/afk install https://example.com/stack.json --agent codex -g --yes
```

The npm invocation requires AFK 2.0.6 or newer. To exercise a local checkout, build it
with `pnpm afk:build` and replace `afk` with `node packages/afk/dist/index.js`.

Bare domain/path arguments use HTTPS. The manifest policy applies: no HTTP, credentials,
fragments or redirects. Pass the direct JSON asset (for example `/stack.json`), rather
than an HTML page. Fetch and validation errors prevent installation.

Sources install sequentially with their explicit selections. Installation may replace
existing skills and make them available. A failed source stops the remaining sources;
completed or partial files remain. The command reports the completed source count and
exits nonzero on failure (130 for cancellation). It does not claim rollback. `--yes`
requires an explicit agent and scope; without it, a terminal confirmation is required.

## Move from stacks

Earlier AFK versions kept stacks, profiles and a saved skills list. Settings version 2
replaces them with the kit. Updating AFK is not enough on its own, so read this first:

- **Update every machine** that shares the settings file. Older AFK versions reject
  version 2 with an error.
- A version 1 file **without** stacks upgrades silently the next time AFK saves it.
- A version 1 file **with** stacks can be read, but AFK refuses every write until you
  migrate. The app shows **Move to your kit**; the CLI command is `afk migrate`.

```sh
afk migrate                          # dry run: nothing is written
afk migrate --core <stack-id>        # choose the stack that becomes Core
afk migrate --core <stack-id> --follow <source> --skip-tool <name> --apply
```

Without `--apply` the command prints what would change and writes nothing.

- `--core <stack-id>` makes that stack your Core. Omit it for an empty Core. The choice is
  yours; AFK never picks one.
- Every other stack becomes a pack. A stack that already had a linked profile
  (`stack-<id>`) keeps that profile's members and activation unchanged.
- `--follow <source>` follows a Core repository and adds the skills you already have from it.
- `--skip-tool <name>` stops a tool from being linked to the skills AFK suggests for it.
- Source bookmarks, tools, projects, rule destinations, on/off state and invocation
  preferences are unchanged. The saved skills list is retired.
- Migration never moves, installs or deletes skill files.

Before it writes, AFK keeps the old file permanently as `~/.afk/backups/pre-kit-*.json`,
outside the 20-file rotation. Restore it with `afk settings restore <name>`. The apply
step refuses a file that changed since the dry run, and a final check stops the write if
anything outside the intended change would be lost.

Settings or ZIP files from version 1 import with an empty Core.
