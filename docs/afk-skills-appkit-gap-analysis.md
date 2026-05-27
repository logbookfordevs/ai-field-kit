# AFK Skills vs AppKit Feature Gap Analysis

Date: 2026-05-27

## Summary

AFK now covers the core Global Library management loop from the AppKit app:

- list local skills from `~/.agents/skills`
- include disabled skills from `~/.agents/skills/.disabled`
- show skill details
- enable and disable skills by moving folders
- rename display labels through AFK taxonomy metadata
- categorize local skills through Codex CLI
- browse current-project Codex and Claude roots as read-only roots
- prompt with searchable choices when `show`, `disable`, `enable`, or `rename` is missing a skill operand

The main AppKit behavior still not represented in AFK is not the local mutate loop. It is the surrounding discovery and maintenance surface: official catalog search, source install command preparation, installed-agent browsing beyond the shared library, update checks, and local file actions.

## Current AFK Coverage

Implemented in `packages/afk/src/skills/`:

- `afk skills list`
- `afk skills show`
- `afk skills disable`
- `afk skills enable`
- `afk skills rename`
- `afk skills categorize`

The implementation intentionally uses `~/.agents/skills/afk-skills.json` instead of the AppKit-era `skills.json`, which is the right AFK-owned boundary. Mutations are also intentionally limited to the shared global library in v1.

## AppKit Features Already Covered

### Global Library

AppKit `CustomTabViewController` and `CustomSkillsCatalogService` manage:

- active skills in `~/.agents/skills`
- disabled skills in `~/.agents/skills/.disabled`
- local search
- enable/disable moves
- display-name rename through taxonomy metadata
- categorized and uncategorized sections
- missing or invalid taxonomy messaging
- Codex-powered auto-categorization

AFK has the functional equivalent for the CLI-oriented subset, with the taxonomy renamed to `afk-skills.json`.

### Project Codex And Claude Browsing

AFK lists current-project `.codex/skills` and `.claude/skills` as read-only project roots. That matches the approved v1 direction, although it is narrower than AppKit's broader installed-agent browser.

## Remaining AppKit Parity Backlog

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

### 3. Update Check And Update All

AppKit exposes:

- Check Updates, backed by `npx --yes skills check`
- Update All, backed by `npx --yes skills update`
- parsed per-skill status in the installed browser

AFK does not currently expose these.

Recommended CLI shape:

```bash
afk skills check [--json]
afk skills update [--dry-run]
```

This is a strong fit for AFK because it preserves the thin-router model.

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
- category, tag, platform, and uncategorized filters for `afk skills list`

## Backlog Priority

1. Add official Hub discovery: `afk skills find` and/or `afk skills search`, delegating to `npx --yes skills find`.
2. Add ad-hoc official install wrapper: `afk skills add <source> ...`, delegating to `npx --yes skills add`.
3. Add maintenance commands: `afk skills check` and `afk skills update`.
4. Consider `export` if Catalog Backup is still a product requirement for AFK CLI.

## Bottom Line

No major Global Library management feature is left behind. After the AppKit Parity slice, the remaining AppKit value is mostly in two adjacent surfaces:

- official catalog discovery and source install delegation
- update maintenance

The next backlog slice after AppKit Parity should likely be `afk skills find`, `afk skills add`, `afk skills check`, and `afk skills update`, because those preserve AFK's router identity while recovering the official catalog and maintenance workflows.
