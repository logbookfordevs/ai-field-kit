# AFK management workflows

Run `afk manage describe <operation>` for current payloads. Read the relevant branch below before changing that state.

## Settings definitions

Resolve the file with `afk settings path`; read current JSON with `afk settings show` and guidance with `afk settings schema`. `show` returns defaults when no file exists. The runtime validator is authoritative: `afk settings validate [file]` validates JSON and exits nonzero on invalid input; it does not apply filesystem changes.

AFK snapshots `settings.json` into `~/.afk/backups/` before a save replaces it. `afk settings backups` lists them; `afk settings restore <name>` restores one after snapshotting the current file. A save refused with "different AFK configuration" means the file on disk belongs to another configuration: check the backups instead of forcing the write.

Direct edits are for `favoriteSources`, `tools` (including `provides`), `kit`, and inactive project definitions. Preserve the rest of the current document, especially `profiles` (the packs), `preferences`, `managedLinks`, `independentSkills`, and `agentRules` destinations/receipts. Prepare a candidate, validate it, check that the original has not changed, then replace it. Prefer `project/save` for project changes because it handles renames and associated state. Pack preparation, activation, invocation, rule ownership, and import use AFK operations.

`afk doctor --json` checks schema and local drift, including rule references. It is read-only. Read its findings and repair each through the relevant workflow; a clean report does not prove a running agent has loaded instructions.

## Kit and packs

Use `state` for inventories, pack IDs, readiness, and enabled targets, and `kit/state` for the kit compared with this machine. Scope is `Global` or an exact saved project name. Core is Global only.

- Compare: `afk kit` or `kit/state`. It lists Core status, tool-owned skills, installed skills not yet in the kit, and the sync plan.
- Add or drop: `afk kit add <skill>... [--pack <name>] [--source <repo>]` and `afk kit drop <skill>`. These edit the kit and install nothing. A skill without a repository source cannot go to Core; link it to a tool (`provides`) or run `afk kit keep <skill>` to keep it on this machine only.
- Install: `afk add <repo> [--skill <name>]... [--all] [--core | --pack <name> | --here [--project <name>] | --later] [--replace] --yes`, or `kit/install-preview` then `kit/install`. Show the user the skills from the preview and read them with `kit/install-read` when asked. Destination is the user's decision. `--replace` needs their approval for each skill installed from another repository. Skills a tool provides are refused; use that tool.
- Catch up one skill: `kit/sync` with the exact plan and `only: [name]`.
- Sync: show the plan from `kit/state`, then run `afk sync` or `kit/sync` with that exact plan. Sync installs missing Core skills and turns Core skills back on. It removes nothing. Run a tool's install command only after the user approves that command, with `--run-tools` or `runTools`.
- Follow: `afk kit follow <repo>`, then `afk kit check` lists new upstream skills. Add the ones the user chooses; nothing installs automatically.
- Create/edit a pack: discover repository or Global members with `discover`, choose explicit skill names, then `pack/save`. Saving a remote pack prepares missing selected copies in shared disabled storage and preserves existing copies. For several repositories pass `groups` (`[{source, skills}]`, each skill from one source). A pack that is on can be edited. Turn it off everywhere before removing it.
- Turn on or off: `afk packs enable <id> [scope]` / `disable`, or `activation`. This is additive and owns discovery links. Turning off preserves overlapping packs, independent availability, and preexisting files.
- `/afk-cli use pack <name>` means read that pack for this conversation. Match names without case sensitivity; quote names containing spaces when passing them to the shell. Use an ID to resolve duplicate names.
- Read a pack for this conversation: run `afk packs use <name-or-id>` or `pack/read`, then read the returned instructions and relevant supporting resources. This includes prepared disabled members and leaves activation unchanged.
- Share: `pack/manifest` returns a pack or `core` as a manifest. `pack/import-preview` then `pack/import` saves a reviewed manifest, passing both `pack` and `expected` unchanged. Neither installs anything.
- Inspect a skill: `afk skills get <name> [scope]` reads SKILL.md; `skill/read` also lists supporting files and can read a chosen relative file.
- Set individual availability with `skill/availability`, supplying the desired `enabled` boolean. Retries preserve that state. Turn off packs that own the skill before changing its individual availability. Invocation uses `invocation` and is independent of availability. Inspect the supported modes and current override before changing them; a project override can create an isolated copy, and reset restores its original/shared metadata behavior.

Verify inventories and enabled targets after availability changes, native metadata after invocation changes, and actual output after reads. Turning a skill off does not erase instructions already read in a conversation.

### Migration

If a write fails with the message that settings use the old stacks format, run `afk migrate` with no `--apply`. Show the dry run and let the user choose which stack becomes Core (`--core <stack-id>`), which repositories to follow, and which tools to link. Pass `--apply` only after the user approves that exact report. The old file is kept under `~/.afk/backups/pre-kit-*`. Remind the user that every machine sharing the file must update AFK.

## Sources and tools

Sources are bookmarks in `favoriteSources`, shown as Try later: saving one neither installs skills nor prepares a pack. Omit `skills` to select all; an explicit selection is a nonempty unique list of skill names. Changing the source requires reviewing that selection. Generate Skills CLI installation commands from the saved source/selection, destination, and optional agent; execute only when installation is requested with `source/install`.

When authoring a manifest, read the [version-one schema](https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/docs/schemas/skill-stack.v1.schema.json) and [complete example](https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/docs/examples/skill-stack.v1.json).

Tools are global definitions in `tools`. An optional `provides` lists the skills the tool installs; the kit then tracks the tool, and `skills/update` skips or refuses those skills. Saving or removing an entry changes management only. `tool/run` executes the saved install command from the home directory, and only after the user approves it; `update: true` selects update, falling back to install when empty. Inspect the saved command and use this operation when execution is authorized. Verify its returned output and exit code separately from saving the definition.

For installed-skill updates, use `skills/update` with the requested scope, or `afk skills update [name] -g` / `afk skills update [name] -p <project>`. Provide `names` to update only selected skills; omit it for all tracked skills. AFK delegates to Skills CLI in isolation and preserves availability and saved invocation preferences. Inspect `skills/update-state` for progress, output and exit code. In the active app session, `skills/update-cancel` stops preparation or downloading; once file replacement starts it finishes safely. Skills CLI receipts determine which installations can update; running it directly bypasses AFK availability protection. An inventory entry with `duplicate` has a real installed folder and an older stored copy; resolve it with `skill/resolve-duplicate` (`keep: installed` or `stored`; the other copy is deleted) after asking which to keep. `skills/schedule` sets this machine's automatic Global update (daily or weekly at a local time, only while the app runs); `skills/schedule-state` reads it with the next run and last automatic result.

## Agent rules

Read `rules/state` for the AFK folder, canonical files, saved hash, destinations, and conflicts. Author `AGENTS.md` and supporting Markdown under `references/` in that folder directly, or use `rules/save` with the full intended file set and the inspected `expectedHash`. Reference placeholders such as `{{development.md}}` resolve under `references/`; fix unresolved references before sync. Saving changes canonical content only.

Use `rules/destination` to register or update explicit destination files. Use `rules/preview` for selected IDs; inspect region changes, reference copies, backups, and errors. Apply with `rules/sync`, supplying the same IDs and exact preview object. A stale snapshot requires a fresh preview and review. Verify `rules/state` and the actual destination region/reference files. AFK preserves text outside its managed region. A Claude or custom destination can set `claudeMdImport: true` so sync also keeps an `@AGENTS.md` import in the neighbouring `CLAUDE.md`; the preview then lists that file as a separate change.

Conflicts require a deliberate choice from the user to adopt target edits or overwrite them. Inspect `rules/existing` and the preview first. `rules/adopt` returns a canonical draft and updates local ownership; review and save that draft, then preview/sync. `rules/overwrite` uses the reviewed `expectedRegion` and `expectedPreview`; preserve text outside the region. Broken or duplicate markers require manual boundary repair rather than an overwrite guess.

Use `rules/disconnect` with the chosen cleanup behavior: remove unchanged owned content, or leave files and forget management. Verify the resulting state and surrounding user content. Sync does not prove a running client has reloaded instructions; verify discovery through that client's reload/context behavior separately.

## Portable configuration

Use `workspace` or `location` to choose/move the AFK folder/settings file; AFK copies canonical Markdown and records the local pointer. Inspect the resolved path afterward, including any `AFK_SETTINGS` override. For switching ownership, turn packs off, disable active skills and disconnect managed destinations first. Let AFK enforce its preconditions rather than clearing receipts by hand.

`afk settings export <file>` exports configuration only and refuses to overwrite an existing file. Use `import` for reviewed settings JSON; turn packs off, disable individual skills and resolve managed links first. Import resets readiness, activation, and link/individual receipts while retaining local rules ownership. A version 1 file imports with an empty Core. Review local project paths and turn packs on intentionally afterward.

Use `bundle/export`, `bundle/preview`, and `bundle/import` for the portable AFK folder, including saved Markdown. Preview the archive and supply reviewed local destination and project mappings. Turn packs off, disable active skills and disconnect rules before replacing the folder. Import resets local ownership and does not execute tools, install skills, or sync rule destinations. Verify saved files and state, then turn on packs, run `afk sync`, and preview/sync rules only for the requested effects.

Transport through Git or a synced folder belongs to the chosen provider. AFK does not commit/push files, fetch rules repositories, or reconcile concurrent machines; ownership and destination paths remain machine-local.
