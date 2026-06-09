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
  - [AFK CLI](#afk-cli--full-setup)
  - [AFK manifests through the shadcn registry](#afk-manifests-through-the-shadcn-registry)
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
| `registry.json` | shadcn-compatible registry entrypoint for installing AFK manifest bundles |
| `packages/afk/` | Local AFK CLI package for guided setup and setup dry-runs |
| `apps/site/` | React/Vite marketing and docs site for AI Field Kit |

---

## Quick Start

### Just the skills — 30 seconds

No clone needed. Install directly from GitHub using the [`skills` CLI](https://skills.sh/):

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

The interactive mode lets you pick which skills to install. Agent-specific
support is handled by the official `skills` CLI.

### AFK CLI — full setup

If you want the complete stack, use the AFK CLI. It is the setup router for
rules, skills, MCPs, utilities, hooks, dry-runs, and team-specific manifests.

```bash
npm install -g @logbookfordevs/afk
afk setup --dry-run
```

Start with `--dry-run`: AFK prints the exact actions it would take before it
writes to your machine. The CLI owns AFK rule and hook setup, then delegates
skills, MCPs, and utilities to the official tools or installer scripts that
already own those ecosystems.

For the full command reference, flags, manifest format, local-development
install flow, and custom defaults workflow, read the
[AFK CLI README](./packages/afk/README.md).

### AFK manifests through the shadcn registry

AI Field Kit also publishes its default AFK manifests as a shadcn-compatible
registry item. Use this when you want to commit the current AFK defaults into a
project before running project-local setup:

```bash
pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-manifests
// or npx shadcn@latest add logbookfordevs/ai-field-kit/afk-manifests
afk setup --local --dry-run
```

The registry item writes the same fragmented manifest files AFK already reads
under `./afk/manifests/`. shadcn handles distribution; AFK still owns setup
semantics such as defaults, scopes, managed rules, hooks, utilities, and
delegated skill/MCP installers.

If you want to work from source, clone the repo and run the package directly:

```bash
git clone https://github.com/logbookfordevs/ai-field-kit.git
cd ai-field-kit
pnpm --dir packages/afk install
pnpm --dir packages/afk run build
node packages/afk/dist/index.js setup --dry-run
```

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

If you only want the AFK skill-routing entry point, install `afk-compass` directly:

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit --skill afk-compass
```

This skill lives in the repository under [`skills/afk-compass/`](./skills/afk-compass/) and routes broad or ambiguous requests to the right AFK and recommended external skills. When you ask for an AFK workflow, feature workflow, or AFK run, Compass treats the work as phase-managed orchestration and re-checks routing as the work moves from sources to specs, plans, and execution.

> **What does global vs. agent-specific mean?**
> Global installs (`--global`) place the skill in `~/.agents/skills/` and make it available to every agent that reads from there.
> Agent-specific installs target a single tool's config directory directly.

### Available skills

| Skill | What it unlocks |
|---|---|
| `afk-animated-driven-frontend` | Motion choreography, microinteractions, cinematic UI |
| `afk-doc-craft` | Reader-first documentation craft: journeys, progressive disclosure, real empathy |
| `afk-execution-tracking` | Checkpointed implementation state across tasks, reviews, validation, and handoffs |
| `afk-artifact-workflow` | AFK artifact workflow for specs, plans, tracking, and artifact conventions |
| `afk-structured-debugging` | Root cause analysis with expected vs. actual timelines |
| `afk-compass` | Routes work to the right AFK and recommended external skills |
| `afk-advanced-elicitation` | Structured critique and refinement loops for improving drafts, plans, and decisions |
| `afk-ask` | Gets a second opinion from another local AI CLI and saves the result as an artifact |
| `afk-brainstorming-facilitator` | Runs guided brainstorming sessions with technique selection, divergence, and synthesis |
| `afk-coding-tradeoffs` | Focused discussion of UX and implementation trade-offs inside a defined scope, with ADR-style decision artifacts |
| `afk-ui-registry-preferences` | Reference map for choosing shadcn, community registries, icons, and headless primitives |
| `afk-pickup` | Explicitly resumes from disposable handoff notes saved in the OS temp directory |

### Spec-Driven discussion and planning skills

Several of the newer skills in this repo work together as a small toolkit for spec-driven development, especially in the messy phase before implementation when the problem is still fuzzy.

They are intentionally similar, but they are not redundant:

| Skill | Use it when | Best output |
|---|---|---|
| `afk-artifact-workflow` | The task involves PRDs, specs, RFCs, implementation plans, tracking, handoff notes, source references, or artifact conventions | Consistent artifact boundaries, storage defaults, and next-artifact suggestions |
| `afk-brainstorming-facilitator` | You need divergence, lots of options, or fresh directions before narrowing anything down | Idea inventory, themes, promising directions |
| `afk-coding-tradeoffs` | You already know the feature or slice of work and need to lock high-leverage UX or implementation trade-offs before coding | ADR-style decision record for downstream implementation |
| `afk-execution-tracking` | You have an implementation plan and want checkpointed execution instead of one long build run | Canonical tracking file with task status, review gates, validation, and next action |
| `afk-advanced-elicitation` | You already have a draft, brief, plan, or answer and want to pressure-test or improve it | Stronger revised artifact with visible critique/refinement |
| `afk-pickup` | A previous session wrote a disposable handoff and this session needs to find and resume it | Verified pickup summary with live references and next action |
| `afk-ask` | You want an outside perspective, alternate framing, or a second opinion from another local AI CLI | External-model artifact with summary and next steps |

### How the workflow currently maps

| Stage | AFK position |
|---|---|
| Artifact workflow | `afk-artifact-workflow` |
| Open / clarify | `afk-brainstorming-facilitator` |
| Pressure-test / decide | `grill-me`, `afk-coding-tradeoffs`, `afk-advanced-elicitation` |
| Spec creation | Flexible for now; use a good standalone external spec skill or normal prompting when that fits |
| RFC creation | Flexible for now; create a dedicated AFK skill only if the RFC shape becomes worth standardizing |
| Implementation planning | Flexible for now; use plan modes, external planning skills, or normal prompting depending on the project |
| Execution control | `afk-execution-tracking` |
| Validation / testing | Flexible for now; use project checks directly, with `afk-structured-debugging` when something fails |
| Support | `afk-pickup`, `afk-ask`, `afk-doc-craft`, `afk-structured-debugging` |

`afk-artifact-workflow` defines the default artifact convention: `docs/<task-slug>/<task-slug>.<type>.md`, with task-specific references under `docs/<task-slug>/references/`.

### What to choose

If you're unsure which one to reach for, use this shortcut:

- "We need more ideas" -> `afk-brainstorming-facilitator`
- "We are dealing with PRDs, specs, RFCs, plans, tracking, or workflow artifacts" -> `afk-artifact-workflow`
- "Grill me on this plan/design before we commit" -> `grill-me`
- "We know the feature, but important UX or implementation trade-offs are still fuzzy" -> `afk-coding-tradeoffs`
- "We have a plan and need checkpointed execution" -> `afk-execution-tracking`
- "We already have something written, but it needs a stronger pass" -> `afk-advanced-elicitation`
- "A previous agent left a temp handoff for this session" -> `afk-pickup`
- "I want another model's opinion" -> `afk-ask`

### Use Only What You Need

AI Field Kit is not meant to be run as a mandatory full ceremony.

Most of the time, you will not use every discussion or planning skill in one flow. In practice, many sessions only need one or two of them:

- `afk-brainstorming-facilitator` when the idea space is still open
- `afk-coding-tradeoffs` when the scope is already known and only the UX/implementation gray areas need clarification

Use the smallest useful slice of AFK for the moment you are in.

If the work is already clear, skip straight to the later skill that matches the need. If the work is messy, start earlier. The point is guidance, not bureaucracy.

When you ask for an AFK workflow, feature workflow, or AFK run, Compass uses a stronger orchestration mode: it routes each phase, asks before tracked execution when tracking is optional, defaults to TDD for software behavior changes, and still avoids workflow artifacts unless `afk-artifact-workflow` is the right skill for that phase.

### A practical optional workflow

You do not need every step. Pick the smallest useful path for the moment you are in.

1. Start with `afk-brainstorming-facilitator` when the idea space is still wide open.
2. Use `grill-me` when a plan or design needs relentless questioning before you commit.
3. Use `afk-artifact-workflow` when source material, references, PRDs, specs, plans, tracking, or handoff artifacts need consistent boundaries.
4. Write or refine the PRD/spec with `spec-driven-development`, another preferred spec skill, or normal prompting.
5. Use `grill-with-docs` before drafting the PRD/spec only when domain language is already risky. Otherwise use it after a draft to pressure-test terminology, code/docs consistency, and decisions before planning.
6. Use `afk-coding-tradeoffs` when a known slice still has UX, behavior, or implementation decisions to lock. It captures those decisions as ADR-style records.
7. Use `afk-advanced-elicitation` when a draft needs a stronger reasoning/refinement pass.
8. Create the implementation plan with your preferred planning tool or normal prompting.
9. Use `afk-execution-tracking` when execution needs checkpoints, resume safety, parallel coordination, review gates, or implementation notes.
10. Default to `test-driven-development` for software behavior changes. Skip only when there is no meaningful behavior risk, or when literal test-first is impractical and another proof mechanism is named first.
11. Use `incremental-implementation` for multi-file, large, risky, or task-breakdown-driven execution. Skip it for minimal single-file or single-function changes.

Most flows only use a few of these. For example:

```text
references -> PRD/spec -> grill-with-docs -> implementation plan -> tracking when needed -> TDD for behavior changes -> incremental execution when warranted
```

### Framework Pairings

AI Field Kit is intentionally compatible with other frameworks and runtimes. It shapes the work before execution; it does not need to own execution.

Useful pairings:

- **AFK + OpenSpec**
  AFK helps explore, clarify, and strengthen the work before you formalize it into OpenSpec artifacts. This is the strongest recommendation if you want a clean way to organize specs after discovery.

- **AFK + oh-my-codex / oh-my-openagent**
  AFK can do the human-centered planning first, then hand off to a more autonomous execution harness when you want that mode.

- **AFK + your normal prompting workflow**
  AFK can stop at the artifact stage. You can then implement manually, prompt directly, or switch to any coding agent you prefer.

If you want a practical default stack, the strongest recommendation is:

- use **AFK** for discovery, shaping, and clarification
- use **OpenSpec** to organize specs and keep the work legible over time

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

- **Write a Skill (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill write-a-skill`  
  Use when you are creating or refining a skill and want the small, composable style: clear trigger metadata, concise `SKILL.md`, one-level references, and scripts only when they reduce repeated fragile work. This pairs well with AFK because it keeps new skills sharp instead of turning every preference into a framework.

- **Grill With Docs (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill grill-with-docs`  
  Stress-test a draft, ADR, or plan against the project's domain language, existing code, `CONTEXT.md`, and prior ADRs. Use it before drafting the PRD/spec only when domain language or documented decisions are already risky; otherwise draft first, then grill before implementation planning. It complements `afk-coding-tradeoffs`: use trade-offs first when decisions are fuzzy, and Grill With Docs when domain language or code/docs consistency is fuzzy.

- **Grill Me (Matt Pocock Skills)**
  Install: `npx skills add https://github.com/mattpocock/skills --skill grill-me`
  Use when you want relentless one-question-at-a-time pressure on a plan or design. It walks the decision tree, recommends answers, and inspects the codebase instead of asking questions the agent can answer directly.

- **To Issues (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill to-issues`  
  Use when you explicitly want to turn a shaped PRD/spec or implementation plan into thin, independently grabbable issue-tracker slices. For one-off use, provide the tracker and label context in the prompt.

- **Setup Matt Pocock Skills (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill setup-matt-pocock-skills`  
  Run once per repo when Matt's issue-tracker skills need stored context about where issues live, which triage labels to use, and where domain docs or ADRs are stored. This supports repeated `to-issues` use without making setup scaffolding part of the default workflow.

- **Prototype (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill prototype`  
  Use when a decision needs a throwaway artifact before production work: a tiny terminal prototype for state or business logic, or several UI variations on one route for front-end direction. This can pair with Impeccable for FE work when you want quick prototype learning without opening a separate design tool.

- **Handoff (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill handoff`  
  Create a compact handoff document for a fresh agent when a session needs to continue elsewhere. It saves outside the workspace on purpose, keeping the note disposable. Pair it with `afk-pickup` in the next session to search temp locations, verify referenced paths, and resume from the right handoff.

- **Impeccable**  
  Install: `npx impeccable skills install`  
  Recommended for front-end design phases before and during implementation: shaping visual direction in specs, improving UI execution, auditing design quality, catching AI-slop patterns, and iterating against the real product context. AFK exposes Impeccable through Utilities and delegates to its installer.

- **cmux**  
  Install: `npx skills add https://github.com/manaflow-ai/cmux --skill cmux`  
  Use when you are working inside a cmux terminal and need deterministic control of windows, workspaces, panes, surfaces, focus, routing, and visual attention cues for parallel agent orchestration.

- **tmux (steipete/clawdis)**  
  Install: `npx skills add https://github.com/steipete/clawdis --skill tmux`  
  Use when parallel agents or long-running interactive CLI sessions live in tmux. It helps send keystrokes, inspect pane output, and monitor sessions that continue across disconnects.

Other useful Agent-Skills companions include security, performance, and Chrome DevTools-focused workflows. Browse the full catalog here:
- [Agent-Skills: all 19 skills](https://github.com/addyosmani/agent-skills?tab=readme-ov-file#all-19-skills)

Or check out the [OpenSpec](https://github.com/Fission-AI/OpenSpec/) for lightweight spec-driven organization.

If more recommended skills require official installers instead of `npx skills add`, revisit whether `skills.json` should support per-skill installer overrides.

#### Honorable mentions

- **oh-my-codex**  
  Repo: [yeachan-heo/oh-my-codex](https://github.com/yeachan-heo/oh-my-codex)  
  A strong autonomous option when you specifically want that mode inside the Codex CLI, Codex App, or extension.

- **BMAD**  
  Repo: [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)  
  A full 360 framework that can replace not only AFK but most of the stack above when you want one integrated system to discuss, plan, execute, and verify end to end.

- **GSD**  
  Repo: [Fission-AI/GetShitDone](https://github.com/Fission-AI/GetShitDone)  
  A lighter alternative than BMAD, but still strong when you want a system that discusses, plans, executes, and verifies in one flow.

### Practical guidance

- `afk-brainstorming-facilitator` is for divergence. Do not reach for it if you already know what you want and just need tighter requirements.
- `grill-me` pressures the plan or design through one-question-at-a-time interrogation.
- `afk-coding-tradeoffs` assumes the work is already scoped enough to lock UX and implementation trade-offs that materially change the result.
- `afk-execution-tracking` starts after an implementation plan exists. Use it when execution needs checkpoints, resume safety, or parallel coordination.
- `afk-advanced-elicitation` is not for first-pass discovery. It is best after a draft or direction already exists.
- `afk-pickup` and `afk-ask` are support skills. They pair well with the others but usually are not the main event.

### Supporting skills around the flow

The spec-shaping flow is the core lane, but it is not the whole story of AI Field Kit.

Several AFK support skills fit naturally around this flow as specialist companions rather than main stages:

| Skill | Where it fits |
|---|---|
| `afk-doc-craft` | When a brief, context doc, decision memo, or guide needs to become polished, readable documentation |
| `afk-structured-debugging` | When the real problem is a bug, failure, or investigation rather than new scoped work |
| `afk-compass` | When you want help choosing which AFK or companion skill best matches the current moment |
| `afk-pickup` | When a previous session created a disposable temp handoff and the new session needs to find it |

These are not required steps in the main flow. They are optional specialists you bring in when the work changes shape.

#### How they connect

- Use `afk-doc-craft` after brainstorming, trade-offs, or another shaping pass when the output needs to become a human-friendly document instead of a working artifact.
- Use `afk-structured-debugging` instead of the spec-shaping flow when the task is really about understanding a defect, incident, or failure timeline.
- Use `afk-compass` when you're unsure whether you need the main flow, a support skill, or a recommended external companion skill.
- Use `afk-pickup` after the external `handoff` skill when the previous session kept its handoff note disposable in the OS temp directory.

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
| `afk-interactive-code-review` | Reviews a PR step by step with pauses after each file |
| `afk-pr-description-generator` | Generates a structured PR description from branch diffs |
| `afk-pr-story-flow-mermaid` | Generates a Mermaid PR story flow from branch diffs |
| `afk-typecheck` | Runs `tsc`, writes a temporary typecheck report when needed, fixes issues, and asks whether to keep or delete the report |
| `afk-deep-interview` | Runs a structured interview with follow-up questions based on the initial answer |

These skills are installed through the normal skills flow. Use `autoInvocation: false` only for slash-only or attached-only procedures that should stay hidden from normal model discovery.

### Global Rules Targets

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

For explicit multi-step procedures, use `autoInvocation: true` when normal language should discover the skill, and reserve `autoInvocation: false` for slash-only or attached-only procedures.

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
- [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)
- [Get Shit Done](https://github.com/gsd-build/get-shit-done?tab=readme-ov-file)
- [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [agent-skills](https://github.com/addyosmani/agent-skills)
- [matt-pocock](https://github.com/mattpocock/skills)

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
