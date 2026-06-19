# 🧭 AI Field Kit — by Logbook for Devs

> *The rules, skills, setup catalog, and router powering a DX-first AI developer workflow.*

A curated, version-controlled collection for making AI coding agents useful in a real development environment.

AI Field Kit treats frameworks like BMAD, Get Shit Done, Agent OS, Superpowers, and agent skills as reference material, not masters. The kit is a personal synthesis of patterns that keep proving useful in real work: standalone skills when you only need one tool, and an optional workflow when you want the pieces to move together.

For the skill composition mental model, open the visual companion:
[Skill Composition Studio](https://tot.page/mhPWYwLnjw_yGzIs8FQOXg).

Repository history is tracked in [`CHANGELOG.md`](./CHANGELOG.md) using dated entries instead of release versions.

---

## Index

- [What's in the Kit](#whats-in-the-kit)
- [Quick Start](#quick-start)
  - [AFK CLI](#afk-cli--full-setup)
  - [Authored skills only](#authored-skills-only--30-seconds)
  - [AFK catalog through the shadcn registry](#afk-catalog-through-the-shadcn-registry)
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
| `registry.json` | shadcn-compatible registry entrypoint for installing AFK catalog bundles |
| `packages/afk/` | Local AFK CLI package for guided setup and setup dry-runs |
| `apps/site/` | React/Vite marketing and docs site for AI Field Kit |

---

## Quick Start

### AFK CLI — full setup

Start with AFK. It is the setup router for rules, skills, MCPs, plugins, hooks,
catalog composition, dry-runs, and team-specific catalogs.

```bash
npx @logbookfordevs/afk setup --dry-run
```

Use `npx` for the first run, a one-off setup, or trying AFK without adding a
global command to your machine. When AFK becomes part of your daily agent setup,
install the CLI from the latest GitHub release so the field-kit commands are
always available:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash

afk setup --dry-run
afk refresh
afk show skills --react
afk show skills --visualize
```

Start with `--dry-run`: AFK prints the exact actions it would take before it
writes to your machine. The CLI owns AFK rule and hook setup, then delegates
skills, MCPs, and plugins to the official tools or installer scripts that
already own those ecosystems.

Plugins are recommended for the full experience: some AFK skills mention,
delegate to, or become much more useful with companion plugin capabilities such
as Plannotator, GoalBuddy, or Impeccable installed.

For the full command reference, flags, catalog format, local-development
install flow, and custom defaults workflow, read the
[AFK CLI README](./packages/afk/README.md).

### Authored skills only — 30 seconds

If you only want the AFK-authored skill files, install directly from GitHub using
the [`skills` CLI](https://skills.sh/):

```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```

This is the lightest path, but it is not the full AFK experience: it installs
skills from this repository only. It does not apply AFK rules, hooks, MCPs,
plugins, catalog composition, or setup policy.

### AFK catalog through the shadcn registry

AI Field Kit also publishes its default AFK catalog as a shadcn-compatible
registry item. Use this when you want to commit the current AFK defaults into a
project before running project-local setup:

```bash
pnpm dlx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog
// or npx shadcn@latest add logbookfordevs/ai-field-kit/afk-catalog
afk setup --local --dry-run
```

The registry item writes the same fragmented catalog files AFK already reads
under `./afk/catalog/`. shadcn handles distribution; AFK still owns setup
semantics such as defaults, scopes, managed rules, hooks, plugins, and
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

### Installing skills

Use AFK for the full skills experience:

```bash
npx @logbookfordevs/afk setup
```

Install the CLI globally when you want AFK to become a regular machine command
for setup, refresh, catalog import, and skill inspection:

```bash
curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash
afk setup
afk refresh
afk show skills
```

Use `npx skills add` only when you specifically want the authored skills from
this repository and do not need AFK rules, hooks, MCPs, plugins, or
catalog-aware companion installs. AFK delegates to that ecosystem during full
setup, then adds the surrounding AFK setup pieces and recommended companion
plugins.

### Available skills

| Skill | What it unlocks |
|---|---|
| `afk-animated-driven-frontend` | Motion choreography, microinteractions, cinematic UI |
| `afk-doc-craft` | Reader-first documentation craft: journeys, progressive disclosure, real empathy |
| `afk-execution-tracking` | Checkpointed implementation state across tasks, reviews, validation, and handoffs |
| `afk-compass` | Routes work to the right AFK and recommended external skills |
| `afk-sprint` | Fast goal execution with Plannotator, native `/goal`, and Markdown checkpoint tracking |
| `afk-turbo` | High-throughput goal execution with Plannotator and GoalBuddy's live board |
| `afk-ask` | Gets a second opinion from another local AI CLI and saves the result as an artifact |
| `afk-delegate` | Assigns work to another local agent and supervises it through live or background terminal lanes |
| `afk-brainstorming-facilitator` | Runs guided brainstorming sessions with technique selection, divergence, and synthesis |
| `afk-code-grill` | Grill-style pressure on UX and implementation choices inside a defined coding scope |
| `afk-to-prd-spec` | Turns grilled context, PM PRDs, or feature notes into an agent-ready PRD/spec |
| `afk-to-issues` | Turns PRDs, plans, goal packages, or tracker issues into executable checkpoint packets |
| `afk-ui-registry-preferences` | Reference map for choosing shadcn, community registries, icons, and headless primitives |
| `afk-pickup` | Explicitly resumes from disposable handoff notes saved in the OS temp directory |

### Spec-Driven discussion and planning skills

Several of the newer skills in this repo work together as a small toolkit for spec-driven development, especially in the messy phase before implementation when the problem is still fuzzy.

They are intentionally similar, but they are not redundant:

| Skill | Use it when | Best output |
|---|---|---|
| `afk-brainstorming-facilitator` | You need divergence, lots of options, or fresh directions before narrowing anything down | Idea inventory, themes, promising directions |
| `afk-code-grill` | You already know the feature or slice of work and need to lock high-leverage UX or implementation trade-offs before coding | Tiny decision note or ADR only when the decision deserves one |
| `afk-to-prd-spec` | You need to create or normalize a PRD/spec after Grill or Grill With Docs | Agent-ready PRD/spec with behavior, acceptance criteria, implementation decisions, and testing seams |
| `afk-to-issues` | You have a PRD/spec, plan, goal package, tracker issue, or rough context that needs executable slices | Local AFK checkpoint packets, external tracker issues, or both |
| `afk-execution-tracking` | You have checkpoint packets and want checkpointed execution, including resume, instead of one long build run | Updated checkpoint packets with status, review gates, validation, implementation notes, and handoff notes |
| `afk-pickup` | A previous session wrote a disposable handoff and this session needs to find and resume it | Verified pickup summary with live references and next action |
| `afk-ask` | You want an outside perspective, alternate framing, or a second opinion from another local AI CLI | External-model artifact with summary and next steps |
| `afk-delegate` | You want another local agent to do work while AFK supervises the terminal run | Live or background delegated agent run with status based on terminal evidence |

### How the workflow currently maps

| Stage | AFK position |
|---|---|
| Artifact conventions | `afk-compass/references/artifacts.md` |
| Open / clarify | `afk-brainstorming-facilitator` |
| Pressure-test / decide | `grill-me`, `afk-code-grill` |
| PRD/spec creation | `afk-to-prd-spec` |
| RFC creation | Flexible for now; create a dedicated AFK skill only if the RFC shape becomes worth standardizing |
| Executable slicing | `afk-to-issues` |
| Execution control | `afk-execution-tracking` plus the selected execution bundle; use its resume mode after context resets |
| Validation / testing | Flexible for now; use project checks directly, with `diagnosing-bugs` when something fails |
| Support | `afk-pickup`, `afk-ask`, `afk-delegate`, `afk-doc-craft`, `diagnosing-bugs` |

Compass defines the default artifact convention in `skills/afk-compass/references/artifacts.md`: `docs/<task-slug>/<task-slug>.<type>.md`, with checkpoint packets under `docs/<task-slug>/tracking/` and task-specific references under `docs/<task-slug>/references/`.

### What to choose

If you're unsure which one to reach for, use this shortcut:

- "We need more ideas" -> `afk-brainstorming-facilitator`
- "Run AFK Sprint" -> `afk-sprint`
- "Run AFK Turbo" -> `afk-turbo`
- "Run AFK Turbo with human review gates" -> `afk-turbo` review-gated mode
- "We need AFK artifact boundaries or storage conventions" -> `afk-compass`
- "We need to create or normalize a PRD/spec after grilling" -> `afk-to-prd-spec`
- "We need to split this into executable slices/checkpoints" -> `afk-to-issues`
- "Grill me on this plan/design before we commit" -> `grill-me`
- "We know the feature, but important UX or implementation trade-offs are still fuzzy" -> `afk-code-grill`
- "We have checkpoint packets and need tracked execution or resume" -> `afk-execution-tracking`
- "Continue AFK Turbo from repo artifacts" -> `afk-turbo` resume mode
- "A previous agent left a temp handoff for this session" -> `afk-pickup`
- "I want another model's opinion" -> `afk-ask`
- "I want another local agent to do this work" -> `afk-delegate`

### Use Only What You Need

AI Field Kit is not meant to be run as a mandatory full ceremony.

Most of the time, you will not use every discussion or planning skill in one flow. In practice, many sessions only need one or two of them:

- `afk-brainstorming-facilitator` when the idea space is still open
- `afk-code-grill` when the scope is already known and only the UX/implementation gray areas need clarification

Use the smallest useful slice of AFK for the moment you are in.

If the work is already clear, skip straight to the later skill that matches the need. If the work is messy, start earlier. The point is guidance, not bureaucracy.

When you ask for an AFK workflow, feature workflow, or AFK run, Compass should help select the next useful skill for the current phase. It should not force the whole sequence below.

### Recommended AFK Workflow

AFK Workflow is a human-facing recommendation, not a required agent pipeline. Use the pieces that fit the work.

1. Start with `afk-brainstorming-facilitator` when the idea space is still wide open.
2. Use `grill-me` when a plan or design needs relentless questioning before you commit.
3. Use `grill-me` for greenfield work or `grill-with-docs` for brownfield work before PRD/spec creation.
4. Write or refine the PRD/spec with `afk-to-prd-spec`.
5. Use `afk-code-grill` when a known slice still has UX, behavior, or implementation decisions to lock. It asks one sharp trade-off question at a time.
6. Create executable slices with `afk-to-issues`. It turns the PRD/spec, plan, goal package, tracker issue, or current context into AFK checkpoint packets.
7. Use `afk-execution-tracking` when execution needs status, resume safety, parallel coordination, review gates, or checkpointed implementation notes.
8. Select the execution bundle for each task: use `tdd` for behavior changes, `source-driven-development` for framework/library/API correctness, and `doubt-driven-development` for risky non-trivial decisions.
9. When tracking is active, record the selected execution bundle and evidence before the checkpoint moves to review.

Most workflows only use a few of these. For example:

```text
references -> grill-me/grill-with-docs -> PRD/spec -> checkpoint packets -> tracked execution -> execution bundle evidence before review
```

If you want a practical default stack, the strongest recommendation is:

- use **AFK** for discovery, shaping, and clarification
- use **Truss** as the always-available decision-quality lens

The clean mental model is:

- **AFK shapes the work**
- **Truss improves decision quality**
- **You choose how to execute it**

### Recommended External Skills

AFK is strongest when it shapes the work first, then hands off to the best external skill or framework for the next job.

#### Baseline recommendation

- **Truss Evaluation (Truss Framework)**
  Install: `npx skills add https://github.com/leoreisdias/truss-framework --skill truss-evaluation`

  Keep this available as a decision-quality lens across normal prompting, free routing, AFK Workflow, code review, debugging, and architecture discussion. It is not a workflow phase; it is the layer to reach for when the work needs explicit trade-offs, structured critique, or a grounded answer to "which approach is better?" Truss evaluates decisions through Maintainability, Strategy, Clarity, and Performance, with a research whitepaper in progress behind the framework.

#### Optional companion skills

- **TDD (Matt Pocock Skills)**
  Install: `npx skills add https://github.com/mattpocock/skills --skill tdd`
  Use when you want red-green-refactor on behavior through public interfaces, one vertical slice at a time, without testing implementation details for their own sake. Matt's current `tdd` skill now leans on `codebase-design`, so install that too when you use it from the Matt catalog.

- **Diagnosing Bugs (Matt Pocock Skills)**
  Install: `npx skills add https://github.com/mattpocock/skills --skill diagnosing-bugs`
  Use when something is broken, throwing, failing, or regressing. It prioritizes a tight deterministic feedback loop before hypotheses, instrumentation, fixes, and regression tests.

- **Source Driven Development (Agent-Skills)**
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill source-driven-development`
  Use when implementation correctness depends on current framework, library, SDK, API, or platform documentation.

- **Doubt Driven Development (Agent-Skills)**
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill doubt-driven-development`
  Use when a non-trivial decision needs fresh-context adversarial review before it reaches the human review gate.

- **Code Simplification (Agent-Skills)**  
  Install: `npx skills add https://github.com/addyosmani/agent-skills.git --skill code-simplification`  
  Apply Chesterton's Fence, Rule of 500, and simplification heuristics to reduce complexity without changing behavior.

- **Writing Great Skills (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill writing-great-skills`  
  Use when you are creating or refining a skill and want predictable invocation, clear trigger metadata, concise `SKILL.md`, carefully disclosed references, and aggressive pruning of no-op prose. This pairs well with AFK because it keeps new skills sharp instead of turning every preference into a framework.

- **Grill With Docs (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill grill-with-docs`  
  Stress-test a draft, ADR, or plan against the project's domain language, existing code, `CONTEXT.md`, and prior ADRs. In AFK Workflow, use it for brownfield work before PRD/spec creation and before executable slicing. It complements `afk-code-grill`: use code grill when implementation decisions are fuzzy, and Grill With Docs when domain language or code/docs consistency is fuzzy. Matt's current version relies on `codebase-design` and `domain-modeling`, so install those alongside it.

- **Grill Me (Matt Pocock Skills)**
  Install: `npx skills add https://github.com/mattpocock/skills --skill grill-me`
  Use when you want relentless one-question-at-a-time pressure on a plan or design. It walks the decision tree, recommends answers, and inspects the codebase instead of asking questions the agent can answer directly.

- **Prototype (Matt Pocock Skills)**
  Install: `npx skills add https://github.com/mattpocock/skills --skill prototype`
  Use when a decision needs a throwaway artifact before production work: a tiny terminal prototype for state or business logic, or several UI variations on one route for front-end direction. This can pair with Impeccable for FE work when you want quick prototype learning without opening a separate design tool.

- **Effective HTML (Plannotator)**
  Install: `npx skills add https://github.com/plannotator/effective-html --skill html`
  Install plan skill: `npx skills add https://github.com/plannotator/effective-html --skill html-plan`
  Install diagram skill: `npx skills add https://github.com/plannotator/effective-html --skill html-diagram`
  Use when the best deliverable is a self-contained HTML artifact: an explainer, report, comparison, prototype, plan page, or architecture diagram. The `html-plan` and `html-diagram` variants keep the output focused when the user explicitly wants a plan or visual system map.

- **GoalBuddy**
  Install: `npx goalbuddy`
  Recommended for high-throughput AFK Turbo work that needs a local live board, PM loop, role-tagged task execution, receipts, and proof pressure around broad goals. AFK exposes GoalBuddy through Plugins and delegates to its installer.

AFK's fast execution packages are:

- **AFK Workflow**: recommended human-facing composition with optional checkpoint packets and execution tracking.
- **AFK Sprint**: `afk-sprint`, a Plannotator goal package plus AFK checkpoint packets, native `/goal`, and execution tracking.
- **AFK Turbo**: `afk-turbo`, an optional grilling pass, a Plannotator goal package, and GoalBuddy's local live board and PM loop. Turbo writes a deterministic `goal-launch.html` beside `goal.md` and waits for an explicit launch trigger before execution. Ask for review-gated Turbo when each code-changing task should stage changes and pause for human review before task completion; ask for Turbo resume when prior goal packages or handoffs should seed a fresh focused goal.

| Ask for | Use |
|---|---|
| Run Turbo normally | `afk-turbo` |
| Run Turbo with human review gates | `afk-turbo` review-gated mode |
| Resume prior Turbo work | `afk-turbo` resume mode |
| Run checkpointed execution | `afk-execution-tracking` |
| Resume checkpointed execution | `afk-execution-tracking` resume mode |

- **Handoff (Matt Pocock Skills)**  
  Install: `npx skills add https://github.com/mattpocock/skills --skill handoff`  
  Create a compact handoff document for a fresh agent when a session needs to continue elsewhere. It saves outside the workspace on purpose, keeping the note disposable. Pair it with `afk-pickup` in the next session to search temp locations, verify referenced paths, and resume from the right handoff.

- **Impeccable**
  Install: `npx impeccable install --global`
  Recommended for front-end design phases before and during implementation: shaping visual direction in specs, improving UI execution, auditing design quality, catching AI-slop patterns, and iterating against the real product context. AFK exposes Impeccable through Plugins and delegates to its installer, including Impeccable's design hook.

- **AFK Delegate**
  Use `afk-delegate` when another local agent should do work, not merely advise. It uses cmux as the default live/shared-control lane and tmux as the default background lane.

Other useful Agent-Skills companions include security, performance, and Chrome DevTools-focused workflows. Browse the full catalog here:
- [Agent-Skills: all 19 skills](https://github.com/addyosmani/agent-skills?tab=readme-ov-file#all-19-skills)

Installer-based companions belong in Plugins. Keep `skills.json` focused on skills installed through `npx skills add`.

### Practical guidance

- `afk-brainstorming-facilitator` is for divergence. Do not reach for it if you already know what you want and just need tighter requirements.
- `grill-me` pressures the plan or design through one-question-at-a-time interrogation.
- `afk-code-grill` is Grill for code decisions: one meaningful trade-off at a time, with a recommendation when the evidence is enough.
- `afk-to-issues` replaces one-file implementation planning with executable checkpoint packets.
- `afk-execution-tracking` starts after checkpoint packets exist. Use it when execution needs status, resume safety, review gates, or parallel coordination.
- `afk-pickup`, `afk-ask`, and `afk-delegate` are support skills. They pair well with the others but usually are not the main event.

### Supporting skills around the workflow

The spec-shaping workflow is the core lane, but it is not the whole story of AI Field Kit.

Several AFK support skills fit naturally around this workflow as specialist companions rather than main stages:

| Skill | Where it fits |
|---|---|
| `afk-doc-craft` | When a brief, context doc, decision memo, or guide needs to become polished, readable documentation |
| `diagnosing-bugs` | When the real problem is a bug, failure, or investigation rather than new scoped work |
| `afk-compass` | When you want help choosing which AFK or companion skill best matches the current moment |
| `afk-pickup` | When a previous session created a disposable temp handoff and the new session needs to find it |

These are not required steps in the main workflow. They are optional specialists you bring in when the work changes shape.

#### How they connect

- Use `afk-doc-craft` after brainstorming, trade-offs, or another shaping pass when the output needs to become a human-friendly document instead of a working artifact.
- Use `diagnosing-bugs` instead of the spec-shaping workflow when the task is really about understanding a defect, incident, or failure timeline.
- Use `afk-compass` when you're unsure whether you need the main workflow, a support skill, or a recommended external companion skill.
- Use `afk-pickup` after the external `handoff` skill when the previous session kept its handoff note disposable in the OS temp directory.

#### A useful mental model

Think of AI Field Kit in two layers:

- **Core workflow:** shape the work before execution
- **Support layer:** polish, debug, document, or route the work more intelligently

That keeps the main workflow coherent without pretending every skill belongs in the same sequence.

---

## Workflow-Style Skills

Workflow-style AFK procedures are skills for named, repeatable user journeys. Use them when the task has a clear intake, flow, checkpoints, and output.

| Skill | What it does |
|---|---|
| `afk-interactive-code-review` | Reviews a PR step by step with pauses after each file |
| `afk-pr-story-flow-mermaid` | Generates a Mermaid PR story flow from branch diffs |

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

**Good skill examples in this stack:**

- `diagnosing-bugs`: a disciplined feedback-loop approach for hard bugs and performance regressions.
- `afk-animated-driven-frontend`: motion strategy and interaction direction that can shape many different UI tasks.

### Choose a workflow when

- The task has a clear beginning, middle, and end.
- The agent should follow a fixed sequence of steps.
- The input format is predictable.
- The output is a specific artifact or deliverable.
- You want the user to invoke it intentionally as a slash command.

**Good workflow examples in this repo:**

- `/afk-interactive-code-review`: a step-by-step review flow with pauses after each file.

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

### AFK catalog

AFK setup is driven by the catalog under `packages/afk/catalog/`. Use it to
define recommended rules, skills, MCPs, plugins, and presets while keeping
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
