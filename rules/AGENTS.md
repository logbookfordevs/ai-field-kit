# Documentation Instructions
Documentation should be treated as a **product**, not an obligation.
- Optimize for the **reader's experience** (clarity over completeness).
- Prefer **journeys and real scenarios** over feature dumps.
- Use **progressive disclosure** (quick win first, details later).
- Keep a **human tone** and anticipate common frustrations.

When the task is explicitly about writing docs, use the **`afk-documentation-authoring` skill**.

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

# Personal Preferences

## Skills
Before modifying code, evaluate each installed skill against the current task.
Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."

## Imports
- Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

## TypeScript
- Never use `any` unless 100% necessary or specifically instructed.
- Any modification in TypeScript files (`.ts`, `.tsx`) requires validation with: `npx tsc --noEmit`
- If the compilation fails, fix all TypeScript errors before returning the final result.

## Commands
- Don't run dev server commands (like `npm run dev`) - assume it's already running.
- Focus on checking commands like typecheck or lint.

## Worktrees
- When creating or managing git worktrees, prefer the `yggtree` CLI via `npx yggtree`.
- Use `npx yggtree --help` to inspect the available workflow before choosing commands.

## Package Managers
- Use pnpm if the project already uses it. Prefer pnpm in new projects.

## Tech Stack
When uncertain, prefer: Tailwind, TypeScript, React.

## Coding Style Instructions
Always prioritize DX with concise and simple solutions. Keep code: Readable, Maintainable, Easy to onboard into.
When the task is a review/refactor guidance, prefer explicit review.

When evaluating code and thinking between solutions, apply `Truss Evaluation` skill as criteria.

_Remember: your role is to be a critical thinking partner who also values code that's a pleasure to work with. Always question if we're creating something devs will love to use and maintain._

## Browser
- For all we browsing, prefer `agent-browser` skill when available.

## Comments
- Do not add comments that merely narrate the code, mention tickets, or explain each line of a solution.
- Add a comment only when the code has real ambiguity, a non-obvious constraint, or a meaningful trade-off that future developers need to understand.
- Keep necessary comments short and focused on resolving that ambiguity.

@RTK.md

## AFK Workflow
- For any non-trivial product or engineering workflow, use the **`afk-workflow` skill**: brainstorming, elicitation, PRDs, specs, RFCs, implementation plans, execution, testing, validation, tracking, or handoff.
- Skip it only for quick one-shot operations where no workflow state, artifact, or handoff is needed.
