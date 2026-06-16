# Documentation Instructions
When the task is explicitly about writing, rewriting, restructuring, or reviewing docs, use the `afk-doc-craft` skill.
Treat docs as reader-facing product work; let the skill provide the detailed writing doctrine.

# Library Preferences

## Motion (old Framer Motion)
- Always import from:
  - `motion` for framework-agnostic usage.
  - `motion/react` for React-specific usage.
- Never mix `framer-motion` and `motion` in the same codebase.
- The package name for installation is `motion`.

## Tailwind CSS v4
- Tailwind CSS v4 is preferred library for CSS.
- Default to Tailwind v4 zero-config setup; do NOT create `tailwind.config.js`/`tailwind.config.ts` unless explicitly required by the project.
- When setting up Tailwind CSS, use the `tailwind-design-system` skill as initial reference.

## Headless Components
- Use the project’s existing headless foundation if one exists. Otherwise prefer Base UI.

# Personal Preferences

## Skills
Use `afk-compass` for broad, ambiguous, multi-phase, phase changes, execution-discipline routing, or any non-obvious skill selection.
Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."
Treat explicit "AFK workflow" or "feature workflow" requests as composable AFK work: use `afk-compass` to choose the next useful skill, not to force a lifecycle. Treat explicit "AFK Sprint" or "AFK Turbo" requests as named execution packages.

## Imports
- Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

## TypeScript
- Avoid `any` unless necessary or specifically instructed.
- TypeScript changes must pass the repo typecheck before final handoff.

## Commands
- Don't run dev server commands (like `npm run dev`) - assume it's already running.

## Worktrees
- When creating or managing git worktrees, prefer the installed `yggtree` CLI, check `yggtree --help`to inspect available workflow commands.

## Package Managers
- Check and follow the current project's package manager. Always chose pnpm in new projects.

## Tech Stack
For web applications or related React work, use: Tailwind V4, TypeScript, and my preferred libraries where necessary.

## Frontend UX Defaults
- UX quality beats avoiding setup. For standard app primitives in React/Tailwind, use the `afk-ui-registry-preferences` skill before choosing custom UI or a registry.
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Mobile is not degraded desktop; replace cramped, wrapped, clipped, or awkward controls with proper responsive patterns.

## Coding Style Instructions
Optimize code for onboarding and day-2 maintenance without downgrading user experience for developer convenience.
When the task is a review/refactor guidance, prefer explicit review.
When evaluating code and thinking between solutions, apply `Truss Evaluation` skill as criteria.
Be a critical thinking partner: challenge weak product or implementation directions, and make the codebase pleasant enough to maintain ambitious UX well.

## Browser
- For browser automated tests, prefer `agent-browser` skill when no other option is specified.

## Comments
- Default to no code comments; prefer clearer names, structure, or types.
- Never add glossary, dictionary, taxonomy, ticket-note, or line-by-line explanation blocks in implementation files.
- Use a short comment only to preserve a non-obvious constraint, dangerous edge case, external contract, or trade-off.

## Dictionary
- Team of agents/multi agents = spawn sub-agents/child agents
- Users/developers = people using the product or tooling being built; do not assume they are the agent reading the file or that they will read implementation code.
- Just/focus just on = this is a hard scope limiter. Do the narrowed request only; do not widen into adjacent cleanup, refactors, docs, or “while I’m here” improvements unless asked.
- CLI/MCP/hooks/plugins/agent config = different integration surfaces, not interchangeable names for “tool setup.” Before recommending one, compare capability, automation behavior, ownership, token/context overhead, and install friction.
