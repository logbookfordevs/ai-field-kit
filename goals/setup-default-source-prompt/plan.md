# Interactive Setup Default Source Plan

## Solution Approach

Split AFK setup source handling into three separate concepts:

- the saved default source, read from and written to local `presets.json`
- the one-run source, selected by prompt or explicit one-run flag
- the explicit default-source update command, which saves a new default and exits

Move source resolution before manifest loading for `afk setup` and setup area subcommands, because the source prompt must happen before AFK knows which manifests to load.

## Ordered Steps

1. Make saved defaults source readable and writable through focused manifest helpers.

   Files:
   - `packages/afk/src/manifest.ts`
   - `packages/afk/src/manifest.test.ts`

   Work:
   - Export a helper that reads the remembered defaults source for global or project-local manifests.
   - Add a helper to write/update the saved defaults source in `presets.json` without fetching every manifest.
   - Keep existing `ensureLocalManifests` behavior for refresh/install paths, but stop treating a setup run source as automatically persisted unless the save helper is called.

   Verification:
   - Unit test that reading returns an existing `presets.json` `defaultsSource`.
   - Unit test that saving writes `presets.json` and preserves or creates the expected manifest shape.

2. Update CLI parsing and help for source semantics.

   Files:
   - `packages/afk/src/cli.ts`
   - `packages/afk/src/cli.test.ts`
   - `packages/afk/src/types.ts`

   Work:
   - Introduce preferred `--default-source <source>` help text and examples.
   - Keep `--defaults-source <source>` as a backwards-compatible alias.
   - Add explicit option state for “save this default source and exit” instead of overloading the run source.
   - Preserve a one-run source override for setup execution. If this maps to an existing flag name, keep the old `--source github|local` rules behavior separated so rule-source selection and defaults-source selection do not collapse into one ambiguous field.

   Verification:
   - Help tests assert `--default-source <source>` appears in setup and area help.
   - Help tests assert examples prefer `afk setup --default-source your-org/dev-kit`.
   - Parser tests assert both `--default-source` and `--defaults-source` are accepted.

3. Add interactive source selection before manifest loading.

   Files:
   - `packages/afk/src/interactive.ts`
   - `packages/afk/src/interactive.test.ts`
   - `packages/afk/src/setup.ts`

   Work:
   - Add a source prompt that supports the saved default source as the preselected/default value.
   - Run that prompt before `ensureManifestFiles` in `runSetup` and `runArea` when there is no one-run source and setup is interactive.
   - If no saved default exists, require the user to provide a source before continuing.
   - The returned source should be copied into the current `CliOptions` only for this run.
   - Do not save interactive choices back to `presets.json`.

   Verification:
   - Test `runSetup` asks for source before manifest preparation when no one-run source exists.
   - Test each area subcommand path goes through source resolution before loading manifests.
   - Test an existing remembered default is passed as the prompt default.
   - Test an alternate interactive source is used for the run but not written to `presets.json`.

4. Implement default-source update and `--yes` failure behavior.

   Files:
   - `packages/afk/src/setup.ts`
   - `packages/afk/src/cli.test.ts`
   - `packages/afk/src/setup.test.ts`

   Work:
   - When `afk setup --default-source <source>` or alias `--defaults-source <source>` is used, write the saved default source, print a success message, and return without running setup installation work.
   - For `--yes`, skip prompts. If no one-run source and no saved default source exists, return a non-zero error with guidance to run `afk setup` or `afk setup --default-source <source>`.
   - If `--yes` has a one-run source or saved default source, use it deterministically.

   Verification:
   - Test default-source update writes the default and exits before delegate commands run.
   - Test alias still writes the default.
   - Test `--yes` without source/default fails with the actionable message.
   - Test `--yes` with saved default proceeds without prompting.

5. Run validation.

   Commands:
   - `pnpm --dir packages/afk test`
   - `npx tsc --noEmit` from `packages/afk`

## Risks And Open Questions

- The current `--source github|local` flag is rules-manifest oriented. The implementation should avoid making that flag carry two incompatible meanings. If a new one-run defaults-source flag is needed, choose a precise name and update facts before implementation.
- Existing tests assume built-in or local manifests are available in some paths. Tests that intentionally exercise legacy/local behavior should keep using explicit test options so the new no-silent-default rule applies only to normal setup execution.
- Source prompting before manifest loading means source prompt tests should mock the new prompt directly instead of relying on item-selection prompts.
