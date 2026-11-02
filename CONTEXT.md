# Domain Glossary

**Kit**:
The skills that travel with a user, stored once in the settings file and shared by every machine that uses it. It holds Core, packs and tool-provided skills.
_Avoid_: Backup, install plan, catalog

**Core**:
The always-on skills in the kit, grouped by original repository. Global only.
_Avoid_: Default pack, starter set, stack

**Pack**:
A shared named group of skills, possibly from several repositories, that is turned on per target or read once.
_Avoid_: Profile, stack, category, setup preset, project-owned pack

**Pack Member**:
A skill selected as part of a pack.
_Avoid_: Catalog skill, package policy

**Activation Target**:
Global or a named project where a pack's members are made available.
_Avoid_: Pack owner, installation source

**Global Scope**:
The user's home-level skill availability shared across agent work.
_Avoid_: All projects selected

**Project**:
A named local folder that can have its own skill availability and invocation preferences.
_Avoid_: Workspace profile, private catalog

**Prepared Skill**:
A locally stored skill ready for activation or reading, including a disabled skill.
_Avoid_: Enabled skill, remote-only member

**Availability**:
Whether a skill is exposed in the selected scope's discovery locations.
_Avoid_: Invocation mode, pack definition

**Independent Activation**:
Skill availability maintained outside pack membership.
_Avoid_: Pack activation, catalog ownership

**On-demand Reading**:
Retrieving a pack's member instructions for the calling agent without changing availability.
_Avoid_: Chat injection, automatic invocation

**Invocation Preference**:
A supported native setting controlling whether an available skill may be selected automatically.
_Avoid_: Enabled state, availability

**Machine-only Skill**:
An installed skill the user chose to keep on one machine. It is recorded in that machine's local state, never in the portable settings file, and the kit stops asking about it.
_Avoid_: Private skill, ignored skill

**Sync**:
Making one machine match the kit: installing missing Core skills, turning Core skills back on, and offering tool install commands. It never removes anything.
_Avoid_: Backup, restore, mirror

**Favorite Source**:
A shared bookmark to a skill repository, shown as Try later in the kit.
_Avoid_: Catalog entry, pack

**Tool Entry**:
A global saved tool name, install/update commands run explicitly by the user, and optionally the skills it provides.
_Avoid_: Installed tool, project tool

**Configuration**:
The portable definitions and selected state managed by AFK in one settings file.
_Avoid_: Skill files, catalog
