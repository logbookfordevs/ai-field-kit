# Project Development Notes

These notes are for agents working on this repository. They are not AFK's exported user rules.

## Design Context

For AFK brand or site work, read `PRODUCT.md` for strategy and `DESIGN.md` for the visual system before changing `apps/site/` or generated visual artifacts. `PRODUCT.md` owns audience, purpose, boundaries, and anti-references; `DESIGN.md` owns colors, type, components, and design guardrails.

## App Context

For CLI and local-app changes, read `docs/specs/afk-pivot.md` and `docs/development.md`. For interface work, use `packages/afk/web/DESIGN.md`; root `DESIGN.md` retains the brand. Keep website work separate unless explicitly requested.

## Skill Design

If the skill changes posture, keep it tiny.
If the skill coordinates a process, add structure.
If the skill must produce a durable artifact with invariants, be explicit.
If the skill compensates for model weakness or fragile tooling, use scripts/references instead of prose.
Prompts earn detail through observed failure, not anticipated failure.
Do not spend context on instructions the model can already infer, and do not bury the trigger/behavior signal under prose.

Do not test authored body content in skills, rules or `AGENTS.md` files, or custom-agent definitions. Test their parsing, discovery, installation, metadata, and runtime behavior without pinning prose, headings, examples, ordering, or required phrases.

## Glossary

- **You / agent**: the AI agent reading these instructions and doing the work.
- **Me / we / us**: Leonardo and collaborators shaping AFK.
- **Users**: people who use AFK’s local app, CLI, skills, profiles, tool commands, or documentation.
- **Developers**: users who build with AFK or with agents configured by AFK; do not assume they will read implementation code.
- **Agents / multi agents / team of agents**: child agents or sub-agents spawned to work in parallel, not the single agent currently reading this file.
- **AFK / AI Field Kit**: the product and ecosystem as a whole, not only a subset of skills.
- **Skill**: an instruction package for an agent. Keep it tiny unless it coordinates a process or must produce durable artifacts with invariants.
- **CLI**: AFK’s executable entry point for opening the local app, reading skills or profiles, changing profile activation, and exporting settings. Skills CLI owns external skill installation and updates.
- **Just / focus just on**: an explicit scope limiter. Stop widening the task and do only the narrowed request.
- **BMAD / Get Shit Done / spec-driven workflow**: structured clarification and implementation workflows, not generic surveys. If referenced in planning, preserve interactive question flows and adaptive follow-ups.

## Agent Delegation

When the user invokes a skill that explicitly asks for a background agent, child agent, sub-agent, fresh-context review, or delegated reading/research pass, treat that skill instruction as explicit user approval to use available sub-agent tooling for that bounded task. Do not degrade to self-review only because the host requires explicit delegation; the selected skill is the delegation request.
