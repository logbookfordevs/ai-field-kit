# AI Field Kit

AI Field Kit provides portable building blocks that can be installed across supported AI harnesses.

## Skill Profiles

**Skill Catalog**:
The durable owner of individually configured skills and their global installation, invocation, composition, categorization, and startup policies.
_Avoid_: Profile cache, package index

**Catalog Skill**:
A skill referenced by a profile through the Skill Catalog. Its catalog policy remains authoritative wherever the skill is used.
_Avoid_: Profile Skill, Package Skill

**Profile Package**:
A remote skill source declared by a profile, optionally narrowed to selected upstream skills. Omitting the selection means the whole package.
_Avoid_: Skill Catalog, bundled profile

**Package Skill**:
A skill acquired through a Profile Package. It belongs to the profile layer and remains profile-only unless promoted to the Skill Catalog.
_Avoid_: Catalog Skill, imported skill

**Skill Promotion**:
The transfer of a Package Skill into Skill Catalog ownership so it can receive durable global configuration and be referenced as a Catalog Skill.
_Avoid_: Cache import, profile enablement

**Skill Provenance**:
The record of how a skill entered the local cache. Provenance does not determine which layer owns its policy.
_Avoid_: Skill ownership, startup policy

**Additive Activation**:
The default profile activation that enables the profile's skills without disabling unrelated active skills.
_Avoid_: Focus Activation, permanent enablement

**Focus Activation**:
An explicit profile activation that filters unrelated active skills according to the profile reconciliation mode.
_Avoid_: Additive Activation, catalog mode

## Custom Agents

**Custom Agent**:
A reusable AFK-defined agent role whose identity and instructions are independent of any single harness.
_Avoid_: Sub-agent, harness-specific agent

**Harness Adapter**:
The compatibility boundary that represents a Custom Agent in a supported harness.
_Avoid_: Agent definition, agent installer

**Capability Provider**:
An optional harness extension that supplies the native Custom Agent capability required by a Harness Adapter.
_Avoid_: Harness Adapter, Custom Agent

**Portable Agent Contract**:
The harness-independent description of a Custom Agent's identity, instructions, capabilities, and safety posture.
_Avoid_: Harness configuration, native agent file

**Portable Agent File**:
The single Markdown source containing a Custom Agent's Portable Agent Contract and instructions.
_Avoid_: Agent package, native agent file

**Agent Name**:
The stable identity shared by a Custom Agent's catalog entry and Portable Agent File.
_Avoid_: Catalog alias, native filename

**Custom Agent Catalog**:
The first-class AFK catalog area that discovers, presents, and provisions Custom Agents alongside other AFK setup areas.
_Avoid_: Agent installer, agent registry

**Agent Catalog Merge**:
The refresh rule where incoming entries replace matching Agent Names, new entries are appended, and existing entries absent upstream remain until explicitly removed.
_Avoid_: Catalog replacement, catalog synchronization

**Catalog Override**:
An explicit destructive refresh mode where the selected source becomes the entire targeted catalog state and local-only entries are discarded after two user confirmations.
_Avoid_: Catalog synchronization, Agent Catalog Merge

**Model Pin**:
An optional exact model identifier or native alias selected for one harness. When absent, the Custom Agent inherits that harness's model selection.
_Avoid_: Model tier, semantic model preference

**Effort Pin**:
An optional exact effort or thinking value selected for one harness. When absent, the Custom Agent inherits that harness's effort setting.
_Avoid_: Model tier, automatic effort

**Nickname Candidate**:
An optional presentation-only display name that a supporting harness may assign to a Custom Agent instance without changing its Agent Name.
_Avoid_: Agent Name, catalog label

**Required Capability**:
A capability without which a Custom Agent cannot preserve its intended behavior on a target harness.
_Avoid_: Preferred tool, optional capability

**Optional Capability**:
A capability that improves a Custom Agent but may be omitted without invalidating its intended behavior.
_Avoid_: Required tool, fallback capability

**Inheritance by Omission**:
The rule that an undeclared Custom Agent setting remains controlled by the target harness or parent session rather than receiving an AFK default.
_Avoid_: Default capability, automatic mapping

**Sub-agent**:
A runtime agent instance created from an available Custom Agent or other harness-provided role.
_Avoid_: Custom Agent, catalog agent

**Agent Provisioning**:
Making a Custom Agent available in a supported harness.
_Avoid_: Agent orchestration, agent launching

**Personal Scope**:
A provisioned Custom Agent available across the user's projects in one harness.
_Avoid_: Global agent, project agent

**Project Scope**:
A provisioned Custom Agent available only within one project in one harness.
_Avoid_: Local agent, personal agent

**Agent Orchestration**:
Launching, coordinating, and supervising runtime agents after they have been provisioned.
_Avoid_: Agent provisioning, agent setup
