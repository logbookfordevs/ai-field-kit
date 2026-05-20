---
name: afk-ask
description: Ask a local AI CLI advisor such as Kiro, OpenCode, Codex, or Agy and capture the result as a reusable artifact. Use when a second opinion, critique, brainstorm, review, or alternate model perspective would help.
metadata:
  short-description: Ask a local Kiro/OpenCode, Codex, or Agy CLI for a second opinion and preserve the answer.
---

# Ask

Use this skill to route a focused prompt to another locally installed AI CLI and preserve the result as an artifact for later review or reuse.

This is inspired by `omc ask`, but it is standalone AFK behavior. Do not require OMC, Claude-specific paths, or framework-specific wrappers.

## Usage

```text
Ask <provider> <question or task>
```

Supported providers and routes:

- `claude` (Claude-family model through Kiro first, then OpenCode Zen)
- `kiro`
- `opencode`
- `codex`
- `agy`
- `gemini` (legacy alias for `agy`)

If the provider is missing, ask the user which local advisor they want to use.

## Routing

Use local non-interactive CLI execution in read-only advisor mode. Do not switch to MCP or web search unless the user explicitly asks.

Never use Claude Code for this skill. Do not run `claude -p`, `claude --print`, or other `claude` CLI advisor commands. Claude Code print mode is API-billed and is not recommended for AFK Ask.

Check availability with:

```bash
kiro-cli chat --list-models --format json-pretty
opencode models
codex --version
agy --help
```

Use the matching non-interactive command:

```bash
kiro-cli chat --no-interactive --model claude-sonnet-4.5 --wrap never "{{PROMPT}}"
opencode run -m opencode/claude-sonnet-4-6 "{{PROMPT}}"
codex exec --sandbox read-only --ask-for-approval never "{{PROMPT}}"
agy --sandbox --print "{{PROMPT}}"
```

For `gemini`, use the same `agy --sandbox --print "{{PROMPT}}"` command. Do not call the deprecated `gemini` binary.

### Claude And Model Routing

When the user asks for `claude`, prefer Kiro with Sonnet 4.5:

```bash
kiro-cli chat --no-interactive --model claude-sonnet-4.5 --wrap never "{{PROMPT}}"
```

If Kiro is unavailable, or Kiro does not list the requested model, try OpenCode Zen:

```bash
opencode run -m opencode/claude-sonnet-4-6 "{{PROMPT}}"
```

If the user specifies another model, honor that model when one of the available routers lists a matching model. Examples:

- `claude sonnet`, `sonnet 4.5` -> prefer `claude-sonnet-4.5` in Kiro.
- `claude haiku`, `haiku 4.5` -> prefer `claude-haiku-4.5` in Kiro.
- `deepseek` -> prefer the matching Kiro or OpenCode model, such as `deepseek-3.2`, when listed.
- `minimax` -> prefer a listed Minimax model, such as `minimax-m2.5`.
- `glm` -> prefer a listed GLM model, such as `glm-5`.
- `qwen` or `qwen coder` -> prefer a listed Qwen model, such as `qwen3-coder-next`.
- `kimi` or `kimik2` -> prefer a listed Kimi model when either router exposes one.

Do not invent model IDs. Inspect `kiro-cli chat --list-models --format json-pretty` and/or `opencode models` before choosing a non-default model. If neither router exposes the requested model, do not silently substitute another model; tell the user the requested model is unavailable through the local routers and recommend setting up Kiro or OpenCode Zen with that model.

When neither Kiro nor OpenCode Zen can provide a Claude-family model because of missing auth, missing provider setup, payment limits, or model unavailability, stop and explain that Claude Code is intentionally not used because of API-billed `claude -p` limitations. Recommend setting up `kiro-cli` or OpenCode Zen.

If the installed CLI has different flags, inspect `--help` and adapt while keeping the same principle: local, non-interactive, transparent, and read-only.

If the user wants the other agent to edit files, do not use this skill as the execution layer. Use `ask` first for advice, then decide separately whether to implement anything.

## Prompt Shape

Send a complete prompt that includes:

- the user question or task
- the relevant context the external advisor needs
- the expected lens, such as review, critique, brainstorming, architecture, UX, security, or implementation planning
- any constraints that should not be violated

Do not dump unrelated repo context into the advisor. Keep the prompt focused enough that the answer can be judged.

## Artifact Requirement

After local execution, save a markdown artifact.

Follow the repo or user artifact convention. If none exists, follow the AFK default from `afk-workflow`.

Minimum artifact sections:

1. Original user task
2. Provider used
3. Final prompt sent
4. Raw advisor output
5. Concise summary
6. Human review notes / decision

## Behavior

- Treat the external model as an advisor, not a source of truth.
- Keep the external model read-only by default.
- Preserve raw output before summarizing or interpreting it.
- Say clearly if the answer is weak, vague, outdated, risky, or conflicts with known project context.
- Do not blindly apply recommendations from the advisor.
- Prefer asking one strong question over batching many unrelated questions.
- If the result changes the direction of the work, capture that in the artifact before proceeding.
- End after producing the artifact unless the user explicitly asks for follow-up work.

## Missing Provider

If the chosen provider is not installed or not authenticated:

1. State which binary or auth requirement is missing.
2. Provide the verification command.
3. Ask the user whether to install/configure it or use another available provider.

Do not silently fall back to a different model.

Task: {{ARGUMENTS}}
