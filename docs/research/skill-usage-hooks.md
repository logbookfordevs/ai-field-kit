# Counting skill usage with agent hooks

Checked 2026-08-17 against the current first-party documentation and source for Codex, Claude Code, Pi, and OpenCode. This is a feasibility note, not an implementation.

## Decision

**Yes, but the portable metric should be “skill invocation/loading,” not “the model followed the skill.”** Claude Code and OpenCode expose a clean skill-tool signal. Pi can be measured with a two-path extension. Codex internally distinguishes explicit and implicit skill injection, but its public lifecycle-hook schema has no skill event, so an ordinary Codex hook can count explicit mentions or heuristic `SKILL.md` reads, not authoritative skill activation.

Recommended order:

1. Implement Claude Code first: it has distinct signals for direct user invocation and model invocation.
2. Add OpenCode through its plugin tool hooks.
3. Add Pi through input-command and `read`-tool observation.
4. Treat Codex as partial until OpenAI exposes the internal skill-invocation signal to public hooks/plugins.

## Define the counters first

Keep these separate:

- **Explicit invocation**: the user selected/named a skill (`/skill-name`, `$skill-name`, or a structured skill input).
- **Implicit invocation**: the model chose a skill after matching its advertised description.
- **Successful load/injection**: the full skill body entered model context. This is stronger than an attempted invocation.
- **Behavioral use**: the model actually followed the instructions and the result improved. No lifecycle hook proves this. Anthropic explicitly recommends measuring invocation and output quality separately; a trigger only proves Claude found the skill. [Claude skill evaluation](https://code.claude.com/docs/en/skills#evaluate-and-iterate-on-a-skill)

A useful event row is `{ harness, session_id, prompt_or_turn_id, skill_id, invocation_kind, outcome, timestamp }`. Count raw invocations and unique `(session_id, skill_id)` loads separately; retries and re-invocations otherwise inflate adoption.

## Claude Code: fully feasible

Claude Code exposes the two invocation paths separately:

- A model-selected skill runs through the built-in `Skill` tool. A `PreToolUse` hook with matcher `Skill` observes the attempt; `PostToolUse` with matcher `Skill` is the better successful-invocation counter. Skills use the existing `Skill` tool rather than adding one tool per skill. [Claude tools reference](https://code.claude.com/docs/en/tools-reference#configure-tools-with-permission-rules-and-hooks)
- A user typing `/skillname` bypasses `PreToolUse`. `UserPromptExpansion` covers that direct path and matches `command_name`; its payload includes `expansion_type`, `command_name`, `command_args`, `command_source`, and the original `prompt`. [Claude `UserPromptExpansion`](https://code.claude.com/docs/en/hooks#userpromptexpansion)

The shared hook payload also supplies `session_id`, `prompt_id`, `transcript_path`, and `cwd`; `prompt_id` is intended for correlation with telemetry. Hooks run in terminal sessions, IDE extensions, the Desktop app, and Claude Code on the web, although cloud sessions do not read a machine-local user settings file. [Claude hook lifecycle and common fields](https://code.claude.com/docs/en/hooks#hook-lifecycle), [Claude hook locations](https://code.claude.com/docs/en/hooks#hook-locations)

Use both events for coverage. `PostToolUse: Skill` alone misses direct slash invocation; `UserPromptExpansion` alone misses model-selected invocation. Also distinguish an invocation from continued influence: once loaded, Claude keeps skill content in context across turns and may avoid inserting an identical body again on re-invocation. [Claude skill content lifecycle](https://code.claude.com/docs/en/skills#skill-content-lifecycle)

## Codex: partial with public hooks, precise internally

Codex supports explicit `$skill-name` mentions and implicit matching. Its app-server API can additionally accept a structured `{ "type": "skill", "name", "path" }` turn input so the backend injects the full instructions directly. [Codex skills](https://developers.openai.com/codex/skills#how-chatgpt-and-codex-use-skills), [Codex app-server skill input](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#skills)

The public hook events are lifecycle and local-tool events (`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, and others). Their documented payloads expose the user `prompt`, or a local `tool_name` plus `tool_input`; there is no documented `SkillInvoked` event or skill identity field. Hosted/specialized tool paths may also bypass tool hooks. [Codex hook events and tool coverage](https://developers.openai.com/codex/hooks#tool-coverage), [Codex `UserPromptSubmit`](https://developers.openai.com/codex/hooks#userpromptsubmit)

Therefore a public Codex hook can only provide partial counters:

- Parse `$skill-name` from `UserPromptSubmit.prompt` for an **explicit mention** counter. This does not prove the structured skill item resolved or injected successfully.
- Observe `PreToolUse`/`PostToolUse` reads or shell commands that access a known `SKILL.md` path for a **probable load** counter. This can false-positive on audits and ordinary file reads, and can miss host-side injection.
- Do not infer implicit activation from a task merely matching a skill description.

The important gap is an exposure gap, not a missing concept in Codex core. Current first-party source emits `codex.skill.injected` with `invoke_type=explicit|implicit`, records status for explicit injection, and calls internal skill-invocation contributors for implicit activation. That signal is not part of the documented command-hook schema. [Codex skill telemetry source](https://github.com/openai/codex/blob/main/codex-rs/core/src/skills.rs)

Codex hook documentation is written for Codex generally but describes `/hooks` and trust management through the CLI. It does not explicitly guarantee identical lifecycle-hook execution in the ChatGPT Desktop Codex surface, so Desktop parity should be a release-specific smoke test rather than an assumption. [Codex hooks](https://developers.openai.com/codex/hooks)

## OpenCode: feasible for native skill-tool loading

OpenCode advertises skill metadata and loads a selected skill only when the model calls the native `skill` tool. Its input is exactly `{ name: string }`; a successful call injects the Markdown body and exposes the base directory. [OpenCode skill runtime](https://opencode.ai/v2/docs/skills#runtime-loading), [OpenCode `SkillTool` source](https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/tool/skill.ts)

A V2 plugin can register `ctx.tool.hook("execute.before", ...)` and `execute.after`; the event exposes `event.tool` and mutable `event.input`. Count attempts where `event.tool === "skill"`, and successful loads in `execute.after`, keyed by `event.input.name`. The V2 plugin API is beta, so pin and test the target OpenCode release. [OpenCode plugin runtime hooks](https://opencode.ai/v2/docs/build/plugins#runtime-hooks)

This is authoritative for the native skill-tool path. The current skills docs do not promise that every interactive slash-command path traverses the same tool hook, so test direct slash invocation separately before calling the OpenCode total complete.

## Pi: feasible, but adapter-shaped

Pi advertises skill names/descriptions in the system prompt. For implicit use, the model calls the ordinary `read` tool on the skill's `SKILL.md`; for explicit use, Pi expands `/skill:name` as a skill command. [Pi skills](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md#how-skills-work)

Pi extensions expose an `input` event and `tool_call`/`tool_result` events with `toolName`, call id, and arguments. An adapter can:

- count `/skill:<name>` in the input/command path as explicit invocation;
- count a successful `read` whose normalized path equals a discovered skill entrypoint as implicit/probable loading.

[Pi extension events](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md#tool-events)

This is less clean than a dedicated skill event. A manual audit of `SKILL.md` looks identical to an implicit load at the tool layer, and direct command expansion must be tested because it is not the same path as model `read`.

## Practical acceptance test

For each harness, install one inert skill whose body contains a unique marker and run four fresh-session cases: direct invocation, description-matched implicit invocation, unrelated prompt, and direct `SKILL.md` inspection. Verify that:

- direct and implicit events are classified correctly;
- an unrelated prompt produces no count;
- a file audit does not become a successful-use count;
- denied/failed loads are attempts, not successes;
- repeated invocation has an explicit raw-versus-unique policy;
- subagent events carry enough identity to avoid silently mixing parent and child usage.

The result should be presented as **invocation telemetry plus separate outcome evals**, never as proof that the skill caused the observed result.
