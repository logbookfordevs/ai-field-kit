# Provider Reference

Use this file only when executing AFK Ask or resolving a provider/model route.

## Availability Checks

```bash
kiro-cli chat --list-models --format json-pretty
opencode models
codex --version
agy --help
```

## Default Commands

```bash
kiro-cli chat --no-interactive --model claude-sonnet-4.5 --wrap never "{{PROMPT}}"
opencode run -m opencode/claude-sonnet-4-6 "{{PROMPT}}"
codex exec --sandbox read-only --ask-for-approval never "{{PROMPT}}"
agy --sandbox --print "{{PROMPT}}"
```

For `gemini`, use `agy --sandbox --print "{{PROMPT}}"`. Do not call the deprecated `gemini` binary.

## Model Routing

When the user asks for `claude`, prefer Kiro with the default Sonnet route. If Kiro is unavailable or does not list the requested Claude-family model, try OpenCode Zen.

When the user specifies another model, inspect the available Kiro and OpenCode model lists before choosing. Match the requested model family when available, for example:

- `claude sonnet`, `sonnet` -> a listed Sonnet model.
- `claude haiku`, `haiku` -> a listed Haiku model.
- `deepseek` -> a listed DeepSeek model.
- `minimax` -> a listed Minimax model.
- `glm` -> a listed GLM model.
- `qwen` or `qwen coder` -> a listed Qwen model.
- `kimi` or `kimik2` -> a listed Kimi model.

Do not invent model IDs. If neither router exposes the requested model, tell the user it is unavailable through the local routers and recommend setting up Kiro or OpenCode Zen with that model.

If a router is installed but its flags differ from the examples, inspect `--help` and adapt while preserving the same constraints: local, non-interactive, transparent, and read-only.
