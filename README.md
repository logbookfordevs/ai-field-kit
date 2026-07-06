# AI Field Kit - by Logbook for Devs

> A CLI-first setup router for practical AI development environments.

AI Field Kit starts with the `afk` command. The CLI previews and applies the
parts of an AI development setup that should move together: shared rules,
skills, MCPs, plugins, hooks, setup profiles, and project-local catalogs.

The important bit: AFK is a router, not a replacement for every ecosystem tool.
It owns AFK-specific rule and hook behavior, then delegates skills, MCPs, and
plugins to the tools that already own those surfaces.

Repository history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) using dated
entries instead of release versions.

---

## Index

- [Quick Start](#quick-start)
  - [Install the CLI](#install-the-cli)
  - [Preview setup](#preview-setup)
  - [Apply setup](#apply-setup)
- [What AFK Sets Up](#what-afk-sets-up)
- [Common CLI Paths](#common-cli-paths)
- [Catalogs and Sources](#catalogs-and-sources)
- [Skills and Workflows](#skills-and-workflows)
- [Repository Map](#repository-map)
- [Contributing](#contributing)
- [Common Issues](#common-issues)
- [Agents Supported](#agents-supported)
- [Acknowledgements](#acknowledgements)
- [Support This Work](#support-this-work)

---

## Quick Start

### Install the CLI

Use `npx` for a first look or a one-off run:

```bash
npx @logbookfordevs/afk setup --dry-run
```

Install the latest release when AFK becomes a regular machine command:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash
```

Working from this checkout? Build and link the local CLI:

```bash
./scripts/install.sh --local
```

### Preview setup

Start with a dry run. AFK prints the exact actions it would take before writing
rules, installing skills, adding MCPs, installing plugins, or merging hooks.

```bash
afk setup --dry-run
```

You can preview one area at a time:

```bash
afk setup rules --dry-run
afk setup skills --dry-run
afk setup mcps --dry-run
afk setup plugins --dry-run
afk setup hooks --dry-run
```

### Apply setup

When the preview looks right, run the same command without `--dry-run`:

```bash
afk setup
```

Interactive setup starts with nothing selected. Choose only the areas and items
you want. Scripted setup can use `--yes` after a catalog source has been saved:

```bash
afk setup --yes
```

For the complete command reference, flags, catalog format, local-development
install flow, and custom defaults workflow, read the
[AFK CLI README](./packages/afk/README.md).

---

## What AFK Sets Up

| Area | Command | What happens |
|---|---|---|
| Rules | `afk setup rules` | Syncs AFK rules into managed regions of supported agent instruction files. |
| Skills | `afk setup skills` | Delegates selected skill installs to the official `skills` CLI. |
| Profiles | `afk setup profiles` | Prepares focus profile definitions from `profiles.json`. |
| MCPs | `afk setup mcps` | Delegates selected MCP recommendations to `add-mcp`. |
| Plugins | `afk setup plugins` | Runs curated plugin installer commands and supported post-install setup. |
| Hooks | `afk setup hooks` | Copies hook scripts and merges hook commands into supported agent configs. |

`afk setup` can run all of those areas in one guided flow. Each area runs
independently: if one delegated installer fails, AFK still tries the remaining
selected areas, then exits non-zero with a failure summary.

AFK-owned rules currently target a focused v1 set. Skills and MCP installation
are delegated to official CLIs, so broader support can come from those projects
without AFK reimplementing their installers.

---

## Common CLI Paths

| Goal | Command |
|---|---|
| Preview the whole setup | `afk setup --dry-run` |
| Apply the whole setup | `afk setup` |
| Run project-local setup | `afk setup --local` |
| Refresh the global catalog cache | `afk refresh` |
| Inspect the cached catalog | `afk show` |
| Inspect skills as a composition tree | `afk show skills --react` |
| Generate the local skill composition page | `afk show skills --visualize` |
| Backfill installed skills into the catalog | `afk catalog skills import --dry-run` |
| Route UI work through UI Skills | `afk ui start` |

Compatibility aliases such as `afk setup skills install` and
`afk setup rules sync` still work, but the shorter forms above are the
preferred command shape.

---

## Catalogs and Sources

AFK setup is catalog-driven. A catalog describes the recommended rules, skills,
MCPs, plugins, hooks, profiles, and presets for a machine or project while
keeping installation delegated to the right upstream tool.

The global catalog cache lives here:

```text
~/.agents/afk/catalog/
```

Project-local catalogs live here:

```text
./afk/catalog/
```

Use a source for one command:

```bash
afk setup --source your-org/dev-kit
afk show skills --source your-org/dev-kit
```

Save a source as the default and refresh from it:

```bash
afk refresh --default-source your-org/dev-kit
```

AI Field Kit also publishes its default AFK catalog as a shadcn-compatible
registry item. Use this when you want to commit the current AFK defaults into a
project before running project-local setup:

```bash
pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog
# or npx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog
afk setup --local --dry-run
```

The registry item writes the same fragmented catalog files AFK already reads
under `./afk/catalog/`. shadcn handles distribution; AFK still owns setup
semantics such as defaults, scopes, managed rules, hooks, plugins, and
delegated skill/MCP installers.

---

## Skills and Workflows

Skills are still a core part of AI Field Kit, but they are no longer the front
door of this README. Start with the CLI; use the skill docs when you want the
composition model, available skills, or workflow guidance.

Start here:

- [Skill Composition](./packages/afk/docs/skill-composition.md) explains the
  primitive, wrapper, workflow, utility, reference, and router model.
- [Skill Composition Studio](https://tot.page/mhPWYwLnjw_yGzIs8FQOXg) is the
  visual companion.
- [`skills/`](./skills) contains the authored AFK skill packages.

If you only want the AFK-authored skill files, install directly from GitHub
using the [`skills` CLI](https://skills.sh/):

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

That is the lightest path, but it is not the full AFK experience. It installs
skills from this repository only; it does not apply AFK rules, hooks, MCPs,
plugins, catalog composition, or setup policy.

---

## Repository Map

| Path | What it is |
|---|---|
| [`packages/afk/`](./packages/afk) | AFK CLI package, command reference, catalog model, and local development flow. |
| [`packages/afk/catalog/`](./packages/afk/catalog) | Default setup catalog read by AFK. |
| [`rules/`](./rules) | Shared AFK rules source for managed agent instruction regions. |
| [`skills/`](./skills) | Authored AFK skills and workflow-style skill packages. |
| [`mcps/`](./mcps) | MCP server recommendations for delegated setup through official tooling. |
| [`registry.json`](./registry.json) | shadcn-compatible registry entrypoint for project-local AFK catalog bundles. |
| [`apps/site/`](./apps/site) | React/Vite site for AI Field Kit. |

### Global rules targets

The shared [`rules/AGENTS.md`](./rules/AGENTS.md) file is the source for AFK's
managed rules region. The CLI merges that region into each supported global
instruction host without replacing user-owned content in the rest of the file:

| Agent | Global rules path |
|---|---|
| Antigravity / Agy | `~/.gemini/GEMINI.md` |
| Codex | `~/.codex/AGENTS.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |
| Claude | `~/.claude/CLAUDE.md` |

---

## Contributing

This kit grows with real-world use. If you have improved a setup catalog, skill,
MCP recommendation, plugin installer, or rule set that made an AI workflow more
useful, open a PR.

**Changing CLI behavior:**

1. Update the relevant code under [`packages/afk/`](./packages/afk).
2. Update [`packages/afk/README.md`](./packages/afk/README.md) when commands,
   flags, setup semantics, or catalog behavior change.
3. Add a product-facing note to [`CHANGELOG.md`](./CHANGELOG.md) for visible
   behavior changes.

**Adding a skill:**

1. Scaffold it with the CLI: `npx skills init my-skill`
2. Fill in `my-skill/SKILL.md` following the existing patterns in
   [`skills/`](./skills).
3. Add or update the catalog entry that should install it.
4. Open a PR with a short description of what the skill does and when to use it.

For explicit multi-step procedures, use `autoInvocation: true` when normal
language should discover the skill, and reserve `autoInvocation: false` for
slash-only or attached-only procedures.

**Adding an MCP server:**

Edit `mcps/mcp.json` and add a new entry under `"servers"`. Use
`KEY_YOUR_NAME` as a placeholder for any API keys. Never commit real values:

```json
{
  "servers": {
    "my-server": {
      "config": {
        "command": "npx",
        "args": ["-y", "my-mcp-package", "--api-key", "KEY_MY_SERVER"]
      },
      "targets": {
        "antigravity": { "name": "my-server" },
        "codex": { "name": "my-server", "enabled": true }
      }
    }
  }
}
```

## Common Issues

**I only want the skills** - Use
`npx skills add https://github.com/logbookfordevs/ai-field-kit`. Use AFK when
you also want rules, hooks, MCPs, plugins, profiles, and catalog policy.

**I want to see what setup will do first** - Run `afk setup --dry-run` or a
narrow command such as `afk setup hooks --dry-run`.

**Skills are not discovered by my agent** - Make sure the skill lives at
`~/.agents/skills/<name>/SKILL.md` and that your agent is configured to read
from `~/.agents/skills/`.

**A `KEY_*` placeholder fails during MCP setup** - Export the environment
variable before running the delegated installer, or let that installer prompt
when supported.

---

## Agents Supported

AFK-owned rules currently target a focused v1 set. Skills and MCP installation
are delegated to the official CLIs, so broader tool support can come from those
projects without AFK reimplementing their installers.

| Agent | Rules | MCP delegation |
|---|---|---|
| Codex | via managed rules region | via `add-mcp` |
| Claude Code | via managed rules region | via `add-mcp` |
| Antigravity / Agy | via managed rules region | via `add-mcp` |
| OpenCode | via managed rules region | via `add-mcp` |

---

## Acknowledgements

AI Field Kit is heavily inspired by the open-source AI coding community and the
people publishing their methods in public. This repo is its own opinionated kit,
but it has learned a lot from these projects:

- [OpenSpec](https://github.com/Fission-AI/OpenSpec/)
- [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)
- [Get Shit Done](https://github.com/gsd-build/get-shit-done?tab=readme-ov-file)
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [agent-skills](https://github.com/addyosmani/agent-skills)
- [matt-pocock](https://github.com/mattpocock/skills)

Thanks to the maintainers and contributors behind those repos for sharing ideas,
workflows, and techniques in the open. AI Field Kit borrows selectively, adapts
heavily, and tries to stay honest about that lineage.

---

## Support This Work

If this kit saves you time, consider buying me a coffee.

| | |
|---|---|
| Ko-fi - quick coffee | [![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs) |
| Ko-fi $15 | [![Ko-fi $15](https://img.shields.io/badge/Ko--fi%20%2415-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs?amount=15) |
| Ko-fi $30 | [![Ko-fi $30](https://img.shields.io/badge/Ko--fi%20%2430-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs?amount=30) |
| Buy Me a Coffee | [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/logbookfordevs) |

---

<br/>

> A tool from the [Logbook for Devs](https://logbookfordevs.com/)
>
> *Charting the technical seas, one commit at a time.*
