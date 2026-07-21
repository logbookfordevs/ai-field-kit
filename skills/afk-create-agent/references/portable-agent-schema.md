# Portable Custom Agent Schema

Use this reference while authoring a Portable Agent File or its catalog entry.

## Catalog entry

`agents.json` contains presentation metadata and a direct source:

```json
{
  "version": 1,
  "items": [
    {
      "id": "notion_assistant",
      "label": "Notion Assistant",
      "source": "https://example.com/agents/notion-assistant.md"
    }
  ]
}
```

- `id` must equal the portable file's `name`.
- `label` is presentation text; the portable file owns runtime description and
  behavior.
- `source` is an HTTP(S) URL, absolute path, or path resolved from the setup
  working directory.
- Custom Agents have no default-selection field. Interactive setup starts with
  every item unchecked; scripts select with `--custom-agent` or `--all`.

Refresh merges `agents.json` by ID: incoming matches replace cached entries,
new entries append, and cached entries absent from the source survive.

## Portable Agent File

The source is Markdown with YAML frontmatter followed by a non-empty instruction
body:

```markdown
---
name: notion_assistant
description: Works with Notion content while preserving existing data.
models:
  codex: gpt-5.6-luna
  claude: claude-sonnet-5
  pi: openai/gpt-5.6
effort:
  codex: medium
  claude: medium
  pi: medium
nicknames:
  - Notion Scout
  - Workspace Librarian
skills:
  - notion-cli
  - logbook-notion-context
access: workspace-write
capabilities:
  required:
    - read
    - search
  optional:
    - write
    - web
---

Use the Notion CLI and preserve existing content.
```

## Fields

| Field | Required | Contract |
|---|---:|---|
| `name` | Yes | Stable identity matching `^[a-z0-9][a-z0-9_-]*$`. Claude renders underscores as hyphens. |
| `description` | Yes | Delegation guidance describing when the harness should use the agent. |
| `models` | No | Non-empty exact model identifier or native alias keyed by `codex`, `claude`, or `pi`. Omission inherits. |
| `effort` | No | Non-empty native effort or thinking value keyed by harness. Omission inherits. |
| `nicknames` | No | Unique non-empty ASCII names using letters, numbers, spaces, hyphens, or underscores. |
| `skills` | No | Unique non-empty shared AFK skill names attached through native agent configuration. |
| `access` | No | `read-only` or `workspace-write`. Omission leaves access under harness control. |
| `capabilities.required` | No | Facilities every selected target must provide; a missing requirement skips that target. |
| `capabilities.optional` | No | Facilities AFK may omit while still provisioning and reporting the omission. |
| Markdown body | Yes | Runtime instructions for the fresh-context agent. |

`read-only` cannot require `write`.

## Harness translation

| Portable field | Codex | Claude Code | Pi with `pi-subagents` |
|---|---|---|---|
| `models` | `model` | `model` | `model` |
| `effort` | `model_reasoning_effort` | `effort` | `thinking` |
| `nicknames` | `nickname_candidates` | Reported as omitted | Reported as omitted |
| `skills` | One enabled `[[skills.config]]` path per skill under `~/.agents/skills` | Native `skills` list | Native `skills` plus absolute `skillPath` entries under `~/.agents/skills` |
| `access: read-only` | `sandbox_mode` | `permissionMode: plan` and denied write tools | Read-only tool selection |
| Instruction body | `developer_instructions` | Markdown body | Markdown body |

AFK translates skill declarations without installing, enabling, inspecting, or
verifying the referenced skill folders. The harness owns missing-skill warnings
and runtime behavior.

## Capabilities

V1 recognizes `read`, `search`, `shell`, `write`, `web`, and `subagents`.

| Harness | Supported capabilities |
|---|---|
| Codex | `read`, `search`, `shell`, `write`, `web`, `subagents` |
| Claude Code | `read`, `search`, `shell`, `write`, `web`, `subagents` |
| Pi | `read`, `search`, `shell`, `write`, `subagents` |

For Pi, `read-only` also makes `shell` and `write` unavailable. Unknown or
unsupported required capabilities block that target. Unknown or unsupported
optional capabilities are reported and omitted.

## Generated targets

| Harness | Personal scope | Project scope |
|---|---|---|
| Codex | `~/.codex/agents/<name>.toml` | `.codex/agents/<name>.toml` |
| Claude Code | `~/.claude/agents/<name>.md` | `.claude/agents/<name>.md` |
| Pi | `~/.pi/agent/agents/<name>.md` | `.pi/agents/<name>.md` |

Setup replaces selected generated files with a fresh translation. Durable edits
belong in the portable source. Pi provisioning requires `pi-subagents`; AFK
suggests `pi install npm:pi-subagents`, skips Pi, and asks for a setup rerun when
the extension is unavailable.
