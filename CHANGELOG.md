# Changelog

This changelog tracks meaningful updates by version and date.

## How We Use This File

- Keep unreleased work in `## TBD - TBD`; when a batch feels complete, move it into a versioned section like `## v0.5.0 - 2026-05-19`.
- Prefer reader-focused summaries over raw commit messages.
- Group bullets by area prefix when helpful: `docs:`, `skills:`, `workflows:`, `mcps:`, `sync:`, `rules:`.
- Skip trivial noise. Record changes that affect how someone uses, syncs, extends, or trusts the kit.

## TBD - TBD

- `cli:` added an interactive setup banner notice when a newer `@logbookfordevs/afk` release is available on npm.
- `release:` renamed the publishable AFK CLI package to `@logbookfordevs/afk` and made npm the recommended user-facing install path.
- `docs:` moved the hosted `install.sh` path out of the public setup journey; `scripts/install.sh --local` is now documented as a development helper.
- `cli:` added a compact additional-agent prompt for skill installs that explains `.agents/skills` as always included, then passes selected Claude Code, Kiro CLI, Kilo Code, Pi, and Droid targets through to the official `skills` CLI with `--agent`, including noninteractive `afk setup skills --yes --agent ...` runs.
- `cli:` refined guided setup so a utilities-only route no longer asks for agent targets, and the setup banner now points to `afk setup refresh` when local manifests may be stale.
- `repo:` migrated AFK CLI tests from Node's built-in test runner to Vitest and added GitHub Actions CI for AFK typecheck, AFK tests, and the site production build.

## v0.5.2 - 2026-05-27

- `cli:` changed global rules sync to merge the AFK managed region into each agent's own rule file instead of replacing Codex, Antigravity/Agy, or OpenCode hosts with symlinks.
- `cli:` added top-level `afk --version` and `afk -v` output sourced from the CLI package metadata.
- `cli:` replaced the setup refresh flag with `afk setup refresh`, including `--local` support for refreshing project-level `./afk/manifests`.
- `cli:` added hook installation as a first-class setup area, with `hooks.json`, interactive selection, manifest show/configure support, dry-run planning, and safe merging into Codex, Claude Code, and local Cursor hook configs.
- `cli:` added the AFK execution-tracking stop hook source and hook install planning for copying managed hook scripts into agent-specific hook folders.
- `cli:` added Cursor aliases for local hook setup while keeping Cursor out of general rule/MCP/utility agent targeting.
- `cli:` made `afk setup rules`, `afk setup skills`, `afk setup mcps`, `afk setup utils`, and `afk setup hooks` the canonical area commands while keeping the older `sync`/`install` forms as compatibility aliases.
- `cli:` expanded setup help so `afk setup --help` lists setup subcommands and each setup area help screen explains shared options instead of showing bare flags.
- `cli:` refined the AFK terminal banner colors for a warmer, more legible setup experience.
- `release:` added an AFK version bump helper that promotes the current changelog TBD section, updates the CLI package version, and refreshes the pinned install example.
- `repo:` added a pnpm workspace and root package scripts so the AFK package and site can live in the same repository cleanly.
- `repo:` added project-local Codex config and refreshed agent guidance, including the dictionary rule that maps "team of agents" and "multi agents" to spawned child agents.
- `skills:` added `afk-pickup` as a manual support skill for finding and resuming disposable handoff notes from the OS temp directory.
- `skills:` added Matt Pocock's external `handoff` skill to the default setup recommendations with manual invocation, pairing it with `afk-pickup` for the next-session resume flow.
- `skills:` renamed `afk-documentation-authoring` to `afk-doc-craft` across the skill directory, README, manifests, and dependent skill references.
- `skills:` refined `afk-execution-tracking` around active checkpoint files, review gates, split-plan handoffs, and stale-tracking recovery.
- `repo:` added project-local agent guidance that prefers tiny skills for naturally clear jobs instead of turning every skill into a workflow ceremony.
- `site:` moved the AI Field Kit React/Vite site into this repo under `apps/site`, including the Vite app, favicon assets, provider icons, Tailwind styling, workspace wiring, and root scripts for site build/dev workflows.
- `site:` exposed the canonical installer at `/install.sh` through the site and updated README setup docs to prefer the hosted `https://ai-field-kit.logbookfordevs.com/install.sh` path.
- `docs:` added README guidance for the hosted install path, hook manifests, shorter setup area commands, and the renamed `afk-doc-craft` documentation skill.

## v0.5.1 - 2026-05-19

- `cli:` restored the tracked AFK CLI source package and release packaging that were missing from the `v0.5.0` release, so the published archive now includes the runnable setup router code instead of only documenting it.
- `cli:` restored `afk manifests show`, refresh-only `afk setup --refresh-defaults`, remote-first manifest refresh behavior, and clean release-asset packaging without bundled manifests, stale doctor output, or compiled tests.
- `cli:` removed the separate workflow manifest and command-sync lane; workflow-style AFK procedures now ship through `skills.json` as manual-invocation skills.
- `cli:` renamed the AFK Gemini target to Antigravity/Agy, kept `gemini` as a compatibility alias, switched MCP delegation to `add-mcp -a antigravity`, and routed RTK project setup through `rtk init --agent antigravity`.
- `sync:` removed the deprecated `sync-ai-agents.sh`, `sync-ai-workflows.sh`, and `sync-ai-mcps.py` scripts now that setup routes through the AFK CLI and upstream installer CLIs.

## v0.5.0 - 2026-05-19

- `cli:` added the initial AFK CLI package under `packages/afk`, centered on `afk setup` as an inspect-first setup router for rules, skills, MCPs, and utilities.
- `cli:` added a warm guided setup experience with an AFK banner, scope selection, and granular checkboxes for setup areas, agents, skills, MCPs, and utilities.
- `cli:` added TypeScript implementations for AFK-owned rules sync while keeping third-party installation delegated to the official `skills` and `add-mcp` CLIs.
- `cli:` added remote-owned JSON manifests for skills, MCPs, utilities, rules, and presets so recommendations can evolve without patching the CLI.
- `cli:` added editable local manifest storage under `~/.agents/afk/manifests`, plus `--init-only`, `--empty`, `--refresh-defaults`, and `--defaults-source` setup modes.
- `cli:` added `afk manifests configure` for authoring global or repo-local manifest files and `afk manifests show` for inspecting global or project-local manifest state.
- `cli:` added rules sync that injects AFK rules into managed regions inside host rule files without replacing user-owned content.
- `cli:` added non-interactive delegated skill installs through `skills add --global --yes`, letting the official `skills` CLI handle agent target fanout.
- `cli:` added initial AFK-owned rule support for Codex, Claude Code, Gemini, and OpenCode; skills and MCP coverage remains owned by their upstream CLIs.
- `cli:` keeps workflow-style AFK procedures in `skills.json` as manual-invocation skills instead of maintaining a separate workflow manifest or command-sync lane.
- `cli:` added `afk setup utils install` for curated utilities, starting with Plannotator and RTK delegated installs plus RTK initialization for selected agents.
- `cli:` added best-effort utility installation and grouped setup summaries so one utility failure does not block the rest of the selected setup route.
- `cli:` added release-asset packaging and install scripts for GitHub Releases while keeping `--source local` available as an explicit development escape hatch.
- `rules:` replaced inline/imported AFK workflow doctrine in `AGENTS.md` with a small trigger that invokes the `afk-workflow` skill when workflow artifacts, specs, plans, RFCs, or tracking are involved.
- `skills:` added `afk-workflow` as the activatable doctrine skill for artifact boundaries, RFC positioning, implementation planning, execution tracking handoff, and default artifact conventions.
- `skills:` standardized generated workflow artifacts around the repo/user convention first, with AFK fallback defaults under `docs/<task-slug>/<task-slug>.<type>.md` and task references under `docs/<task-slug>/references/`.
- `skills:` added `afk-execution-tracking` for checkpointed implementation after a plan exists, including task status, validation, engineer/product review gates, resume context, and parallel-agent coordination.
- `skills:` renamed `afk-ask-gemini` to `afk-ask` and generalized it into a standalone local advisor skill for Claude, Codex, and Gemini CLIs, preserving reusable artifacts while keeping the advisor read-only by default.
- `skills:` aligned artifact-writing skills with repo/user artifact rules instead of hardcoded AFK paths, using `afk-workflow` as the fallback convention.
- `sync:` writes AFK rules as raw managed regions in host rule files, including `CLAUDE.md`, so reruns update AFK-owned content without replacing user-owned rules.
- `docs:` reframed the README around "standalone skills with an optional workflow path," added the current AFK workflow map, and removed internal handoff-contract details from the public README.

## v0.1.1 - 2026-04-08

- `repo:` started lightweight versioning for changelog entries instead of relying only on date buckets.
- `skills:` introduced the first AFK spec-driven primary skill set around brainstorming, deep interview, and decision-shaping before implementation.
- `skills:` refactored `afk-brainstorming-facilitator` by rebasing it on the original BMAD brainstorming architecture, while adapting it to AFK paths, lighter setup, stronger partnership tone, and durable `artifacts/`-based session persistence.
- `skills:` replaced `afk-discuss-implementation-decisions` with `afk-coding-tradeoffs`, a more AFK-native skill for resolving UX and implementation trade-offs with Truss as the decision lens and reusable decision artifacts in `docs/decisions/`.
- `skills:` strengthened `afk-structured-debugging` around root-cause flow while preserving the earlier "what should happen vs what is happening" comparison experience.
- `skills:` removed `afk-dx-coding-playbook` and `afk-code-simplify` after deciding those roles were either too broad or better consumed from external skill sources directly.
- `docs:` expanded the README with workflow guidance, framework pairings, artifact lifecycle explanations, and acknowledgements to the upstream projects that informed AFK.

## 2026-03-23

- `workflows:` added the `/typecheck` workflow with a report-and-approval loop for TypeScript validation.
- `skills:` generated Codex skills from synced workflow documents so workflows can surface as reusable AFK skills.
- `rules:` updated TypeScript validation guidance to require user confirmation before the validation flow proceeds.

## 2026-03-17

- `sync:` updated the Codex CLI workflow sync strategy to use root-level `afk-` prefixed symlinks.
- `workflows:` migrated several AI skills into workflow documents, including interactive code review, cinematic landing page builder, and PR description generation.
- `docs:` refreshed the README and sync guidance to match the newer workflow model.

## 2026-03-16

- `repo:` established the current repository structure and baseline documentation.
- `skills:` removed the `logbookfordevs-context` skill from this repository.
- `scripts:` removed the older worktree management script.

## 2026-03-11

- `mcps:` introduced the JSON MCP registry and the Python sync script for distributing MCP server configuration across agents.
- `mcps:` removed the older Kiro-specific MCP rule path in favor of the new shared sync flow.

## 2026-03-09

- `skills:` added the Spline 3D integration skill with guides, performance notes, and React/vanilla examples.
- `docs:` clarified `motion` installation wording and added Tailwind CSS v4 reference links.

## 2026-03-03

- `rules:` added per-project `AGENTS.md` support and stronger guidance around skill evaluation before code modification.
- `docs:` added preferred Tailwind CSS v4 usage guidance.

## 2026-02-27

- `rules:` added Motion library guidance and TypeScript compilation requirements.
- `skills:` refined `dx-code-review` guidance to better match its intended review/refactor role.

## 2026-02-25

- `skills:` evolved the MELP framework through acronym and boundary updates before it was later removed from this repository.
- `rules:` added a rule against starting the development server by default.

## 2026-02-23

- `skills:` renamed `expressive-frontend-design` to `animated-driven-frontend`.
- `skills:` added deeper reference documentation for the animated frontend skill, including dials, guardrails, modes, and patterns.
- `skills:` added OpenAI agent metadata and refined multiple skill descriptions for discovery.
- `skills:` introduced the original MELP evaluation framework in skill form.

## 2026-02-22

- `skills:` introduced the expressive frontend design skill, which later evolved into `animated-driven-frontend`.
- `skills:` added the cinematic landing page builder skill.
- `skills:` updated LogbookForDevs guidance with stronger branding, attribution, and support requirements.

## 2026-02-17

- `rules:` introduced mandatory cross-file impact analysis for contract-touching changes.

## 2026-02-16

- `skills:` broadened `dx-code-review` so it could support a wider range of coding and refactor tasks.
- `docs:` expanded DX-oriented coding guidance in the repository rules.

## 2026-02-11

- `skills:` added PR story flow, spec creation/execution, interactive code review, planning, and PR description generation skills.

## 2026-02-02

- `skills:` added LogbookForDevs skill guidance and usage context.

## 2026-01-26

- `scripts:` added and iterated on worktree management tooling.
- `sync:` moved rule and workflow synchronization toward symlink-based flows for a single source of truth.

## 2026-01-22

- `sync:` added support for syncing skills into the `.cursor` directory.
- `skills:` improved MELP evaluation documentation formatting.

## 2026-01-19

- `repo:` consolidated documentation and introduced new skills for documentation authoring, code review, and debugging.
- `scripts:` removed older deprecated scripts and refreshed workflow documentation.

## 2026-01-14

- `workflows:` added feature brief and specification creation workflows.
- `scripts:` introduced early repository helper scripts.

## 2025-11-18

- `rules:` created the initial `AGENTS.md` foundation for repository-wide agent behavior.

## 2025-11-17

- `skills:` added early MELP, bug debugging, and PR description guidance documents.
- `docs:` updated language guidance as part of the repository foundation.

## 2025-08-20

- `workflows:` added and refined the PR Mermaid flow workflow.

## 2025-07-30

- `docs:` added the early documentation and code review guidance that seeded this repository.
- `workflows:` added the guide for generating effective pull request descriptions.
