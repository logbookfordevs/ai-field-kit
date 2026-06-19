# Delegation Transports

Use this reference when launching or supervising delegated local agents.

## Live Delegation: cmux

Use `cmux` when the user may want shared control.

Default posture:

- interactive external agent
- visible surface
- user can type, interrupt, or steer
- monitor the screen, not only the process

Useful commands:

```bash
cmux identify --json
cmux top --processes --flat
cmux read-screen --surface surface:ID --scrollback --lines 180
cmux new-split right --panel pane:ID
cmux trigger-flash --surface surface:ID
```

Rules:

- After creating or changing splits, rediscover surface ids with `cmux identify` or `cmux top`.
- Force or verify cwd before launch.
- Keep the brief file available until the external agent is finished.
- Watch for trust or permission prompts and answer only when the intended trust posture is clear.

Kiro live launch shape:

```bash
prompt=$(cat .delegate-brief.md)
kiro-cli chat --agent kiro_default --effort high --trust-all-tools "$prompt"
```

Do not add `--no-interactive` in cmux unless the user explicitly asks.

## Background Delegation: tmux

Use `tmux` when the user wants a detached worker lane.

Default posture:

- non-interactive external agent when the provider supports it
- persistent session
- monitor by captured output
- user can still attach or send keys, but that is not the main experience

Useful commands:

```bash
tmux new-session -d -s delegate-name
tmux capture-pane -t delegate-name -p
tmux capture-pane -t delegate-name -p -S -
tmux send-keys -t delegate-name -l -- "Please continue"
tmux send-keys -t delegate-name Enter
```

Rules:

- Use normal shell execution for simple one-shot commands.
- Use tmux for durable agent runs that may outlive the current prompt.
- Capture full scrollback before reporting status.
- Approve prompts only when the prompt is understood.

## Prompt Brief

Include:

- target repo and cwd
- exact task
- files, URLs, or artifacts to inspect
- allowed tool policy
- validation expectations
- final report requirements
- completion contract

If browser tooling matters, state the policy explicitly:

```text
Use agent-browser for browser validation.
Run `agent-browser skills get core` first.
Do not use Playwright/Puppeteer unless explicitly authorized.
If agent-browser fails, stop and report why.
```

If browser tooling does not matter:

```text
You may use any browser validation path available.
If you use a dependency from a sibling project, mention it in your report.
```

## Monitoring

Do not infer completion from an idle prompt. Check:

- task counter
- final report
- validation section
- explicit statement that all tasks are complete
- live screen state
- changed files when relevant

Continuation nudge:

```text
You stopped with tasks remaining. Continue now and complete the remaining tasks end-to-end: finish implementation, run validation, clean up temporary files only if safe, and produce the final report. Do not stop at the prompt until all tasks are complete or you hit a concrete blocker.
```

## Cleanup

Remove temporary brief files only after the delegated agent has finished and no longer needs to reread them.
