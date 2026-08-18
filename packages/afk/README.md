# AFK CLI

AFK is the setup router for AI Field Kit. It gives developers one place to
preview and apply the parts of the kit they want: shared rules, skills, Custom
Agents, MCPs, tools, hooks, and custom setup catalogs.

The CLI is intentionally a router, not a replacement for every ecosystem tool.
AFK owns the AFK-specific rule and hook behavior. It delegates skills to the
official `skills` CLI, MCPs to `add-mcp`, and tools to their own installer
commands.

AFK skills are modeled as composable parts: primitives, wrappers, workflows,
utilities, references, and routers. That shape keeps automatic model discovery
small while still giving people named workflows to invoke directly. Explore the
published [Skill Composition Studio](https://tot.page/mhPWYwLnjw_yGzIs8FQOXg)
for the full mental model, then open the
[AFK skills and profiles switchyard](https://tot.page/13T7lSXk6SIhvGNt0aa_tw)
to see how skill commands, profiles, catalog policy, storage, recovery paths,
and workflow moments interact. See
[Portable Custom Agents](docs/custom-agents.md) for the agent source contract,
adapter behavior, and native target paths.

## How to Use This Reference

This README documents the public CLI in the current checkout. Start with the
[complete command reference](#complete-command-reference) when you know the
operation you need, then use the deeper sections for behavior and storage
details:

- [Flag Reference](#flag-reference) explains shared setup, refresh, and skill
  flags.
- [Catalog Model](#catalog-model) explains source, cache, and project-local
  catalog ownership.
- [Compose a Catalog from Multiple Sources](#compose-a-catalog-from-multiple-sources)
  shows how to assemble one setup from independent catalog repositories.
- [Skills and Profiles](#skills-and-profiles) explains installation, storage,
  invocation policy, profile reconciliation, and recovery behavior.
- [Troubleshooting](#troubleshooting) covers common installation and cache
  problems.

`afk <command> --help` is the compact terminal companion to this document. If
the behavior of an installed release differs from this checkout, use that
release's `--help` output and version (`afk --version`) together: this README
tracks the repository version, not every older installed binary.

## Quick Start

Install the latest AFK CLI release:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash
afk setup --dry-run
```

Start with `--dry-run`. AFK prints the exact rules, skills, MCP, tool, and
hook actions it would run before anything writes to your machine.

When the preview looks right, run the same command without `--dry-run`:

```bash
afk setup
```

Interactive setup starts with nothing selected. Use space to choose the areas
and items you want. On first run, AFK asks which source should seed the local
cache, saves that source as the default, refreshes the cache, then continues.
Scripted setup can use `--yes` to accept defaults after the cache exists, or
`--source` to merge and apply entries from another source without changing the
remembered default source.

## What AFK Sets Up

| Area | Command | What happens |
|---|---|---|
| Rules | `afk setup rules` | Syncs AFK rules into managed regions of supported agent rule files. |
| Skills | `afk setup skills` | Delegates selected skill installs to `npx skills add`. |
| Skills Profiles | `afk setup profiles` | Offers profiles from `profiles.json`, offers lock-backed recovery for missing references, and installs the available skills after confirmation. |
| Custom Agents | `afk setup agents` | Translates portable agent files into native Codex, Claude Code, or Pi definitions. |
| MCPs | `afk setup mcps` | Delegates selected MCP recommendations to `npx add-mcp`. |
| Tools | `afk setup tools` | Runs curated tool installer commands and supported post-install setup. |
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
afk setup agents --dry-run
afk setup mcps --dry-run
afk setup tools --dry-run
afk setup hooks --dry-run

# Refresh local catalog files from defaults
afk refresh

# Edit one writable catalog family
afk skills catalog

# Inspect the local catalog cache
afk show

# Route UI work through UI Skills
afk ui start
afk ui list --category motion
afk ui get baseline-ui

# Backfill skills catalog entries from installed skills
afk skills catalog import --dry-run
```

Compatibility aliases such as `afk setup skills install` and
`afk setup rules sync` still work, but the shorter forms above are the
preferred command shape.

## Complete Command Reference

AFK has four kinds of commands:

- **Read-only inspection** commands print catalog or skill state without
  changing it.
- **AFK-owned mutation** commands edit catalog JSON, skill folders, invocation
  metadata, or profile runtime state.
- **Setup/delegation** commands invoke the upstream tool that owns an ecosystem
  surface.
- **Interactive routers** open a picker when a required command, profile, or
  skill is omitted and the terminal supports prompts.

Use `--dry-run` wherever it is listed before a write, move, deletion, install,
or delegated command. Read-only commands do not need it.

### Top-Level Commands

| Command | Purpose | State or delegation |
|---|---|---|
| `afk` | Open the interactive AFK lobby. | Routes to another command; the selected command owns any effects. |
| `afk open` | Open the user AFK folder at `~/.agents/afk`; pass `--code` to use VS Code. | Read-only GUI handoff. |
| `afk --version`, `afk -v` | Print the installed AFK version. | Read-only. |
| `afk <command> --help`, `-h` | Print command-specific usage, options, and examples. | Read-only. |
| `afk setup` | Preview or apply rules, skills, profiles, Custom Agents, MCPs, tools, and hooks. | AFK writes owned files and delegates ecosystem installs. |
| `afk refresh [category...]` | Refresh cached catalog files from the remembered or selected source. | Writes the global or project-local catalog cache. |
| `afk show [category...]` | Inspect cached catalog data or a one-off source. | Read-only, except `--visualize` writes an HTML file. |
| `afk <family> catalog` | Interactively edit one writable catalog family. | Writes that family's catalog JSON. |
| `afk skills <command>` | Inspect or manage local skill libraries and profile runtime state. | Read-only or mutating, depending on the subcommand. |
| `afk ui <command>` | Route UI skill discovery to the upstream UI Skills CLI. | Delegates to `npx --yes ui-skills`. |
| `afk update` | Update AFK through the hosted release installer. | Replaces the installed AFK release. |

### Setup Commands

All setup areas accept the shared setup flags described in
[Setup Flags](#setup-flags). Without a specific area, `afk setup` offers all
areas in one guided flow. A failure in one delegated area does not prevent AFK
from attempting the remaining selected areas; the overall command exits
non-zero when any selected area fails.

Use `afk preset` or `afk setup preset` to choose a bundle from the cached
catalog. Pass `--source <source>` to choose from another catalog for one run,
or include the preset ID to skip the preset menu. Presets with explicit
selections install exactly those members in their declared area order. For
example, `afk preset afk-architect` installs the Architect skill before
provisioning its three required portable Custom Agents. The existing
`afk setup --preset <id>` form remains available for compatibility.

Use `afk preset daily-routine` to install every rule, skill, tool, and Custom
Agent from the current cache or `--source`. Use `afk setup --all --yes` when the
goal is broader: install every item in every catalog area for the detected
harnesses.

| Command | What it does | Owner of the effect |
|---|---|---|
| `afk preset [id]` | Choose or directly apply one named catalog preset. | AFK routes the preset's declared setup areas. |
| `afk setup preset [id]` | Long-form route for `afk preset [id]`. | AFK routes the preset's declared setup areas. |
| `afk setup rules` | Compose configured rules layers into AFK-managed regions and install their isolated dependency files without replacing user-owned content outside those regions. | AFK. |
| `afk setup skills` | Select catalog skills, delegate installation, restore previously disabled storage, apply invocation policy, and reconcile enabled profiles. | Official `skills` CLI for installation; AFK for policy and reconciliation. |
| `afk setup profiles` | Prepare `profiles.json`, select profiles from that source, and install available profile skills plus composed dependencies. Missing references require confirmation before a partial install; `--yes` accepts. It does not enable a profile. | AFK for selection and policy; official `skills` CLI for installation. |
| `afk setup agents` | Select portable Custom Agents and translate them into native Codex, Claude Code, or Pi definitions. | AFK adapters; the harness owns orchestration. |
| `afk setup mcps` | Select catalog MCPs and delegate their installation for supported agents/scopes. | `add-mcp`. |
| `afk setup tools` | Run selected catalog installer commands and supported post-install commands. | Each tool installer. |
| `afk setup hooks` | Copy selected hook scripts and merge commands into supported native hook configs. | AFK. |

Setup aliases retained for compatibility:

| Alias | Preferred command |
|---|---|
| `afk setup rules sync` | `afk setup rules` |
| `afk setup skills install` | `afk setup skills` |
| `afk setup mcps install` | `afk setup mcps` |
| `afk setup hooks install` | `afk setup hooks` |
| `afk setup refresh` | `afk refresh` |
| `--defaults-source <source>` | `--default-source <source>` with `afk refresh` |

### Refresh and Show Commands

Catalog categories are `rules`, `skills`, `profiles`, `agents`, `mcps`, `tools`,
`hooks`, and `presets`. Pass one or more categories to limit output or refresh
writes:

```bash
afk refresh skills profiles
afk show skills profiles
```

| Command | Behavior |
|---|---|
| `afk refresh` | Refresh every managed catalog file in the global cache. |
| `afk refresh <category...>` | Refresh only the named catalog categories. |
| `afk refresh --local` | Refresh `./afk/catalog` instead of the global cache. |
| `afk refresh --source <source>` | Refresh once from a source without remembering it as the default. |
| `afk refresh --default-source <source>` | Save the source in `presets.json` and refresh from it. |
| `afk refresh --override` | Replace targeted catalog files from the source after two confirmations instead of preserving local-only entries. |
| `afk refresh --empty` | Prepare empty catalog files instead of seeding source defaults. |
| `afk show` | Print every cached catalog category. |
| `afk show <category...>` | Print only the named categories. |
| `afk show rules` | Inspect the ordered rules layers AFK would compose into managed regions. |
| `afk show skills` | Inspect skill install metadata, invocation policy, roles, and composition. |
| `afk show profiles` | Inspect profile definitions and catalog-wide reconciliation policy. |
| `afk show agents` | Inspect portable Custom Agent catalog entries before provisioning. |
| `afk show mcps` | Inspect MCP recommendations before delegated installation. |
| `afk show tools` | Inspect tool installers and post-install commands. |
| `afk show hooks` | Inspect lifecycle hook definitions and supported targets. |
| `afk show presets` | Inspect remembered source metadata and preset bundle membership. |
| `afk show --source <source>` | Read a source for this invocation without changing the cache. |
| `afk show <category> --source <source> --ref <git-ref>` | Inspect a specific Git ref from a GitHub-backed source. |
| `afk show --local` | Read project-local `./afk/catalog`. |
| `afk show skills --react` | Render the skill catalog as a terminal composition tree. |
| `afk show skills --visualize` | Write and open a self-contained `afk-skills.html` composition map. |

`afk manifests show` and `afk manifest show` are compatibility aliases for
`afk show`.

### Catalog Editing Commands

Each `afk <family> catalog` command edits its area in the global cache under
`~/.agents/afk/catalog` by default. Add `--local` to edit `./afk/catalog`.
Running a family catalog without an action opens its interactive editor. Use
`--dry-run` to preview supported writes.

| Family | Commands | What changes |
|---|---|---|
| Rules | `afk rules catalog add`, `edit`, `remove` | Ordered rules layers and their source paths in `rules.json`. |
| Skills | `afk skills catalog add`, `edit`, `remove` | Skill definitions and installation metadata in `skills.json`. |
| Skills policy | `afk skills catalog bulk-edit` | Select multiple skills, then set invocation and always-on policy together. |
| Skills policy | `afk skills catalog toggle-default` | Which catalog skills non-interactive default setup selects. |
| Skills policy | `afk skills catalog toggle-auto` | Catalog-owned `autoInvocation` policy. |
| Skills status | `afk skills catalog status` | Read-only comparison of installed shared skills and catalog entries. |
| Skills import | `afk skills catalog import` | Missing catalog entries recovered from official `skills` CLI lock metadata. Existing entries are preserved. |
| Profiles | `afk profiles catalog list`, `show` | Read-only profile definition inspection. Add `--json` for machine-readable output. |
| Profiles | `afk profiles catalog create`, `edit`, `delete` | Profile definitions in `profiles.json`. |
| Profile policy | `afk profiles catalog set-mode` | Top-level `strict` or `context` reconciliation mode. |
| Profile policy | `afk profiles catalog toggle-always-on` | Top-level skills kept by every active profile. |
| Custom Agents | `afk agents catalog add`, `edit`, `remove` | Portable agent source references in `agents.json`. |
| MCPs | `afk mcps catalog add`, `edit`, `remove`, `toggle-default` | MCP recommendations in `mcps.json`. |
| Tools | `afk tools catalog add`, `edit`, `remove`, `toggle-default` | Installer definitions in `tools.json`. |
| Hooks | `afk hooks catalog add`, `edit`, `remove`, `toggle-default` | Lifecycle hook definitions in `hooks.json`. |

After a confirmed global `afk skills catalog edit` or `bulk-edit`, AFK offers
to run skill setup for only the entries whose install source, invocation,
startup storage, or always-on policy changed. Declining keeps the catalog
changes without running setup. Dry runs, no-op edits, and `--local` catalog
edits do not offer this setup shortcut.

The profile definition commands support these non-interactive flags:

| Flag | Applies to | Meaning |
|---|---|---|
| `--local` | All profile definition commands | Use `./afk/catalog/profiles.json`. |
| `--json` | `list`, `show` | Print JSON instead of formatted text. |
| `--name <name>` | `create`, `edit` | Set the display name. |
| `--skill <skill>` | `create`, `edit` | Repeat to define the member set. On `edit`, an explicit set replaces existing members; omitting it preserves them. |
| `--enabled` / `--disabled` | Interactive `create`, `edit` | Limit the skill picker to one storage state. |
| `--always-on <skill>` | `create`, `edit` | Repeat to append skills to the catalog-wide `alwaysOn` set. |
| `--mode <mode>` | `create`, `edit` | Set the catalog-wide reconciliation mode to `strict` or `context` while saving the profile. |
| `--profile-only` | `create`, `edit` | Mark selected skills `startDisabled` and move active shared folders into `.disabled`. |
| `--dry-run` | Mutating actions | Preview catalog and folder changes. |

Profile definitions and profile runtime are deliberately separate. Use
`afk profiles catalog ...` to edit desired configuration; use
`afk skills profiles ...` to apply or inspect runtime state.

### Skills Commands

AFK's shared skill library defaults to `~/.agents/skills`. Preset agent roots
can be selected with `--agent`; exact custom roots require both
`--agent custom` and `--agent-path <folder>`. For root-aware commands,
`--scope global|project|all` chooses which preset root family to inspect.

| Command | Purpose | Important options and effects |
|---|---|---|
| `afk skills list` | List enabled skills by default. | Use `--disabled` for disabled skills; additional filters include `--auto-invocation` with `enabled`, `disabled`, `mixed`, or `default`, `--category`, `--tag`, and `--uncategorized`; `--json` prints records. |
| `afk skills show <folder>` | Show one enabled skill's metadata and paths by default. | Use `--disabled` to inspect a disabled skill; supports root selection and `--json`. |
| `afk skills get <folder>` | Print one skill as agent context, including disabled skills. | Read-only; includes the absolute skill root so referenced files remain resolvable. |
| `afk skills open <folder>` | Open `SKILL.md` or its folder. | `--file` is the default; use `--folder` or select `finder`, `code`, `cursor`, `zed`, or `agy` with `--app`. |
| `afk skills add <source> [flags...]` | Delegate installation to `skills add`, then synchronize AFK catalog and profile state. | Supports upstream `--skill`, `--agent`, `--global`, `--yes`; AFK adds `--profile`, `--profile-only`, and `--start-disabled`. |
| `afk skills disable [folder]` | Move active skill folders into `.disabled`. | Omit the folder for an interactive multi-select; supports `--dry-run`. |
| `afk skills enable [folder]` | Move disabled skill folders back to active storage. | Omit the folder for an interactive picker; supports `--dry-run`. |
| `afk skills invocation [disable|enable] [folder]` | Review or change skill invocation policy. | The bare command opens a searchable batch editor; explicit actions change one skill. Both update matching shared `skills.json` policy and installed host metadata; supports `--dry-run`. |
| `afk skills delete [folder]` | Permanently remove selected skill folders. | `--catalog-only`, `--profile`, storage filters, `--yes`, and `--dry-run`; profile deletion mode deletes referenced folders, not the profile definition. |
| `afk skills update [skills...]` | Select AFK-cataloged skills with lock metadata and delegate updates to `skills update`. | `--all`, `--scope` with `global`, `project`, or `all`, `--profile`, and `--yes`; preserves active/disabled storage. |
| `afk skills reset` | Reconcile the installed shared library with cached `skills.json`. | Applies `startDisabled` and invocation policy, disables uncataloged skills, clears runtime profile state, and reports missing catalog skills; supports `--dry-run` and `--yes`. |
| `afk skills categorize` | Ask `codex exec` to create or update catalog categorization metadata. | `--mode` with `append-missing` or `recategorize-all`, `--instruction`, `--runner codex-exec`, `--dry-run`. |
| `afk skills profiles <command>` | Read or apply profile runtime state. | Detailed below. |

`afk skills add` always includes the shared global target. `--profile <id>` and
`--profile-only <id>` are repeatable and apply only to skills introduced by the
current installation. `--profile-only` also records `startDisabled: true` and
moves those new shared folders into `.disabled`. Reinstalling an existing skill
refreshes its content while preserving its prior storage and profile membership.

Bare `afk skills invocation` opens a searchable policy editor. Use up/down to
navigate, left to draft manual invocation, right to draft automatic invocation,
Enter to apply every drafted change, or Escape to discard the draft. Existing
`mixed` and `default` states remain untouched until changed. Explicit
`enable|disable [folder]` actions continue to update one skill directly. Shared
skills already represented in `skills.json` update catalog policy and installed
metadata together. Untracked and agent-specific skills update only their
installed metadata.

`afk skills delete --profile` accepts zero or one profile ID. Without an ID it
prompts for a profile. AFK then presents the profile's installed skills with all
selected by default, so you can narrow the deletion before confirming it. With
`--yes`, AFK keeps the non-interactive default and deletes every installed skill
in the profile. AFK warns again because a referenced skill may belong to other
profiles. Deleting by profile does not delete the profile definition from
`profiles.json`; use `afk profiles catalog delete` for that.

### Profile Runtime Commands

| Command | Behavior | Writes or movement |
|---|---|---|
| `afk skills profiles use <profile>` | Print the profile's locally available skills as compact agent context. | Read-only. Add `--all` for full `SKILL.md` content. |
| `afk skills profiles enable <profile>` | Activate a profile additively and reconcile desired skill storage. | Writes runtime state and may move folders. Add `--focus` to filter unrelated active skills. |
| `afk skills profiles disable <profile>` | Remove one activation and recompute the desired state from the remaining activations. | Writes runtime state and restores or disables eligible folders. |
| `afk skills profiles status` | Show active profiles, activation modes, kept skills, and runtime paths. | Read-only. |

Add `--local` to use project-local profile definitions and runtime state under
`./afk/catalog` and `./afk/state`. In v1, reconciliation still moves folders in
the shared global skill library. Add `--dry-run` to `enable` or `disable` to
preview all state and folder changes.

### UI and Update Commands

| Command | Delegation or effect |
|---|---|
| `afk ui` | Run the upstream UI Skills CLI without a subcommand. |
| `afk ui start` | Print the upstream UI routing skill. |
| `afk ui categories` | List UI Skills categories. |
| `afk ui list [--category <category>]` | List upstream UI skills, optionally filtered. |
| `afk ui get <skill>` | Print upstream skill Markdown; it does not install the skill. |
| `afk ui ... --dry-run` | Print the exact delegated `npx --yes ui-skills ...` command. |
| `afk update --dry-run` | Print the hosted installer command without running it. |
| `afk update` | Run the hosted AFK installer against the latest published release. |

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
| `--refresh` | Refresh the relevant catalog before setup. Top-level setup refreshes the full catalog; area commands refresh only their matching category and respect `--local`/project scope. |
| `--dry-run` | Preview planned actions without applying them. Use this before real setup. |
| `--verbose` | Show delegated installer output instead of keeping it quiet. |
| `--yes`, `-y` | Accept defaults and skip prompts. Useful for scripts. |
| `--preset <id>` | Compatibility form for applying one cataloged bundle with top-level `afk setup`. |
| `--scope global/project` | Choose machine-wide setup or current-project setup. |
| `--local` | Alias for `--scope project`. |
| `--agent <agent>`, `-a <agent>` | Override detected setup targets and limit setup to selected agents. Repeat the flag for multiple agents. |
| `--custom-agent <id>` | Select one cataloged Custom Agent. Repeat the flag for multiple agents. |
| `--all` | Include every cataloged skill and Custom Agent; with top-level `afk setup --yes`, every setup area also selects all cataloged MCPs, tools, and hooks. |
| `--source <source>` | Merge the source entries setup applies into the cache without changing the remembered default source. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK catalog and rules. |
| `--init-only` | Legacy cache-prep flag; prefer `afk refresh`. |
| `--empty` | With cache preparation, create empty catalog files instead of seeding source defaults. |

### Refresh Flags

These flags apply to `afk refresh`.

| Flag | Meaning |
|---|---|
| `--dry-run` | Preview cache writes without applying them. |
| `--local` | Refresh `./afk/catalog` instead of the global catalog cache. |
| `--source <source>` | Refresh the cache from this source once, without changing the remembered default source. |
| `--default-source <source>` | Save the default source and refresh the cache from it. |
| `--override` | Replace targeted catalog files from the source instead of merging; requires two confirmations. |
| `--ref <git-ref>` | Choose the Git ref used when fetching default AFK catalog and rules. |
| `--empty` | Create empty catalog files. |

General setup agent values are:

```text
antigravity, claude, codex, cursor-local, opencode, pi
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
| Custom Agents | `codex`, `claude`, `pi`; Pi additionally requires the `pi-subagents` extension. |
| MCPs | `antigravity`, `claude`, `codex`, `opencode`; project scope skips Antigravity because `add-mcp` does not support that target locally. |
| Hooks | `codex`, `claude`, `cursor-local`. |
| Tools | Tool installers run independently and may define generic post-install commands. |

### Detected Setup Targets

When no `--agent` flag is provided, AFK detects compatible installed agent
surfaces and uses those targets by default. Setup summaries and dry-runs show
the resolved targets before AFK writes files or delegates installers.

Detection is intentionally conservative. AFK checks known config files and
agent directories such as `.codex/config.toml`, `.claude/settings.json`,
`.gemini/GEMINI.md`, `.config/opencode/opencode.json`, and `.cursor/hooks.json`.
If a selected target-dependent area has no detected compatible target,
interactive setup asks for manual targets once.

Tools are not driven by detected agent targets. They remain global or
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

AFK keeps the `skills` CLI default symlink fanout. Invocation policy is
three-state: `autoInvocation: false` forces manual invocation,
`autoInvocation: true` forces model discovery, and an omitted field preserves
the metadata authored by the skill source.

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

Use `afk skills catalog import` when skills are already installed through the official
`skills` CLI and you want AFK's local catalog to catch up.

```bash
afk skills catalog status
afk skills catalog import --dry-run
afk skills catalog import
afk skills catalog import --local
```

`status` compares installed shared skills with `skills.json`, showing
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
agents.json
mcps.json
presets.json
rules.json
tools.json
hooks.json
```

### Presets

`presets.json` can describe an area shortcut, every item within declared areas,
or an exact required bundle:

```json
{
  "version": 1,
  "defaultsSource": "logbookfordevs/ai-field-kit",
  "presets": [
    {
      "id": "daily-routine",
      "label": "Daily Routine",
      "areas": ["rules", "skills", "tools", "agents"],
      "all": true
    },
    {
      "id": "afk-architect",
      "label": "AFK Architect",
      "areas": ["skills", "agents"],
      "selections": {
        "skills": ["afk-architect"],
        "customAgents": [
          "afk-cartographer",
          "afk-builder",
          "afk-pathfinder"
        ]
      }
    }
  ]
}
```

When `all` is `true`, AFK selects every current catalog item within the declared
areas, including entries supplied by `--source`. When `selections` is present,
its arrays are exact required members. When both are omitted, each area keeps
its normal default selection behavior. In every mode, `areas` defines execution
order. AFK continues into later areas after a failure, then exits non-zero if
any required provisioning is incomplete. Use `afk show presets` to inspect the
mode and members before setup.

### Layered Rules and Dependency Files

Version 2 `rules.json` composes named layers in array order. Each layer owns one
rules document and may declare its own dependency files:

```json
{
  "version": 2,
  "layers": [
    {
      "id": "company-base",
      "label": "Company base rules",
      "source": "rules/AGENTS.md",
      "files": [
        {
          "source": "rules/artifacts.md",
          "destination": "artifacts.md"
        }
      ]
    }
  ]
}
```

Each layer and file `source` accepts either an HTTP(S) URL or a path relative
to the root of the repository that owns the catalog. AFK materializes relative
sources during catalog loading. Layer IDs use lowercase slug characters and
must be unique inside the assembled catalog.

Dependency destinations are isolated beneath the owning layer:

```text
Global:  ~/.agents/afk/rules/<layer-id>/
Project: <project>/.agents/afk/rules/<layer-id>/
```

Each rules document can refer to its own directory with `{{AFK_RULES_DIR}}`;
setup replaces the placeholder with that layer's concrete global or project
path. Destinations must remain inside the managed directory and
cannot cross symlinks. AFK records dependency hashes internally and only
removes stale files that still match their installed content; catalog authors
do not provide these hashes.

Version 1 singular rules catalogs remain accepted. Editing one through
`afk rules catalog` migrates it to one named version 2 layer.

AFK has a small cache/source split:

- `afk refresh` updates local catalog cache files.
- `afk skills catalog import` backfills `skills.json` from installed skills with lock metadata.
- `afk show` inspects the cache by default.
- `afk setup` applies the cache by default.
- `setup --source` merges the source entries it applies into the cache without changing the saved default.
- `show --source` inspects a source without changing the cache or saved default.
- `--default-source` belongs to `afk refresh`; it saves the default source and refreshes the cache from it.

Refresh replaces source-owned catalog content while preserving local catalog
extensions. In `skills.json`, imported skills absent from the refreshed source
survive. In `profiles.json`, locally created profiles whose IDs are absent from
the refreshed source survive. The refreshed source wins on matching IDs and
owns top-level profile policy such as `mode`, `alwaysOn`, and `skillAliases`. In `agents.json`,
refresh updates matching IDs, appends new source entries, and preserves local
entries absent from the source. In version 2 `rules.json`, refresh updates
matching layer IDs in place, preserves absent cached layers, and appends new
layers in source order. Refreshing a legacy version 1 rules cache from version 2
performs the one-time transition to the layered shape.

Use `afk refresh --override` when the selected source should become the entire
targeted catalog state. Override removes local-only entries in those files and
therefore asks for confirmation twice before writing. `--dry-run` previews the
replacement without prompting or changing files.

Use these commands to prepare catalog files without running setup:

```bash
afk refresh
afk refresh skills
afk refresh --empty
afk refresh --local
afk refresh --override --dry-run
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

AFK reads public catalogs directly. When raw GitHub access is unavailable, it
falls back to Git using your existing credentials so private repositories work
without a separate AFK token. Interactive terminals show progress while Git
fetches the catalog.

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

### Compose a Catalog from Multiple Sources

A complete AFK setup does not have to come from one repository. You can keep
skills in one catalog, profiles in another, and infrastructure recommendations
somewhere else, then materialize those pieces into one local AFK catalog.

Start by establishing a remembered base source. This gives first-run setup a
stable fallback and fills any categories you do not replace later:

```bash
afk refresh --default-source your-org/base-kit
```

Layer independent sources over individual catalog categories:

```bash
afk refresh skills --source your-org/skills-kit
afk refresh profiles --source your-org/profile-kit
afk refresh mcps --source your-org/platform-kit
afk refresh hooks --source your-org/automation-kit
```

Each targeted refresh writes only the named category. After those commands,
the global cache is an assembled catalog:

```text
~/.agents/afk/catalog/
├── rules.json      # base-kit
├── skills.json     # skills-kit
├── profiles.json   # profile-kit
├── mcps.json       # platform-kit
├── tools.json    # base-kit
├── hooks.json      # automation-kit
└── presets.json    # remembers base-kit as the default source
```

Inspect the assembled result before applying it:

```bash
afk show rules skills profiles mcps tools hooks
afk setup --dry-run
```

When the preview looks right, ordinary setup uses the currently materialized
catalog files; it does not refresh them first:

```bash
afk setup
```

The source model has two deliberate constraints:

- AFK remembers one `defaultsSource`, not a permanent source URL for every
  category. The mixed catalog is the current set of files produced by your
  targeted refresh commands.
- A later unrestricted `afk refresh` refreshes every category from the one
  remembered default source. Continue using
  `afk refresh <category> --source <source>` when you want to preserve or
  update the mix.

Setup can merge and install directly from another source:

```bash
afk setup skills --source your-org/skills-kit
```

That command merges only the skills selected for installation into cached
`skills.json`, marks them as imported local extensions, and leaves the
remembered default source unchanged. Unselected source skills are not cached.
Use targeted `refresh skills --source` to merge the entire source catalog
without installing it.

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
./afk/catalog/agents.json
./afk/catalog/mcps.json
./afk/catalog/rules.json
./afk/catalog/tools.json
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

Use the relevant `afk <family> catalog` command for small edits to writable
local catalog files. It edits the global AFK catalog cache by default, or
`./afk/catalog` with `--local`. For shared defaults, prefer editing the source
repository directly and then refreshing from that source.

## Catalog Examples

### Rules

Rules sync composes named layers in their declared order. A catalog can provide
one layer or assemble public, organization, personal, and project policy:

```json
{
  "version": 2,
  "layers": [
    {
      "id": "organization-base",
      "label": "Organization base",
      "source": "rules/AGENTS.md"
    },
    {
      "id": "personal",
      "label": "Personal rules",
      "source": "https://raw.githubusercontent.com/you/private-kit/main/rules/AGENTS.md"
    }
  ]
}
```

AFK injects the ordered content into one managed region with visible per-layer
markers and preserves content outside the managed region. `setup rules
--source` merges every supplied layer into cached `rules.json` by ID and
immediately renders the combined layers without changing the remembered
default source. Use targeted `refresh rules --source` to perform the same
catalog merge without applying the rules.

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
available to automatic model discovery. Omit `autoInvocation` when the source
skill should retain its own Claude and OpenAI invocation metadata.

### Custom Agents

```json
{
  "version": 1,
  "items": [
    {
      "id": "notion_assistant",
      "label": "Notion Assistant",
      "source": "agents/notion_assistant.md"
    }
  ]
}
```

The catalog stores discovery metadata and a direct Portable Agent File source;
the linked Markdown file owns the runtime description and behavior. The
catalog `id` owns selection and the installed filename, while the portable
file's `name` owns the harness-facing identity. Custom Agents have no
default-selection field: interactive setup starts with every item unchecked,
and scripted setup requires `--custom-agent <id>` or `--all`. Portable files
may declare shared AFK skill names for native per-agent configuration; Custom
Agent setup never installs or validates those skills.

An explicitly selected preset may supply its own exact `customAgents` list.
That is bundle selection, not a change to the unchecked default for ordinary
`afk setup agents` runs.

Relative agent sources resolve from the selected catalog source root. Local
repository sources materialize them as absolute paths; GitHub sources
materialize them as raw-file URLs. Absolute paths and HTTP(S) sources pass
through unchanged. A relative source read directly from a writable cache,
without repository source context, falls back to the setup working directory.

See [Portable Custom Agents](docs/custom-agents.md) for the source schema,
per-harness model and effort fields, capabilities, target paths, and adapter
behavior.

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

### Tools

```json
{
  "version": 1,
  "items": [
    {
      "id": "example-tool",
      "label": "Example Tool",
      "description": "Install the example developer tool.",
      "install": {
        "command": "sh",
        "args": ["-c", "curl -fsSL https://example.com/install.sh | sh"]
      },
      "default": false
    }
  ]
}
```

Tools are delegated commands. If one tool install fails, AFK reports the
failure and continues with the remaining selected tools.

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

AFK updates only the `AFK:RULES` managed region. Version 2 layers receive
`AFK:RULE-LAYER:<id>` markers inside it; user-owned content outside the outer
region is preserved.

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

### Tools

The bundled tool catalog currently includes Plannotator, Plannotator Tot,
Yggtree, Impeccable, and Orchestrator. Tool setup is
best-effort because these installers are owned by their upstream tools.

### Profiles

Profile setup prepares the local `profiles.json` catalog from the remembered
or selected source, lets you select profiles, and installs their catalog skills,
composed dependencies, and remote packages. Setup installs but does not enable
profiles; use `afk skills profiles enable <profile>` to apply one.

### Custom Agents

AFK translates one portable Markdown definition into native Codex, Claude
Code, or Pi agent files. Setup is provisioning only; the selected harness owns
execution and orchestration. Generated native files are replaced on the next
setup, so lasting edits belong in the portable source. Declared portable
`skills` become Codex `skills.config` blocks, Claude Code's native `skills`
list, and Pi `skills` plus `skillPath`; AFK leaves availability to the harness.

Use `afk setup agents` for the unchecked interactive picker, or make scripted
selection explicit:

```bash
afk setup agents --custom-agent notion_assistant --agent codex --dry-run
afk setup agents --custom-agent notion_assistant --agent codex --yes
afk setup agents --all --agent claude --agent pi --yes
afk setup --preset afk-architect --agent codex --yes
```

`--yes` confirms but does not select; the preset command explicitly selects
its declared bundle. AFK Architect remains usable as a skill-only baseline if
the portable agents are not installed. Its optimized bundle adds
Cartographer for discovery, Builder for bounded writes, and Pathfinder for
difficult judgment, verification, or direct implementation. Their catalog IDs
and installed filenames retain the `afk-` namespace. Pi requires
`pi-subagents`; AFK suggests
the extension command and skips Pi when it is unavailable rather than
installing it automatically. For the full contract, see
[Portable Custom Agents](docs/custom-agents.md).

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
afk setup tools --verbose
```

AFK can show which delegated command it planned with:

```bash
afk setup tools --dry-run
```

## Skills and Profiles

This section is the behavioral reference for the `afk skills`,
`afk profiles catalog`, and `afk skills profiles` families. The command tables
above provide the syntax; this section explains how commands compose and what
AFK preserves.

### Command Examples

```bash
afk skills list
afk skills list --scope global --json
afk skills list --disabled
afk skills list --scope global --agent codex
afk skills list --scope project --agent claude
afk skills list --agent custom --agent-path ~/.my-agent/skills
afk skills list --category Docs --tag writing
afk skills add logbookfordevs/ai-field-kit --skill afk-compass --yes
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --yes --profile video
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --yes --profile-only video
afk skills add logbookfordevs/ai-field-kit --skill hyperframes --yes --start-disabled
afk skills show afk-note
afk skills get afk-note
afk skills open afk-note --folder --app cursor
afk skills disable old-skill --dry-run
afk skills enable old-skill
afk skills invocation
afk skills invocation disable afk-doc-craft --dry-run
afk skills delete old-skill --dry-run
afk skills delete --catalog-only --dry-run
afk skills delete --profile
afk skills update --all
afk skills update --profile
afk skills update video --profile
afk skills reset --dry-run
afk skills reset --yes
afk skills categorize --dry-run
afk profiles catalog create video --name Video --skill hyperframes --skill tailwind --mode context
afk skills profiles use video
afk skills profiles use video --all
afk skills profiles enable video --dry-run
afk skills profiles status
```

### Installation and Catalog Synchronization

`afk skills` is separate from `afk setup skills`. Setup remains the
catalog-driven install flow, while `afk skills add` is a convenience wrapper
around the official `skills add` command for one-off installs. AFK always
includes the shared global target first; each explicit `--agent <agent>` adds
an upstream-supported agent projection. Literal `--agent custom` paths apply
only to AFK-owned inspection and mutation commands because the upstream
installer does not accept arbitrary destination directories.

`afk skills update --profile` selects a global profile interactively, or use
`afk skills update <profile> --profile` to select it directly. AFK updates
the profile members that are present in the AFK catalog and tracked by the
skills lock, and reports other members it skips. The picker and `--all` use the
same catalog-and-lock intersection; use the official skills CLI directly for
locked skills outside AFK's catalog. Update preserves active and disabled
storage state even though the upstream flow reinstalls changed skill content.

`afk skills reset` is the recovery route for shared-library drift. It clears
enabled profile state, moves cataloged skills according to `startDisabled`,
applies explicit catalog `autoInvocation` metadata, preserves source policy
when that field is omitted, and moves installed uncataloged skills into
`.disabled`. It reports catalog skills that are not installed but
does not install, update, or delete anything. Use `--dry-run` to inspect the
reconciliation before applying it, or `--yes` to skip confirmation.

AFK uses one skills catalog file for both setup metadata and skill-management
enrichment:

```text
~/.agents/afk/catalog/skills.json
```

Setup-selected source catalog entries remain source-owned. After a successful
direct `afk skills add`, newly installed skills absent from the catalog are
inserted as imported, uncategorized entries.

Before `afk skills add` starts, AFK offers to import installed skills that are
missing from `skills.json` when their source is recoverable from the official
skills CLI lock. Installs owned by tools or other CLIs without lock metadata
are ignored by this preflight and remain under their owning catalog; users can
still add them to the skills catalog manually when they want AFK to manage
them. Add flags remain scoped to skills introduced by the current installation
because AFK compares the active and disabled folders before and after the
upstream add. A source-cataloged skill is therefore still treated as new when
it is installed for the first time.

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

### Discovery, Roots, and Storage

`afk skills list` reads only the shared global library by default. Use
`--agent <agent>` to select a preset agent root and `--scope
global|project|all` to choose that preset's root family. Use `--agent custom
--agent-path <folder>` to select an exact custom skills root; custom paths do
not combine with `--scope`. List and show include only active folders by
default. Use `--disabled` to show disabled folders, and `--category`, `--tag`, or
`--uncategorized` to filter AFK catalog metadata. The same
`--enabled` and `--disabled` folder filters are also available on `afk skills
show`, `open`, `delete`, and `invocation`, plus `afk profiles catalog
create|edit` when those commands need to choose from discovered skill folders.

`afk skills disable`, `afk skills enable`, and `afk skills delete` can manage
the shared global library by default. They can manage preset agent roots with
`--agent <agent>` or a literal root with `--agent custom --agent-path
<folder>`.
`afk skills delete --disabled` is useful when pruning disabled skills. Use
`--catalog-only` to limit deletion candidates to installed skills represented
in AFK's `skills.json` catalog. Use `--profile` to choose a profile and delete
selected installed skills referenced by it. Every installed profile skill starts
selected, and AFK asks for an extra confirmation because the chosen skills may
also be used by other profiles.
Delete is permanent; use `--dry-run` to preview the selected folders before
removing them.

### Profile Definitions and Runtime

`afk profiles catalog` edits profile definitions in `profiles.json`. A
profile is a named group of skill folders. `afk skills profiles
enable|disable|status` applies those definitions to the shared global skill
library.

Version 2 profile definitions separate AFK catalog membership from remote
skill packages:

```json
{
  "version": 2,
  "mode": "context",
  "alwaysOn": [],
  "items": [
    {
      "id": "video",
      "name": "Video",
      "catalogSkills": ["afk-animate"],
      "packages": [
        { "source": "remotion-dev/skills" },
        {
          "source": "another-org/video-skills",
          "skills": ["captions", "video-editing"]
        }
      ]
    }
  ]
}
```

Every `catalogSkills` ID must exist in the selected `skills.json`. A package
without `skills` delegates whole-source installation to `npx skills add`; a
package with `skills` installs only those upstream IDs. After successful
lock-backed verification, AFK caches installed package skills in `skills.json`
with `imported: true` and `startDisabled: true`. Package-owned skills are
profile-only: setup keeps them in `.disabled` until an enabled profile needs
them. Verified cached skills from a whole package, or the selected skills from
a selective package, become runtime members of the profile.

Ownership is resolved per skill ID. If a package also contains a source-owned
`skills.json` entry, the catalog keeps ownership: AFK does not change that
entry to imported or override its `startDisabled` policy. A selective package
cannot repeat a catalog skill already named by the same profile; whole-package
overlap is allowed because the package contents may not be known beforehand.

Version 1 `skills` definitions remain readable for compatibility and retain
their existing lock-backed recovery behavior. Profile writes use version 2 and
serialize membership as `catalogSkills`.

`afk skills profiles use <profile>` prints a compact agent-context list with
each profile skill's local description and matching `afk skills get <skill>`
command. It reads both active and `.disabled` shared skills without changing
profile state or moving folders. Add `--all` to include every profile skill's
complete `SKILL.md` content. `afk skills get` wraps complete local skill
content with its absolute root so referenced files remain resolvable.

By default, enabling a profile is additive: it activates the profile's skills
without filtering unrelated active skills. The explicit `--additive` flag is
kept as a compatibility alias for that default:

```bash
afk skills profiles enable video --additive
```

Use `--focus` when you want the profile to filter unrelated skills according
to the configured `strict` or `context` mode:

```bash
afk skills profiles enable video --focus
```

AFK remembers how
the profile was enabled, so the ordinary disable command restores only the
skills that were disabled before that activation:

```bash
afk skills profiles disable video
```

Disable a profile before switching it between focus and additive activation.
This keeps restoration predictable instead of changing an active profile's
behavior in place.

### Profile Reconciliation Math

Profiles are reconciled from the desired final state each time you enable or
disable one. The kept set includes every active profile, regardless of how it
was enabled:

```text
alwaysOn + catalogSkills + verified package skills from every enabled profile
```

The top-level `profiles.json` `mode` controls what happens to skills outside
that set while at least one explicitly enabled focus profile is active:

| Mode | Behavior |
|---|---|
| `strict` | Default. Profiles act like an availability sandbox: active skills outside the kept set move to `.disabled`. |
| `context` | Profiles act like a context filter: cataloged manual skills with `autoInvocation: false` stay active, while discoverable or uncataloged skills outside the kept set move to `.disabled`. |

The optional top-level `skillAliases` map declares renamed upstream skills-lock
IDs used during setup recovery. The key remains the profile-facing skill ID and
the value becomes the upstream `--skill` argument, such as
`"stitch-remotion": "remotion"`. Omit aliases when both IDs already match.

Use `afk profiles catalog create|edit --mode strict|context` to set the mode,
or use `afk profiles catalog set-mode`.

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

`afk profiles catalog toggle-always-on` can edit profile-level `alwaysOn`
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

Use `--local` with `afk profiles catalog ...` to read and write profile
definitions in the current project under `./afk/catalog/profiles.json`. Use
`--local` with `afk skills profiles ...` when applying project-local profile
state under `./afk/state/skill-profiles.json`. V1 still applies the resulting
profile filter to the shared global skill library at `~/.agents/skills`.

`afk skills open` can open a skill file or folder in Finder, VS Code, Cursor,
Zed, or Antigravity.

`afk skills categorize` uses `codex exec` to update the categorization metadata
inside `skills.json`, while preserving the path for a later SDK-backed runner.
