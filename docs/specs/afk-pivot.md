# AFK Fieldwork specification

Status: implemented in this checkout; not published.
Approved direction: 2026-10-01.

## Purpose and boundaries

AFK manages local skills, shared profiles, favorite source bookmarks, and tool
commands. The CLI opens a local web app and exposes focused reading/activation
operations. Catalogs, setup presets, rules, hooks, MCP configuration, custom-agent
provisioning, and general setup orchestration are outside its scope.

The five sections are Profiles, Installed Skills, Favorite skill sources, Tools,
and Settings. Tools and Settings have no project picker. Profiles put the target
beside each activation action; Installed Skills uses a page-level inventory scope.

## Profiles

Definitions are shared and reusable. The current definition stores one source
reference, a name and identifier, selected skill names, readiness, and enabled
targets. Create from a repository or existing Global skills; multiple source
references in one definition are not currently supported.

Repository discovery delegates to Skills CLI in an isolated temporary workspace
and home. Users select members; only selected missing copies are retained under
`~/.agents/skills/.disabled/`. Existing available skills are preserved. Saving a
remote profile prepares its members; there is no remote-only invocation path.
Failures are visible, and the profile is not saved as ready on failure. Any selected
copies already prepared remain available for retry.

Global and project activation are independent. Selecting a target changes the
shown state only. Enabling creates owned discovery links; disabling withdraws only
owned exposure, preserving overlapping profiles, independent activation, and
preexisting user files. Activation is additive, with no focus mode.

Disable a profile in every target before editing or removing it. Removal deletes
the definition, not stored skill files. Skill names identify stored copies; another
source with the same name does not get a separate namespace. Review existing
members before reusing names across sources.

**Use with your agent** opens guidance and a copyable command for the profile ID.
`afk profiles use <id>` reads all locally prepared member instructions, including
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

Inspection reads real SKILL.md and supporting files inside the selected skill
folder. Individual availability is separate from profiles; disable owning profiles
before toggling a member directly. Independently available skills survive profile
disable. Existing files are not replaced merely because a profile names the skill.

Invocation settings are distinct from availability. Manual and Automatic write
Claude's `disable-model-invocation` and Codex's `allow_implicit_invocation` policy.
An override of a shared project skill makes an isolated local copy; reset reconnects
owned links to shared storage so later Global changes flow through. A physical
project-local skill restores its own original metadata. These controls do not
claim support for every agent.

Update-all copies `npx skills update -g` for Global or a command that changes to
the project directory and runs `npx skills update -p`. It never executes the update.
Skills CLI updates only installations it tracks; staged AFK copies are not a new
upstream-update registry.

## Favorite skill sources

Shared bookmarks store a name and source reference. Add, edit, remove, copy the
source link, copy one install command, or copy a sequential install-all script.
Command generation can select Global/project destination and an optional agent.
These actions never execute installation or uninstall removed bookmarks.

## Tools

Always global. Each entry has a name, install command, and optional update command;
an empty update reuses install. Install/Update explicitly run the saved command
from the home directory and show output and exit status. Results persist during
the server session even if the dialog closes. Duplicate concurrent runs for the
same entry are rejected. Removing an entry only removes it from management.

## Settings and projects

One settings file holds shared definitions, targets, preferences, and local link
receipts. Default and custom locations, precedence, physical paths, and import
semantics are detailed in [Settings and storage](../settings.md).

Add projects through a home-rooted folder browser with ancestor and parent
navigation, then select the folder and name it. Project creation does not enable
profiles. Rename preserves target names/preferences; changing a folder requires
its profiles to be disabled first.

Export downloads JSON. Import reviews folder mappings, replaces configuration,
clears local ownership receipts and individual activation state, and marks profiles
inactive/unprepared. Current profiles must be disabled first. Imported preferences
are stored but not applied to native files automatically. Saved tool commands do
not run. Prepare and enable intentionally on the destination machine.

A storage provider may sync the chosen settings file. AFK does not sync files,
reconcile concurrent machines, or automatically apply another machine's activation.

## Lifecycle and verification

The server binds loopback, checks host/origin, and requires the current session
token for APIs. Exit AFK stops accepting connections and shows a closed screen;
Ctrl+C also closes the server. Configuration and activation remain unchanged.
In-flight operations can finish as shutdown drains existing connections.

Typecheck, lint, build, ten regressions, installer checks, and focused browser
checks pass. The approved design was reviewed at desktop/mobile widths; real
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
