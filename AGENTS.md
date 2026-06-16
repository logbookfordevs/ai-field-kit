# Project Development Notes

These notes are for agents working on this repository. They are not AFK's exported user rules.

## Skill Design

If the skill changes posture, keep it tiny.
If the skill coordinates a process, add structure.
If the skill must produce a durable artifact with invariants, be explicit.
If the skill compensates for model weakness or fragile tooling, use scripts/references instead of prose.
Do not overfit prompts for weak-model failure modes as workflow uses frontier or recent models.
Do not spend context on instructions the model can already infer, and do not bury the trigger/behavior signal under prose.

## Glossary

- **You / agent**: the AI agent reading these instructions and doing the work.
- **Me / we / us**: Leonardo and collaborators shaping AFK.
- **Users**: people who will use AFK, generated rules, skills, hooks, docs, or installer flows.
- **Developers**: users who build with AFK or with agents configured by AFK; do not assume they will read implementation code.
- **Agents / multi agents / team of agents**: child agents or sub-agents spawned to work in parallel, not the single agent currently reading this file.
- **AFK / AI Field Kit**: the product and ecosystem as a whole, not only a subset of skills.
- **Skill**: an instruction package for an agent. Keep it tiny unless it coordinates a process or must produce durable artifacts with invariants.
- **CLI**: an executable command and the preferred owner for install/setup orchestration when AFK needs to configure skills, MCPs, hooks, rules, or plugins.
- **MCP**: a tool-server integration surface. Do not treat it as interchangeable with a CLI; compare capability, automation behavior, and token overhead.
- **Hook**: deterministic background automation. When the goal is low-context, low-token behavior, prefer hooks over always-present instructions or MCP layers.
- **App / connector**: a Codex-style connector backed by app metadata and tools. It is not just another name for a skill bundle, plugin, or CLI.
- **Plugin**: packaging for Codex-native surfaces such as skills, MCP servers, apps/connectors, and metadata. A local skill-only plugin must beat `npx skills add <repo>` on user value before becoming the default recommendation.
- **Just / focus just on**: an explicit scope limiter. Stop widening the task and do only the narrowed request.
- **BMAD / Get Shit Done / spec-driven workflow**: structured clarification and implementation workflows, not generic surveys. If referenced in planning, preserve interactive question flows and adaptive follow-ups.
