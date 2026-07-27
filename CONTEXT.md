# AI Field Kit

AI Field Kit provides portable building blocks that can be installed across supported AI harnesses.

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
