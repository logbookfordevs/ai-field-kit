# Library Preferences

## Motion (old Framer Motion)
- Always import from `motion` or `motion/react` instead of `framer-motion`.

## Tailwind CSS v4
- Tailwind CSS v4 is preferred library for CSS.
- Default to Tailwind v4 zero-config setup; do NOT create `tailwind.config.js`/`tailwind.config.ts` unless explicitly required.

## Headless Components
- Use the project’s existing headless foundation if one exists. Otherwise prefer Base UI.

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
- When tests are planned or about to be written, use the `tdd` skill. Add regression tests when they protect meaningful behavior; do not require them for trivial copy or similarly low-risk changes.

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
- Do not choose a simpler implementation just to avoid setup when a richer interaction, mature primitive, or small amount of extra state materially improves UX. For standard app primitives in React/Tailwind, use the `afk-ui-registry-preferences` skill before choosing custom UI or a registry.
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Mobile is not degraded desktop; replace cramped, wrapped, clipped, or awkward controls with proper responsive patterns.

## Coding Style Instructions
When evaluating code and thinking between solutions, apply `Truss Evaluation` skill as criteria.
Challenge product or implementation directions that trade away user value mainly to reduce implementation effort.

## Comments
- Default to no code comments; prefer clearer names, structure, types, ADRs.
- Never add glossary, dictionary, taxonomy, ticket-note, or line-by-line explanation blocks in implementation files.
- Use a short comment only to preserve a non-obvious constraint, dangerous edge case, external contract, or trade-off.

## Sub-agents
Before spawning any sub-agent, deliberately choose the model and reasoning effort best suited to that specific task. Do not inherit either by default; use inheritance only when you have affirmatively determined that it is the best fit.

## Dictionary
- Team of agents/multi agents = spawn sub-agents/child agents
- Users/developers = people using the product or tooling being built;
- Just/focus = this is a hard scope limiter. Do the narrowed request only
