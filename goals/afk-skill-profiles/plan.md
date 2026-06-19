# AFK Skill Profiles Plan

## Solution Approach

Add skill profiles as a sub-family under `afk skills profiles`. Profiles are durable catalog definitions in `profiles.json`; enabled profile runtime state is kept separately so AFK can distinguish skills it temporarily disabled from skills that were already disabled.

V1 will operate only on the shared global skill library at `~/.agents/skills`, with `--local` controlling where profile definitions and runtime state are read/written. Global mode uses `~/.agents/afk/catalog/profiles.json` and `~/.agents/afk/state/skill-profiles.json`; local mode uses `./afk/catalog/profiles.json` and `./afk/state/skill-profiles.json` while still applying profile filtering to the shared global skill library.

## Ordered Steps

1. Add profile domain types and storage helpers.
   - Files: `packages/afk/src/skills/profiles.ts`, `packages/afk/src/manifest.ts` if path helpers need reuse.
   - Define `SkillProfileCatalog`, `SkillProfileItem`, and `SkillProfileState`.
   - Implement global/local path resolution using existing `localManifestDir(homeDir)` and `projectManifestDir(cwd)` conventions.
   - Validate/normalize `profiles.json` with defaults: `{ "version": 1, "alwaysOn": [], "items": [] }`.
   - Store runtime state separately as enabled profile IDs, profile-moved skills, and pre-existing disabled skills.
   - Verification: unit tests for missing, invalid, global, and local profile catalog/state paths.

2. Implement profile set calculation and filesystem plan generation.
   - Files: `packages/afk/src/skills/profiles.ts`, reuse `packages/afk/src/skills/catalog.ts` helpers where appropriate.
   - Load global active/disabled skill records from `~/.agents/skills`.
   - Compute kept skills as `alwaysOn` plus the union of skills from all enabled profiles.
   - On `enable`, add one or more profile IDs to state, disable currently active global skills outside the kept set, and record only AFK-moved skills.
   - On `disable`, remove profile IDs from state, recompute the kept set for remaining enabled profiles, and restore only profile-moved skills that should now be active again.
   - Let profiles temporarily enable skills that were disabled before profile filtering, while still returning those skills to disabled once no enabled profile keeps them.
   - Support dry-run by returning the planned movements without writing catalog/state or moving folders.
   - Verification: tests for multiple enabled profiles, always-on skills, preserve-disabled behavior, disable-one-profile while another remains enabled, and dry-run no-op.

3. Add profile command execution.
   - Files: `packages/afk/src/skills/commands.ts`, new helpers in `packages/afk/src/skills/profiles.ts`.
   - Extend `SkillCommandName` to route `profiles`.
   - Implement `list`, `show`, `create`, `edit`, `delete`, `enable`, `disable`, and `status`.
   - `create` and `edit` should use the existing searchable skill picker patterns when skills are not provided explicitly.
   - `delete` removes only profile definitions and never deletes skill folders.
   - `status` shows enabled profiles, kept skills, disabled-by-profile skills, and catalog/state paths.
   - Verification: command tests for each subcommand, missing profile handling, and JSON/canonical output if JSON is included.

4. Extend CLI parsing and help.
   - Files: `packages/afk/src/cli.ts`, `packages/afk/src/types.ts`, `packages/afk/src/cli.test.ts`.
   - Add help entries for `afk skills profiles` and subcommands.
   - Allow `--local` for `afk skills profiles ...` without changing existing `afk skills list/show/disable/enable/trash` behavior.
   - Add profile-specific options such as `--name <name>`, `--skill <skill>`, `--always-on <skill>`, `--json` where useful, `--dry-run`, and `--yes` for destructive profile-definition deletion if confirmation is needed.
   - Verification: parser/help tests for command routing, `--local`, invalid options, and examples.

5. Add profile render helpers matching AFK command UI.
   - Files: `packages/afk/src/skills/render.ts`.
   - Render profile lists, detail, status, enable/disable previews, and completion summaries using `sectionTitle`, `muted`, `paint`, and the existing skill command visual style.
   - Verification: string snapshot-style tests for readable sections and movement summaries.

6. Update docs and catalog examples.
   - Files: `packages/afk/README.md`, possibly `README.md` if the top-level command list mentions skills management.
   - Document the profile file shape, the global/local paths, multiple-profile union behavior, always-on behavior, and safety rules.
   - Verification: covered by review plus package tests.

7. Run validation.
   - `pnpm --dir packages/afk run typecheck`
   - `pnpm --dir packages/afk run test`
   - `git diff --check`

## Risks And Open Questions

- Local profile definitions controlling global shared skills may surprise users. The docs and command output should make the catalog/state path and affected skill library explicit.
- Profile state can become stale if users manually move folders while a profile is enabled. The implementation should tolerate missing folders and update state toward the current filesystem instead of crashing after partial external changes.
- `edit` can grow into a large interactive workflow. Keep V1 minimal: update name and skill set, using existing picker primitives, without adding a full manifest editor.
- Agent-specific profile filtering is intentionally out of scope for V1.
