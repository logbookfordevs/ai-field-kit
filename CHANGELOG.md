# Changelog

This repository does not use release tags as the primary way to communicate change.
Instead, this changelog tracks meaningful updates by date.

## How We Use This File

- Add new work to `## In Progress` while it is still evolving.
- When a batch of changes feels complete, move it into a dated section like `## 2026-03-25`.
- Prefer reader-focused summaries over raw commit messages.
- Group bullets by area prefix when helpful: `docs:`, `skills:`, `workflows:`, `mcps:`, `sync:`, `rules:`.
- Skip trivial noise. Record changes that affect how someone uses, syncs, extends, or trusts the kit.

## In Progress

- Nothing recorded yet.

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
