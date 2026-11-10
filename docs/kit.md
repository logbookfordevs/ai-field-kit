# Your library and the Skills page

AFK keeps the skills you manage in **your library**: a Git repository on this machine at
`~/.afk/library`. Every change AFK makes there (an install, an update, an edit, a new
pack) is one save with a readable name. **Backup** copies those saves to a private Git
repository, and **Restore** brings them back on a new or wiped machine.

The library saves **Core** skills in full. Packs, tools, Try later bookmarks, your
Manual/Automatic choices, agent folders and agent rules are saved as definitions. Skills
kept on this machine only, and pack skills once downloaded, stay on this machine and are
not saved.

## Start a library

If you used AFK before the library, start one from **Start a new library** on the first-run
screen, on the Backup screen, or in Settings. AFK first shows what it will do:

- Core skills move into the library.
- Pack skills and skills kept on this machine move into AFK's storage on this machine.
- Skills a tool installs stay where the tool put them.
- Core skills missing on this machine are listed and skipped.
- `AGENTS.md` and its references are copied into the library.

Nothing changes until you choose **Start the library**. AFK then replaces the original
folders with links, so your agents still find every skill, and keeps the originals in a
dated folder under `~/.afk/library-backups`. Delete them once everything works.

The same steps from a terminal:

```sh
afk library init           # dry run: shows the plan, writes nothing
afk library init --apply   # starts the library
afk library confirm        # deletes the kept originals
```

## Backup

The Backup screen connects the library to a private repository:

- **Create a private GitHub repository** uses the GitHub CLI and its sign-in. AFK stores
  no token.
- **Use another Git remote** takes any URL Git can push to, with Git's own credentials.

AFK then sends waiting changes to the remote once a day at 22:00. If AFK isn't running
then, an edit made outside AFK is waiting, or the push fails, that day is skipped; the changes
wait on this machine and nothing is lost. **Back up now** sends them at any time. Skill files are not
scanned for secrets, so keep the repository private.

**History** lists every save. **Go back** restores an earlier one as a new save, so going
back can be undone too.

**Needs attention** lists changes AFK did not make:

- A stored skill edited outside AFK. **Keep edit** saves the edit; **Discard** puts the saved
  files back. Saving to the remote pauses while such edits wait.
- A stored skill replaced by Skills CLI with a plain folder. **Take the update** moves the
  new files into the library; **Restore saved version** puts the link to the saved version back.

## Restore on a new machine

On a machine without a library, the first-run screen offers **Restore my library**. Pick
the repository from your GitHub CLI sign-in or paste its address. AFK checks it is an AFK
library before downloading it, links your Core skills, applies your agent folders and
Manual/Automatic choices, and leaves packs off. Skills already here with identical files
are adopted; different ones move to a dated folder, so nothing is lost. Tools are listed
for you to run; none runs unless you tick it.

```sh
afk library connect owner/afk-library
afk library connect git@github.com:owner/afk-library.git --run-tools all
```

## The Skills page

**Skills** lists every skill once, with where it comes from: **Core** (saved in full in
your library), a pack, **This machine** (stays on this computer and is not saved), a
tool, or **To review** (installed outside AFK; Overview lists these under **Needs you** so
you can decide where each belongs). Search by name or description and filter by where a
skill comes from or its state. A Core skill missing on this machine can be installed from
its row.

Each row has an on/off switch, the Manual/Automatic choice and a **⋯** menu (inspect, edit
files, update, move to Core, a pack or this machine, drop, delete). Select a skill's name for its
details and files. Select several rows to turn them on or off, change their invocation,
update or delete them together.

**Packs** has its own page, and **Try later** bookmarks are on **Sources**.

AFK ships no default Core. You choose what goes in it.

### Follow a repository

Mark a Core source as followed with **Follow new skills** or `afk kit follow <repository>`.
**Check now**, or `afk kit check`, lists skills the repository has added since. AFK offers
them and never installs them automatically. Add the ones you want with
`afk kit add <skill> --source <repository>`.

## Packs

A pack is a named group of skills, possibly from several repositories. Packs are Global:
turn one on or off, or read its instructions once without turning it on. The library
saves the pack's definition; its skills download the first time you turn it on.

- Turning a pack off removes only AFK's links. The downloaded skills stay ready.
- A skill belongs to one source in a pack. A pack that selects one skill from two
  sources is rejected.
- A pack that is on can be edited. It stays on, added skills appear, and dropped skills
  lose only AFK's links.
- Remove a pack after it is off. Downloaded skill files remain.

```sh
afk packs use "My pack"
afk packs enable "My pack"
afk packs disable "My pack"
```

`afk profiles` still works as an alias. Names match without case sensitivity; duplicate
names need the pack ID.

## Installing

**Add something new** (on Overview or Sources), or `afk add <repository>`, is one place to install
from. Skills CLI does the work. AFK lists the repository's skills first, from a temporary
download, so you can read each `SKILL.md` before anything is installed. You then choose
where they go:

| Destination | What happens |
| --- | --- |
| Core | Installs into your library and joins Core, so your backup saves it. |
| A pack | Downloads into an existing or new pack. The pack stays on or off as it was. |
| This machine | Installs and stays out of your library. A project choice installs there instead. |
| Try later | Saves a bookmark and installs nothing. With no skills picked, it covers the repository. |

AFK remembers your last destination and agent. A failed installation changes nothing.

Skills already installed from that repository are adopted without reinstalling. A skill
installed from another repository is left unticked, with a warning, because installing
replaces it. Ticking it approves the replacement; in the CLI, pass `--replace`. A skill a
tool provides is left out, and AFK names the tool.

```sh
afk add owner/repo
afk add owner/repo --skill review --core --yes
afk add owner/repo --skill review --pack "Video" --yes
afk add owner/repo --skill review --here --project Work --yes
afk add owner/repo --later --yes
```

Without a skill and destination, a terminal asks for them. Unattended runs need `--skill`
or `--all`, a destination and `--yes`. For a published manifest URL, use `afk install`.

### Uploads

The install dialog also takes a `.zip`, a `.skill` file or a folder. AFK checks it before
writing anything (no unsafe paths, no symlinks, a size limit, at least one `SKILL.md`),
then lets you send the skills to Core, a pack or this machine. Uploaded skills in Core or
a pack are saved in full, because they can't be downloaded again. They never update
automatically, and a pack or Core that contains them can't be exported as a manifest.

## Editing a skill

**Edit files** in a row's **⋯** menu opens the editor: the skill's files on the left, plain
text with a Markdown preview on the right. Saving makes one save named `Edit <name>` and
reapplies your Manual/Automatic choice. For a skill that updates from a repository, the
first save asks whether to **keep your version** (its updates stop) or **let updates
replace your edits**. Tool skills, pack skills and skills AFK does not store open read-only.

## Try later

Try later holds repository bookmarks (`favoriteSources`). A bookmark can select specific
skills. Saving one installs nothing. Use a bookmark to copy a command, install, or start
a pack.

## To review

To review lists installed Global skills that are not in Core, a pack, a tool or this
machine only. For each one, choose:

- **Core** (or **Add to library**), to save it in your library.
- **Pack**, to add it to a pack.
- **This machine only**, to keep it here and stop being asked. `afk kit keep <skill>` does
  the same.
- **Remove**, to delete it from this machine.

A skill without a repository source can't be reinstalled elsewhere; link it to a tool or
keep it on this machine only.

## Tools that provide skills

A tool can list the skills it installs and updates in `provides`. AFK then tracks the tool
instead of each skill: its skills stay where the tool writes them, outside the library,
and `afk skills update` skips them. Update them with the tool's own command. Turning one
off moves it to `~/.afk/off`. Restore lists your tools for you to run.

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

`afk kit` compares Core with this machine. Nothing here installs a skill; use `afk add`.
Run `afk manage describe` for the matching operations (`kit/state`, `kit/add`, `kit/drop`,
`kit/machine-only`, `kit/follow`, `kit/upstream`).

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

Before it writes, AFK keeps the old file permanently as `~/.afk/backups/pre-kit-*.json`.
To undo the migration, copy that file back over your `settings.json`. The apply step
refuses a file that changed since the dry run, and a final check stops the write if
anything outside the intended change would be lost.

Migrate before you start a library: the library starts from the migrated settings.
