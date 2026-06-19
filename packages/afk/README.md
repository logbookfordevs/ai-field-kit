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

# Inspect the local catalog cache
afk show

# Route UI work through UI Skills
afk ui start
afk ui list --category motion
afk ui get baseline-ui

# Backfill skills catalog entries from installed skills
afk catalog import --dry-run
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
| `--all` | Include every skill in the catalog, not only default skills. |
| `--agent <skill-agent>` | Override detected skill providers and add direct installs for supported skill hosts. Repeatable. |

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
| `profiles` | Future activation groups. Present now as metadata, often empty until profile support lands. |

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

Use `afk catalog import` when skills are already installed through the official
`skills` CLI and you want AFK's local catalog to catch up.

```bash
afk catalog import --dry-run
afk catalog import
afk catalog import --local
```

The command scans installed skill folders, reads the `skills` CLI lockfile, and
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
  "role": "utility",
  "profiles": []
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
mcps.json
presets.json
rules.json
plugins.json
hooks.json
```

AFK has a small cache/source split:

- `afk refresh` updates local catalog cache files.
- `afk catalog import` backfills `skills.json` from installed skills with lock metadata.
- `afk show` inspects the cache by default.
- `afk setup` applies the cache by default.
- `--source` reads a source for one command without changing the cache or saved default.
- `--default-source` belongs to `afk refresh`; it saves the default source and refreshes the cache from it.

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

`afk configure` is intentionally retired until AFK can edit a writable setup
source directly, for example by creating a branch or patch in the source repo.

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
      "role": "wrapper",
      "composes": ["source-driven-development"],
      "profiles": []
    }
  ]
}
```

`default: true` means non-interactive setup includes the skill. If the skill
depends on another setup helper, keep it `default: false` until the dependency
is also installed by default.

`role`, `autoInvocation`, and `composes` make the catalog readable as a skill
system instead of a flat install list. For example, a wrapper can stay manually
invoked while composing smaller primitives that remain available to automatic
model discovery.

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

Project rule sync supports:

| Agent | Project file |
|---|---|
| Antigravity/Agy | `GEMINI.md` |
| Claude Code | `CLAUDE.md` |
| Codex | `AGENTS.md` |
| OpenCode | `AGENTS.md` |
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
Plannotator Tot, Yggtree, and Impeccable. Plugin setup is best-effort
because these installers are owned by their upstream tools.

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
afk skills list --scope global --agent codex
afk skills list --scope project --agent claude
afk skills list --category Docs --tag writing
afk skills show afk-note
afk skills open afk-note --folder --app cursor
afk skills disable old-skill --dry-run
afk skills enable old-skill
afk skills delete old-skill --dry-run
afk skills upgrade --all
afk skills categorize --dry-run
afk skills profiles create video --name Video --skill hyperframes --skill tailwind
afk skills profiles enable video --dry-run
afk skills profiles status
```

`afk skills` is separate from `afk setup skills install`. Setup still delegates
installation to the official `skills` CLI; the skills command family manages
local skill libraries that already exist on disk.

AFK uses one skills catalog file for both setup metadata and skill-management
enrichment:

```text
~/.agents/afk/catalog/skills.json
```

Skills installed through `afk setup skills` are automatically inserted into this
catalog as uncategorized entries after a successful upstream `skills add` run.
AFK categorization metadata lives in top-level `scopes` plus each item's nested
`catalog` object, so `id`, `source`, `args`, `default`, and other install fields
remain easy to read.

`afk skills list` reads the shared global library, current-project Codex and
Claude roots, and installed-agent roots such as Codex, Claude, Gemini,
OpenCode, Cursor, Zed, and Kiro when they exist. Use `--scope
global|project|all` to choose root families, `--agent` to focus on an agent,
and `--category`, `--tag`, or `--uncategorized` to filter AFK catalog
metadata.

`afk skills disable`, `afk skills enable`, and `afk skills delete` can manage
the shared global library by default, or agent-specific roots when `--agent` is
provided. Delete is permanent; use `--dry-run` to preview the selected folders
before removing them.

`afk skills profiles` manages focus profiles for the shared global skill
library. A profile is a named group of skill folders. Enabling one or more
profiles keeps the union of their skills plus top-level `alwaysOn` skills
enabled, temporarily moves other active global skills into `.disabled`, and can
temporarily enable a previously disabled skill when an enabled profile keeps it.
Disabling profiles restores AFK-moved skills and returns previously disabled
skills to disabled once no enabled profile keeps them.

Global profile definitions live at:

```text
~/.agents/afk/catalog/profiles.json
```

Runtime restore state lives separately at:

```text
~/.agents/afk/state/skill-profiles.json
```

Use `--local` with `afk skills profiles ...` to read and write profile
definitions/state in the current project under `./afk/catalog/profiles.json`
and `./afk/state/skill-profiles.json`. V1 still applies the resulting profile
filter to the shared global skill library at `~/.agents/skills`.

`afk skills open` can open a skill file or folder in Finder, VS Code, Cursor,
Zed, or Antigravity.

`afk skills categorize` uses `codex exec` to update the categorization metadata
inside `skills.json`, while preserving the path for a later SDK-backed runner.
