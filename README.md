# 🧭 AI Field Kit — by Logbook for Devs

> *The rules, skills, MCP manifests, and setup router powering a DX-first AI developer workflow.*

A curated, version-controlled collection of everything you need to make AI coding agents actually useful in a real development environment. No fluff — just the configuration, prompts, and automation that ship every day.

AI Field Kit treats frameworks like BMAD, Get Shit Done, Agent OS, Superpowers, and agent skills as reference material, not masters. The kit is a personal synthesis of patterns that keep proving useful in real work: standalone skills when you only need one tool, and an optional workflow when you want the pieces to move together.

> **Standalone skills with an optional workflow path.**
> Install one skill when that is all you need, or use the kit as a loose workflow when the work benefits from staged discovery, decisions, execution, and review.

Repository history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) using dated entries instead of release versions.

---

## Index

- [What's in the Kit](#whats-in-the-kit)
- [Quick Start](#quick-start)
  - [Just the skills](#just-the-skills--30-seconds)
  - [Full setup](#full-setup--rules-and-mcps-too)
- [The Skills](#the-skills)
- [The Workflows](#the-workflows)
- [Skill vs Workflow Rubric](#skill-vs-workflow-rubric)
- [The MCP Registry](#the-mcp-registry)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Common Issues](#common-issues)
- [Agents Supported](#agents-supported)
- [Acknowledgements](#acknowledgements)
- [Support This Work](#support-this-work)

---

## What's in the Kit

| Piece | What it does |
|---|---|
| `rules/` | Global agent instructions (AGENTS.md) shared across all AI tools |
| `.agents/skills/` | Reusable capabilities, quality lenses, and explicit workflow-style procedures |
| `mcps/` | MCP server registry for delegated setup through official tooling |
| `packages/afk/` | Local AFK CLI package for guided setup and setup dry-runs |

---

## Quick Start

### Just the skills — 30 seconds

No clone needed. Install directly from GitHub using the [`skills` CLI](https://skills.sh/):

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install. Agent-specific
support is handled by the official `skills` CLI.

### Full setup — rules and MCPs too

If you want the complete stack, clone the repo first:

```bash
git clone https://github.com/logbookfordevs/ai-field-kit.git ~/codes/ai-field-kit
cd ~/codes/ai-field-kit
```

Then use the AFK CLI as the setup router:

The repo includes a local AFK CLI package. AFK owns rule setup for a small v1
target set: Antigravity/Agy, Codex, Claude Code, and OpenCode. Third-party
installs still route through the official
`skills` and `add-mcp` CLIs, while optional utilities delegate to their own
install scripts.

```bash
pnpm --dir packages/afk install
pnpm --dir packages/afk run build
node packages/afk/dist/index.js setup --dry-run
```

Install the local checkout as an `afk` command while developing:

```bash
./scripts/install.sh --local
afk setup --dry-run
```

Use the dry run first. The CLI prints the exact rules, skills, MCP, and utility
setup actions before anything writes to your machine.

`afk setup` asks whether to prepare a global field kit or only the current
project. Scripted runs stay global by default; pass `--scope project` or
`--local` when you want AFK-owned files, `skills`, `add-mcp`, and RTK init to
use project scope.

AFK also works as a personal setup router. Keep convention-compatible manifests
in your own GitHub repo under `afk/manifests/`, then refresh local defaults from
that repo:

```bash
node packages/afk/dist/index.js setup --refresh-defaults --defaults-source your-org/dev-kit
```

That gives developers a way to carry their own recommended skills, MCPs,
utilities, presets, and rule sources without patching the AFK CLI. For rules,
their `rules.json` can point directly at their raw GitHub rules file so
`setup rules sync` keeps fetching from their defaults. AFK remembers the chosen defaults source in `presets.json`, so later
`--refresh-defaults` runs can use that source without repeating the flag.

To create those manifest files interactively, run:

```bash
afk manifests configure --local
```

That writes `./afk/manifests/` in the current repo, ready to publish as a
personal defaults source.

---

## The Skills

Skills are modular instruction files that teach agents *how* to think and work across many requests: debugging lenses, DX heuristics, motion direction, and specialized integrations.

### Installing skills with the CLI

The easiest way to install skills from this repo is with the [`skills` CLI](https://skills.sh/). Run it from the repo directory and it'll walk you through an interactive picker:

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install and where the official
`skills` CLI should place them. A few useful flags:

```bash
# Install all skills globally, skip confirmation
npx skills add https://github.com/logbookfordevs/ai-field-kit --all --global

# Install only to a specific agent
npx skills add https://github.com/logbookfordevs/ai-field-kit --agent claude-code

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
| `afk-execution-tracking` | Checkpointed implementation state across tasks, reviews, validation, and handoffs |
| `afk-workflow` | AFK doctrine for specs, plans, tracking, and workflow artifact conventions |
| `afk-spline-3d-integration` | Spline 3D integration guides for React and vanilla JS |
| `afk-structured-debugging` | Root cause analysis with expected vs. actual timelines |
| `ai-companion` | Uses `skills.json` taxonomy to improve native skill discovery |
| `afk-advanced-elicitation` | Structured critique and refinement loops for improving drafts, plans, and decisions |
| `afk-ask` | Gets a second opinion through Kiro/OpenCode, Codex, or Agy and saves the result as an artifact |
| `afk-brainstorming-facilitator` | Runs guided brainstorming sessions with technique selection, divergence, and synthesis |
| `afk-deep-interview` | High-rigor, Socratic clarification mode for turning vague requests into execution-ready briefs |
| `afk-coding-tradeoffs` | Focused discussion of UX and implementation trade-offs inside a defined scope, with ADR-style decision artifacts |
| `afk-ui-registry-preferences` | Reference map for choosing shadcn, community registries, icons, and headless primitives |
| `afk-note` | Durable lightweight memory in a local notepad file for long sessions and handoffs |

### Spec-Driven discussion and planning skills

Several of the newer skills in this repo work together as a small toolkit for spec-driven development, especially in the messy phase before implementation when the problem is still fuzzy.

They are intentionally similar, but they are not redundant:

| Skill | Use it when | Best output |
|---|---|---|
| `afk-workflow` | The task involves PRDs, specs, RFCs, implementation plans, tracking, or workflow artifact conventions | Consistent artifact boundaries, storage defaults, and workflow framing |
| `afk-brainstorming-facilitator` | You need divergence, lots of options, or fresh directions before narrowing anything down | Idea inventory, themes, promising directions |
| `afk-deep-interview` | You want disciplined clarification before planning or execution and you're willing to be questioned one round at a time | Execution-ready brief or spec with clear boundaries |
| `afk-coding-tradeoffs` | You already know the feature or slice of work and need to lock high-leverage UX or implementation trade-offs before coding | ADR-style decision record for downstream implementation |
| `afk-execution-tracking` | You have an implementation plan and want checkpointed execution instead of one long build run | Canonical tracking file with task status, review gates, validation, and next action |
| `afk-advanced-elicitation` | You already have a draft, brief, plan, or answer and want to pressure-test or improve it | Stronger revised artifact with visible critique/refinement |
| `afk-note` | You need important context to survive interruptions, compaction, or handoffs | Durable lightweight memory |
| `afk-ask` | You want an outside perspective, alternate framing, or a second opinion from another local AI CLI | External-model artifact with summary and next steps |

### How the workflow currently maps

| Stage | AFK position |
|---|---|
| Workflow doctrine | `afk-workflow` |
| Open / clarify | `afk-brainstorming-facilitator`, `afk-deep-interview` |
| Pressure-test / decide | `afk-coding-tradeoffs`, `afk-advanced-elicitation` |
| Spec creation | Flexible for now; use a good standalone external spec skill or normal prompting when that fits |
| RFC creation | Flexible for now; create a dedicated AFK skill only if the RFC shape becomes worth standardizing |
| Implementation planning | Flexible for now; use plan modes, external planning skills, or normal prompting depending on the project |
| Execution control | `afk-execution-tracking` |
| Validation / testing | Flexible for now; use project checks directly, with `afk-structured-debugging` when something fails |
| Support | `afk-note`, `afk-ask`, `afk-documentation-authoring`, `afk-structured-debugging` |

`afk-workflow` defines the default artifact convention: `docs/<task-slug>/<task-slug>.<type>.md`, with task-specific references under `docs/<task-slug>/references/`.

### What to choose

If you're unsure which one to reach for, use this shortcut:

- "We need more ideas" -> `afk-brainstorming-facilitator`
- "We are dealing with PRDs, specs, RFCs, plans, tracking, or workflow artifacts" -> `afk-workflow`
- "We need to interrogate the request before building" -> `afk-deep-interview`
- "We know the feature, but important UX or implementation trade-offs are still fuzzy" -> `afk-coding-tradeoffs`
- "We have a plan and need checkpointed execution" -> `afk-execution-tracking`
- "We already have something written, but it needs a stronger pass" -> `afk-advanced-elicitation`
- "I don't want to lose this context later" -> `afk-note`
- "I want another model's opinion" -> `afk-ask`

### Use Only What You Need

AI Field Kit is not meant to be run as a mandatory full ceremony.

Most of the time, you will not use every discussion or planning skill in one flow. In practice, many sessions only need one or two of them:

- `afk-brainstorming-facilitator` when the idea space is still open
- `afk-deep-interview` when ambiguity is expensive and you want rigor
- `afk-coding-tradeoffs` when the scope is already known and only the UX/implementation gray areas need clarification

Use the smallest useful slice of AFK for the moment you are in.

If the work is already clear, skip straight to the later skill that matches the need. If the work is messy, start earlier. The point is guidance, not bureaucracy.

### A practical optional workflow

You do not need every step. Pick the smallest useful path for the moment you are in.

1. Start with `afk-brainstorming-facilitator` when the idea space is still wide open.
2. Use `afk-deep-interview` when intent, scope, non-goals, or decision boundaries are still expensive to get wrong.
3. Write or refine the PRD/spec with your preferred spec skill or normal prompting.
4. Use `afk-coding-tradeoffs` when a known slice still has UX, behavior, or implementation decisions to lock. It captures those decisions as ADR-style records.
5. Use `afk-advanced-elicitation` when a draft needs a stronger reasoning/refinement pass.
6. Create the implementation plan with your preferred planning tool or normal prompting.
7. Use `afk-execution-tracking` when execution needs checkpoints, resume safety, parallel coordination, review gates, or implementation notes.

Most flows only use a few of these. For example:

```text
PRD/spec -> afk-coding-tradeoffs -> implementation plan -> afk-execution-tracking
```

### Framework Pairings

AI Field Kit is intentionally compatible with other frameworks and runtimes. It shapes the work before execution; it does not need to own execution.

Useful pairings:

- **AFK + OpenAgentsControl**
  AFK shapes the work. OpenAgentsControl is then a strong next layer when you want custom agents or existing OpenAgentsControl agents to enforce approval gates, behavior rules, and subagent orchestration.

- **AFK + OpenSpec**
  AFK helps explore, clarify, and strengthen the work before you formalize it into OpenSpec artifacts. This is the strongest recommendation if you want a clean way to organize specs after discovery.

- **AFK + oh-my-codex / oh-my-openagent**
  AFK can do the human-centered planning first, then hand off to a more autonomous execution harness when you want that mode.

- **AFK + your normal prompting workflow**
  AFK can stop at the artifact stage. You can then implement manually, prompt directly, or switch to any coding agent you prefer.

If you want a practical default stack, the strongest recommendation is:

- use **AFK** for discovery, shaping, and clarification
- use **OpenSpec** to organize specs and keep the work legible over time
- use **OpenAgentsControl** when you want behavior control, approval gates, or agent/subagent workflows
- use **oh-my-openagent** when you want a more autonomous path that can take a detailed plan or PRD, talk to Prometheus, and keep moving while you step away

The clean mental model is:

- **AFK shapes the work**
- **You choose how to execute it**

### Recommended External Skills

AFK is strongest when it shapes the work first, then hands off to the best external skill or framework for the next job.

#### Optional companion skills

- **Spec Driven Development (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill spec-driven-development`  
  Write a PRD covering objectives, commands, structure, code style, testing, and boundaries before any code. This is a strong follow-up after AFK discovery and clarification.

- **Planning and Task Breakdown (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill planning-and-task-breakdown`  
  Decompose specs into small, verifiable tasks with acceptance criteria and dependency ordering.

- **Incremental Implementation (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill incremental-implementation`  
  Prefer thin vertical slices: implement, test, verify, commit, with safe defaults and rollback-friendly changes.

- **Test Driven Development (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill test-driven-development`  
  Use when you want implementation to stay anchored in tests and short feedback loops instead of broad speculative coding.

- **Code Simplification (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill code-simplification`  
  Apply Chesterton's Fence, Rule of 500, and simplification heuristics to reduce complexity without changing behavior.

- **Grill With Docs (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill grill-with-docs`  
  Stress-test a draft, ADR, or plan against the project's domain language, existing code, `CONTEXT.md`, and prior ADRs. It complements `afk-coding-tradeoffs`: use trade-offs first when decisions are fuzzy, and Grill With Docs first when domain language is fuzzy.

Other useful Agent-Skills companions include security, performance, and Chrome DevTools-focused workflows. Browse the full catalog here:
- [Agent-Skills: all 19 skills](https://github.com/addyosmani/agent-skills?tab=readme-ov-file#all-19-skills)

Or check out the [OpenSpec](https://github.com/Fission-AI/OpenSpec/) for lightweight spec-driven organization.

#### If you use OpenCode heavily

It is often worth pairing AFK with a stronger agent runtime.

If OpenCode is your main terminal, it is often worth explicitly empowering it with an agent layer that can better coordinate skills, MCPs, and longer-running execution patterns.

- **oh-my-openagent**  
  Repo: [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)  
  Good fit when you want autonomous execution with parallel agents, batteries-included orchestration, and an OpenCode setup that leans hard into skills, MCPs, and Asteroids-style tooling. The trade-off is speed over control: just do it and keep going until done.

- **OpenAgentsControl**  
  Repo: [darrenhinde/OpenAgentsControl](https://github.com/darrenhinde/OpenAgentsControl)  
  Good fit when you want plan-first execution, approval gates, incremental delivery, or your own set of agents, subagents, and rules via SystemBuilder on top of OpenCode.

Quick rule of thumb:
- **oh-my-openagent**: need autonomous execution with parallel agents; speed over control
- **OpenAgentsControl**: plan first, approve, execute incrementally, ship; better for established patterns and tighter control

For the fuller comparison that inspired this rule of thumb:
- [Discussion #116](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)

#### Honorable mentions

- **oh-my-codex**  
  Repo: [yeachan-heo/oh-my-codex](https://github.com/yeachan-heo/oh-my-codex)  
  A strong autonomous option when you specifically want that mode inside the Codex CLI, Codex App, or extension.

- **BMAD**  
  Repo: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)  
  A full 360 framework that can replace not only AFK but most of the stack above when you want one integrated system to discuss, plan, execute, and verify end to end.

- **GSD**  
  Repo: [Fission-AI/GetShitDone](https://github.com/Fission-AI/GetShitDone)  
  A lighter alternative than BMAD and less independently autonomous than oh-my-codex or oh-my-openagent, but still strong when you want a system that discusses, plans, executes, and verifies in one flow without being Codex-only.

### Practical guidance

- `afk-brainstorming-facilitator` is for divergence. Do not reach for it if you already know what you want and just need tighter requirements.
- `afk-deep-interview` is the strictest one. Use it when ambiguity is expensive.
- `afk-coding-tradeoffs` is narrower than `afk-deep-interview`. It assumes the work is already scoped enough to discuss UX and implementation trade-offs that materially change the result.
- `afk-execution-tracking` starts after an implementation plan exists. Use it when execution needs checkpoints, resume safety, or parallel coordination.
- `afk-advanced-elicitation` is not for first-pass discovery. It is best after a draft or direction already exists.
- `afk-note` and `afk-ask` are support skills. They pair well with the others but usually are not the main event.

### Supporting skills around the flow

The spec-shaping flow is the core lane, but it is not the whole story of AI Field Kit.

Several older AFK skills fit naturally around this flow as specialist companions rather than main stages:

| Skill | Where it fits |
|---|---|
| `afk-documentation-authoring` | When a brief, context doc, decision memo, or guide needs to become polished, readable documentation |
| `afk-structured-debugging` | When the real problem is a bug, failure, or investigation rather than new scoped work |
| `ai-companion` | When you want help discovering which installed skill best matches the current moment |

These are not required steps in the main flow. They are optional specialists you bring in when the work changes shape.

#### How they connect

- Use `afk-documentation-authoring` after `afk-deep-interview` or `afk-coding-tradeoffs` when the output needs to become a human-friendly document instead of a working artifact.
- Use `afk-structured-debugging` instead of the spec-shaping flow when the task is really about understanding a defect, incident, or failure timeline.
- Use `ai-companion` when you're unsure whether you need the main flow, a support skill, or something else already installed.

#### A useful mental model

Think of AI Field Kit in two layers:

- **Core flow:** shape the work before execution
- **Support layer:** polish, debug, document, or route the work more intelligently

That keeps the main flow coherent without pretending every skill belongs in the same sequence.

---

## Workflow-Style Skills

Workflow-style AFK procedures are skills for named, repeatable user journeys. Use them when the task has a clear intake, flow, checkpoints, and output.

| Skill | What it does |
|---|---|
| `afk-cinematic-landing-page-builder` | Builds a premium landing page from a fixed creative intake |
| `afk-interactive-code-review` | Reviews a PR step by step with pauses after each file |
| `afk-pr-description-generator` | Generates a structured PR description from branch diffs |
| `afk-pr-story-flow-mermaid` | Generates a Mermaid PR story flow from branch diffs |
| `afk-typecheck` | Runs `tsc`, writes a temporary typecheck report when needed, fixes issues, and asks whether to keep or delete the report |

These skills are installed through the normal skills flow with `autoInvocation: false`, so agents can see them without automatically choosing them for broad prompts.

### Global Rules Targets

The shared [`rules/AGENTS.md`](./rules/AGENTS.md) file is the source for
supported tools' global instruction hosts:

| Agent | Global rules path |
|---|---|
| Antigravity / Agy | `~/.gemini/GEMINI.md` |
| Codex | `~/.codex/AGENTS.md` |
| OpenCode | `~/.config/opencode/AGENTS.md` |
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

`mcps/mcp.json` is a single source of truth for MCP server recommendations.
AFK delegates installation to official upstream tooling instead of owning
per-agent config writers.

### How `KEY_*` placeholders work

The registry uses `KEY_STITCH`-style placeholders instead of real API keys:

1. Checks if an environment variable with that name is set
2. If not, prompts you securely to enter the value
3. Let the delegated installer write the target agent config

**Your real keys never touch the repo.** ✅

### Supported agents

| Agent | Config target |
|---|---|
| Antigravity / Agy | `~/.gemini/settings.json` |
| Codex | `~/.codex/config.toml` |
| Claude | `~/.claude/.mcp.json` |
| OpenCode | `~/.config/opencode/opencode.json` |

Use `add-mcp` or the agent's official setup flow for the actual install.

---

## Configuration

### AFK manifests

AFK setup is driven by manifests under `packages/afk/manifests/`. Use them to
define recommended rules, skills, MCPs, utilities, and presets while keeping
installation delegated to the right upstream CLI.

---

## Contributing

This kit grows with real-world use. If you've built a skill or MCP config that's made your AI workflow meaningfully better — open a PR.

**Adding a skill:**

1. Scaffold it with the CLI: `npx skills init my-skill`
2. Fill in `my-skill/SKILL.md` following the existing patterns in `skills/`
3. Open a PR with a short description of what the skill does and when to use it

For explicit multi-step procedures, add them as skills with `autoInvocation: false`
in `packages/afk/manifests/skills.json`.

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
        "antigravity": { "name": "my-server" },
        "codex": { "name": "my-server", "enabled": true }
      }
    }
  }
}
```

---

## Common Issues

**Skills not discovered by my agent** — Make sure the skill lives at `~/.agents/skills/<name>/SKILL.md` and that your agent is configured to read from `~/.agents/skills/`.

**`KEY_*` placeholder error** — Export the env var before running the delegated installer, or let that installer prompt when supported.

---

## Agents Supported

AFK-owned rules currently target a focused v1 set. Skills and MCP installation
are delegated to the official CLIs, so broader tool support can come from those
projects without AFK reimplementing their installers.

| Agent | Rules | MCP delegation |
|---|---|---|
| Codex | ✅ | via `add-mcp` |
| Claude Code | ✅ | via `add-mcp` |
| Antigravity / Agy | ✅ | via `add-mcp` |
| OpenCode | ✅ | via `add-mcp` |

---

## Acknowledgements

AI Field Kit is heavily inspired by the open-source AI coding community and the people publishing their methods in public. This repo is its own opinionated kit, but it has learned a lot from these projects:

- [OpenSpec](https://github.com/Fission-AI/OpenSpec/)
- [OpenAgentsControl](https://github.com/darrenhinde/OpenAgentsControl)
- [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)
- [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)
- [Get Shit Done](https://github.com/gsd-build/get-shit-done?tab=readme-ov-file)
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [agent-skills](https://github.com/addyosmani/agent-skills)

Thanks to the maintainers and contributors behind those repos for sharing ideas, workflows, and techniques in the open. AI Field Kit borrows selectively, adapts heavily, and tries to stay honest about that lineage.

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
