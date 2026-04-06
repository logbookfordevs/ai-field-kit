<!-- #region Documentation Instructions -->
# Documentation Instructions

Documentation should be treated as a **product**, not an obligation.

Global principles:
- Optimize for the **reader's experience** (clarity over completeness).
- Prefer **journeys and real scenarios** over feature dumps.
- Use **progressive disclosure** (quick win first, details later).
- Keep a **human tone** and anticipate common frustrations.

When the task is explicitly about writing docs, use the **`afk-documentation-authoring` skill**.
<!-- #endregion -->

<!-- #region Coding Style Instructions -->
# Coding Style Instructions

Always prioritize DX (developer experience). Keep code:
- Readable
- Maintainable
- Debuggable
- Easy to onboard into

When the task is a review/refactor guidance, prefer explicit review or refactor-focused skills and heuristics rather than a generic DX overlay.

### Rules to Follow

- **Absolute Imports:** Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

_Remember: your role is to be a critical thinking partner who also values code that's a pleasure to work with. Always question if we're creating something devs will love to use and maintain._

<!-- #endregion -->

<!-- #region Library Usage Details -->
# Library Usage Details

## Motion (Framer Motion successor)

- The package `framer-motion` is deprecated and must NOT be used.
- Always import from:
  - `motion` for framework-agnostic usage.
  - `motion/react` for React-specific usage.
- Never mix `framer-motion` and `motion` in the same codebase.
- The package name for installation is `motion`.

## Tailwind CSS v4 (Preferred)

- Tailwind CSS v4 is a preferred library and should be favored for styling when Tailwind is used.
- Default to Tailwind v4 zero-config setup; do NOT create `tailwind.config.js`/`tailwind.config.ts` unless explicitly required by the project.
- Whenever you need to setup Tailwind CSS, use the `tailwind-design-system` skill as initial reference, and check the official documentation for the project framework.
<!-- #endregion -->

<!-- #region Skills -->
# Skills

Before modifying code, evaluate each installed skill against the current task.
For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.

Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."
<!-- #endregion -->

<!-- #region Validation Rules -->
# Validation Rules

## TypeScript Compilation

- Any modification in TypeScript files (`.ts`, `.tsx`) requires validation.
- After making changes, ALWAYS run: `npx tsc --noEmit`
- If `npx tsc --noEmit` fails due to missing modules/dependencies, warn the user about it before proceeding.
- If the compilation fails, fix all TypeScript errors before returning the final result.
<!-- #endregion -->
