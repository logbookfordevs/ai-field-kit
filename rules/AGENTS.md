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

## Headless Components
- Use the project’s existing headless foundation if one exists. Otherwise prefer Base UI.

# Personal Preferences

## Skills
Use `afk-compass` for broad, ambiguous, multi-phase, phase changes, execution-discipline routing, or any non-obvious skill selection.
Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."

## Imports
- Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

## TypeScript
- Avoid `any` unless necessary or specifically instructed.
- TypeScript changes must pass the repo typecheck before final handoff.

## React
- Do not use ternaries inside JSX content. For one optional branch, use a positive `&&` check. For mutually exclusive branches or conditions with more than two checks, compute named variables before the return or extract a helper/component.
- Conditional JSX should use named booleans, not chained `||` expressions inside `{condition && (...)}` blocks. Hoist OR logic above the return, such as `const showActions = isReady && canEdit`, then use `&&` with those names in JSX. For repeated status unions like `active | pending` or `loading | refreshing`, use shared helpers in `utils/`, such as `isActiveStatus`, instead of duplicating OR expressions.

## Commands
- Don't run dev server commands (like `npm run dev`) - assume it's already running.

## Worktrees
- When creating or managing git worktrees, prefer the installed `yggtree` CLI; run `yggtree --help` before falling back to native git worktree commands.

## Package Managers
- Check and follow the current project's package manager. Always chose pnpm in new projects.

## Tech Stack
For web applications or React work, use Tailwind V4 and TypeScript.

## Frontend UX Defaults
- Do not choose a simpler implementation just to avoid setup when a richer interaction, mature primitive, or small amount of extra state materially improves UX. For standard app primitives in React/Tailwind, use the `afk-ui-registry-preferences` skill before choosing custom UI or a registry.
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Mobile is not degraded desktop; replace cramped, wrapped, clipped, or awkward controls with proper responsive patterns.

## Coding Style Instructions
When reviewing or giving refactor guidance, use an explicit review stance.
When evaluating code and thinking between solutions, apply `Truss Evaluation` skill as criteria.
Challenge product or implementation directions that trade away user value mainly to reduce implementation effort.

## Comments
- Default to no code comments; prefer clearer names, structure, or types.
- Never add glossary, dictionary, taxonomy, ticket-note, or line-by-line explanation blocks in implementation files.
- Use a short comment only to preserve a non-obvious constraint, dangerous edge case, external contract, or trade-off.

## Dictionary
- Team of agents/multi agents = spawn sub-agents/child agents
- Users/developers = people using the product or tooling being built;
- Just/focus = this is a hard scope limiter. Do the narrowed request only; do not widen into adjacent cleanup, refactors, docs, or “while I’m here” improvements unless asked.
