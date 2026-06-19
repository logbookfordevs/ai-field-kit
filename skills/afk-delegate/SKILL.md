---
name: afk-delegate
description: Delegate implementation, review, research, or polish work to an external local agent and supervise the run.
disable-model-invocation: true
metadata:
  short-description: Delegate work to another local agent with live or background supervision.
---

# Delegate

Delegate work to another local agent, then supervise it until the run is complete or concretely blocked.

Use this when the user wants another agent to do work, not merely advise. For read-only second opinions, use `afk-ask`.

## Modes

- **Live delegation**: use `cmux` by default. The human may watch, type, interrupt, or steer the external agent.
- **Background delegation**: use `tmux` by default. The agent runs non-interactively unless the user asks for a shared session.

If the user names `cmux` or asks to interact, choose live. If the user asks for background, fire-and-monitor, or detached work, choose background.

## Process

1. Define the delegated task, target repo, agent/provider, mode, and completion contract.
2. Write a temporary brief file in the target repo when the task is non-trivial.
3. Use [transports.md](references/transports.md) for launch, monitor, nudge, and cleanup rules.
4. Verify the target cwd before launching the external agent.
5. Launch the delegated agent with the chosen mode.
6. Monitor live output. Do not treat a returned prompt as completion.
7. Nudge the agent if it stops with work remaining.
8. Report status from terminal evidence: done, still running, or blocked.
9. Clean temporary brief files only after the delegated agent no longer needs them.

## Completion Contract

Every delegated prompt should tell the external agent not to stop until one is true:

1. all delegated tasks are complete and validated
2. a concrete blocker is reported clearly
3. the user interrupts or changes scope

Task: {{ARGUMENTS}}
