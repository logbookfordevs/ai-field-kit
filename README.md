# 🧭 AI Field Kit — by Logbook for Devs

> *The rules, skills, MCP configs, and sync scripts powering a DX-first AI developer workflow.*

A curated, version-controlled collection of everything you need to make AI coding agents actually useful in a real development environment. No fluff — just the configuration, prompts, and automation that ship every day.

---

## What's in the Kit

| Piece | What it does |
|---|---|
| `rules/` | Global agent instructions (AGENTS.md) shared across all AI tools |
| `skills/` | Modular skill files that extend agent behavior for specific tasks |
| `workflows/` | Slash-command workflows for Gemini, Cursor, KiloCode, and Codex |
| `mcps/` | MCP server registry + sync script to configure them everywhere |
| `sync-ai-agents.sh` | One-command sync: pulls repo and symlinks rules into all agents |
| `sync-ai-workflows.sh` | One-command sync: symlinks workflow files into all agent directories |
| `sync-ai-mcps.py` | Smart MCP sync: resolves API key placeholders, writes to each agent config |

---

## Quick Start

### Just the skills — 30 seconds

No clone needed. Install directly from GitHub using the [`skills` CLI](https://skills.sh/):

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install and which agents to target.

### Full setup — rules, workflows, and MCPs too

If you want the complete stack, clone the repo first:

```bash
git clone https://github.com/logbookfordevs/ai-field-kit.git ~/codes/ai-field-kit
cd ~/codes/ai-field-kit
```

Then run the sync scripts in order:

```bash
# 1. Symlink global agent rules (AGENTS.md → Gemini, Codex, KiloCode, Claude)
bash sync-ai-agents.sh

# 2. Symlink workflows into every agent that supports slash commands
bash sync-ai-workflows.sh

# 3. Inject MCP server configs (prompts for API keys as needed)
python3 sync-ai-mcps.py
```

✅ Done. Every agent on your machine now shares the same rules, workflows, and MCP servers.

---

## The Skills

Skills are modular instruction files that teach agents *how* to approach specific tasks — code reviews, motion design, debugging, spec writing, and more.

### Installing skills with the CLI

The easiest way to install skills from this repo is with the [`skills` CLI](https://skills.sh/). Run it from the repo directory and it'll walk you through an interactive picker:

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install and which agents to target. A few useful flags:

```bash
# Install a specific skill globally (available to all agents on your machine)
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill dx-coding-playbook --global

# Install all skills globally, skip confirmation
npx skills add https://github.com/logbookfordevs/ai-field-kit --all --global

# Install only to a specific agent
npx skills add https://github.com/logbookfordevs/ai-field-kit --agent cursor
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill spec-create --agent gemini

# Preview what's available without installing
npx skills add https://github.com/logbookfordevs/ai-field-kit --list
```

The CLI symlinks skill files into the right agent directories — no manual path juggling needed.

> **What does global vs. agent-specific mean?**
> Global installs (`--global`) place the skill in `~/.agents/skills/` and make it available to every agent that reads from there.
> Agent-specific installs target a single tool's config directory directly.

### Available skills

| Skill | What it unlocks |
|---|---|
| `animated-driven-frontend` | Motion choreography, microinteractions, cinematic UI |
| `cinematic-landing-page-builder` | Art-directed landing pages with GSAP + Tailwind |
| `codex-uncodexfy` | Breaks out of generic AI UI aesthetics |
| `documentation-authoring` | DocX playbook: journeys, progressive disclosure, real empathy |
| `dx-coding-playbook` | DX-first heuristics for reviews, refactors, and API design |
| `iteractive-code-review` | Step-by-step PR review that follows the developer's reasoning |
| `logbookfordevs-context` | Brand + attribution rules for all Logbook for Devs projects |
| `pr-description-generator` | Generates comprehensive, structured PR descriptions |
| `pr-story-flow-mermaid` | Generates Mermaid flow diagrams from PR diffs |
| `spec-create` | Full spec-driven workflow from problem → tasks |
| `spec-execute` | Executes individual tasks from an approved spec |
| `spec-plan` | Lightweight feature brief for rapid development |
| `spline` | Spline 3D integration guides for React and vanilla JS |
| `structured-debugging` | Root cause analysis with expected vs. actual timelines |

---

## The Workflows

Workflows are markdown slash commands that agents can invoke directly.

| Command | What it does |
|---|---|
| `/spec-plan` | Creates a lightweight feature brief optimized for rapid development |
| `/spec-create` | Runs the complete spec-driven workflow |
| `/spec-execute` | Executes tasks from an approved task list |
| `/pr-story-flow-mermaid` | Generates a Mermaid PR story flow from branch diffs |

---

## The MCP Registry

`mcps/mcp.json` is a single source of truth for your MCP server configurations. Instead of maintaining separate configs per agent, you define servers once and the sync script distributes them.

### How `KEY_*` placeholders work

The registry uses `KEY_STITCH`-style placeholders instead of real API keys. The sync script (`sync-ai-mcps.py`) resolves them at runtime:

1. Checks if an environment variable with that name is set
2. If not, prompts you securely to enter the value
3. Writes the resolved config into each agent's config file

**Your real keys never touch the repo.** ✅

### Supported agents

| Agent | Config target |
|---|---|
| Gemini / Antigravity | `~/.gemini/settings.json` / `~/.gemini/antigravity/mcp_config.json` |
| Codex | `~/.codex/config.toml` |
| Claude | `~/.claude/.mcp.json` |

---

## Configuration

### Override the repo path

By default, sync scripts expect the repo at `~/codes/ai-field-kit`. Override with:

```bash
export AI_RULES_REPO=/path/to/your/clone
bash sync-ai-agents.sh
```

### MCP server options

Preview changes before writing:

```bash
python3 sync-ai-mcps.py --dry-run
```

Sync only a specific agent:

```bash
python3 sync-ai-mcps.py --agent gemini
python3 sync-ai-mcps.py --agent codex
```

Sync non-interactively (CI-friendly) — export keys first:

```bash
export KEY_STITCH=your_value
python3 sync-ai-mcps.py --non-interactive
```

---

## Contributing

This kit grows with real-world use. If you've built a skill, workflow, or MCP config that's made your AI workflow meaningfully better — open a PR.

**Adding a skill:**

1. Scaffold it with the CLI: `npx skills init my-skill`
2. Fill in `my-skill/SKILL.md` following the existing patterns in `skills/`
3. Open a PR with a short description of what the skill does and when to use it

**Adding a workflow:**

1. Add a `.md` file to `workflows/` with the standard YAML frontmatter + instruction format
2. Open a PR

**Adding an MCP server:**

Edit `mcps/mcp.json` and add a new entry under `"servers"`. Use `KEY_YOUR_NAME` as a placeholder for any API keys — never commit real values:

```json
{
  "servers": {
    "my-server": {
      "config": {
        "command": "npx",
        "args": ["-y", "my-mcp-package", "--api-key", "KEY_MY_SERVER"]
      },
      "targets": {
        "gemini": { "name": "my-server" },
        "codex": { "name": "my-server", "enabled": true }
      }
    }
  }
}
```

---

## Common Issues

**Symlink already exists and points somewhere wrong** — The sync scripts handle this automatically: they back up real files and replace broken symlinks. Check for `.bak.*` files in the destination directories if something seems off.

**Skills not discovered by my agent** — Make sure the skill lives at `~/.agents/skills/<name>/SKILL.md` and that your agent is configured to read from `~/.agents/skills/`.

**`KEY_*` placeholder error** — Either export the env var before running, or let the script prompt you interactively. See [MCP server options](#mcp-server-options) above.

---

## Agents Supported

| Agent | Rules | Workflows | MCP |
|---|---|---|---|
| Gemini CLI / Antigravity | ✅ | ✅ | ✅ |
| Codex | ✅ | ✅ | ✅ |
| KiloCode | ✅ | ✅ | — |
| Claude | ✅ | — | ✅ |
| Cursor | — | ✅ | — |

---

## Support This Work

If this kit saves you time, consider buying me a coffee ☕

| | |
|---|---|
| ☕ Ko-fi — quick coffee | [![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs) |
| 🍱 Buy me lunch | [![Ko-fi $15](https://img.shields.io/badge/Ko--fi%20%2415-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs?amount=15) |
| 🍽️ Buy me dinner | [![Ko-fi $30](https://img.shields.io/badge/Ko--fi%20%2430-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/logbookfordevs?amount=30) |
| ☕ Buy Me a Coffee | [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/logbookfordevs) |

---

<br/>

> A tool from the [Logbook for Devs](https://logbookfordevs.com/)
> 
> *Charting the technical seas, one commit at a time.*
