---
name: afk-create-agent
description: Create and register a portable AFK Custom Agent.
disable-model-invocation: true
---

# AFK Create Agent

Create a source-owned Portable Agent File and connect it to an AFK
`agents.json` catalog.

## 1. Shape the agent

Inspect the target catalog and any existing agent with the requested identity.
Establish its stable name, delegation description, runtime instructions, target
harnesses, and only the optional controls the user actually wants: model,
effort, nicknames, skills, access, or capabilities.

Omit model and effort values when the user wants harness inheritance. Treat
declared skills as configuration, not dependencies for AFK to install or
validate.

Complete when every requested behavior has one clear owner in the portable
definition and no required choice remains implicit.

## 2. Author the portable file

Read [`references/portable-agent-schema.md`](references/portable-agent-schema.md)
completely before writing. Create one Markdown file with YAML frontmatter and a
focused instruction body. Keep lasting behavior in this source file; native
harness files are generated targets.

Complete when the file satisfies every applicable schema constraint and its
body is sufficient for a fresh-context agent to perform the intended role.

## 3. Register the source

Add an `agents.json` item with the same `id` as the portable file's `name`, a
human label, and a repository-relative path to the file. Preserve unrelated
catalog entries. Edit the source catalog when the definition is shared; use
`afk catalog agents add` when the user explicitly wants a writable local cache
entry.

Complete when `afk show agents` or `afk show agents --source <source>` exposes
the new entry and its source is reachable from the intended setup context.

## 4. Verify every target

Dry-run each requested adapter:

```bash
afk setup agents --source <source> --custom-agent <id> --agent <harness> --dry-run
```

Confirm the reported native path, model inheritance or selection, effort,
access, capabilities, skills, and intentional omissions for every harness.
Apply setup only when the user asked to provision the agent; otherwise return
the exact setup command. If Pi reports that `pi-subagents` is unavailable,
surface its suggested install command and the required setup rerun.

Complete when every requested harness has either a successful dry-run or a
specific, actionable compatibility result.
