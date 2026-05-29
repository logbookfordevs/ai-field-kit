# AFK Skills Upgrade Implementation Plan

Date: 2026-05-27

Status: Implemented in `packages/afk` on 2026-05-27.

## Goal

Add `afk skills upgrade` as an AFK-owned selection experience that delegates actual updates to the official `skills` CLI.

The command should solve one specific gap: upstream `skills update` can update skills, but it does not provide AFK's searchable picker when the user wants to choose a subset. AFK should keep update ownership upstream and own only the safer command shape, scope defaults, selection UI, and argument construction.

## Command Surface

```bash
afk skills upgrade [skills...] [--scope global|project|all] [--all] [--yes]
```

No `afk skills check` in this slice.

`skills check` exists upstream, but currently routes through the same update path as `skills update` / `skills upgrade`. AFK should not expose it as a read-only command unless that behavior changes upstream or AFK intentionally builds its own checker later.

## Behavior Decisions

### Scope

`--scope` controls both the picker contents and the delegated update command.

- `global`: default. List global tracked skills and delegate with `-g`.
- `project`: list current-project tracked skills and delegate with `-p`.
- `all`: list global and current-project tracked skills, grouped by scope. With `--all`, delegate both scopes.

Use `global` as the default because AFK's current skills-management commands primarily protect the shared global library and because it avoids surprising project updates.

### Selection

If explicit skill names are passed, skip the picker:

```bash
afk skills upgrade frontend-design web-design-guidelines
```

If no skill names are passed and `--all` is not passed, show AFK's branded searchable selection flow for the selected scope:

```bash
afk skills upgrade
afk skills upgrade --scope project
afk skills upgrade --scope all
```

The picker should show enough context to prevent mistakes:

- display name
- folder/name
- scope
- root/source when available

For `--scope all`, group or label options so global and project records are never visually ambiguous.

### Update All

Use a real flag for "everything":

```bash
afk skills upgrade --all
afk skills upgrade --scope project --all
afk skills upgrade --scope all --all
```

Do not require users to select every row in the picker to update everything. `--all` is clearer in shell history, better for scripts, and avoids accidental partial selection.

### Delegation

Delegate to the official `skills` CLI:

```bash
npx --yes skills update <skills...> -g
npx --yes skills update <skills...> -p
```

For `--scope all --all`, run both scoped updates explicitly instead of relying on upstream's interactive scope prompt:

```bash
npx --yes skills update -g
npx --yes skills update -p
```

When `--yes` is passed to AFK, forward `-y` to upstream. Without `--yes`, preserve upstream confirmation behavior where applicable.

## Implementation Steps

1. Extend CLI parsing and help text.
   - Add `upgrade` under `afk skills`.
   - Parse `[skills...]`, `--scope global|project|all`, `--all`, and `--yes`.
   - Document that `global` is the default scope.
   - Do not add `check`.

2. Add tracked-skill discovery for upgrade.
   - Read the same upstream lock data that `skills update` uses where possible.
   - Global scope should discover skills tracked by the global skills lock.
   - Project scope should discover skills tracked by the current project lock.
   - If a scope has no tracked skills, print a clear AFK-styled message and do not call upstream.

3. Add the searchable multi-select.
   - Reuse the existing AFK prompt styling and selection helpers where possible.
   - Filter options by scope before showing the picker.
   - Return selected skill names in the form expected by upstream `skills update`.

4. Add the runner boundary.
   - Create a small function that builds the `npx --yes skills update` arguments.
   - Keep process spawning isolated so tests can assert generated commands without invoking upstream.
   - Avoid reimplementing update logic.

5. Implement command execution.
   - Explicit skill args: build and run one scoped update command.
   - Picker selection: build and run one scoped update command with selected names.
   - `--all`: build and run scoped update command without names.
   - `--scope all --all`: run global and project updates separately.

6. Add tests.
   - Parser help includes `upgrade` and omits `check`.
   - Default scope is `global`.
   - Explicit skill args skip selection and build `skills update <names> -g`.
   - `--scope project` builds `skills update <names> -p`.
   - `--all` builds update commands without skill names.
   - `--scope all --all` builds separate global and project commands.
   - Empty tracked-skill scope does not invoke upstream.
   - Picker receives only records for the requested scope.

7. Validate.
   - `pnpm --dir packages/afk run typecheck`
   - `pnpm --dir packages/afk run test`

## Implementation Notes

- Global tracked skills are read from `~/.agents/.skill-lock.json`.
- Project tracked skills are read from `skills-lock.json` in the current working directory.
- AFK builds explicit `npx --yes skills update ... -g/-p` commands and does not modify skill files, taxonomy metadata, or lockfiles.
- The interactive path uses searchable selection and asks whether to select another skill after each choice. `--all` remains the scriptable path for updating everything.

## Acceptance Criteria

- `afk skills upgrade` defaults to a global searchable multi-select.
- `afk skills upgrade --all` updates all global tracked skills without opening the picker.
- `afk skills upgrade --scope project` shows only current-project tracked skills.
- `afk skills upgrade --scope all --all` updates global and project scopes through explicit upstream calls.
- Explicit skill names skip the picker.
- AFK does not expose `afk skills check` in this slice.
- AFK does not modify skill files, taxonomy metadata, or lockfiles directly during upgrade.
