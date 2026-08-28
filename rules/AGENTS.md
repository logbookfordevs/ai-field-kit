# Library Preferences
- Always import from `motion` or `motion/react` instead of `framer-motion`.
- Tailwind CSS v4 is preferred library for CSS.
- Default to Tailwind v4 zero-config setup; do NOT create `tailwind.config.js`/`tailwind.config.ts` unless explicitly required.
- Use the project's existing headless foundation if one exists. Otherwise prefer Base UI.

# Personal Preferences

## Skills
Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."

## Artifacts
When choosing where to store or find an artifact and the repo or user convention does not decide it, read `{{AFK_RULES_DIR}}/artifacts.md`.

## Imports
- Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

## TypeScript
- Avoid `any` unless necessary or specifically instructed.
- TypeScript changes must pass the repo typecheck before final handoff.

## Testing
- When tests are planned or about to be written. Add regression tests when they protect meaningful behavior; do not require them for trivial copy or similarly low-risk changes.
- Tautological tests considered harmful.

## React
- Keep conditional rendering explicit: use `&&` for one optional JSX element and keep simple local conditions inline; for mutually exclusive JSX branches, compute a named element before the return or extract a component. Keep value-selection ternaries short and flat; hoist nested or hard-to-scan expressions into named values.
- Name complex or repeated JSX conditions and hoist chained `||` logic above the return. For repeated status unions like `active | pending` or `loading | refreshing`, use shared helpers in `utils/`, such as `isActiveStatus`, instead of duplicating OR expressions.

## Browser Testing
- Prefer `agent-browser` CLI when available over playwright CLI.

## Commands
- Don't run dev server commands (like `npm run dev`) - assume it's already running.

## Worktrees
- When creating or managing git worktrees, prefer the installed `yggtree` CLI; run `yggtree --help` before falling back to native git worktree commands.

## Package Managers
- Check and follow the current project's package manager. Always chose pnpm in new projects.

## Tech Stack
For web applications, prefer React, Tailwind V4 and TypeScript. For prototyping, you may use HTML/CSS/JS or whatever attends the needs.

## Frontend UX Defaults
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Mobile is not degraded desktop; replace cramped, wrapped, clipped, or awkward controls with proper responsive patterns.

## Coding Style Instructions
When evaluating code and thinking between solutions, apply `Truss Evaluation` skill as criteria.
Push back when implementation convenience is prioritized over a materially better user experience.

## Comments
- **Comment-sparse code:** express intent through names, structure, types, and ADRs.
- A comment earns its place only when it preserves an enduring non-obvious invariant, dangerous edge case, external contract, or trade-off. Describe lasting code behavior, not task history.

## Sub-agents
When spawning sub-agents, use the `afk-architect` skill as the coordination policy.

## Dictionary
- Team of agents/multi agents = spawn sub-agents/child agents