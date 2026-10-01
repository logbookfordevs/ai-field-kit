# AFK pivot: skills, profiles, and tools

Status: implemented locally against the final Open Design export; not published.
Date: 2026-09-30.

## Purpose

Keep the AFK name. Change what the product does.

AFK becomes a local management app for the skills and tools a developer actually uses. Its CLI opens a web UI and exposes the relevant operations for agents and terminal use.

The current product has grown beyond Leonardo’s everyday needs. Its catalog and broad installation orchestration create too much maintenance and make its purpose hard to explain. The pivot preserves the useful behaviors without preserving every existing abstraction.

The core jobs are:

- Inspect skills and control their availability and supported invocation settings.
- Define reusable groups of skills, enable them globally or for a project, and manually load a whole group into an agent conversation.
- Maintain a personal list of tool install and update commands.
- Keep the configuration in one portable settings file at a user-selected location.

The local build implements these workflows. Native invocation metadata and filesystem
activation are tested; discovery inside live Claude Code and Codex conversations
has not been verified. Manual profile use prints instructions for the calling agent
to read, rather than injecting another conversation. Skills CLI updates only the
installations it tracks.

## Product surfaces

The main sections are Profiles, Installed Skills, Favorite skill sources, Tools, and Settings.

The prototype’s Agent Experience section explains the proposed integration. It is not a required permanent product section.

Tools and Settings have no project selector. Profiles have a scope selector beside each profile’s activation action. Installed Skills has a page-level scope selector because its inventory depends on the selected path.

## Shared definitions and project scope

Profile definitions are shared. Tool definitions are always global. Creating either does not create a project-owned definition.

A project is a named folder configured in Settings. Project scope controls profile activation and supported skill invocation overrides. It does not create a separate profile catalog, separate tool list, or separate downloaded copy of every profile skill.

The same profile can be enabled in multiple projects, globally, or in both kinds of scope. Changing one scope does not silently change another.

Global availability can still make a skill available while a project-specific activation is absent. The UI must distinguish a scope’s activation from effective availability inherited from global discovery. Project-only suppression of globally available skills has not been settled.

## Profiles

### Definition

A profile contains a name, source references, and selected skill members. It can be formed from existing local skills, source repositories, or a combination.

A package is a convenient group of skills discovered from a source. It is not a category taxonomy or a new general-purpose package manager.

Profiles do not automatically install the CLI tools their skills describe. Tools remain a separate, explicitly operated section.

### Create

1. Enter a profile name.
2. Add a source repository or select existing skills.
3. Discover the source’s available skills using Skills CLI where its capabilities fit.
4. Select the desired members. A whole package can be selected as a convenience.
5. Save the profile and prepare missing members through Skills CLI.
6. Keep newly prepared members disabled in shared home-level skill storage.

Existing skill availability is preserved. Creating a profile does not disable skills already enabled by the user.

Saving a new remote profile includes preparing its selected members locally. The agreed design does not keep remote-only profiles and defer arbitrary remote retrieval to each invocation.

Discovery or preparation failures must be visible. A partially prepared profile must not be presented as ready. Recovery and rollback details need an implementation decision.

### Enable and disable

Each profile has an **Enable for** dropdown beside its **Enable / Disable** action. The choices are Global and the projects configured in Settings.

Selecting a scope changes the target and displayed state only. It does not enable, disable, download, or relocate skills.

Enable exposes the profile’s stored members to agent discovery in the selected scope. Project enable creates project symlinks to shared stored copies. Global enable exposes those copies in the global discovery locations.

Disable removes only the selected scope’s AFK-managed exposure. Shared copies remain stored. Exposure still required by another enabled profile or independent activation is preserved.

The UI must identify the target of the action and distinguish “enabled in this project” from “available globally.” Several profiles can be active together; activation is additive.

### Manual invocation of a group

A profile can be invoked manually as one group. AFK reads its selected members from local storage, including disabled members, and returns their instructions to the requesting agent. It also makes required supporting resources accessible.

Invocation does not create discovery links, enable the profile, or change persistent activation state. The loaded instructions remain in the conversation; disabling a profile later does not erase them.

For an open-ended task, the agent can choose its approach before retrieving tool-specific guidance. Explicitly invoking a profile is the user’s choice to provide that guidance. Loading competing tool profiles first would not meet the stated goal of avoiding premature influence on tool choice.

A proposed Claude Code flow is:

1. The user invokes a small AFK entry command with a profile name.
2. The entry command directs the current agent to call AFK’s group-reading operation.
3. AFK resolves the profile and reads its locally prepared members.
4. The agent reads the result and continues the existing task.

The prototype uses `/afk-use hyperframe` and `afk profiles use hyperframe` as illustrative commands. Names, integration, and refresh behavior are not verified. The CLI cannot silently inject into another running agent’s context.

A single small integration entry point may need setup. The individual profile members do not need to be enabled for manual group invocation.

### Edit and remove

The UI supports editing names, sources, and member selections. Added remote members are prepared disabled; existing independent availability remains intact.

Updating membership while a profile is active, handling new members discovered after upstream updates, and deleting active profiles need explicit implementation rules. The prototype currently requires disabling active profiles before editing membership. That is a prototype simplification, not a settled product requirement.

## Physical skill storage

Use the home-level `.agents` skill storage rather than introducing a separate `.afk` skill store. Prepare profile members once on each machine.

The intended model is:

```text
Shared stored copies
~/.agents/skills/.disabled/<skill>/

Global exposure, when enabled
<global agent discovery location>/<skill> -> shared stored copy

Project exposure, when enabled
<project agent discovery location>/<skill> -> shared stored copy
```

Keep stored targets stable so disabling global exposure does not break project links. Project activation creates links rather than another installation.

The exact canonical layout is proposed. Verify whether disabled directories are ignored by every supported agent, how Skills CLI lockfiles and updates interact with stored copies and links, and which agent directories need exposure.

AFK must preserve user-owned files, identify name/source collisions, and track its own contributions sufficiently to disable one profile without breaking another. Do not assume two skills with the same name from different sources are interchangeable.

Ordinary skills installed directly by the user can remain in their existing locations. Do not silently migrate them into profile storage.

## Installed Skills

Selecting Global lists global skill entries, including disabled global storage where appropriate.

Selecting a project lists only skill entries in that project’s configured path, including AFK-created project links. Exclude global-only entries, even if those skills are also available to the agent through global discovery. Do not list the entire shared library as if it were installed in every project.

Users can inspect skill content and relevant supporting files, enable or disable individual skills, and change supported invocation preferences.

Individual activation and profile activation must compose: removing individual activation does not hide a skill still exposed by an active profile.

Invocation choices are Manual, Automatic selection allowed, and Restore original. Project settings may inherit a global preference unless explicitly overridden.

“Automatic” permits agent selection; it does not guarantee execution. Availability and invocation are separate controls.

Use agent-native settings where possible. A project preference must not rewrite a shared skill’s metadata in a way that changes other projects. Unsupported controls must be shown honestly. Agent-specific behavior requires verification.

## Tools

Tools is always global and independent of the project being viewed elsewhere.

A tool contains:

- Name.
- Install command.
- Optional update command.

If update is empty, Update executes the install command. This is the user-defined behavior; AFK does not infer a package manager or a different update strategy.

Available actions are Add, Edit, Remove entry, Install, and Update.

Removing an entry removes it from AFK’s management configuration. It does not uninstall the tool or delete its files.

Install and Update run the command explicitly selected by the user, display output, and report its result. A successful command is not automatically proof that the tool is installed or usable.

Execution is global and must not inherit the currently selected project’s working directory. Display the execution context; the exact fixed working-directory policy remains to be chosen.

No dependency solver, automatic recommendations, or general tool setup framework is included. Detection commands, uninstall commands, scheduling, and bulk execution were not requested.

## Projects

Projects are managed in Settings. Adding or editing a project does not enable profiles.

### Add project

1. Open a folder browser at the user’s home folder.
2. Navigate folders using breadcrumbs and a parent/back action.
3. Choose **Use this folder**.
4. Use the folder name as the suggested project name; allow renaming.
5. Save the project definition.

Do not require typing a folder path as the primary experience. The actual local app can obtain directory listings from its local server. The prototype uses sample folders only and cannot open Finder or browse the real machine.

An optional include-subfolders control exists in the prototype. Recursive matching and precedence for overlapping paths need a final decision before implementation.

Profile activation happens in Profiles, not in project creation or Settings.

## One settings file

Keep the configuration in one user-selected settings JSON file. Do not require maintaining the previous rich catalog or opening an IDE to manage it.

The file contains shared profile definitions, global tool entries, global skill preferences, project definitions and overrides, and the selected activation state of profiles in each scope.

Use **Global**, not **Defaults**, for the global configuration section.

The web UI and CLI read and edit the same file. A small machine-local pointer identifies its location; this pointer is not another catalog.

Users can put the file in a Google Drive or other synced folder. AFK writes there; the folder provider handles synchronization. AFK does not build a sync service or claim a save has completed remote synchronization.

Local skill files remain on each machine. Workspace paths may need remapping after import or on another machine. The file records selected state, not proof that corresponding links and stored files exist everywhere.

Enable and Disable update the recorded activation state after successful local application. Partial failures must not silently turn selected state into a false success claim. Transaction and reconciliation details need verification.

### Illustrative shape

This demonstrates semantics, not a finalized schema:

```json
{
  "profiles": {
    "hyperframe": {
      "source": "<repository link>",
      "skills": ["skill-a", "skill-b"]
    }
  },
  "tools": {
    "my-cli": {
      "name": "My CLI",
      "install": "<install command>",
      "update": ""
    }
  },
  "global": {
    "enabledProfiles": [],
    "invocation": {}
  },
  "projects": {
    "demo-studio": {
      "name": "Demo Studio",
      "path": "~/Projects/demo-studio",
      "enabledProfiles": ["hyperframe"],
      "invocation": {}
    }
  }
}
```

Exact field names, support for multiple sources, source identity, independent skill activation records, machine-specific path mappings, and format versioning remain to be designed.

### Export and import

Export downloads the settings JSON file. Import accepts a saved configuration file. “Show export” and paste-in JSON are prototype conveniences, not the intended final interaction.

Import does not run tool commands or activate skills immediately. It loads configuration, identifies local path and preparation gaps, and offers explicit application once those are resolved.

Imported command entries are saved data until the user chooses an execution action. Changed synced configuration likewise must not silently execute commands.

Validate configuration and preserve the previous usable file on parse or write failure. Handling concurrent edits, external changes, and synced-file conflicts needs an explicit implementation policy.

## Scope removed from AFK

The new product does not own the rich skill catalog, taxonomy, recommendations, or favorites library. Users can keep favorites in Notion or elsewhere.

It does not orchestrate general rules, hooks, MCPs, custom agents, or an extension ecosystem. No new framework is introduced to support optional integrations.

Skills CLI owns source discovery and installation mechanics where suitable. AFK coordinates only the selected profile preparation and the availability/state behavior required here. This is narrower than restoring the current broad installer wrapper.

Direct single-skill inspection remains useful, but there is no separate Saved Sources section. Source references belong to profiles, and the main on-demand value is invoking a group.

No automatic profile expiry, session-end cleanup, automatic updates, or guaranteed token savings are part of this spec.

## Evidence and implementation questions

Skills CLI’s current README documents repository discovery through `skills add <source> --list`, selected installation, and a single-skill use-without-installing operation. Prefer its existing capabilities before writing discovery or retrieval substitutes. Machine-readable discovery and compatibility with disabled storage still need testing.

AFK’s existing source includes start-disabled installation handling and profile-related storage behavior. The inspected code installs through upstream tooling and then reconciles disabled storage. This is reusable evidence, not proof that the proposed new flow is already correct or safe during every intermediate state.

Skill Cabinet documents inspection, quarantine, and restore, so basic skill management overlaps with an existing tool. Compare reusable approaches before building those parts. The proposed AFK-specific value is reusable groups, per-scope activation, group invocation, global tool commands, and portable personal configuration.

Before implementation, resolve:

- Supported agents and their discovery, symlink, invocation override, and refresh behavior.
- Canonical disabled storage, upstream lockfile/update compatibility, and isolation during first installation.
- Source identity, collisions, overlapping profile ownership, and independent activation preservation.
- Membership updates and profile removal while enabled.
- Shared configuration versus machine-local observed state and path mappings.
- Path matching, recursive overrides, and global/project precedence.
- Native manual-entry integration and supporting-resource access for group invocation.
- A supported way to obtain discovery results for the UI.
- Exact schema, import/reconciliation behavior, and file-write/conflict handling.

These are implementation questions inside the agreed scope, not authorization to widen it.

## Acceptance scenarios

- Create a source-backed profile, select members, and prepare new copies disabled without changing existing availability.
- Enable the same profile for two projects using shared copies; disabling one preserves the other.
- Enable globally and locally; removing one scope preserves the other’s references.
- Disable one of two overlapping profiles; shared members remain available while still required.
- Manually invoke a disabled profile; return the whole selected group’s local guidance and resources without creating discovery links.
- View a project’s skill inventory; exclude global-only skills and include project links.
- Apply a project invocation preference without altering other projects’ shared content.
- Update a tool with no update command; execute its saved install command. Remove its entry without uninstalling.
- Navigate sample or real folders, add a project, and leave profile activation unchanged.
- Export/import settings, remap paths, and apply explicitly without automatic tool execution.
- Save settings to a user-selected synced folder and distinguish local save from provider synchronization.

## Prototype and delivery state

The in-conversation prototype is `work/afk-pivot/skill-switchboard.html`. It uses illustrative repositories, skill members, folders, commands, and local state. It does not operate the filesystem, install skills, execute commands, synchronize files, or integrate with a real agent.

Its simulated interactions have received focused syntax and behavior checks. It has not received rendered browser QA. The Installed Skills inventory still needs correction to exclude global-only/shared entries in project scope. The spec is authoritative over inconsistent prototype behavior or abandoned storage proposals.

No production implementation, migration, removal of existing features, release, push, or publication is authorized or claimed by this recap.

## References

- [Skills CLI](https://github.com/vercel-labs/skills)
- [Claude Code skills and invocation controls](https://code.claude.com/docs/en/skills)
- [Skill Cabinet](https://github.com/subsy/skill-cabinet)

## Favorite skill sources and external updates

Favorite sources are global bookmarks containing a name and repository reference. Users can add, edit, and remove bookmarks, copy a source link, copy its Skills CLI install command, or copy a sequential script for all saved sources. Commands target a chosen global/project scope and optionally an agent. These controls never execute installation.

Installed Skills provides a copy-only update command for the selected scope: `npx skills update -g` globally, or a project-directory command followed by `npx skills update -p`. Skills CLI owns update behavior and updates the installations it tracks; AFK does not execute updates or invent an update `--all` flag.
