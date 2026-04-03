---
name: afk-ask-gemini
description: Ask Gemini through a local CLI and capture the result as a reusable artifact. Use when a second opinion, brainstorming pass, or external model perspective would help.
---

# Ask Gemini (Local CLI)

Use the locally installed Gemini CLI as a direct external advisor for brainstorming, design feedback, and second opinions.

## Usage

```bash
/ask-gemini <question or task>
```

## Routing

### Preferred: Local CLI execution
Run Gemini through the locally available CLI, not through a framework-specific wrapper.

Exact non-interactive Gemini CLI command from `gemini --help`:

```bash
gemini -p "{{ARGUMENTS}}"
# equivalent: gemini --prompt "{{ARGUMENTS}}"
```

If needed, adapt to the user's installed Gemini CLI variant while keeping local execution as the default path.

Repository-specific wrappers may exist, but they are optional convenience layers, not required parts of the skill.

### Missing binary behavior
If `gemini` is not found, do **not** switch to MCP.
Instead:
1. Explain that local Gemini CLI is required for this skill.
2. Ask the user to install/configure Gemini CLI.
3. Provide a quick verification command:

```bash
gemini --version
```

## Artifact requirement
After local execution, save a markdown artifact to:

```text
artifacts/gemini-<slug>-<timestamp>.md
```

Another local artifact path is acceptable if the repository uses a different convention.

Prefer `artifacts/`. If `artifacts/` conflicts with the repo's structure, use `docs/artifacts/` when `docs/` exists. Otherwise follow the repo's existing convention.

Minimum artifact sections:
1. Original user task
2. Final prompt sent to Gemini CLI
3. Gemini output (raw)
4. Concise summary
5. Action items / next steps

If useful, also include shared anchor headings such as:
- `Context`
- `Open Questions`
- `Next Step`

## Behavior

- Prefer local CLI execution over remote wrappers or framework-specific commands
- Keep the invocation transparent so the user can understand how Gemini was queried
- Preserve raw output in the artifact before summarizing it
- Treat Gemini as an external advisor, not a source of truth
- If the result is weak, conflicting, or vague, say so clearly in the summary

## Suggested Next Skills

These are suggestions, not required steps:
- return to `afk-business-analyst` if Gemini output changes the framing of the problem
- use `afk-advanced-elicitation` if the Gemini-informed artifact needs a stronger refinement pass
- use `afk-note` if the important takeaways should be preserved for later

Task: {{ARGUMENTS}}
