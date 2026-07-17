# AFK CLI

AFK is the setup router for AI Field Kit. It gives developers one place to
preview and apply the parts of the kit they want: shared rules, skills, MCPs,
plugins, hooks, and custom setup catalogs.

The CLI is intentionally a router, not a replacement for every ecosystem tool.
AFK owns the AFK-specific rule and hook behavior. It delegates skills to the
official `skills` CLI, MCPs to `add-mcp`, and plugins to their own installer
commands.

AFK skills are modeled as composable parts: primitives, wrappers, workflows,
utilities, references, and routers. That shape keeps automatic model discovery
small while still giving people named workflows to invoke directly. See
[Skill Composition](docs/skill-composition.md) for the full mental model.

## Quick Start

Install the latest AFK CLI release:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash
afk setup --dry-run
```

Start with `--dry-run`. AFK prints the exact rules, skills, MCP, plugin, and
hook actions it would run before anything writes to your machine.

When the preview looks right, run the same command without `--dry-run`:

```bash
afk setup
```

Interactive setup starts with nothing selected. Use space to choose the areas
and items you want. On first run, AFK asks which source should seed the local
cache, saves that source as the default, refreshes the cache, then continues.
Scripted setup can use `--yes` to accept defaults after the cache exists, or
`--source` to run from another source once without changing the cache.

## What AFK Sets Up

| Area | Command | What happens |
|---|---|---|
| Rules | `afk setup rules` | Syncs AFK rules into managed regions of supported agent rule files. |
| Skills | `afk setup skills` | Delegates selected skill installs to `npx skills add`. |
| Profiles | `afk setup profiles` | Prepares focus profile definitions from `profiles.json`. |
| MCPs | `afk setup mcps` | Delegates selected MCP recommendations to `npx add-mcp`. |
| Plugins | `afk setup plugins` | Runs curated plugin installer commands and supported post-install setup. |
| Hooks | `afk setup hooks` | Copies hook scripts and merges hook commands into supported agent configs. |

`afk setup` can run all of those areas in one guided flow. Each area runs
independently: if one delegated installer fails, AFK still tries the remaining
selected areas, then exits non-zero with a failure summary.

## Install AFK

Use the latest GitHub release for a persistent machine command:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash
afk setup --dry-run
```

Use the package directly while developing:

```bash
pnpm --dir packages/afk install
pnpm --dir packages/afk run build
node packages/afk/dist/index.js setup --dry-run
```

From the repo root, you can also link this checkout as your local `afk`
command:

```bash
./scripts/install.sh --local
afk setup --dry-run
```

`scripts/install.sh --local` is for local development installs from this
checkout. A local launcher can shadow another `afk` on `PATH`; remove it with:

```bash
./scripts/install.sh --unlink
```

## Scopes

AFK can prepare a machine-wide field kit or only the current project.

| Scope | How to select it | Expected behavior |
|---|---|---|
| Global | default, or `--scope global` | Writes under user-level agent directories and passes global flags to delegated tools when supported. |
| Project | `--scope project` or `--local` | Writes AFK-owned files under the current directory and omits global flags for delegated tools. |

In project scope, rules are injected into project host files such as
`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, or `.cursor/rules/afk.mdc`. Skills and
MCPs are delegated without their global flags.

For `afk refresh`, `--local` has a different meaning: it refreshes
`./afk/catalog` instead of the global catalog cache.

## Common Commands

```bash
# Guided setup for every area
afk setup

# Preview first
afk setup --dry-run

# Non-interactive default setup after a source is saved
afk setup --yes

# Project-local setup
afk setup --local

# Run only one area
afk setup rules --dry-run
afk setup skills --dry-run
afk setup mcps --dry-run
afk setup plugins --dry-run
afk setup hooks --dry-run

# Refresh local catalog files from defaults
afk refresh

# Edit writable local catalog files
afk catalog

# Inspect the local catalog cache
afk show

# Route UI work through UI Skills
afk ui start
afk ui list --category motion
afk ui get baseline-ui

# Backfill skills catalog entries from installed skills
afk catalog skills import --dry-run
```

Compatibility aliases such as `afk setup skills install` and
`afk setup rules sync` still work, but the shorter forms above are the
preferred command shape.

## UI Skills Delegation

`afk ui` is a thin convenience wrapper around the MIT-licensed
[UI Skills](https://github.com/ibelick/ui-skills) CLI by Ibelick. AFK keeps the
command shorter and consistent with the rest of the CLI, while UI Skills remains
the source of truth for its registry and skill markdown.

| AFK command | Delegates to |
|---|---|
| `afk ui` | `npx --yes ui-skills` |
| `afk ui start` | `npx --yes ui-skills start` |
| `afk ui categories` | `npx --yes ui-skills categories` |
| `afk ui list --category motion` | `npx --yes ui-skills list --category motion` |
| `afk ui get baseline-ui` | `npx --yes ui-skills get baseline-ui` |

`afk ui get` prints the upstream skill markdown; it does not install the skill.
Use `--dry-run` to inspect the delegated command without running `npx`.

## Flag Reference

### Setup Flags

These flags apply to `afk setup` and most area commands.

| Flag | Meaning |
|---|---|
| `--dry-run` | Preview planned actions without applying them. Use this before real setup. |
| `--verbose` | Show delegated installer output instead of keeping it quiet. |
| `--yes`, `-y` | Accept defaults and skip prompts. Useful for scripts. |
| `--scope global/project` | Choose machine-wide setup or current-project setup. |
| `--local` | Alias for `--scope project`. |
| `--agent <agent>` | Override detected setup targets and limit setup to selected agents. Repeat the flag for multiple agents. |
| `--source <source>` | Use a catalog source for this run only, without changing the cache or default source. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK catalog and rules. |
| `--init-only` | Legacy cache-prep flag; prefer `afk refresh`. |

### Refresh Flags

These flags apply to `afk refresh`.

| Flag | Meaning |
|---|---|
| `--dry-run` | Preview cache writes without applying them. |
| `--local` | Refresh `./afk/catalog` instead of the global catalog cache. |
| `--source <source>` | Refresh the cache from this source once, without changing the remembered default source. |
| `--default-source <source>` | Save the default source and refresh the cache from it. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK catalog and rules. |
| `--empty` | Create empty catalog files. |

General setup agent values are:

```text
antigravity, claude, codex, cursor-local, opencode
```

Aliases:

```text
agy, gemini -> antigravity
cursor, cursor-ide, cursor-cli -> cursor-local
```

Area support is narrower than the full alias list:

| Area | Supported AFK targets |
|---|---|
| Rules | `antigravity`, `claude`, `codex`, `opencode`; project scope also supports `cursor-local`. |
| MCPs | `antigravity`, `claude`, `codex`, `opencode`; project scope skips Antigravity because `add-mcp` does not support that target locally. |
| Hooks | `codex`, `claude`, `cursor-local`. |
| Plugins | Plugin installers run independently and may define generic post-install commands. |

### Detected Setup Targets

When no `--agent` flag is provided, AFK detects compatible installed agent
surfaces and uses those targets by default. Setup summaries and dry-runs show
the resolved targets before AFK writes files or delegates installers.

Detection is intentionally conservative. AFK checks known config files and
agent directories such as `.codex/config.toml`, `.claude/settings.json`,
`.gemini/GEMINI.md`, `.config/opencode/opencode.json`, and `.cursor/hooks.json`.
If a selected target-dependent area has no detected compatible target,
interactive setup asks for manual targets once.

Plugins are not driven by detected agent targets. They remain global or
project scoped. Skills always use the shared `.agents/skills` install path;
detected skill providers only add extra direct `skills` CLI targets.

For custom local evidence paths, create:

```text
~/.agents/afk/setup-targets.json
```

Example:

```json
{
  "version": 1,
  "customAgentPaths": {
    "opencode": ["company/opencode/AGENTS.md"],
    "kiro-cli": ["company/kiro/skills"]
  }
}
```

Relative paths are resolved from your home directory. AFK does not write
detected paths into this file automatically.

### Skills Flags

`afk setup skills` delegates to the official `skills` CLI. It also accepts:

| Flag | Meaning |
|---|---|
| `--all` | Show imported skills alongside source-owned catalog skills. With `--yes`, install every listed skill. |
| `--agent <skill-agent>` | Override detected skill providers and add direct installs for supported skill hosts. Repeatable. |

By default, setup only considers source-owned catalog skills; locally imported
entries stay out of the list. Use `--all` when you want to review or include
those imported entries too. Interactive setup still asks you to select the
skills you want. Add `--yes` only when you want every listed skill installed.
After a successful global install, setup restores skills that were already
disabled and reconciles the library against any enabled focus profiles. In
`strict` mode, new skills outside the focused set move to `.disabled`; in
`context` mode, cataloged manual skills remain active. Additive-only profiles
continue to leave unrelated skills active.

Skill-agent values are:

```text
claude-code, kiro-cli, kilo, pi, droid
```

AFK keeps the `skills` CLI default symlink fanout. For skill entries with
`autoInvocation: false`, AFK adds policy metadata after install so supported
agents hide the skill from normal model discovery unless it is explicitly
attached or invoked. Use `autoInvocation: true` when plain-language requests
should discover the skill.

Skill catalog entries can also describe architecture metadata:

| Field | Meaning |
|---|---|
| `role` | The skill's compositional shape: `primitive`, `wrapper`, `workflow`, `utility`, `reference`, or `router`. |
| `composes` | Skills that a wrapper or workflow is built from. Setup can suggest these when the parent is selected. |
| `startDisabled` | Install the skill, then keep it in `.disabled` until a user or profile activates it. |

The short version: primitives are usually model-discoverable, wrappers and workflows
are usually manual, and composition makes the relationship explicit.

### Catalog Show

| Command | Shows |
|---|---|
| `afk show` | Cached global AFK catalog. |
| `afk show skills` | Cached skills catalog. |
| `afk show skills --react` | Cached skills as a React-style composition tree. |
| `afk show skills --visualize` | Write `afk-skills.html`, a self-contained skills composition page, and open it in interactive terminals. |
| `afk show skills mcps` | Multiple cached catalog files in one run. |
| `afk show --source <source>` | Inspect a source directly without changing the cache. |
| `afk show --local` | Inspect project-local `./afk/catalog`. |
| `afk manifests show` | Alias for `afk show`. |
| `afk manifest show` | Alias for `afk show`. |

`afk show` does not hit the network by default. It shows the local cache AFK
will use for normal setup. Add `--source` when you want to inspect a repo,
branch, raw URL, or local source path without writing that source into the
cache.

Use `afk show skills --react` when you want the skills catalog rendered as
AFK's React-inspired architecture: auto-discoverable skills under
`<ModelDiscovery>`, explicit skills under `<ExplicitInvocation>`, and composed
skills as nested primitive, wrapper, workflow, router, utility, or reference
components.

Use `afk show skills --visualize` when you want the same composition story as a
local HTML artifact. AFK writes `afk-skills.html` in the current directory; the
file is self-contained and does not start a server. In an interactive terminal,
AFK opens the file automatically after writing it. Set `AFK_NO_OPEN=1` to skip
that browser handoff.

### Catalog Import

Use `afk catalog skills import` when skills are already installed through the official
`skills` CLI and you want AFK's local catalog to catch up.

```bash
afk catalog skills import-status
afk catalog skills import --dry-run
afk catalog skills import
afk catalog skills import --local
```

`import-status` compares installed shared skills with `skills.json`, showing
how many skills are not imported yet and how many catalog entries are not
currently installed.

`import` scans installed skill folders, reads the `skills` CLI lockfile, and
adds only missing entries to `skills.json`. It does not remove or overwrite
existing catalog entries.

| Flag | Meaning |
|---|---|
| `--dry-run` | Preview the catalog write without applying it. |
| `--local` | Write `./afk/catalog/skills.json`; read `./.agents/skills` and `./.agents/.skill-lock.json` when present, then fall back to the home directory. |

Imported skills are conservative by default:

```json
{
  "id": "some-skill",
  "label": "Some Skill",
  "source": "owner/repo",
  "args": ["--skill", "some-skill"],
  "default": false,
  "autoInvocation": true,
  "role": "utility"
}
```

AFK only imports skills that have matching `skills` CLI lock metadata. Skills
without lock metadata are skipped because AFK cannot recover their original
portable source safely.

## Catalog Model

AFK reads setup recommendations from JSON catalog files. The global catalog lives here:

```text
~/.agents/afk/catalog/
```

The project-local catalog lives here:

```text
./afk/catalog/
```

The expected files are:

```text
skills.json
profiles.json
mcps.json
presets.json
rules.json
plugins.json
hooks.json
```

AFK has a small cache/source split:

- `afk refresh` updates local catalog cache files.
- `afk catalog skills import` backfills `skills.json` from installed skills with lock metadata.
- `afk show` inspects the cache by default.
- `afk setup` applies the cache by default.
- `--source` reads a source for one command without changing the cache or saved default.
- `--default-source` belongs to `afk refresh`; it saves the default source and refreshes the cache from it.

Refresh replaces source-owned catalog content while preserving local catalog
extensions. In `skills.json`, imported skills absent from the refreshed source
survive. In `profiles.json`, locally created profiles whose IDs are absent from
the refreshed source survive. The refreshed source wins on matching IDs and
owns top-level profile policy such as `mode` and `alwaysOn`.

Use these commands to prepare catalog files without running setup:

```bash
afk refresh
afk refresh skills
afk refresh --empty
afk refresh --local
```

If you want to inspect another source without changing the cache, use `show`
with `--source`:

```bash
afk show skills --source your-org/dev-kit
```

## Custom Defaults

You can make AFK a setup router for your own team or personal toolkit. Put
convention-compatible catalog files in another repo, then point AFK at it:

```bash
afk setup --source your-org/dev-kit
afk refresh --source your-org/dev-kit
afk refresh --default-source your-org/dev-kit
```

For a normal GitHub repo, AFK looks in both of these locations:

```text
afk/catalog/
packages/afk/catalog/
```

`--source` and `--default-source` accept:

| Source shape | Example |
|---|---|
| GitHub shorthand | `your-org/dev-kit` |
| GitHub repo URL | `https://github.com/your-org/dev-kit` |
| GitHub tree URL | `https://github.com/your-org/dev-kit/tree/main/path/to/catalog` |
| Raw GitHub directory URL | `https://raw.githubusercontent.com/your-org/dev-kit/main/afk/catalog` |
| Local path | `./afk/catalog` |

`--source` applies only to the current command. It can point at a local path or
remote source and never changes the cache or remembered default by itself.
`afk refresh --source <source>` refreshes the cache once from that source.
`afk refresh --default-source <source>` saves the source in `presets.json` and
refreshes the cache from it. Later `afk setup`, `afk setup --yes`, and
`afk refresh` can reuse the remembered source without repeating the flag.
`presets.json` is not used for local detected-agent state; custom local target
evidence belongs in `~/.agents/afk/setup-targets.json`.

## Install Catalog From the shadcn Registry

The AI Field Kit repository exposes its default AFK catalog as a
shadcn-compatible registry item. This is a project-local distribution path for
the catalog files; AFK still performs the actual setup work.

```bash
pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog
afk setup --local --dry-run
```

The registry item writes:

```text
./afk/catalog/skills.json
./afk/catalog/profiles.json
./afk/catalog/mcps.json
./afk/catalog/rules.json
./afk/catalog/plugins.json
./afk/catalog/hooks.json
./afk/catalog/presets.json
```

Use this when you want AFK defaults committed in a project before running
`afk setup --local`. Use `afk refresh --local` when you want AFK itself to
refresh those files from a defaults source.

## Author Catalog

To change what AFK installs durably, edit the configured source repository or
directory, then refresh the cache from it. Use `--source` for one command only,
or `afk refresh --default-source` when the source should become the saved
default.

```bash
afk show skills --source your-org/dev-kit
afk refresh --default-source your-org/dev-kit
```

Use `afk catalog` for small edits to writable local catalog files. It edits
the global AFK catalog cache by default, or `./afk/catalog` with `--local`.
For shared defaults, prefer editing the source repository directly and then
refreshing from that source.

## Catalog Examples

### Rules

Rules sync uses a single source file. For remote defaults, keep the source repo
explicit:

```json
{
  "version": 1,
  "source": "github",
  "url": "https://raw.githubusercontent.com/your-org/dev-kit/main/rules/AGENTS.md"
}
```

AFK injects that content into a managed region and preserves content outside
the managed region. In global scope it writes user-level agent rule files. In
project scope it writes project host files.

### Skills

```json
{
  "version": 1,
  "defaultSource": "https://github.com/your-org/dev-kit",
  "items": [
    {
      "id": "review-pr",
      "label": "Review PR",
      "source": "https://github.com/your-org/dev-kit",
      "args": ["--skill", "review-pr"],
      "default": true,
      "autoInvocation": false,
      "startDisabled": false,
      "role": "wrapper",
      "composes": ["source-driven-development"]
    }
  ]
}
```

`default: true` means non-interactive setup includes the skill. If the skill
depends on another setup helper, keep it `default: false` until the dependency
is also installed by default.

`startDisabled: true` installs the skill, then places it in `.disabled` so it
stays quiet until the user enables it directly or a skill profile keeps it
active.

`role`, `autoInvocation`, `startDisabled`, and `composes` make the catalog
readable as a skill system instead of a flat install list. For example, a
wrapper can stay manually invoked while composing smaller primitives that remain
available to automatic model discovery.

### MCPs

```json
{
  "version": 1,
  "items": [
    {
      "id": "stitch",
      "label": "Stitch MCP",
      "source": "https://stitch.googleapis.com/mcp",
      "args": ["--name", "stitchmcp"],
      "default": true
    }
  ]
}
```

AFK passes the source and args to `add-mcp`, then adds scope and agent flags
based on the setup command.

### Plugins

```json
{
  "version": 1,
  "items": [
    {
      "id": "example-tool",
      "label": "Example Tool",
      "description": "Install the example developer plugin.",
      "install": {
        "command": "sh",
        "args": ["-c", "curl -fsSL https://example.com/install.sh | sh"]
      },
      "default": false
    }
  ]
}
```

Plugins are delegated commands. If one plugin install fails, AFK reports the
failure and continues with the remaining selected plugins.

AFK also supports object-style post-install commands:

```json
{
  "postInstall": {
    "label": "Example Tool / init",
    "command": "sh",
    "args": ["-c", "example-tool init"]
  }
}
```

### Hooks

```json
{
  "version": 1,
  "items": [
    {
      "id": "company-stop-check",
      "label": "Company Stop Check",
      "description": "Run a local handoff guard.",
      "source": "https://raw.githubusercontent.com/your-org/dev-kit/main/hooks/company-stop-check.js",
      "command": "node",
      "args": ["${HOOK_FILE}", "--agent", "${AGENT}"],
      "events": ["stop"],
      "agents": ["codex", "claude"],
      "default": true
    }
  ]
}
```

AFK copies the hook source into the selected agent's hook folder, expands
`${HOOK_FILE}` and `${AGENT}`, then merges the command into the native hook
config. Existing hook config is preserved.

## Area Details

### Rules

Global rule sync supports:

| Agent | Global file |
|---|---|
| Antigravity/Agy | `~/.gemini/GEMINI.md` |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex | `~/.codex/AGENTS.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |
| Pi | `~/.pi/agent/AGENTS.md` |

Project rule sync supports:

| Agent | Project file |
|---|---|
| Antigravity/Agy | `GEMINI.md` |
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| OpenCode | `AGENTS.md` |
| Pi | `.pi/agent/AGENTS.md` |
| Cursor local | `.cursor/rules/afk.mdc` |

AFK updates only the `AFK:RULES` managed region. User-owned content outside
that region is preserved.

### Hooks

Hook setup supports Codex, Claude Code, and local Cursor hook configs:

| Agent | Config file |
|---|---|
| Codex | `.codex/hooks.json` |
| Claude Code | `.claude/settings.json` |
| Cursor local | `.cursor/hooks.json` |

Global setup writes under the user home directory. Project setup writes under
the current project. Cursor Cloud lifecycle hooks are intentionally out of
scope.

### Plugins

The bundled plugin catalog currently includes Plannotator, GoalBuddy,
Plannotator Tot, Yggtree, Impeccable, and Orchestrator. Plugin setup is
best-effort because these installers are owned by their upstream tools.

### Profiles

Profile setup prepares the local `profiles.json` catalog file from the
remembered or selected setup source. Profiles are definitions, not installs:
use `afk skills profiles enable <profile>` after the referenced skills exist
to apply one.

## Troubleshooting

### `afk` runs a local checkout

`./scripts/install.sh --local` writes a launcher to `~/.local/bin/afk` by
default. If `~/.local/bin` appears before another AFK install in `PATH`, it
will shadow that command.

Remove the local launcher:

```bash
./scripts/install.sh --unlink
hash -r
command -v afk
afk --version
```

### A new catalog item does not appear

AFK reads the local catalog cache by default. Inspect the cache first:

```bash
afk show
```

If you need to update the cache, refresh it:

```bash
afk refresh
```

Use project-local refresh when the catalog should live in the repo:

```bash
afk refresh --local
```

### I want to inspect what AFK will do

Use dry-run on the full setup or an individual area:

```bash
afk setup --dry-run
afk setup hooks --dry-run
afk show
```

### A delegated installer failed

Rerun with `--verbose` so the delegated command prints its own output:

```bash
afk setup plugins --verbose
```

AFK can show which delegated command it planned with:

```bash
afk setup plugins --dry-run
```

Manage local skills:

```bash
afk skills list
afk skills list --scope global --json
afk skills list --agent shared --disabled
afk skills list --scope global --agent codex
afk skills list --scope project --agent claude
afk skills list --category Docs --tag writing
afk skills add logbookfordevs/ai-field-kit --skill afk-compass --global --yes
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --global --yes --profile video
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --global --yes --profile-only video
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --global --yes --start-disabled
afk skills show afk-note
afk skills get afk-note
afk skills open afk-note --folder --app cursor
afk skills disable old-skill --dry-run
afk skills enable old-skill
afk skills invocation disable afk-doc-craft --dry-run
afk skills delete old-skill --dry-run
afk skills delete --catalog-only --dry-run
afk skills delete --profile
afk skills upgrade --all
afk skills upgrade --profile
afk skills upgrade video --profile
afk skills categorize --dry-run
afk catalog profiles create video --name Video --skill hyperframes --skill tailwind --mode context
afk skills profiles use video
afk skills profiles use video --all
afk skills profiles enable video --dry-run
afk skills profiles status
```

`afk skills` is separate from `afk setup skills install`. Setup remains the
catalog-driven install flow, while `afk skills add` is a direct convenience
wrapper around the official `skills add` command for one-off installs.

`afk skills upgrade --profile` selects a global profile interactively, or use
`afk skills upgrade <profile> --profile` to select it directly. AFK upgrades
the profile members that are tracked by the skills lock and reports untracked
members it skips. Upgrade preserves active and disabled storage state even
though the upstream update flow reinstalls changed skill content.

AFK uses one skills catalog file for both setup metadata and skill-management
enrichment:

```text
~/.agents/afk/catalog/skills.json
```

Setup-selected source catalog entries remain source-owned. After a successful
direct `afk skills add`, newly installed skills absent from the catalog are
inserted as imported, uncategorized entries.

Before `afk skills add` starts, AFK checks for installed skills that are not in
`skills.json` and routes them through `afk catalog skills import`. The add
continues only after the existing installed library is fully cataloged, so add
flags apply only to skills introduced by that installation. AFK determines
that set from the active and disabled skill folders before and after the
upstream add, so a source-cataloged skill is still treated as new when it is
installed for the first time.

Use `afk skills add --start-disabled` to mark newly installed skills with
`startDisabled: true` and move their shared folders into `.disabled`, including
first installs whose definitions were already in the source catalog. Use
`afk skills add --profile <profile>` to append only newly installed skills to a
new or existing profile in `profiles.json`. Use `--profile-only <profile>` to
append those new skills as `startDisabled: true` entries and move their shared
folders into `.disabled`.

Reinstalling an already installed skill refreshes its content without
reapplying add-time flags.
AFK restores its previous active or disabled storage and preserves existing
profile membership; use the profile commands to change that membership.
AFK categorization metadata lives in top-level `scopes` plus each item's nested
`catalog` object, so `id`, `source`, `args`, `default`, and other install fields
remain easy to read.

`afk skills list` reads the shared global library, current-project Codex and
Claude roots, and installed-agent roots such as Codex, Claude, Gemini,
OpenCode, Cursor, Zed, and Kiro when they exist. Use `--scope
global|project|all` to choose root families, `--agent shared` to focus on the
shared library, `--agent <agent>` to focus on one agent, `--enabled` to show
active folders, `--disabled` to show disabled folders, and `--category`,
`--tag`, or `--uncategorized` to filter AFK catalog metadata. The same
`--enabled` and `--disabled` folder filters are also available on `afk skills
show`, `open`, `delete`, and `invocation`, plus `afk catalog profiles
create|edit` when those commands need to choose from discovered skill folders.

`afk skills disable`, `afk skills enable`, and `afk skills delete` can manage
the shared global library by default, or explicitly with `--agent shared`.
They can manage agent-specific roots when `--agent <agent>` is provided.
`afk skills delete --disabled` is useful when pruning disabled skills. Use
`--catalog-only` to limit deletion candidates to installed skills represented
in AFK's `skills.json` catalog. Use `--profile` to choose a profile and delete
the installed skills referenced by it; AFK asks for an extra confirmation
because those skills may also be used by other profiles.
Delete is permanent; use `--dry-run` to preview the selected folders before
removing them.

`afk catalog profiles` edits focus profile definitions in `profiles.json`. A
profile is a named group of skill folders. `afk skills profiles
enable|disable|status` applies those definitions to the shared global skill
library.

`afk skills profiles use <profile>` prints a compact agent-context list with
each profile skill's local description and matching `afk skills get <skill>`
command. It reads both active and `.disabled` shared skills without changing
profile state or moving folders. Add `--all` to include every profile skill's
complete `SKILL.md` content. `afk skills get` wraps complete local skill
content with its absolute root so referenced files remain resolvable.

By default, enabling a profile focuses the library by filtering unrelated
skills according to the configured `strict` or `context` mode. Use
`--additive` when you only want its skills for the current activity:

```bash
afk skills profiles enable video --additive
```

Additive activation leaves unrelated active skills alone. AFK remembers how
the profile was enabled, so the ordinary disable command restores only the
skills that were disabled before the additive activation:

```bash
afk skills profiles disable video
```

Disable a profile before switching it between normal and additive activation.
This keeps restoration predictable instead of changing an active profile's
behavior in place.

#### Profile math: what stays on

Profiles are reconciled from the desired final state each time you enable or
disable one. The kept set includes every active profile, regardless of how it
was enabled:

```text
alwaysOn + skills from every currently enabled profile
```

The top-level `profiles.json` `mode` controls what happens to skills outside
that set while at least one normally enabled focus profile is active:

| Mode | Behavior |
|---|---|
| `strict` | Default. Profiles act like an availability sandbox: active skills outside the kept set move to `.disabled`. |
| `context` | Profiles act like a context filter: cataloged manual skills with `autoInvocation: false` stay active, while discoverable or uncataloged skills outside the kept set move to `.disabled`. |

Use `afk catalog profiles create|edit --mode strict|context` to set the mode,
or use `afk catalog profiles set-mode`.

If every enabled profile is additive, AFK does not filter skills outside the
kept set. If focus and additive profiles are enabled together, focus filtering
still applies, and the additive profile skills join the kept set.

For example, if `captions` is not in profile X, is in profile Y, and is not in
profile Z, enabling X, then Y, then Z keeps `captions` active because Y is still
enabled. If Y is disabled later and no remaining enabled profile includes
`captions`, AFK can move it back to `.disabled`.

While profiles are enabled, AFK temporarily moves other active global skills
into `.disabled`. If a profile needs a skill that was already disabled before
profiles touched it, AFK can temporarily enable it, then return it to disabled
once no enabled profile keeps it.

`afk catalog profiles toggle-always-on` can edit profile-level `alwaysOn`
skills. In the interactive always-on picker, existing `alwaysOn` skills
start checked. Use search to filter by text, or press `1` for auto-invocation
on, `2` for auto-invocation off, `3` for default on, and `4` for
start-disabled skills. Press the same number again to clear that shortcut
filter.

Global profile definitions live at:

```text
~/.agents/afk/catalog/profiles.json
```

Runtime restore state lives separately at:

```text
~/.agents/afk/state/skill-profiles.json
```

Use `--local` with `afk catalog profiles ...` to read and write profile
definitions in the current project under `./afk/catalog/profiles.json`. Use
`--local` with `afk skills profiles ...` when applying project-local profile
state under `./afk/state/skill-profiles.json`. V1 still applies the resulting
profile filter to the shared global skill library at `~/.agents/skills`.

`afk skills open` can open a skill file or folder in Finder, VS Code, Cursor,
Zed, or Antigravity.

`afk skills categorize` uses `codex exec` to update the categorization metadata
inside `skills.json`, while preserving the path for a later SDK-backed runner.
