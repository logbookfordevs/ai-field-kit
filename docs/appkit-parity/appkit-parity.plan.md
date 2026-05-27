# AppKit Parity Implementation Plan

Date: 2026-05-27

Status: Implemented in `packages/afk` on 2026-05-27.

## Goal

Implement the selected AppKit parity slice for `afk skills`:

- read-only installed-agent browsing beyond current-project Codex and Claude roots
- `afk skills open` for skill files and folders
- `afk skills trash` for confirmed local Trash moves
- category, tag, platform, and uncategorized filters for `afk skills list`

This plan intentionally leaves official Hub search, source add/install delegation, update checks, and catalog export in the backlog.

## Command Surface

```bash
afk skills list [--scope global|project|agent|all] [--agent <id>] [--category <id-or-label>] [--tag <tag>] [--platform <platform>] [--uncategorized] [--json]
afk skills open [<folder>] [--file|--folder] [--app finder|code|cursor|zed|agy]
afk skills trash [<folder>] [--dry-run] [--yes]
```

Keep existing commands intact:

```bash
afk skills show [<folder>] [--json]
afk skills disable [<folder>] [--dry-run]
afk skills enable [<folder>] [--dry-run]
afk skills rename [<folder>] [<display-name>] [--dry-run]
afk skills categorize ...
```

## Behavior Decisions

### `list --scope agent`

`--scope agent` lists installed skills from known agent roots outside the AFK shared library. It does not include `~/.agents/skills`, and it does not include current-project roots unless those roots are modeled as agent roots for the current working directory.

Human output should be sectioned by agent/root, for example:

```text
Codex
  ...

Claude
  ...

Gemini
  ...
```

`--json` should remain a flat array of `SkillRecord` values with `rootLabel`, `rootPath`, `agent`, `rootKind`, `storage`, and `readOnly` fields. Scripts should not need to parse visual sections.

Agent roots are read-only in this slice. Mutating commands continue to operate only on `~/.agents/skills`.

### Agent Root Coverage

Start with the AppKit visible sources:

- Global Library: `~/.agents/skills`
- Codex global: `~/.codex/skills`
- Claude global: `~/.claude/skills`
- Gemini: `~/.gemini/skills`
- Gemini / Antigravity legacy: `~/.gemini/antigravity/skills`

Then add a small, typed registry based on the AppKit `AgentTarget` model for common roots such as OpenCode, Cursor, Amp, Goose, Warp, Zed, Roo Code, Aider, Continue, Kiro, Jules, OpenHands, and related tools. It is acceptable for nonexistent roots to scan as empty.

### `open`

`show` already prints the skill file path, so do not add a separate `path` command in this slice.

`afk skills open` opens the selected skill in a target app:

- default target: `SKILL.md`
- `--file`: open `SKILL.md`
- `--folder`: open the skill folder
- `--app finder`: macOS `open`
- `--app code`: `code <target>`
- `--app cursor`: `cursor <target>`
- `--app zed`: `zed <target>`
- `--app agy`: `agy <target>`

If no folder is passed, reuse the searchable skill picker. The picker should include global and agent records, but opening should never mutate the selected record.

If the requested app command is unavailable, print a branded error with the target path and the missing executable.

### `trash`

`afk skills trash` moves a skill folder to the OS Trash when possible.

Rules:

- only global-library records are eligible
- project and agent roots are read-only and must fail with a clear error
- require confirmation unless `--yes` is passed
- support `--dry-run`
- never permanently delete folders
- if a cross-platform Trash implementation is not available, implement macOS first and fail clearly elsewhere

If no folder is passed, use the searchable picker and show only eligible global-library records.

### List Filters

Add filters to `afk skills list`:

- `--category <id-or-label>`
- `--tag <tag>`
- `--platform <platform>`
- `--uncategorized`

Filters should apply after scope and agent selection. Multiple filters should combine with AND semantics.

Category matching should accept category id or visible label case-insensitively. Tag and platform matching should be case-insensitive exact matches after trimming.

## Implementation Steps

1. Extend CLI parsing and help text.
   - Add `agent` to list scope parsing.
   - Add `--category`, `--tag`, `--platform`, `--uncategorized`, `--app`, `--file`, `--folder`, and `--yes`.
   - Add command help for `open` and `trash`.

2. Extend skill root modeling.
   - Add a root kind for installed agent libraries if needed.
   - Add typed known-agent root definitions.
   - Preserve existing read-only current-project Codex and Claude behavior.
   - Keep global-library mutation boundaries unchanged.

3. Add list filtering.
   - Apply category/tag/platform/uncategorized filters in the catalog or command layer.
   - Keep JSON output stable and flat.
   - Update branded list output to section agent results by root when useful.

4. Implement `open`.
   - Resolve a skill record by folder/name/originalName or prompt with search.
   - Resolve target path based on `--file` or `--folder`.
   - Spawn the selected app command.
   - Return clear failures for missing app executables or missing paths.

5. Implement `trash`.
   - Resolve only global-library active or disabled records.
   - Confirm unless `--yes`.
   - Move to Trash, not permanent delete.
   - Support `--dry-run`.

6. Add tests.
   - Agent root scanning and `--scope agent` behavior.
   - Section/order behavior for human list rendering.
   - JSON remains flat.
   - Category/tag/platform/uncategorized filtering.
   - `open` argument generation for finder/code/cursor/zed/agy.
   - Missing app executable failure.
   - `trash` dry-run, confirmation bypass, read-only rejection, and successful trash handler path.
   - CLI help for new commands and flags.

7. Validate.
   - `pnpm --dir packages/afk run typecheck`
   - `pnpm --dir packages/afk run test`

## Acceptance Criteria

- `afk skills list --scope agent` shows read-only agent-root skills sectioned by source in human output.
- `afk skills list --scope agent --json` returns a flat record array.
- `afk skills list` filters work for category, tag, platform, and uncategorized records.
- `afk skills open` can open a selected skill file or folder with Finder, Code, Cursor, Zed, or Antigravity.
- `afk skills trash` never affects project or agent roots and never permanently deletes a skill.
- Existing `show`, `disable`, `enable`, `rename`, and `categorize` behavior remains intact.

## Validation

- `pnpm --dir packages/afk run typecheck`
- `pnpm --dir packages/afk run test`
