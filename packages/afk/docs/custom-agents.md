# Portable Custom Agents

AFK provisions portable Custom Agent definitions into supported harnesses. It
does not launch or coordinate the resulting agents.

## Commands

```bash
# Refresh agents.json together with the other catalog files
afk refresh

# Inspect or edit the catalog
afk show agents
afk catalog agents
afk catalog agents add
afk catalog agents edit
afk catalog agents remove

# Interactive setup: every agent starts unchecked
afk setup agents

# Scripted setup: selection is always explicit
afk setup agents --custom-agent notion_assistant --agent codex --yes
afk setup agents --all --agent claude --agent pi --yes
```

`--yes` only skips confirmation. It never selects Custom Agents. A scripted
`afk setup agents` run must pass one or more `--custom-agent` values or `--all`.

## Catalog

`agents.json` contains presentation metadata and a direct link or path to each
Portable Agent File:

```json
{
  "version": 1,
  "items": [
    {
      "id": "notion_assistant",
      "label": "Notion Assistant",
      "source": "agents/notion_assistant.md"
    }
  ]
}
```

The catalog `id` must match the Portable Agent File's `name`. `label` is only
for catalog presentation; the portable file owns runtime description and
behavior.

Relative `source` values resolve from the selected custom source root. For a
local repository, AFK materializes an absolute filesystem path. For a GitHub
repository shorthand or URL, AFK materializes a raw-file URL at the selected
ref. Existing absolute paths and HTTP(S) URLs remain unchanged. Relative paths
loaded directly from a writable cache without source context fall back to the
setup working directory.

Refresh merges `agents.json` by id. Incoming matches replace existing entries,
new incoming entries are appended, and existing entries absent from the source
remain until explicitly removed. Refresh never provisions agents.

## Portable Agent File

Each source is one Markdown file with YAML frontmatter and an instruction body:

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
  - Ledger Keeper
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

| Field | Required | Meaning |
|---|---:|---|
| `name` | Yes | Stable agent identity using lowercase letters, numbers, hyphens, or underscores. |
| `description` | Yes | Harness-facing guidance for when the agent should be used. |
| `models` | No | Exact model identifier or native alias per harness. Omission inherits the harness model. |
| `effort` | No | Exact per-harness effort or thinking value. Omission inherits the harness setting. |
| `nicknames` | No | Portable display-name candidates. Codex emits them natively; unsupported harnesses report their omission. |
| `skills` | No | Shared AFK skill names to attach to this agent. AFK translates them into native harness configuration without installing or validating the skills. |
| `access` | No | `read-only` or `workspace-write`. Omission leaves access under harness control. |
| `capabilities.required` | No | Facilities the target must support or AFK skips that target. |
| `capabilities.optional` | No | Facilities AFK may omit while still provisioning and reporting the omission. |
| Markdown body | Yes | Runtime instructions translated into the native agent definition. |

V1 recognizes `read`, `search`, `shell`, `write`, `web`, and `subagents`.
Unknown required capabilities block provisioning for that target. Unknown or
unsupported optional capabilities are reported and omitted. Agent instructions
may mention additional user-managed facilities without declaring them. Effort
maps to `model_reasoning_effort` in Codex, `effort` in Claude Code, and
`thinking` in Pi.

### Skill configuration

Portable `skills` entries name folders in AFK's shared `~/.agents/skills`
library. AFK does not install, enable, inspect, or verify those folders during
Custom Agent setup. The declaration only asks each harness to attach the named
skills when it runs the generated agent.

| Harness | Generated configuration |
|---|---|
| Codex | One `[[skills.config]]` block per skill, pointing to its shared `SKILL.md` with `enabled = true`. |
| Claude Code | A native `skills` list that preloads the named skills. Claude must already be able to discover them. |
| Pi | A native `skills` list plus absolute `skillPath` entries pointing to the shared AFK library. |

If a skill is unavailable, the harness owns the resulting warning or runtime
behavior. Omitting `skills` leaves agent-specific skill configuration unset.

## Native Targets

| Harness | Personal scope | Project scope |
|---|---|---|
| Codex | `~/.codex/agents/<name>.toml` | `.codex/agents/<name>.toml` |
| Claude Code | `~/.claude/agents/<name>.md` | `.claude/agents/<name>.md` |
| Pi | `~/.pi/agent/agents/<name>.md` | `.pi/agents/<name>.md` |

AFK owns these translations and writes selected source state over the native
target files. It does not merge or preserve manual edits in generated targets.

Pi support uses the `pi-subagents` extension. When Pi is selected without that
extension, AFK suggests:

```bash
pi install npm:pi-subagents
```

AFK skips Pi instead of installing the extension, then asks the user to rerun
`afk setup agents` after installation.
