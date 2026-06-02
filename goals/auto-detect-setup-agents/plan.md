# Auto-detect AFK setup agent targets plan

## Solution approach

Introduce a centralized setup-target detection layer for AFK. Setup commands should distinguish between explicit user-selected targets and detected default targets, then use detected targets for rules, MCPs, hooks, and additional skill providers while keeping utilities independent from agents. Detection should be conservative, visible in summaries and dry-runs, and extensible through a separate local AFK config file rather than `presets.json`.

## Ordered steps

### 1. Add centralized target detection

Files/systems:

- `packages/afk/src/agents.ts`
- New helper such as `packages/afk/src/agent-detection.ts`
- `packages/afk/src/types.ts`
- `packages/afk/src/fs-utils.ts` if reusable JSON/path helpers are useful

Implementation notes:

- Add a detection function that accepts `homeDir`, `cwd`, and `setupScope`.
- Return compatible targets for general setup agents, hook agents, and skill-provider agents separately.
- Use conservative evidence paths per supported target. Initial examples:
  - Codex: `.codex/AGENTS.md`, `.codex/config.toml`, `.codex/`
  - Claude: `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/`
  - OpenCode: `.config/opencode/opencode.json`, `.config/opencode/AGENTS.md`
  - Antigravity/Gemini compatibility: `.gemini/GEMINI.md`, `.gemini/`
  - Cursor local hooks: `.cursor/hooks.json`, `.cursor/`
  - Skill providers: the provider skill directories already listed in `skillAgentChoices`
- Keep these paths centralized and typed so future targets do not require prompt-specific branching.

Verification:

- Add unit tests for detected, missing, and mixed targets.
- Run `pnpm --dir packages/afk test`.
- Run `npx tsc --noEmit` from `packages/afk` or `pnpm --dir packages/afk typecheck`.

### 2. Add local custom target path config outside presets

Files/systems:

- New helper such as `packages/afk/src/setup-config.ts`
- `packages/afk/src/manifest.ts` only for reusing `localAfkDir`, not for adding this to `presets.json`
- Documentation in `packages/afk/README.md`

Implementation notes:

- Add a separate local config surface under `~/.agents/afk/`, for example `setup-targets.json` or `config.json`.
- Support a typed field such as `customAgentPaths` or `agentTargetPaths`.
- Merge custom paths into detection results only when their configured evidence exists.
- Do not persist automatically detected targets into this file by default.
- Keep `presets.json` focused on defaults sources and named setup presets.

Verification:

- Add tests that custom configured paths are honored.
- Add tests that `presets.json` validation and refresh behavior remain unchanged.

### 3. Resolve default targets before prompting

Files/systems:

- `packages/afk/src/interactive.ts`
- `packages/afk/src/setup.ts`
- `packages/afk/src/cli.ts`

Implementation notes:

- Preserve explicit `--agent` behavior as a user override.
- In normal interactive setup, use detected targets without showing repeated rules/MCP/hooks agent prompts when detection finds compatible targets.
- If a selected target-dependent area has no detected compatible targets and no explicit `--agent`, ask once for manual targets.
- Keep utilities out of this target resolution; `areaOptionsForSetupArea` should continue shielding utilities from prompted or detected agent targets unless utility behavior is intentionally changed later.
- For `setup skills`, keep universal `.agents/skills` behavior and use detection only for additional provider links.

Verification:

- Update `packages/afk/src/interactive.test.ts` so rules/MCPs/hooks use detection and do not ask repeated target questions when targets are detected.
- Add tests for the missing-target fallback asking once.
- Add tests that `selectUtilsInstall` and utilities-only setup still do not ask agent target questions.

### 4. Replace broad empty-target defaults with resolved targets

Files/systems:

- `packages/afk/src/rules.ts`
- `packages/afk/src/delegates.ts`
- `packages/afk/src/hooks.ts`
- `packages/afk/src/setup.ts`

Implementation notes:

- Avoid letting an empty `agents` array mean "all supported agents" after setup target resolution.
- Rules should receive explicit resolved targets and only write those targets.
- MCP command building should receive explicit resolved targets; `--yes` should not silently expand to broad default MCP agents unless those targets were detected or explicitly requested.
- Hooks should use resolved hook targets.
- Utility post-install behavior should remain scoped by global/project behavior and should not adopt detected targets as part of this goal.

Verification:

- Update `packages/afk/src/rules.test.ts` expectations where empty agents currently means all.
- Update `packages/afk/src/delegates.test.ts` expectations for MCP defaults and utility independence.
- Update `packages/afk/src/hooks.test.ts` if hook target resolution moves earlier.

### 5. Make detected targets visible

Files/systems:

- `packages/afk/src/setup.ts`
- `packages/afk/src/brand.ts` if copy helpers are needed
- `packages/afk/src/cli.ts` help text if options need clearer wording

Implementation notes:

- Show detected targets in the setup path summary, for example `Detected targets: codex, claude`.
- Keep dry-run output explicit about which files or delegate commands will be touched.
- When manual fallback is used, distinguish manual targets from detected targets in the summary.
- Keep copy compact and low-ceremony.

Verification:

- Add setup output tests in `packages/afk/src/setup.test.ts`.
- Smoke check with temp `HOME` fixtures and `--dry-run`.

### 6. Document the new behavior

Files/systems:

- `packages/afk/README.md`
- Root `README.md` only if the public setup story needs a short mention

Implementation notes:

- Explain that AFK detects compatible installed targets by default.
- Explain that explicit `--agent` narrows or overrides target selection.
- Explain where custom target paths live.
- State that `presets.json` remains for defaults sources and named presets.

Verification:

- Check docs for stale claims about repeated target prompts.
- Run the same TypeScript validation required for this TypeScript change set: `npx tsc --noEmit` from `packages/afk` or `pnpm --dir packages/afk typecheck`.

## Risks and open questions

- Detection evidence can be too broad if a stale directory remains after uninstall. Prefer known config files where possible and directory fallback only when it is the established agent home.
- Some users may expect `--yes` to mean "install everywhere AFK supports." This change should make `--yes` mean "accept defaults using detected targets"; document an explicit all-target override if needed.
- The exact local config filename and field name should be chosen before implementation. Recommended: `~/.agents/afk/setup-targets.json` with `customAgentPaths`.
- Existing tests encode empty target arrays as broad defaults. Updating those tests is part of the behavior change, not just test maintenance.

## Validation commands

- `pnpm --dir packages/afk test`
- `pnpm --dir packages/afk typecheck`
- For any touched TypeScript files, also satisfy the project instruction by ensuring `npx tsc --noEmit` passes in `packages/afk`.
