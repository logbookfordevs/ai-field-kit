# AFK Skills vs AppKit Feature Gap Analysis

Date: 2026-05-27

## Summary

AFK now covers the core Global Library management loop from the AppKit app:

- list local skills from `~/.agents/skills`
- include disabled skills from `~/.agents/skills/.disabled`
- show skill details
- enable and disable skills by moving folders
- categorize local skills through Codex CLI
- browse current-project Codex and Claude roots as read-only roots
- prompt with searchable choices when `show`, `disable`, `enable`, or `trash` is missing a skill operand
- upgrade selected or all tracked skills by delegating to the official `skills` CLI

The main AppKit behavior still not represented in AFK is not the local mutate loop. It is the surrounding discovery surface: official catalog search, source install command preparation, and catalog export.

## Current AFK Coverage

Implemented in `packages/afk/src/skills/`:

- `afk skills list`
- `afk skills show`
- `afk skills open`
- `afk skills disable`
- `afk skills enable`
- `afk skills trash`
- `afk skills upgrade`
- `afk skills categorize`

The implementation intentionally uses `~/.agents/afk/catalog/skills.json` as the single source for setup metadata and AFK-owned categorization enrichment. Mutations now cover the shared global library by default and agent-specific roots when `--agent` selects one.
Skill rename is intentionally not exposed until AFK can support a real managed customization flow that updates agent-visible metadata without breaking upstream upgrade identity.

## AppKit Features Already Covered

### Global Library

AppKit `CustomTabViewController` and `CustomSkillsCatalogService` manage:

- active skills in `~/.agents/skills`
- disabled skills in `~/.agents/skills/.disabled`
- local search
- enable/disable moves
- categorized and uncategorized sections
- missing or invalid skills catalog messaging
- Codex-powered auto-categorization

AFK has the functional equivalent for the CLI-oriented subset, with AFK enrichment stored inside `skills.json`.

### Project Codex And Claude Browsing

AFK lists current-project `.codex/skills` and `.claude/skills` as read-only project roots. That matches the approved v1 direction, although it is narrower than AppKit's broader installed-agent browser.

## Remaining AppKit Parity Backlog And Notes

### 1. Official Skills Hub Search

AppKit has an Official tab backed by:

- `npx --yes skills find <query>`
- parsed official search results
- copy install source
- copy install command as `npx --yes skills add <source>`

AFK does not currently expose an equivalent under `afk skills`.

Recommended CLI shape:

```bash
afk skills find <query> [--json]
afk skills search <query> [--json] # optional alias
afk skills install-command <source>
```

Keep this as delegation and presentation. Do not reimplement the official catalog or installer.

### 2. Source Add / Install Wizard

AppKit has install-state modeling for:

- GitHub shorthand
- full URL
- local path
- selected skill from `skills add <source> --list`
- project vs global scope
- selected agents and extra agent IDs
- generated `npx --yes skills add ...` arguments

AFK currently keeps install behavior in `afk setup skills install`, but it does not provide the AppKit-style ad-hoc source flow under `afk skills`.

Recommended CLI shape:

```bash
afk skills add <source> [--list]
afk skills add <source> [--skill <name>] [--global|--project] [--agent <id>...] [--yes]
```

This should still delegate to the official `skills` CLI. AFK should be the ergonomic wrapper, not the installer owner.

### 3. Upgrade Selected Or All Skills

AppKit exposes:

- Check Updates, backed by `npx --yes skills check`
- Update All, backed by `npx --yes skills update`
- parsed per-skill status in the installed browser

AFK now exposes this maintenance flow as `afk skills upgrade`.

Important upstream behavior:

- The official `skills check` command currently routes to the same update implementation as `skills update` / `skills upgrade`, so AFK should not expose `afk skills check` as a read-only wrapper.
- The official `skills update` / `skills upgrade` command prompts for scope when no scope flags or skill names are provided. It does not show a searchable skill picker.
- AFK can add real value by making selection searchable and scope-aware, then delegating the actual update to the official `skills` CLI.

Recommended CLI shape:

```bash
afk skills upgrade [skills...] [--scope global|project|all] [--all] [--yes]
```

Default behavior:

- `--scope` defaults to `global`.
- No skill args and no `--all` opens AFK's branded searchable selection flow for the selected scope.
- Explicit skill args skip the picker.
- `--all` skips the picker and delegates every tracked skill in the selected scope.
- `--yes` forwards non-interactive confirmation behavior to the official CLI.
- `--scope all` should show grouped records for interactive selection and delegate both global and project updates when `--all` is passed.

This is a strong fit for AFK because it preserves the thin-router model while giving users a better selection experience than upstream currently provides.

Implementation plan:

[docs/skills-upgrade/skills-upgrade.plan.md](/Users/leonardo/.codex/worktrees/d8fa/ai-rules-workflows/docs/skills-upgrade/skills-upgrade.plan.md)

### 4. Catalog Backup / Export

The Electron/AppKit migration notes mention a Catalog Backup artifact named `ai-skills-catalog.json`, merging filesystem scan data, lockfile metadata, and taxonomy metadata without mutating taxonomy.

AFK does not currently have this.

Recommended CLI shape:

```bash
afk skills export [--output ai-skills-catalog.json]
```

This is not required for immediate AppKit parity unless the backup/export workflow is part of the current product goal.

## Desktop-Only Features To Skip

These should not be ported directly:

- menu bar and popover behavior
- AppKit command-output collapsible panels
- GUI banners and help windows
- app self-update checks
- clipboard-first install buttons

For CLI, prefer printed commands, `--json`, and searchable prompts.

## Moved To AppKit Parity Implementation Plan

The following items were selected for the next implementation slice and moved to:

[docs/appkit-parity/appkit-parity.plan.md](/Users/leonardo/.codex/worktrees/d8fa/ai-rules-workflows/docs/appkit-parity/appkit-parity.plan.md)

- installed-agent browsing beyond current-project Codex and Claude roots
- `afk skills open` for `SKILL.md` and skill folders, including editor flags
- `afk skills trash` for confirmed local Trash moves
- category, tag, and uncategorized filters for `afk skills list`

## Backlog Priority

1. Add official Hub discovery: `afk skills find` and/or `afk skills search`, delegating to `npx --yes skills find`.
2. Add ad-hoc official install wrapper: `afk skills add <source> ...`, delegating to `npx --yes skills add`.
3. Consider `export` if Catalog Backup is still a product requirement for AFK CLI.

## Bottom Line

No major Global Library management feature is left behind. After the AppKit Parity and Skills Upgrade slices, the remaining AppKit value is mostly in the official catalog surface:

- official catalog discovery
- source install delegation

The next backlog slice after AppKit Parity should likely be `afk skills find` and `afk skills add`, because those preserve AFK's router identity while recovering the official catalog workflows. Avoid `afk skills check` until upstream has a clearly read-only check surface or AFK implements its own read-only checker intentionally.
