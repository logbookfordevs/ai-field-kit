# AFK CLI-Launched GUI PRD/Spec

## Problem Statement

AFK is becoming a broad command-line control surface for setup, skills, profiles, catalogs, MCPs, plugins, hooks, rules, updates, and related agent configuration workflows. The CLI is powerful, scriptable, and appropriate for advanced use, but many AFK workflows involve state inspection, selection, previews, edits, and multi-step decisions that are easier to understand and safer to perform in a visual interface.

Users need a GUI that can expose the same AFK capabilities without replacing the CLI as the product's engine. The GUI should make AFK easier to learn, easier to audit, and easier to operate for workflows such as setup, skill management, profile management, catalog editing, MCP configuration, and backup/export. The GUI should be launched intentionally from the CLI, serve a bundled local web app, and call AFK's core logic rather than becoming a disconnected desktop product.

The first version does not need 100 percent CLI parity. The product should instead define a measurable CLI-to-UI parity map and advance through gradual coverage milestones.

## Solution

Add an AFK GUI mode launched by the CLI, tentatively through `afk ui`. The command starts a local web server, serves a bundled React web app, opens or prints a local browser URL, and exposes local JSON API routes that call shared AFK core functions.

The GUI should follow the Stitch design direction already captured in `apps/gui/docs/stitch-ai-skills-companion-electron-pivot`: a warm, dense, editorial workspace for an AI Skills Companion, with focused workflow routes and a persistent dashboard shell.

The long-term product goal is UI parity with the AFK CLI. The implementation goal is staged parity: build small, complete vertical slices that each map to real CLI capabilities, while tracking overall coverage in 10 percent increments.

The preferred architecture is:

```text
AFK CLI command
  -> start local AFK GUI server
  -> serve bundled web app
  -> expose local API routes
  -> call shared AFK core functions
  -> return previews, results, and errors
```

The GUI should not shell out to `afk` for every action as its primary model. Shelling out may be acceptable as a short-lived compatibility bridge for commands that are not yet extracted into reusable functions, but the durable architecture should separate command parsing from reusable AFK behavior.

## User Stories

1. As an AFK user, I want to launch a local GUI from the CLI, so that I can manage AFK visually without installing a separate desktop app.
2. As an AFK user, I want the GUI to use the same behavior as the CLI, so that visual workflows do not drift from command-line workflows.
3. As an AFK user, I want a dashboard that shows AFK setup state, so that I can understand what is installed, configured, missing, or stale.
4. As an AFK user, I want to run setup from the GUI, so that I can choose rules, skills, MCPs, plugins, hooks, agents, and scope with clearer previews.
5. As an AFK user, I want to dry-run setup from the GUI, so that I can review planned file and command operations before anything changes.
6. As an AFK user, I want to manage skills from the GUI, so that I can list, inspect, add, open, enable, disable, delete, upgrade, and categorize skills visually.
7. As an AFK user, I want to manage skill profiles from the GUI, so that I can create, edit, enable, disable, delete, and inspect profile status.
8. As an AFK user, I want to edit catalog manifests from the GUI, so that I can update rules, skills, profiles, MCPs, plugins, hooks, and presets without hand-editing JSON.
9. As an AFK user, I want catalog edits to show a preview before writing, so that I can catch mistakes before AFK mutates config files.
10. As an AFK user, I want MCP recommendations and configuration content to be editable in the GUI, so that agent integration setup is easier to audit.
11. As an AFK user, I want plugin and hook configuration to be visible in the GUI, so that I can understand what AFK will install or wire into agents.
12. As an AFK user, I want backup/export workflows in the GUI, so that I can save and transfer AFK catalog or skill state.
13. As an AFK user, I want the GUI to show errors and partial failures clearly, so that I know what succeeded, what failed, and what to do next.
14. As an AFK user in a remote or headless environment, I want the CLI to print the local URL instead of assuming a browser can open, so that I can still use port forwarding or copy the URL manually.
15. As a maintainer, I want the GUI to be built gradually with a visible parity percentage, so that the project can make honest progress without promising complete parity in the first slice.
16. As a maintainer, I want CLI and GUI behavior to share core functions, so that bug fixes and product semantics apply to both surfaces.
17. As a maintainer, I want the GUI API to support dry-run and preview modes, so that mutating workflows can be tested safely.
18. As a maintainer, I want a browser smoke test for the GUI shell, so that broken bundles, blank screens, and missing API wiring are caught early.

## Behavior

### Launch Behavior

`afk ui` should start a local server on an available port and serve the bundled GUI. The CLI should open the URL in the user's browser when appropriate and print the URL as a fallback.

The GUI should be a persistent dashboard with focused workflow routes. This means the shell can stay open, but individual routes can still behave like task-specific flows.

Remote and non-interactive behavior must be explicit:

- If browser opening is skipped or fails, print the URL.
- Logs should not pollute machine-readable outputs when a command mode expects JSON.
- The server should expose a clear shutdown path.
- The server should not require a frontend dev server in normal CLI use.

### Capability Coverage Model

The GUI should include a CLI parity map. Each CLI capability should be classified as:

- Not started
- Planned
- Read-only surfaced
- Previewable
- Mutating
- Complete for current CLI behavior

The project should track progress in 10 percent increments. The exact count of capabilities may change as AFK grows, so the percentage is a product planning guide rather than a rigid claim.

Suggested staged coverage:

1. 10 percent: GUI shell, local server, health/status API, Stitch-inspired navigation, basic catalog overview.
2. 20 percent: read-only skills and profiles browser.
3. 30 percent: skill enable, disable, open, show, and profile status actions with previews where applicable.
4. 40 percent: profile create, edit, enable, disable, and delete.
5. 50 percent: setup preview and dry-run flow for rules, skills, MCPs, plugins, and hooks.
6. 60 percent: setup apply flow with progress, partial failure reporting, and post-run summary.
7. 70 percent: catalog manifest editor for rules, skills, profiles, MCPs, plugins, hooks, and presets.
8. 80 percent: skill add, upgrade, categorization, and official source workflows.
9. 90 percent: backup/export/import workflows, richer validation, and cross-surface diagnostics.
10. 100 percent: every supported AFK CLI command has an equivalent GUI route or an intentional documented reason for no GUI equivalent.

The first implementation slice should target the first 10 percent only unless a later implementation plan deliberately widens scope.

### UI Information Architecture

The GUI should use a persistent dashboard shell with focused routes. Expected route groups include:

- Overview: current AFK state, catalog freshness, setup status, quick actions.
- Setup: rules, skills, MCPs, plugins, hooks, agents, scope, preview, apply.
- Skills: list, show, open, add, enable, disable, delete, upgrade, categorize.
- Profiles: list, show, create, edit, enable, disable, delete, status.
- Catalog: rules, skills, profiles, MCPs, plugins, hooks, presets, JSON preview.
- Integrations: MCP and plugin configuration.
- Backup: export/import and local backup artifacts.
- Diagnostics: validation output, failed operations, environment information.

The UI should follow the Stitch design system direction:

- Warm neutral canvas and tonal layering.
- Dense but breathable operational layouts.
- Persistent navigation and focused work areas.
- Minimal decorative framing.
- Clear preview and confirmation states for mutations.

### Tailwind Styling And Theme Tokens

The GUI should implement its styling foundation with Tailwind CSS v4 and CSS-first design tokens. The first version only needs the default AFK visual theme, but the token model should leave room for future light/dark mode support and named theme presets such as Dracula, Caffeine, or other community/product palettes.

The implementation should separate semantic UI intent from raw color values. Components should use semantic tokens such as background, foreground, surface, panel, card, border, muted, accent, primary, destructive, warning, success, ring, and their foreground variants rather than hard-coded palette utilities. This keeps the Stitch-inspired default theme changeable without rewriting component classes.

The token system should be designed around:

- Tailwind v4 `@theme` tokens in the GUI stylesheet instead of a Tailwind config file unless the project later needs explicit config-only behavior.
- CSS custom property overrides for theme scopes, starting with the default theme and reserving clear selectors or data attributes for future modes and presets.
- A light/dark-ready semantic color set, even if dark mode is not exposed in the initial UI.
- Non-color tokens for radius, spacing rhythm, shadows, focus rings, and motion so future themes can change more than hue.
- Accessible contrast targets for all semantic token pairs.
- Components that reference tokens through Tailwind utilities and shared variants, not one-off arbitrary values.

Future theme presets are out of scope for the first slice. The first slice should only create a durable token structure and default theme values that do not block later preset selection, persistence, or user customization.

### Core Behavior Reuse

The CLI should keep owning command-line parsing, help text, and scriptable behavior. Shared AFK behavior should live in reusable functions that can be called by CLI command handlers and GUI API handlers.

The GUI API should avoid duplicating CLI parsing. For example, setup preview should call setup planning functions directly rather than constructing a shell command string. Existing command modules can be refactored gradually when the GUI reaches a workflow.

Where a CLI command currently mixes prompts, stdout rendering, file mutation, and business logic, implementation should extract the smallest useful core function before adding the GUI route.

### Mutations, Previews, And Confirmation

All mutating GUI workflows should prefer a two-step pattern:

1. Preview planned operations, commands, file writes, or moves.
2. Apply after explicit confirmation.

This applies especially to setup, manifest editing, skill enable/disable/delete, profile changes, MCP edits, plugin installation, hook installation, and backup/import operations.

Dry-run behavior in the GUI should match CLI dry-run semantics where they already exist.

### Error Handling

The GUI should display:

- Validation errors before apply.
- Missing executable errors for delegated commands.
- Partial setup failures by area.
- Read-only root rejection for skills or agent roots that cannot be mutated.
- Failed downloads, missing catalogs, malformed manifests, and stale state.
- A copyable command or diagnostic detail when appropriate.

Errors should preserve AFK's user-facing semantics. The UI should not rename CLI/MCP/hooks/plugins/agent config surfaces as if they were interchangeable.

### Empty States

Expected empty states include:

- No local catalog found.
- No skills installed.
- No disabled skills.
- No profiles configured.
- No MCPs selected or no MCP targets selected.
- No plugins available or selected.
- No hooks available or no hook targets selected.
- No backup/export artifacts yet.

Empty states should offer the next meaningful action without turning the app into a marketing page.

## Acceptance Criteria

- [ ] A PRD-backed CLI capability inventory exists and includes setup, refresh, catalog import/show/configure, skills, profiles, UI delegation, update, and setup area commands.
- [ ] The GUI project has a staged parity model that can report approximate progress in 10 percent increments.
- [ ] The first implementation slice is explicitly limited to the first parity increment unless widened by a later plan.
- [ ] `afk ui` is defined as a CLI-launched local web app, not a separate Electron-first product.
- [ ] The GUI architecture calls shared AFK core functions through local API routes.
- [ ] Shelling out to `afk` from the GUI is treated as a temporary fallback, not the preferred durable architecture.
- [ ] The GUI shell follows the Stitch design direction from the existing AI Skills Companion Electron Pivot artifacts.
- [ ] The GUI styling foundation uses Tailwind CSS v4 semantic design tokens and leaves room for future light/dark modes and named theme presets.
- [ ] The local server serves a bundled web app in normal CLI use.
- [ ] The GUI can expose read-only state without mutating files.
- [ ] Mutating GUI workflows have preview and confirmation behavior.
- [ ] Setup, skill management, profile management, catalog editing, MCP/plugin/hook configuration, and backup/export are all represented in the long-term UI parity map.
- [ ] Browser opening has a URL fallback for remote or failed-open environments.
- [ ] Tests cover the CLI launch seam, local API seam, core behavior seam, staged parity data, and a browser smoke seam.

## Implementation Decisions

- Build a CLI-launched web app rather than starting with a standalone Electron app.
- Use the CLI as the product entry point and AFK core functions as the behavior engine.
- Keep the UI as a persistent dashboard with focused workflow routes.
- Use the existing Stitch project export as visual direction for the GUI.
- Use Tailwind CSS v4 with CSS-first semantic design tokens for the GUI styling foundation.
- Design the first theme as the default AFK/Stitch-inspired theme while preserving room for future light/dark mode and named presets.
- Store the GUI under the existing workspace application pattern.
- Keep setup, skills, profiles, catalog manifests, MCPs, plugins, hooks, and backup/export in the long-term parity scope.
- Do not require 100 percent parity for v1.
- Track UI coverage through staged parity increments.
- Prefer direct core function calls from local API routes.
- Permit temporary shell delegation only for CLI workflows that have not yet been extracted.
- Preserve CLI behavior and public semantics while extracting shared core logic.
- Keep preview/dry-run behavior central to all mutating workflows.
- Treat read-only roots and destructive behavior with the same boundaries as the CLI.
- Keep normal CLI usage free from frontend dev-server requirements.

## Testing Decisions

Tests should verify observable AFK behavior, not implementation details or React component internals.

The main testing seams are:

- CLI capability inventory seam: verify the parity map against the command dispatch/help surface.
- Local web server seam: verify `afk ui` starts a local server, serves the built GUI, exposes health/state APIs, and provides a URL fallback.
- Core action API seam: verify local API routes call shared AFK behavior and return structured preview/apply results.
- Skills and profiles seam: verify read-only and mutating skill/profile workflows through external behavior.
- Catalog/configuration seam: verify draft, preview, validation, and write behavior for manifest editing.
- Phased parity seam: verify each capability has a coverage status and that progress reporting is derived from the map.
- GUI smoke seam: verify the built GUI loads in a browser and can call at least one read-only API.
- Styling token seam: verify the built GUI stylesheet exposes the required semantic tokens and that representative shell components use token-backed utilities instead of hard-coded palette values.

Prior art in the codebase includes tests for CLI dispatch, setup flows, manifest configuration, skills management, UI command delegation, and catalog import behavior. New tests should extend those high-level seams rather than duplicating lower-level implementation details.

## Out of Scope

- Building full CLI-to-UI parity in the first implementation slice.
- Shipping an Electron app as the initial product shape.
- Shipping selectable theme presets or full user theme customization in the first implementation slice.
- Replacing the AFK CLI.
- Reimplementing official upstream skill or MCP installers instead of delegating where AFK already delegates.
- Adding decorative marketing pages instead of usable workflow routes.
- Supporting every remote/headless deployment mode in v1 beyond URL fallback and clear behavior.
- Mutating read-only agent roots.
- Redesigning AFK's public CLI command names or setup semantics as part of the GUI effort.

## Further Notes

The product ambition is complete UI parity with AFK CLI over time, but the execution style should be incremental. The GUI should become useful at 10 percent completion, then continue earning more CLI surface area through clear slices.

The Plannotator pattern is the main technical reference: prebuild the frontend, serve it from a CLI-owned local server, expose JSON endpoints, and avoid running a frontend dev server during normal CLI use.

The existing `afk ui` command currently delegates to the external UI Skills CLI. This PRD reuses the command name as the likely future entry point for the AFK-native GUI, but implementation should decide how to avoid breaking existing user expectations around that command.

The Stitch artifact folder is source material for product and visual direction. It should not be treated as production source code without adaptation.
