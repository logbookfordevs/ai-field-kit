---
name: afk-ask
description: Ask a local AI CLI advisor such as Kiro, OpenCode, Codex, or Agy and capture the result as a reusable artifact. Use when a second opinion, critique, brainstorm, review, or alternate model perspective would help.
metadata:
  short-description: Ask a local Kiro/OpenCode, Codex, or Agy CLI for a second opinion and preserve the answer.
---

# Ask

Use this skill to route a focused prompt to another locally installed AI CLI and preserve the result as an artifact for later review or reuse.

This is inspired by `omc ask`, but it is standalone AFK behavior. Do not require OMC, Claude-specific paths, or framework-specific wrappers.

## Invocation

```text
Ask <provider> <question or task>
```

Providers:

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

Use the provider command map in [references/providers.md](references/providers.md), and inspect the installed CLI help/model list when a requested model is not the default.

For Claude-family requests, prefer Kiro, then OpenCode Zen. If neither can provide the requested Claude-family model because of missing auth, provider setup, payment limits, or model availability, stop and explain that Claude Code is intentionally not used for AFK Ask.

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

Follow the repo or user artifact convention. If none exists, follow the AFK artifact convention from `afk-compass/references/artifacts.md`.

Minimum artifact sections for substantial asks:

1. Original user task
2. Provider used
3. Final prompt sent
4. Raw advisor output
5. Concise summary
6. Human review notes / decision

For tiny asks, a compact artifact is acceptable if it still preserves the prompt, provider, raw output, and decision.

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
