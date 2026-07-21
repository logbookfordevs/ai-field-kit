# Changelog

This changelog tracks meaningful updates by version and date.

## How We Use This File

- Keep unreleased work in `## TBD - TBD`; when a batch feels complete, move it into a versioned section like `## v0.5.0 - 2026-05-19`.
- Prefer reader-focused summaries over raw commit messages.
- Group bullets by area prefix when helpful: `docs:`, `skills:`, `workflows:`, `mcps:`, `sync:`, `rules:`.
- Skip trivial noise. Record changes that affect how someone uses, syncs, extends, or trusts the kit.

## TBD - TBD

### Added

- `cli:` added portable Custom Agents as a first-class `agents.json` catalog area, with refresh merging, show/catalog menus, interactive and scripted setup, and AFK-owned adapters for Codex, Claude Code, and Pi through `pi-subagents`; the portable contract preserves per-harness model and effort pins, Codex display nicknames, and native per-agent skill configuration without taking over skill installation or validation.
- `skills:` added the manual-only `afk-create-agent` workflow for authoring portable agent files, registering their catalog sources, and dry-running every requested harness adapter.

### Fixed

- `install:` resolved the latest AFK release through GitHub's release redirect instead of the rate-limited unauthenticated REST API.

## v1.2.0 - 2026-07-20

### Added

- `cli:` added global `afk skills upgrade --profile` selection for upgrading every tracked skill in a chosen profile without changing profile membership or activation.
- `cli:` added `afk skills get <skill>` for printing local skill instructions and `afk skills profiles use <profile>` for on-demand profile context, with `--all` to include every profile skill in full.
- `cli:` added `afk skills profiles enable <profile> --additive` to activate a profile on demand without filtering unrelated active skills, with activation-aware restoration when the profile is disabled.
- `cli:` added `afk skills delete --profile` to delete installed skills referenced by a selected profile, with an extra warning that those skills may be shared by other profiles.
- `skills:` added the manual-only `afk-profile-use` router for loading local profile members into the current request through the AFK CLI.
- `skills:` added Matt Pocock's `wayfinder` workflow to the bundled catalog as an optional shared skill.

### Changed

- `cli:` made the shared global skills library the default across `afk skills`, with explicit preset-agent targeting, literal custom roots through `--agent custom --agent-path <folder>`, and shared-first installs before optional agent fanout.
- `cli:` made catalog refresh preserve local profile definitions absent from the refreshed source while source definitions and top-level profile policy remain authoritative.
- `cli:` made global skill setup reconcile newly installed skills against enabled focus profiles according to strict or context policy, while additive-only profiles continue to preserve unrelated active skills.
- `cli:` made skill upgrades restore pre-upgrade disabled storage after the upstream content reinstall completes.
- `cli:` made `afk skills add` offer preflight import only for existing installs tracked by the skills CLI, ignore plugin- or CLI-owned skills without lock metadata, treat source-cataloged first installs as new, apply add-time flags only to genuinely new skills, and refresh existing content without changing storage or profile membership.
- `cli:` made skill setup consider source-owned catalog entries by default, with `afk setup --all` and `afk setup skills --all` including imported entries; interactive runs now show the expanded list for review, while `--yes --all` installs every listed skill.
- `cli:` renamed the `afk skills delete --manifest-only` filter to `--catalog-only` so the flag matches its `skills.json` catalog behavior.
- `skills:` made `afk-doc-craft` manually invoked by default, so documentation craft runs only when explicitly selected instead of sitting in automatic discovery.
- `skills:` made Matt Pocock's optional `research` skill auto-invoked when installed.
- `skills:` replaced `afk-interactive-code-review` with `afk-code-review`, an AFK-compatible fork of Matt Pocock's two-axis Standards/Spec review workflow.
- `skills:` renamed `afk-to-tasks` to `afk-to-tickets` so AFK's fork keeps the same public shape as Matt Pocock's `to-tickets` skill.
- `skills:` updated `afk-to-tickets` with fresh-context sizing and expand-contract guidance for wide refactors.
- `docs:` explained when to use `grill-with-docs` versus `wayfinder`, and taught `afk-compass` the same routing distinction.

### Fixed

- `cli:` fixed interactive `afk skills add` profile modes so `--profile`, `--profile-only`, and `--start-disabled` apply as AFK post-install behavior instead of being forwarded to the upstream skills CLI.

## v1.1.0 - 2026-07-06

### Added

- `cli:` added profile reconciliation modes in `profiles.json`, with `strict` preserving existing profile filtering and `context` keeping cataloged manual skills active while profiles filter discoverable skills.
- `cli:` added `profiles.json` to the default catalog refresh/setup flow and `afk show profiles`, with bundled defaults for context mode, always-on profile skills, and the existing Stitch and Video profiles.
- `cli:` added an `afk catalog skills` menu and made nested AFK lobbies use Ctrl/Cmd-C as a shared back action.
- `cli:` added `afk skills add --profile-only <profile>` to add imported skills to a profile while importing them as `startDisabled: true` and moving their shared folders into `.disabled`.
- `cli:` added `--profile-only` and the matching interactive prompt to `afk catalog profiles create|edit`, so profile members can start disabled outside that profile.
- `skills:` added Emil Kowalski's optional `animation-vocabulary` utility to the bundled catalog with invocation off.

### Changed

- `cli:` replaced the `afk config` command surface with `afk catalog`, including direct area menus for rules, skills, profiles, MCPs, plugins, and hooks.
- `skills:` renamed `afk-to-prd-spec` to `afk-to-spec` and `afk-to-issues` to `afk-to-tasks` across the bundled catalog and workflow routing.
- `skills:` renamed `afk-execution-tracking` to `afk-implement-tasks` so the workflow command names the implementation job rather than the tracking mechanism.
- `skills:` aligned `afk-to-spec` and `afk-to-tasks` with the upstream `to-prd`/`to-issues` structures while adapting them to AFK spec artifacts, checkpoint packets, optional tracker publication, and Plannotator review.
- `skills:` clarified that `afk-to-spec` and `afk-to-tasks` must reopen the Plannotator annotation gate after feedback until the user approves or stops the loop.
- `skills:` clarified that an approved `/plannotator-review` during `afk-implement-tasks` can mark the checkpoint packet's `code` review gate accepted.
- `rules:` clarified that explicit skill-driven background-agent or fresh-context review instructions count as delegation approval for bounded sub-agent use.
- `docs:` corrected the `grill-with-docs` companion-skill guidance to reflect its current `grilling` and `domain-modeling` composition.

### Fixed

- `cli:` fixed `afk setup skills --yes` so detected single-agent installs still create the shared `~/.agents/skills` library before adding agent-specific targets.

## v1.0.3 - 2026-06-23

### Added

- `cli:` added `afk update` to update the AFK CLI through the hosted GitHub release installer, with `--dry-run` for previewing the installer command.
- `cli:` added `afk skills invocation` to enable or disable skill auto-invocation metadata in both `SKILL.md` and Codex `agents/openai.yaml`.
- `cli:` added `startDisabled` support for skills catalog items, so installed skills can start in `.disabled` until enabled directly or through profiles.
- `cli:` added `afk skills add <source> [flags...]` as a thin wrapper around the official `skills add` command, followed by AFK catalog import for new shared skills plus AFK-owned `--start-disabled` and `--profile <profile>` options.
- `cli:` restored `afk configure` for writable catalog edits, including profile `alwaysOn` editing.
- `cli:` added `afk catalog profiles` for profile definition edits, while keeping runtime profile operations under `afk skills profiles`.
- `cli:` added `afk skills add` and `afk skills invocation` to the skill-management lobby.

### Changed

- `install:` updated AFK update notices to suggest `afk update` and refreshed the website full-setup copy to use the hosted `install.sh` flow instead of npm install commands.
- `cli:` removed skill-item `profiles` metadata from the skills catalog model so `profiles.json` stays the single source of truth for focus-profile membership.
- `cli:` refreshed `afk catalog import` output with branded sections, path rows, and readable bullet summaries for imported and skipped skills.

## v1.0.1 - 2026-06-19

### Changed

- `release:` made `install.sh` a GitHub release installer again, with checksum-verified release assets and a generated launcher that requires Node 20 or newer at runtime.

## v1.0.0 - 2026-06-19

### Added

- `cli:` added the `afk skills` command family for local skill management, including list, show, open, enable, disable, delete, upgrade, and categorize commands.
- `cli:` added searchable skill pickers for management commands and multi-select delete flows when a command needs the user to choose skills interactively.
- `cli:` added `afk skills profiles` to create, edit, enable, disable, delete, and inspect focus profiles that temporarily keep selected global skills active while moving the rest aside.
- `cli:` added `afk ui` as a thin, attributed wrapper around the UI Skills CLI for `start`, `categories`, `list`, and `get` without forcing users to remember the `npx ui-skills` command shape.
- `cli:` added `afk show skills --react` to render the skills catalog as a syntax-colored React-style composition tree using each skill's role, auto-discovery setting, and composed dependencies.
- `cli:` added `afk show skills --visualize` to write a self-contained `afk-skills.html` composition page from the skills catalog and open it automatically in interactive terminals.
- `cli:` added `afk catalog import` to backfill missing skills catalog entries from installed skills when the official `skills` CLI lockfile can recover the original source.
- `skills:` added AFK Turbo review-gated mode, where each code-changing GoalBuddy task stages changes, suggests Plannotator Review, and waits for human approval before task completion.

### Changed

- `cli:` moved catalog cache updates to top-level `afk refresh`, made `afk setup` consume the cache by default, and made `afk show` inspect the cache unless `--source` is passed.
- `cli:` made first-run setup seed the catalog cache from the official `logbookfordevs/ai-field-kit` source when no default exists, while `afk refresh --default-source` now saves a new default source and refreshes the cache.
- `cli:` renamed AFK's public setup data model from manifests to catalog, moving bundled defaults to `packages/afk/catalog`, global cache files to `~/.agents/afk/catalog`, and project-local files to `./afk/catalog`.
- `cli:` made `~/.agents/afk/catalog/skills.json` the single AFK skills catalog for setup metadata and skill-management enrichment, with categorization stored in top-level scopes plus each item's nested `catalog` object.
- `cli:` made successful `afk setup skills` installs synchronize installed skill entries into the AFK skills catalog as uncategorized imported items.
- `cli:` made `afk skills delete` remove imported catalog entries for deleted skills, so imported catalog state follows the local skill library.
- `cli:` made `afk skills list`, `show`, `open`, `enable`, `disable`, and `delete` understand global, project, and agent-specific skill roots through `--scope` and `--agent`.
- `cli:` made skill list/show output expose auto-invocation state from `SKILL.md` and Codex `agents/openai.yaml`, including mixed-state warnings when the two sources disagree.
- `cli:` made `afk skills upgrade` use AFK's tracked skill catalog for selection while delegating the actual update to the official skills CLI.
- `cli:` fixed the skills visualization React analogy so quoted JSX attributes render as normal quotes instead of visible `&quot;` entities.
- `cli:` made `afk show skills --visualize` include local focus profiles, enabled state, always-on skills, and missing profile references when profile data is available.
- `cli:` made the root lobby and command help more self-documenting, including direct routes for refresh, skill React view, skill visualization, and catalog import.
- `cli:` expanded the interactive lobby with skill-management and profile-management submenus.
- `cli:` removed RTK from the bundled plugin catalog and dropped its special `rtk-init` post-install path in favor of generic plugin post-install commands.
- `cli:` refined the skills visualization template typography with smaller fixed headings, clearer product UI hierarchy, and lighter role markers.
- `cli:` marked catalog-imported skills with `imported: true` and preserved them across refresh until the refreshed source owns the same skill id.
- `docs:` made Quick Start lead with AFK CLI, clarified when to use `npx` versus a global AFK install, recommended companion plugins for the full skills experience, and kept `npx skills add` as the authored-skills-only path.
- `docs:` documented Turbo and execution-tracking modes so review-gated and resume requests are discoverable without reading skill internals.
- `docs:` refreshed the skill composition markdown and HTML companion so the current AFK tree no longer references the removed resume workflow and shows Turbo composing `grilling`.
- `skills:` simplified AFK Turbo launch behavior so the skill stops at the harness boundary and prints the exact user-triggered command instead of generating a launch page.
- `skills:` folded workflow resume into Turbo and execution-tracking modes, removed `afk-resume-workflow` from the catalog, and let Turbo compose the `grilling` primitive before Plannotator setup.
- `skills:` aligned Sprint and execution tracking with Turbo's preflight/review posture by adding short grilling before weak Plannotator setup context and recommending `/plannotator-review` at review gates.
- `skills:` added a Plannotator annotation gate after `afk-to-prd-spec` writes local PRD/spec artifacts so user feedback is resolved before slicing or execution consumes the spec.
- `skills:` added a folder-level Plannotator annotation gate after `afk-to-issues` writes local checkpoint packets so packet content is reviewed before tracked execution starts.
- `skills:` added `afk-delegate` as a supervised external-agent utility and removed raw cmux/tmux entries from the catalog in favor of live/background transport references.
- `skills:` renamed the composition role from `flow` to `workflow`, including bundled catalog values, show output, visualization docs, and README language.
- `skills:` clarified AFK Sprint so manual composed skills are explicit user-invocation boundaries instead of silent internal steps.
- `skills:` pointed Turbo and execution tracking at `yggtree` for parallel worktrees before falling back to native git worktree commands.
- `skills:` shortened AFK-owned manual skill descriptions and default prompts so `autoInvocation: false` skills read like explicit invocation surfaces instead of auto-discovery triggers.

### Fixed

- `cli:` normalized skill description parsing so YAML block-scalar markers and leading blank descriptions no longer leak into `afk skills list` or `show` output.

## v0.6.0 - 2026-06-16

### Added

- `plugins:` added Plannotator Tot as an opt-in global plugin installer for git-backed Markdown and HTML publishing.
- `skills:` added Plannotator's compound report, `/goal` setup, and visual explainer skills to the default global skill manifest.
- `skills:` added Plannotator's Effective HTML skills as opt-in external recommendations for self-contained HTML reports, plans, and diagrams.
- `skills:` added `afk-resume-workflow` to continue feature or AFK workflow work from durable repo artifacts after context resets.

### Changed

- `skills:` renamed `afk-workflow` to `afk-artifact-workflow` so AFK workflow requests mean Compass orchestration, while the artifact skill stays focused on durable workflow artifacts, storage, next-artifact suggestions, and handoff state.
- `skills:` tightened `afk-doc-craft` so agent-facing prompt and rule surfaces route to skill design instead of reader-facing documentation craft.
- `skills:` trimmed repeated trigger prose from skill bodies so descriptions own invocation and loaded instructions stay focused on runtime behavior.
- `skills:` added Matt Pocock's `teach` skill as an opt-in manifest item for explicit stateful learning workflows.
- `skills:` added Matt Pocock's `grill-me` skill for plan/design interrogation and retired `afk-deep-interview` from default install and auto-routing.
- `skills:` replaced `incremental-implementation` in the AFK manifest with `source-driven-development` and `doubt-driven-development` for human-gated execution discipline.
- `skills:` taught `afk-compass` and `afk-resume-workflow` to select a named execution discipline before implementation or delegation instead of treating execution tracking as the only execution skill.
- `skills:` taught `afk-execution-tracking` to record selected execution bundles, discipline evidence, and active checkpoints with an always-array marker before review, while treating commit hashes as receipts and tracking artifacts as explicit-ask commits only.
- `skills:` made skill invocation policy sync both directions so `autoInvocation: true` re-enables model discovery even when an installed skill shipped disabled, while `write-a-skill` and `to-issues` remain manual.
- `skills:` tightened `afk-pickup` so temp handoff resumes check direct `/tmp` paths before broader searches and avoid fragile shell search patterns.
- `plugins:` moved Impeccable back to the plugin installer manifest through its official installer.
- `hooks:` removed the AFK execution-tracking stop hook from the default hook manifest.
- `cli:` made `afk show` inspect the active setup source by default, retired the local manifest editor route from `afk configure`, and changed the plain `afk` lobby source action to save a new `--default-source`.
- `cli:` renamed the setup plugins surface from utils to plugins, including `plugins.json`, `afk setup plugins`, `afk show --plugins`, and setup selection labels.

## v0.5.4 - 2026-06-06

### Added

- `cli:` added conservative setup target detection so rules, MCPs, hooks, and additional skill-provider installs use detected compatible agent surfaces by default.
- `cli:` added `~/.agents/afk/setup-targets.json` for custom local agent target evidence paths, keeping machine-specific target configuration out of `presets.json`.
- `cli:` added interactive setup source selection before manifest loading, with `--source` for one-run overrides and `--default-source` for saving the preselected default.
- `cli:` added `--verbose` for setup delegation so AFK can keep noisy upstream installer output hidden by default while still exposing raw CLI logs on demand.
- `repo:` added a shadcn-compatible GitHub registry entrypoint with an `afk-manifests` item that installs the default AFK manifest bundle into project-local `./afk/manifests/`.

### Changed

- `cli:` replaced `afk setup skills --include-external` with `--all` so users can install every skill in the manifest instead of only default skills.
- `cli:` changed empty setup target lists to mean "no resolved target" instead of expanding to every supported rules or MCP target; explicit `--agent` flags still override detected targets.
- `cli:` changed `--yes` setup runs to require an explicit or saved source before installing from a manifest.
- `cli:` clarified guided setup prompts so rules, MCPs, and hooks name their destination purpose instead of using a vague shared "agent targets" label.
- `skills:` renamed `ai-companion` to `afk-compass` and expanded it into the AFK entry-point router for AFK-native and recommended external skills.
- `skills:` moved cross-skill routing out of individual AFK skills and into `afk-compass`.
- `skills:` tightened default activation, routing, and ambiguity handling across AFK skills so guided workflows stay opt-in unless the task clearly calls for them.
- `skills:` tightened `afk-ask` around stable advisor behavior while moving volatile provider and model details into a reference file.
- `skills:` taught `afk-compass` to route frontend design and UI-quality work to plugin-installed Impeccable skills when available.

### Fixed

- `cli:` made guided MCP delegation pass `add-mcp -y` after AFK has collected MCP and target-agent choices, and now clearly reports when selected MCPs have no target agents instead of silently doing nothing.
- `cli:` kept plugin setup non-interactive for `npx`-backed installers by passing npm's own `--yes` flag before the package name, starting with the Impeccable plugin installer.

## v0.5.3 - 2026-06-01

### Added

- `release:` added a tag-triggered GitHub Actions workflow that publishes `@logbookfordevs/afk` to npm after verifying the tag, `main` tip, AFK typecheck, AFK tests, and package dry run.
- `release:` added a root `pnpm afk:version <patch|minor|major>` helper that runs `npm version` from inside `packages/afk`.
- `cli:` added an interactive setup banner notice when a newer `@logbookfordevs/afk` release is available on npm.
- `cli:` added a compact additional-agent prompt for skill installs that explains `.agents/skills` as always included, then passes selected Claude Code, Kiro CLI, Kilo Code, Pi, and Droid targets through to the official `skills` CLI with `--agent`, including noninteractive `afk setup skills --yes --agent ...` runs.

### Changed

- `release:` renamed the publishable AFK CLI package to `@logbookfordevs/afk` and made npm the recommended user-facing install path.
- `release:` replaced the AFK version-bump script with a manual changelog-first release flow using npm version tagging and an exact tag push.
- `cli:` refined guided setup so a plugins-only route no longer asks for agent targets, and the setup banner now points to `afk setup refresh` when local manifests may be stale.
- `docs:` moved the hosted `install.sh` path out of the public setup journey; `scripts/install.sh --local` is now documented as a development helper.
- `docs:` removed maintainer-only publish commands from the public README so contributors see install and development guidance instead of private release steps.

## v0.5.2 - 2026-05-27

### Added

- `cli:` added top-level `afk --version` and `afk -v` output sourced from the CLI package metadata.
- `cli:` added hook installation as a first-class setup area, with `hooks.json`, interactive selection, manifest show/configure support, dry-run planning, and safe merging into Codex, Claude Code, and local Cursor hook configs.
- `cli:` added the AFK execution-tracking stop hook source and hook install planning for copying managed hook scripts into agent-specific hook folders.
- `skills:` added `afk-pickup` as a manual support skill for finding and resuming disposable handoff notes from the OS temp directory.
- `skills:` added Matt Pocock's external `handoff` skill to the default setup recommendations with manual invocation, pairing it with `afk-pickup` for the next-session resume flow.
- `site:` added the AI Field Kit site and exposed the canonical installer at `/install.sh`.
- `docs:` added README guidance for the hosted install path, hook manifests, shorter setup area commands, and the renamed `afk-doc-craft` documentation skill.

### Changed

- `cli:` changed global rules sync to merge the AFK managed region into each agent's own rule file instead of replacing Codex, Antigravity/Agy, or OpenCode hosts with symlinks.
- `cli:` replaced the setup refresh flag with `afk setup refresh`, including `--local` support for refreshing project-level `./afk/manifests`.
- `cli:` added Cursor aliases for local hook setup while keeping Cursor out of general rule/MCP/plugin agent targeting.
- `cli:` made `afk setup rules`, `afk setup skills`, `afk setup mcps`, `afk setup plugins`, and `afk setup hooks` the canonical area commands while keeping older `sync`/`install` forms as compatibility aliases where still supported.
- `cli:` expanded setup help so `afk setup --help` lists setup subcommands and each setup area help screen explains shared options instead of showing bare flags.
- `cli:` refined the AFK terminal banner colors for a warmer, more legible setup experience.
- `release:` added an AFK version bump helper that promotes the current changelog TBD section, updates the CLI package version, and refreshes the pinned install example.
- `skills:` renamed `afk-documentation-authoring` to `afk-doc-craft` across the skill directory, README, manifests, and dependent skill references.
- `skills:` refined `afk-execution-tracking` around active checkpoint files, review gates, split-plan handoffs, and stale-tracking recovery.
- `docs:` updated README setup docs to prefer the hosted `https://ai-field-kit.logbookfordevs.com/install.sh` path.

## v0.5.1 - 2026-05-19

### Changed

- `cli:` removed the separate workflow manifest and command-sync lane; workflow-style AFK procedures now ship through `skills.json` as manual-invocation skills.
- `cli:` renamed the AFK Gemini target to Antigravity/Agy, kept `gemini` as a compatibility alias, switched MCP delegation to `add-mcp -a antigravity`, and routed RTK project setup through `rtk init --agent antigravity`.
- `sync:` removed the deprecated `sync-ai-agents.sh`, `sync-ai-workflows.sh`, and `sync-ai-mcps.py` scripts now that setup routes through the AFK CLI and upstream installer CLIs.

### Fixed

- `cli:` restored the tracked AFK CLI source package and release packaging that were missing from the `v0.5.0` release, so the published archive now includes the runnable setup router code instead of only documenting it.
- `cli:` restored `afk manifests show`, refresh-only `afk setup --refresh-defaults`, remote-first manifest refresh behavior, and clean release packages that fetch manifests remotely.

## v0.5.0 - 2026-05-19

### Added

- `cli:` added the initial AFK CLI package under `packages/afk`, centered on `afk setup` as an inspect-first setup router for rules, skills, MCPs, and plugins.
- `cli:` added a warm guided setup experience with an AFK banner, scope selection, and granular checkboxes for setup areas, agents, skills, MCPs, and plugins.
- `cli:` added remote-owned JSON manifests for skills, MCPs, plugins, rules, and presets so recommendations can evolve without patching the CLI.
- `cli:` added editable local manifest storage under `~/.agents/afk/manifests`, plus `--init-only`, `--empty`, `--refresh-defaults`, and `--defaults-source` setup modes.
- `cli:` added `afk manifests configure` for authoring global or repo-local manifest files and `afk manifests show` for inspecting global or project-local manifest state.
- `cli:` added rules setup that injects AFK rules into managed regions inside host rule files without replacing user-owned content.
- `cli:` added non-interactive delegated skill installs through `skills add --global --yes`, letting the official `skills` CLI handle agent target fanout.
- `cli:` added initial AFK-owned rule support for Codex, Claude Code, Gemini, and OpenCode; skills and MCP coverage remains owned by their upstream CLIs.
- `cli:` added `afk setup plugins` for curated plugins, starting with Plannotator and RTK delegated installs plus RTK initialization for selected agents.
- `cli:` added best-effort plugin installation and grouped setup summaries so one plugin failure does not block the rest of the selected setup route.
- `cli:` added release-asset packaging and install scripts for GitHub Releases while keeping `--source local` available as an explicit development escape hatch.
- `skills:` added `afk-workflow` as the activatable doctrine skill for artifact boundaries, RFC positioning, implementation planning, execution tracking handoff, and default artifact conventions.
- `skills:` added `afk-execution-tracking` for checkpointed implementation after a plan exists, including task status, validation, engineer/product review gates, resume context, and parallel-agent coordination.

### Changed

- `cli:` keeps workflow-style AFK procedures in `skills.json` as manual-invocation skills instead of maintaining a separate workflow manifest or command-sync lane.
- `rules:` replaced inline/imported AFK workflow doctrine in `AGENTS.md` with a small trigger that invokes the `afk-workflow` skill when workflow artifacts, specs, plans, RFCs, or tracking are involved.
- `skills:` standardized generated workflow artifacts around the repo/user convention first, with AFK fallback defaults under `docs/<task-slug>/<task-slug>.<type>.md` and task references under `docs/<task-slug>/references/`.
- `skills:` renamed `afk-ask-gemini` to `afk-ask` and generalized it into a standalone local advisor skill for Claude, Codex, and Gemini CLIs, preserving reusable artifacts while keeping the advisor read-only by default.
- `skills:` aligned artifact-writing skills with repo/user artifact rules instead of hardcoded AFK paths, using `afk-workflow` as the fallback convention.
- `docs:` reframed the README around "standalone skills with an optional workflow path," added the current AFK workflow map, and removed maintainer-only handoff-contract details from the public README.

## v0.1.1 - 2026-04-08

- `repo:` started lightweight versioning for changelog entries instead of relying only on date buckets.
- `skills:` introduced the first AFK spec-driven primary skill set around brainstorming, deep interview, and decision-shaping before implementation.
- `skills:` refactored `afk-brainstorming-facilitator` by rebasing it on the original BMAD brainstorming architecture, while adapting it to AFK paths, lighter setup, stronger partnership tone, and durable `artifacts/`-based session persistence.
- `skills:` replaced `afk-discuss-implementation-decisions` with `afk-coding-tradeoffs`, a more AFK-native skill for resolving UX and implementation trade-offs with Truss as the decision lens and reusable decision artifacts in `docs/decisions/`.
- `skills:` strengthened `afk-structured-debugging` around root-cause flow while preserving the earlier "what should happen vs what is happening" comparison experience.
- `skills:` removed `afk-dx-coding-playbook` and `afk-code-simplify` after deciding those roles were either too broad or better consumed from external skill sources directly.
- `docs:` expanded the README with workflow guidance, framework pairings, artifact lifecycle explanations, and acknowledgements to the upstream projects that informed AFK.

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
