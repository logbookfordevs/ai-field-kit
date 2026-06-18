# AFK CLI

AFK is the setup router for AI Field Kit. It gives developers one place to
preview and apply the parts of the kit they want: shared rules, skills, MCPs,
plugins, hooks, and custom setup manifests.

The CLI is intentionally a router, not a replacement for every ecosystem tool.
AFK owns the AFK-specific rule and hook behavior. It delegates skills to the
official `skills` CLI, MCPs to `add-mcp`, and plugins to their own installer
commands.

AFK skills are modeled as composable parts: primitives, wrappers, flows,
utilities, references, and routers. That shape keeps automatic model discovery
small while still giving people named workflows to invoke directly. See
[Skill Composition](docs/skill-composition.md) for the full mental model, or
open the visual companion in [Skill Composition Studio](https://tot.page/mhPWYwLnjw_yGzIs8FQOXg).

## Quick Start

Install the published CLI from npm:

```bash
npm install -g @logbookfordevs/afk
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

## Install From Source

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

`scripts/install.sh` is for local development installs from this checkout. The
user-facing install path is the npm package. A local link can shadow an
npm-installed `afk`; restore the npm binary on `PATH` with:

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
MCPs are delegated without their global flags. RTK project initialization runs
from the current project directory.

For `afk refresh`, `--local` has a different meaning: it refreshes
`./afk/manifests` instead of the global manifest cache.

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

# Refresh local manifest files from defaults
afk refresh

# Inspect the local manifest cache
afk show
```

Compatibility aliases such as `afk setup skills install` and
`afk setup rules sync` still work, but the shorter forms above are the
preferred command shape.

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
| `--source <source>` | Use a manifest source for this run only, without changing the cache or default source. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK manifests and rules. |
| `--init-only` | Legacy cache-prep flag; prefer `afk refresh`. |

### Refresh Flags

These flags apply to `afk refresh`.

| Flag | Meaning |
|---|---|
| `--dry-run` | Preview cache writes without applying them. |
| `--local` | Refresh `./afk/manifests` instead of the global manifest cache. |
| `--source <source>` | Refresh the cache from this source once, without changing the remembered default source. |
| `--default-source <source>` | Save the default source and refresh the cache from it. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK manifests and rules. |
| `--empty` | Create empty manifest files. |

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
| Plugins | Plugin installers run independently; RTK post-install supports `antigravity`, `claude`, `codex`, and `opencode`. |

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
| `--all` | Include every skill in the manifest, not only default skills. |
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

Skill manifests can also describe architecture metadata:

| Field | Meaning |
|---|---|
| `role` | The skill's compositional shape: `primitive`, `wrapper`, `flow`, `utility`, `reference`, or `router`. |
| `composes` | Skills that a wrapper or flow is built from. Setup can suggest these when the parent is selected. |
| `profiles` | Future activation groups. Present now as metadata, often empty until profile support lands. |

The short version: primitives are usually model-discoverable, wrappers and flows
are usually manual, and composition makes the relationship explicit.

### Manifest Show

| Command | Shows |
|---|---|
| `afk show` | Cached global AFK manifests. |
| `afk show skills` | Cached skills manifest. |
| `afk show skills --react` | Cached skills as a React-style composition tree. |
| `afk show skills mcps` | Multiple cached manifests in one run. |
| `afk show --source <source>` | Inspect a source directly without changing the cache. |
| `afk show --local` | Inspect project-local `./afk/manifests`. |
| `afk manifests show` | Alias for `afk show`. |
| `afk manifest show` | Alias for `afk show`. |

`afk show` does not hit the network by default. It shows the local cache AFK
will use for normal setup. Add `--source` when you want to inspect a repo,
branch, raw URL, or local source path without writing that source into the
cache.

Use `afk show skills --react` when you want the skills manifest rendered as
AFK's React-inspired architecture: auto-discoverable skills under
`<ModelDiscovery>`, explicit skills under `<ExplicitInvocation>`, and composed
skills as nested primitive, wrapper, flow, router, utility, or reference
components.

## Manifest Model

AFK reads setup recommendations from JSON manifests. Global manifests live here:

```text
~/.agents/afk/manifests/
```

Project-local manifests live here:

```text
./afk/manifests/
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

- `afk refresh` updates local manifest cache files.
- `afk show` inspects the cache by default.
- `afk setup` applies the cache by default.
- `--source` reads a source for one command without changing the cache or saved default.
- `--default-source` belongs to `afk refresh`; it saves the default source and refreshes the cache from it.

Use these commands to prepare manifest files without running setup:

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
convention-compatible manifests in another repo, then point AFK at it:

```bash
afk setup --source your-org/dev-kit
afk refresh --source your-org/dev-kit
afk refresh --default-source your-org/dev-kit
```

For a normal GitHub repo, AFK looks in both of these locations:

```text
afk/manifests/
packages/afk/manifests/
```

`--source` and `--default-source` accept:

| Source shape | Example |
|---|---|
| GitHub shorthand | `your-org/dev-kit` |
| GitHub repo URL | `https://github.com/your-org/dev-kit` |
| GitHub tree URL | `https://github.com/your-org/dev-kit/tree/main/path/to/manifests` |
| Raw GitHub directory URL | `https://raw.githubusercontent.com/your-org/dev-kit/main/afk/manifests` |
| Local path | `./afk/manifests` |

`--source` applies only to the current command. It can point at a local path or
remote source and never changes the cache or remembered default by itself.
`afk refresh --source <source>` refreshes the cache once from that source.
`afk refresh --default-source <source>` saves the source in `presets.json` and
refreshes the cache from it. Later `afk setup`, `afk setup --yes`, and
`afk refresh` can reuse the remembered source without repeating the flag.
`presets.json` is not used for local detected-agent state; custom local target
evidence belongs in `~/.agents/afk/setup-targets.json`.

## Install Manifests From the shadcn Registry

The AI Field Kit repository exposes its default AFK manifests as a
shadcn-compatible registry item. This is a project-local distribution path for
the manifest files; AFK still performs the actual setup work.

```bash
pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-manifests
afk setup --local --dry-run
```

The registry item writes:

```text
./afk/manifests/skills.json
./afk/manifests/mcps.json
./afk/manifests/rules.json
./afk/manifests/plugins.json
./afk/manifests/hooks.json
./afk/manifests/presets.json
```

Use this when you want AFK defaults committed in a project before running
`afk setup --local`. Use `afk refresh --local` when you want AFK itself to
refresh those files from a defaults source.

## Author Manifests

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

## Manifest Examples

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

`role`, `autoInvocation`, and `composes` make the manifest readable as a skill
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

RTK has built-in post-install handling through `"postInstall": "rtk-init"`.

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

The bundled plugin manifest currently includes Plannotator, GoalBuddy,
Plannotator Tot, RTK, Yggtree, and Impeccable. Plugin setup is best-effort
because these installers are owned by their upstream tools.

RTK post-install follows the selected AFK targets. With no explicit plugin
agent selection, AFK uses the RTK defaults: `antigravity`, `claude`, `codex`,
and `opencode`.

## Troubleshooting

### The npm CLI is installed, but `afk` runs a local checkout

`./scripts/install.sh --local` writes a symlink to `~/.local/bin/afk` by
default. If `~/.local/bin` appears before your npm global bin in `PATH`, it
will shadow the npm package.

Restore the npm-installed binary:

```bash
./scripts/install.sh --unlink
hash -r
command -v afk
afk --version
```

### A new manifest item does not appear

AFK reads the local manifest cache by default. Inspect the cache first:

```bash
afk show
```

If you need to update the cache, refresh it:

```bash
afk refresh
```

Use project-local refresh when the manifests should live in the repo:

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
