---
stepsCompleted: [1]
inputDocuments: []
session_topic: "Root afk command lobby"
session_goals: "Explore joyful, useful entry experiences for users who run afk without a subcommand."
selected_approach: "progressive live ideation"
techniques_used: []
ideas_generated: []
context_file: ""
---

## Session Overview

**Topic:** Root `afk` command lobby.

**Goals:** Explore ideas for what should happen when someone runs plain `afk`, with enough range to find something more useful and delightful than forcing a subcommand.

### Context Guidance

- The current root command is primarily help/version. The meaningful guided flow starts at `afk setup`.
- AFK has been moving toward lower-friction CLI UX, fewer prompts, clearer defaults, and concrete routing.
- `afk-compass` already owns broad routing at the skill layer, so a root CLI lobby should complement that posture rather than duplicate skill selection.
- Root `afk` should feel like an entry room: orient, reveal useful state, and offer next actions without trapping experienced users.

### Starting Constraints

- Keep `afk --help` and explicit subcommands predictable.
- Avoid prompt loops and repeated confirmations.
- Preserve non-interactive behavior for CI or piped contexts.
- Prefer a joyful interactive TTY lobby only when plain `afk` is run in a real terminal.

## First Ideation Pass

### Direction A: Command Center

Plain `afk` opens a branded, keyboard-driven lobby with a small number of actions:

- Setup or update this machine
- Refresh manifests
- Show what AFK can install
- Configure manifests
- Inspect current setup
- Exit to help

This is the most straightforward product upgrade: useful, low surprise, and easy to map onto current commands.

### Direction B: Field Check

Plain `afk` first shows a tiny status snapshot, then offers actions:

- Detected agents
- Manifest source
- Last refresh status
- Installed/available counts
- Update notice
- Suggested next action

This makes AFK feel more alive, but should avoid slow checks or noisy diagnostics.

### Direction C: Compass Lobby

Plain `afk` asks "What are you trying to do?" with intent-oriented choices:

- Prepare this machine for agent work
- Add or update skills
- Add MCP tools
- Add hooks
- Build a custom kit
- See commands

This aligns the CLI with the `afk-compass` posture without turning skill routing into CLI behavior.

### Direction D: Tiny Joy Mode

Plain `afk` renders a compact branded lobby with a rotating one-line field note, but the actions remain practical. Joy comes from language, rhythm, and visual polish, not extra prompts.

### Direction E: Non-Interactive Help Plus TTY Lobby

Plain `afk` in a TTY opens the lobby. Plain `afk` in non-TTY prints normal help. `afk --help` always prints help. This preserves scriptability and keeps the surprise limited to human terminal use.

## Compass Lobby Exploration

The Compass Lobby treats root `afk` as an intent router rather than a command picker.

### Core Shape

The user sees a small set of natural-language goals:

- Prepare this machine for agent work
- Add or update skills
- Add MCP tools
- Add lifecycle hooks
- Build or edit a custom field kit
- Inspect what AFK knows
- Show commands

Each option maps to an existing command path, so the lobby does not invent a second setup system.

### Product Feel

The screen should feel like AFK asking "where are we headed?" rather than "which subcommand do you remember?"

It can show the command it will run before continuing:

```text
Route: afk setup skills
```

This keeps the lobby educational and reduces magic.

### Guardrails

- Keep choices single-select.
- Do not ask follow-up questions unless the target command already needs them.
- Preserve root help for `afk --help` and non-TTY use.
- Keep `afk-compass` as the skill/router concept; the CLI lobby borrows the compass metaphor without becoming a skill-selection engine.

## Chosen Implementation Direction

Combine the Compass Lobby with the Field Check and Command Center instincts:

- Plain `afk` in an interactive TTY opens a small lobby.
- Plain `afk` outside a TTY keeps printing normal help.
- `afk --help` keeps printing normal help.
- The lobby starts with a compact field check, then asks the user to pick an intent.
- Each intent shows a concrete command route before AFK hands off.
- The first command set covers setup, refresh, skills, MCPs, utilities, hooks, manifest editing, manifest inspection, and help.

Joyful micro-interactions should stay purposeful:

- Branded banner.
- Field-check panel.
- Intent-first labels.
- Route preview after selection.
- No extra confirmation step.
