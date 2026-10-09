# AFK management workflows

Run `afk manage describe <operation>` for current payloads. Read the relevant branch below before changing that state.

## Settings definitions

Resolve the file with `afk settings path`; read current JSON with `afk settings show` and guidance with `afk settings schema`. `show` returns defaults when no file exists. The runtime validator is authoritative: `afk settings validate [file]` validates JSON and exits nonzero on invalid input; it does not apply filesystem changes.

Direct edits are for `favoriteSources`, `stacks`, `tools`, and inactive project definitions. Preserve the rest of the current document, especially `profiles`, `preferences`, `managedLinks`, `independentSkills`, and `agentRules` destinations/receipts. Prepare a candidate, validate it, check that the original has not changed, then replace it. Prefer `project/save` for project changes because it handles renames and associated state. Profile preparation, activation, invocation, rule ownership, and import use AFK operations.

`afk doctor --json` checks schema and local drift, including rule references. It is read-only. Read its findings and repair each through the relevant workflow; a clean report does not prove a running agent has loaded instructions.

## Profiles and skills

Use `state` for inventories, profile IDs, readiness, and enabled targets. Scope is `Global` or an exact saved project name. A project inventory lists that project's files; globally available skills can still be discoverable there.

- Create/edit: discover repository or Global members with `discover`, choose explicit skill names, then `profile/save`. Saving a remote profile prepares missing selected copies in shared disabled storage; it preserves existing copies. Inspect existing names before reusing them across sources. Disable every enabled target before changing members or removing a profile.
- Activate: use `afk profiles enable <id> [scope]` / `disable`, or `activation`. Activation is additive and owns discovery links. Disable preserves overlapping profiles, independent availability, and preexisting files.
- `/afk-cli use profile <name>` means read that profile for this conversation. Match names without case sensitivity; quote names containing spaces when passing them to the shell. Use an ID to resolve duplicate names.
- Read a group for this conversation: run `afk profiles use <name-or-id>` or `profile/read`, then read the returned instructions and relevant supporting resources. This includes prepared disabled members and leaves activation unchanged.
- Inspect a skill: `afk skills get <name> [scope]` reads SKILL.md; `skill/read` also lists supporting files and can read a chosen relative file.
- Set individual availability with `skill/availability`, supplying the desired `enabled` boolean. Retries preserve that state. Disable profiles that own the skill before changing its individual availability. Invocation uses `invocation` and is independent of availability. Inspect the supported modes and current override before changing them; a project override can create an isolated copy, and reset restores its original/shared metadata behavior.

Verify inventories and enabled targets after availability changes, native metadata after invocation changes, and actual output after reads. Disabling a skill does not erase instructions already read in a conversation.

## Sources, stacks and tools

Sources are bookmarks in `favoriteSources`: saving one neither installs skills nor prepares a profile. Omit `skills` to select all; an explicit selection is a nonempty unique list of skill names. Changing the source requires reviewing that selection. Generate Skills CLI installation commands from the saved source/selection, destination, and optional agent; execute only when installation is requested.

Stacks live in optional `stacks` entries as `{manifest,origin?}`. Each version-one
manifest has `id`, `name`, optional `description`, and ordered `sources` groups of
`{name,source,skills}` with explicit selected names. Import JSON or a direct HTTPS
JSON URL through `stack/preview`. Inspect its proposed stack and existing snapshot,
then pass both unchanged to `stack/save`. For refresh, preview the saved origin
with its ID; compare all groups and local edits before replacement. Use
`stack/script` for the selected scope/agent and `stack/remove` with the inspected
existing snapshot. These operations manage definitions or return text; they do
not install skills, create profiles, or change activation. Manifest refresh changes
selections; installed package updates remain a separate Skills CLI action.

Tools are global definitions in `tools`. Saving or removing an entry changes management only. `tool/run` executes the saved install command from the home directory; `update: true` selects update, falling back to install when empty. Inspect the saved command and use this operation when execution is authorized. Verify its returned output and exit code separately from saving the definition.

For installed-skill updates, use `skills/update` with the requested scope, or `afk skills update [name] -g` / `afk skills update [name] -p <project>`. Provide `names` to update only selected skills; omit it for all tracked skills. AFK delegates to Skills CLI in isolation and preserves availability and saved invocation preferences. Inspect `skills/update-state` for progress, output and exit code. In the active app session, `skills/update-cancel` stops preparation or downloading; once file replacement starts it finishes safely. Skills CLI receipts determine which installations can update; running it directly bypasses AFK availability protection.

## Agent rules

Read `rules/state` for the AFK folder, canonical files, saved hash, destinations, and conflicts. Author `AGENTS.md` and supporting Markdown under `references/` in that folder directly, or use `rules/save` with the full intended file set and the inspected `expectedHash`. Reference placeholders such as `{{development.md}}` resolve under `references/`; fix unresolved references before sync. Saving changes canonical content only.

Use `rules/destination` to register or update explicit destination files. Use `rules/preview` for selected IDs; inspect region changes, reference copies, backups, and errors. Apply with `rules/sync`, supplying the same IDs and exact preview object. A stale snapshot requires a fresh preview and review. Verify `rules/state` and the actual destination region/reference files. AFK preserves text outside its managed region.

Conflicts require a deliberate choice from the user to adopt target edits or overwrite them. Inspect `rules/existing` and the preview first. `rules/adopt` returns a canonical draft and updates local ownership; review and save that draft, then preview/sync. `rules/overwrite` uses the reviewed `expectedRegion` and `expectedPreview`; preserve text outside the region. Broken or duplicate markers require manual boundary repair rather than an overwrite guess.

Use `rules/disconnect` with the chosen cleanup behavior: remove unchanged owned content, or leave files and forget management. Verify the resulting state and surrounding user content. Sync does not prove a running client has reloaded instructions; verify discovery through that client's reload/context behavior separately.

## Portable configuration

Use `workspace` or `location` to choose/move the AFK folder/settings file; AFK copies canonical Markdown and records the local pointer. Inspect the resolved path afterward, including any `AFK_SETTINGS` override. For switching ownership, disable active profiles/skills and disconnect managed destinations first. Let AFK enforce its preconditions rather than clearing receipts by hand.

`afk settings export <file>` exports configuration only and refuses to overwrite an existing file. Use `import` for reviewed settings JSON; disable profiles and individual skills and resolve managed links first. Import resets readiness, activation, and link/individual receipts while retaining local rules ownership. Review local project paths and prepare/enable profiles intentionally afterward.

Use `bundle/export`, `bundle/preview`, and `bundle/import` for the portable AFK folder, including saved Markdown. Preview the archive and supply reviewed local destination and project mappings. Disable active profiles/skills and disconnect rules before replacing the folder. Import resets local ownership and does not execute tools, install skills, or sync rule destinations. Verify saved files and state, then prepare, activate, and preview/sync only the requested effects.

Transport through Git or a synced folder belongs to the chosen provider. AFK does not commit/push files, fetch rules repositories, or reconcile concurrent machines; ownership and destination paths remain machine-local.
