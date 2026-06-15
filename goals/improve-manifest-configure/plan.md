# Improve AFK Manifest Configure Plan

## Solution Approach

Build `afk manifests configure` as an editor-style interactive session over the existing `@inquirer/prompts` stack. The core change is to separate manifest editing state from prompt rendering: load current manifests into typed drafts, let the user perform add/edit/remove/toggle actions in a loop, validate the final draft, preview changed JSON, then write only after explicit confirmation.

Truss evaluation:

- Maintainability: prefer a shared manifest editor model plus small per-manifest field adapters over a brand-new TUI dependency.
- Strategy: solve the boring manual JSON editing problem now while leaving room for a richer preview surface later.
- Clarity: make each manifest type's fields explicit and testable instead of hiding behavior in long prompt functions.
- Performance: terminal prompt overhead is negligible; avoid browser or agent-driven preview in the first implementation.

## Ordered Steps

1. Extract manifest path, loading, and writing helpers.

   Touches: `packages/afk/src/manifest-configure.ts`, maybe `packages/afk/src/manifest.ts`.

   Work:
   - Keep global vs project-local destination behavior.
   - Load existing manifests by default when files exist.
   - Preserve `--from-current` as compatible behavior, even if it becomes effectively redundant.
   - Keep missing manifests bootstrapped as empty typed drafts.

   Verification:
   - Unit test that configure reads existing global manifests by default.
   - Unit test that `--local` reads and writes `./afk/manifests`.

2. Introduce typed editor primitives.

   Touches: `packages/afk/src/manifest-configure.ts`, or a new `packages/afk/src/manifest-editor.ts` if the file gets too large.

   Work:
   - Represent editable categories for `rules`, `skills`, `mcps`, `utils`, and `hooks`.
   - Provide shared item operations for item manifests: add, edit, remove, toggle default.
   - Provide skill-specific `autoInvocation` toggle.
   - Keep rules as a single-record edit flow for `url` and inferred `source`.
   - Do not implement duplicate/clone.

   Verification:
   - Unit tests for add/edit/remove/toggle behavior on skills, MCPs, utils, and hooks.
   - Unit test that duplicate ids are rejected or forced through `uniqueId`.
   - Unit test that editing preserves unrelated existing fields.

3. Replace the linear configure prompts with a menu loop.

   Touches: `packages/afk/src/manifest-configure.ts`, `packages/afk/src/prompt-ui.ts` if a small shared renderer helps.

   Work:
   - First menu: choose manifest type or finish.
   - Manifest menu: show summary of current entries and available actions.
   - Entry menu: choose item to edit/remove/toggle.
   - Confirm removal with clear item label/id.
   - Return to the manifest menu after each action.
   - Preserve existing AFK prompt theme and step styling.

   Verification:
   - Prompt-level tests using an injectable prompt adapter, not fragile terminal automation.
   - Existing help tests still pass.

4. Add final validation and preview.

   Touches: `packages/afk/src/manifest-configure.ts`, `packages/afk/src/manifest.ts`.

   Work:
   - Reuse or expose the existing manifest shape guards before writing.
   - Validate duplicate ids across item-based manifests.
   - Render a readable preview of only changed manifest files.
   - Keep JSON preview in-terminal for first version; design the renderer so a richer HTML or Plannotator-like review UI could be layered later.
   - `--dry-run` shows preview and exits without writing.

   Verification:
   - Unit test invalid drafts do not write.
   - Unit test dry-run prints preview and writes nothing.
   - Unit test unchanged manifests can be skipped or reported clearly.

5. Preserve CLI compatibility.

   Touches: `packages/afk/src/cli.ts`, `packages/afk/src/cli.test.ts`, `packages/afk/src/manifest-configure.test.ts`.

   Work:
   - Keep `afk manifests configure`, `--local`, `--from-current`, and `--dry-run`.
   - Update help text only if needed to describe editor behavior.
   - Do not add setup execution side effects.

   Verification:
   - Existing CLI help tests pass.
   - Test that configure writes manifest JSON only and does not call delegated setup commands.

6. Run full validation.

   Commands:
   - `npx tsc --noEmit`
   - `pnpm --dir packages/afk test`

## Risks And Open Questions

- Inquirer can handle the editor loop, but testing prompt-heavy code will be painful unless prompt functions are injected behind a small adapter.
- The existing manifest shape guards are private to `manifest.ts`; exposing them cleanly may be better than duplicating validation.
- A beautiful preview UI is desirable, but a browser/HTML review flow would expand scope. The first version should make the terminal preview polished and keep the preview renderer separable.
- Editing arbitrary command args is inherently advanced. The first version should provide simple string prompts for args while preserving existing arrays exactly when unchanged.
