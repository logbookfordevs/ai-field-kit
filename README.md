# 🧭 AI Field Kit — by Logbook for Devs

> *The rules, skills, MCP configs, and sync scripts powering a DX-first AI developer workflow.*

A curated, version-controlled collection of everything you need to make AI coding agents actually useful in a real development environment. No fluff — just the configuration, prompts, and automation that ship every day.

Repository history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) using dated entries instead of release versions.

---

## What's in the Kit

| Piece | What it does |
|---|---|
| `rules/` | Global agent instructions (AGENTS.md) shared across all AI tools |
| `skills/` | Reusable capabilities and quality lenses that shape how agents work |
| `workflows/` | Slash-command workflows for explicit multi-step tasks |
| `mcps/` | MCP server registry + sync script to configure them everywhere |
| `sync-ai-agents.sh` | One-command sync: pulls repo and symlinks rules into all supported agents |
| `sync-ai-workflows.sh` | One-command sync: manages per-workflow symlinks where possible and renders Gemini CLI commands as TOML |
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
# 1. Symlink global agent rules (AGENTS.md → Gemini, Codex, OpenCode, KiloCode, Claude)
bash sync-ai-agents.sh

# 2. Sync workflows into each agent's command or prompt directory
bash sync-ai-workflows.sh

# 3. Inject MCP server configs (prompts for API keys as needed)
python3 sync-ai-mcps.py
```

✅ Done. Every agent on your machine now shares the same rules, workflows, and MCP servers.

---

## The Skills

Skills are modular instruction files that teach agents *how* to think and work across many requests: debugging lenses, DX heuristics, motion direction, and specialized integrations.

### Installing skills with the CLI

The easiest way to install skills from this repo is with the [`skills` CLI](https://skills.sh/). Run it from the repo directory and it'll walk you through an interactive picker:

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install and which agents to target. A few useful flags:

```bash
# Install a specific skill globally (available to all agents on your machine)
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill afk-dx-coding-playbook --global

# Install all skills globally, skip confirmation
npx skills add https://github.com/logbookfordevs/ai-field-kit --all --global

# Install only to a specific agent
npx skills add https://github.com/logbookfordevs/ai-field-kit --agent cursor
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill afk-dx-coding-playbook --agent gemini

# Preview what's available without installing
npx skills add https://github.com/logbookfordevs/ai-field-kit --list
```

The CLI symlinks skill files into the right agent directories — no manual path juggling needed.

### Install a single skill

If you only want the taxonomy-aware discovery helper, install `ai-companion` directly:

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill ai-companion
```

This skill lives in the repository under [`skills/ai-companion/`](./skills/ai-companion/) and is designed to work with the `skills.json` file generated or maintained by AI Skills Companion.

> **What does global vs. agent-specific mean?**
> Global installs (`--global`) place the skill in `~/.agents/skills/` and make it available to every agent that reads from there.
> Agent-specific installs target a single tool's config directory directly.

### Available skills

| Skill | What it unlocks |
|---|---|
| `afk-animated-driven-frontend` | Motion choreography, microinteractions, cinematic UI |
| `afk-documentation-authoring` | DocX playbook: journeys, progressive disclosure, real empathy |
| `afk-dx-coding-playbook` | DX-first heuristics for reviews, refactors, and API design |
| `afk-spline-3d-integration` | Spline 3D integration guides for React and vanilla JS |
| `afk-structured-debugging` | Root cause analysis with expected vs. actual timelines |
| `ai-companion` | Uses `skills.json` taxonomy to improve native skill discovery |
| `afk-advanced-elicitation` | Structured critique and refinement loops for improving drafts, plans, and decisions |
| `afk-archive-artifact` | Archives finished or inactive artifacts cleanly while preserving traceability |
| `afk-ask-gemini` | Gets a second opinion from a local Gemini CLI and saves the result as an artifact |
| `afk-brainstorming-facilitator` | Runs guided brainstorming sessions with technique selection, divergence, and synthesis |
| `afk-business-analyst` | Discovery, requirements clarification, competitor framing, and decision support |
| `afk-deep-interview` | High-rigor, Socratic clarification mode for turning vague requests into execution-ready briefs |
| `afk-discuss-phase-context` | Phase-focused discussion before planning to surface unresolved decisions and write context artifacts |
| `afk-note` | Durable lightweight memory in a local notepad file for long sessions and handoffs |
| `afk-unarchive-artifact` | Restores an archived artifact back into the active artifacts area |

### Spec-Driven discussion and planning skills

Several of the newer skills in this repo work together as a small toolkit for spec-driven development, especially in the messy phase before implementation when the problem is still fuzzy.

They are intentionally similar, but they are not redundant:

| Skill | Use it when | Best output |
|---|---|---|
| `afk-brainstorming-facilitator` | You need divergence, lots of options, or fresh directions before narrowing anything down | Idea inventory, themes, promising directions |
| `afk-business-analyst` | You want a capable analyst mode to structure ambiguity, compare options, or turn fuzziness into clearer business framing | Brief, decision memo, requirements outline, analysis summary |
| `afk-deep-interview` | You want disciplined clarification before planning or execution and you're willing to be questioned one round at a time | Execution-ready brief or spec with clear boundaries |
| `afk-discuss-phase-context` | You already know the phase or scoped chunk of work and need to resolve the gray areas before planning | Context artifact for downstream planning |
| `afk-advanced-elicitation` | You already have a draft, brief, plan, or answer and want to pressure-test or improve it | Stronger revised artifact with visible critique/refinement |
| `afk-note` | You need important context to survive interruptions, compaction, or handoffs | Durable lightweight memory |
| `afk-ask-gemini` | You want an outside perspective, alternate framing, or a second opinion from another model | External-model artifact with summary and next steps |
| `afk-archive-artifact` | You want to retire a finished, paused, superseded, or merged artifact without losing history | Archived artifact with an `ARCHIVE.md` note |
| `afk-unarchive-artifact` | You want to bring an archived artifact back into active work | Restored artifact in active `artifacts/` |

### What to choose

If you're unsure which one to reach for, use this shortcut:

- "We need more ideas" -> `afk-brainstorming-facilitator`
- "We need clearer business framing" -> `afk-business-analyst`
- "We need to interrogate the request before building" -> `afk-deep-interview`
- "We know the phase, but implementation decisions are still fuzzy" -> `afk-discuss-phase-context`
- "We already have something written, but it needs a stronger pass" -> `afk-advanced-elicitation`
- "I don't want to lose this context later" -> `afk-note`
- "I want another model's opinion" -> `afk-ask-gemini`
- "This artifact is no longer active, but I want to keep it" -> `afk-archive-artifact`
- "I need to bring archived work back into the active flow" -> `afk-unarchive-artifact`

### A simple flow that works well

You do not need to use all of these every time, but this sequence works well for many spec-driven tasks:

1. Start with `afk-brainstorming-facilitator` when the space is still wide open.
2. Move to `afk-business-analyst` when the ideas need clearer framing, trade-offs, or requirements language.
3. Use `afk-deep-interview` when you want to pressure-test intent, scope, non-goals, and decision boundaries before planning.
4. Use `afk-discuss-phase-context` when a specific phase needs its gray areas resolved.
5. Use `afk-advanced-elicitation` on the resulting brief, context doc, or plan to improve quality before execution.

### Lightweight handoff contract

These skills are designed to work well together, but they are intentionally not a rigid pipeline.

AI Field Kit uses a lightweight handoff model:
- predictable artifact names when a skill writes a file
- a small set of shared anchor sections
- freedom for each skill to keep its own tone, structure, and special sections

The goal is handoff clarity, not template lock-in.

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

Active work should stay in the main `artifacts/` area. Archived work should move to `artifacts/archive/`. Branches, not nested work folders, are the default way to separate parallel active work.

#### Shared anchor sections

When a skill produces a document artifact, it should include whichever of these are relevant:

- `Goal`
- `Context`
- `Intent`
- `Scope`
- `Non-goals`
- `Constraints`
- `Ideas` or `Options`
- `Decisions`
- `Open Questions`
- `Next Step`

Not every artifact needs every section. These are navigation anchors so the next skill, or the next chat, can recover the important parts quickly.

#### Recommended artifact names

These are suggestions, not hard requirements:

| Skill | Suggested artifact name |
|---|---|
| `afk-brainstorming-facilitator` | `artifacts/brainstorming/brainstorming-session-<topic-or-slug>.md` |
| `afk-business-analyst` | `artifacts/analysis/analysis-brief-<topic-or-slug>.md` |
| `afk-deep-interview` | `artifacts/interviews/deep-interview-brief-<topic-or-slug>.md` |
| `afk-discuss-phase-context` | `artifacts/context/context-<phase-or-topic>.md` |
| `afk-advanced-elicitation` | usually revises an existing artifact instead of creating a new canonical file |
| `afk-note` | `notepad.md` or another repo-local persistent notes file |
| `afk-ask-gemini` | `artifacts/gemini-<slug>-<timestamp>.md` |

#### How the handoff works

The next skill is not expected to blindly parse a strict schema.

Instead, it should:
- look for the previous artifact if one exists
- scan the shared anchor sections first
- use the rest of the document for nuance and skill-specific detail

When a skill produces multiple files, prefer one primary handoff artifact for the next step and treat any other files as supporting artifacts.

This keeps the flow legible without making every output feel identical.

### Practical guidance

- `afk-brainstorming-facilitator` is for divergence. Do not reach for it if you already know what you want and just need tighter requirements.
- `afk-business-analyst` is the best choice when you want the experience of talking to a smart strategist, not just filling in a template.
- `afk-deep-interview` is the strictest one. Use it when ambiguity is expensive.
- `afk-discuss-phase-context` is narrower than `afk-deep-interview`. It assumes the work is already scoped enough to discuss implementation-facing decisions.
- `afk-advanced-elicitation` is not for first-pass discovery. It is best after a draft or direction already exists.
- `afk-note`, `afk-ask-gemini`, and `afk-archive-artifact` are support skills. They pair well with the others but usually are not the main event.

### Supporting skills around the flow

The spec-shaping flow is the core lane, but it is not the whole story of AI Field Kit.

Several older AFK skills fit naturally around this flow as specialist companions rather than main stages:

| Skill | Where it fits |
|---|---|
| `afk-documentation-authoring` | When a brief, context doc, decision memo, or guide needs to become polished, readable documentation |
| `afk-dx-coding-playbook` | When a refined plan or requirements artifact needs DX-oriented critique, maintainability guidance, or implementation-shaping advice |
| `afk-structured-debugging` | When the real problem is a bug, failure, or investigation rather than new scoped work |
| `afk-archive-artifact` | When an inactive artifact should move out of the active flow without being deleted |
| `afk-unarchive-artifact` | When archived work needs to become active again |
| `ai-companion` | When you want help discovering which installed skill best matches the current moment |

These are not required steps in the main flow. They are optional specialists you bring in when the work changes shape.

#### How they connect

- Use `afk-documentation-authoring` after `afk-business-analyst`, `afk-deep-interview`, or `afk-discuss-phase-context` when the output needs to become a human-friendly document instead of a working artifact.
- Use `afk-dx-coding-playbook` after `afk-advanced-elicitation` or alongside planning artifacts when you want sharper implementation guidance with stronger developer experience.
- Use `afk-structured-debugging` instead of the spec-shaping flow when the task is really about understanding a defect, incident, or failure timeline.
- Use `afk-archive-artifact` when a flow output is done, paused, superseded, or merged and should move out of the active workspace.
- Use `afk-unarchive-artifact` when archived work should return to the active workspace for revision or follow-up.
- Use `ai-companion` when you're unsure whether you need the main flow, a support skill, or something else already installed.

#### A useful mental model

Think of AI Field Kit in two layers:

- **Core flow:** shape the work before execution
- **Support layer:** polish, debug, document, or route the work more intelligently

That keeps the main flow coherent without pretending every skill belongs in the same sequence.

---

## The Workflows

Workflows are markdown slash commands for named, repeatable user journeys. Use them when the task has a clear intake, flow, checkpoints, and output.

| Command | What it does |
|---|---|
| `/afk-cinematic-landing-page-builder` | Builds a premium landing page from a fixed creative intake |
| `/afk-interactive-code-review` | Reviews a PR step by step with pauses after each file |
| `/afk-pr-description-generator` | Generates a structured PR description from branch diffs |
| `/afk-pr-story-flow-mermaid` | Generates a Mermaid PR story flow from branch diffs |
| `/afk-typecheck` | Runs `tsc`, writes a temporary typecheck report when needed, fixes issues, and asks whether to keep or delete the report |

### Workflow Sync Targets

Different agents expose the same idea under different names and file formats, so the sync script keeps AI Field Kit workflows namespaced per agent and renders agent-compatible variants when needed.

| Agent | What the agent calls them | Global path used by this repo | Sync strategy |
|---|---|---|---|
| Antigravity | Workflows | `~/.gemini/antigravity/global_workflows/` | Root-level workflow copies with generated YAML frontmatter |
| Codex | Skills | `~/.codex/skills/afk/` | Generated skill folders built from each workflow |
| OpenCode | Commands | `~/.config/opencode/commands/afk/` | Managed per-file symlinks |
| Gemini CLI | Custom commands | `~/.gemini/commands/afk/` | Rendered TOML files |
| Claude Code | Custom slash commands | `~/.claude/commands/afk/` | Managed per-file symlinks |
| Cursor | Commands | `~/.cursor/commands/afk/` | Managed per-file symlinks |
| KiloCode | Workflows | `~/.kilocode/workflows/afk/` | Managed per-file symlinks |

### Compatibility Notes

- Gemini CLI expects `.toml` command files, so `sync-ai-workflows.sh` converts repo workflows into TOML before syncing.
- Antigravity currently receives root-level copied files because nested folders and symlinked entries may not be indexed reliably there.
- Codex now receives generated AFK skills under `~/.codex/skills/afk/`, built from the workflow markdown files during sync.
- Antigravity workflow files are exported with generated YAML frontmatter containing `description`, because that format appears to be required for manual workflow discovery there.
- Other supported Markdown workflow consumers currently receive managed per-file symlinks inside the repo-owned `afk/` subfolder.
- This keeps AI Field Kit commands and Codex skills isolated from your personal or third-party entries in the same agent.
- The script only refreshes files managed by this repo; it does not intentionally wipe unrelated commands in the parent command folders.
- This is intentionally symlink-first for better DX: one source of truth, easier debugging, and no copy drift.

### Global Rules Sync Targets

`sync-ai-agents.sh` links the shared [`rules/AGENTS.md`](./rules/AGENTS.md) file into each supported tool's expected global instructions path:

| Agent | Global rules path |
|---|---|
| Gemini | `~/.gemini/GEMINI.md` |
| Codex | `~/.codex/AGENTS.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |
| KiloCode | `~/.kilocode/rules/AGENTS.md` |
| Claude | `~/.claude/CLAUDE.md` |

---

## Skill vs Workflow Rubric

If you're deciding where a new prompt belongs, use this rule first:

- A **skill** is reusable expertise.
- A **workflow** is a named operating procedure.

### Choose a skill when

- The guidance should improve many different kinds of requests.
- The agent needs a reusable lens, not a fixed script.
- Multiple valid outputs are acceptable.
- The task is broad, adaptive, or composable with other skills.
- You want the behavior to activate naturally from plain-English requests.

**Good skill examples in this repo:**

- `afk-dx-coding-playbook`: a maintainability and readability lens that applies across reviews, refactors, and implementation work.
- `afk-structured-debugging`: a debugging approach that works across many bug reports and log investigations.
- `afk-animated-driven-frontend`: motion strategy and interaction direction that can shape many different UI tasks.

### Choose a workflow when

- The task has a clear beginning, middle, and end.
- The agent should follow a fixed sequence of steps.
- The input format is predictable.
- The output is a specific artifact or deliverable.
- You want the user to invoke it intentionally as a slash command.

**Good workflow examples in this repo:**

- `/afk-interactive-code-review`: a step-by-step review flow with pauses after each file.
- `/afk-pr-description-generator`: a repeatable artifact generator for PR descriptions.
- `/afk-cinematic-landing-page-builder`: a fixed creative intake followed by a specific landing-page build process.

### Quick test

Ask these two questions:

1. "Is this teaching the agent how to think across many situations?"
2. "Or is this telling the agent exactly how to run one repeatable process?"

If the answer is mostly **1**, make it a skill. If it's mostly **2**, make it a workflow.

### A helpful anti-pattern

If the exact same prompt content works well as both a skill and a workflow, that usually means the boundary is still too blurry.

In practice:

- Put the canonical version in **one place**.
- Prefer **skills** for reusable judgment.
- Prefer **workflows** for explicit rituals.
- Avoid keeping the same long instructions in both folders, because they will drift.

### A simple rule of thumb

- "Help me do this well" usually wants a **skill**.
- "Run this exact playbook" usually wants a **workflow**.

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
| OpenCode | `~/.config/opencode/opencode.json` |

For OpenCode specifically, the sync script only merges into the top-level `mcp` object and preserves every other existing setting in `opencode.json`.

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
python3 sync-ai-mcps.py --agent opencode
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

1. Add a `.md` file to `workflows/` with the standard instruction format
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
