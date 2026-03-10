<!-- #region Language Instructions -->
# Language Instructions

All responses, comments, and messages generated for pull requests, commits, and related activities **must always be written in English**. This ensures consistency and facilitates collaboration across international teams.
<!-- #endregion -->

<!-- #region Documentation Instructions -->
# Documentation Instructions

## DocX (Core)

Documentation should be treated as a **product**, not an obligation.

Global principles:
- Optimize for the **reader's experience** (clarity over completeness).
- Prefer **journeys and real scenarios** over feature dumps.
- Use **progressive disclosure** (quick win first, details later).
- Keep a **human tone** and anticipate common frustrations.

When the task is explicitly about writing docs, use the **`documentation-authoring` skill**.
<!-- #endregion -->

<!-- #region Coding Style Instructions -->
# Coding Style Instructions

## DX Principles (Core)

Always prioritize DX (developer experience). Keep code:
- Readable
- Maintainable
- Debuggable
- Easy to onboard into

When the task is a review/refactor guidance, use the **`dx-code-review` skill**.
<!-- #endregion -->

<!-- #region Coding Style Instructions -->
# Coding Style Instructions

**The user is obsessed with Developer Experience (DX)** – always prioritizes the developer's experience and loves code that's fun to read, understand, and work with.

### DX-Specific Questions:

- **Readability:** "How will another dev feel reading this code for the first time?"
- **Maintainability:** "What kind of experience will this code provide for someone who needs to debug it?"
- **Fun/Elegance:** "Is there a more elegant or expressive way to do this?"
- **Onboarding:** "Could a junior dev quickly understand the intention here?"
- **Debugging:** "What would the debugging experience be like with this approach?"

### Balancing DX with Other Factors:

- **Performance vs DX:** "Is it worth sacrificing some performance for clearer code?"
- **Simplicity vs Elegance:** "Are we being elegant or just overcomplicating things?"
- **Standards vs Innovation:** "Does this actually improve DX or is it just different for the sake of being different?"

### Provocative Questions for DX:

- "If you had to explain this solution to someone debugging a critical bug at 2am, how would it go?"
- "What emoji would you put next to this code? 😍, 🤔, or 😰?"
- "On a scale from 'reading Java documentation' to 'reading Rails code', where does this code fit?"

### Rules to Follow

- **Absolute Imports:** Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

---

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
- Before creating any Tailwind config file, verify there is a real need (for example, legacy compatibility or a project-specific requirement that cannot be solved with v4 defaults).
- Prefer v4-style configuration patterns and APIs over v3 conventions.
- Check the official documentation for the latest installation instructions for the specific project framework:
  - Vite: `https://tailwindcss.com/docs/installation/using-vite`
  - PostCSS: `https://tailwindcss.com/docs/installation/using-postcss`
  - Next.js: `https://tailwindcss.com/docs/installation/framework-guides/nextjs`
  - TanStack Start: `https://tailwindcss.com/docs/installation/framework-guides/tanstack-start`
<!-- #endregion -->

<!-- #region Validation Rules -->
# Validation Rules

## TypeScript Compilation

- Any modification in TypeScript files (`.ts`, `.tsx`) requires validation.
- After making changes, ALWAYS run:
  `npx tsc --noEmit`
- If `npx tsc --noEmit` fails due to missing modules/dependencies, install or sync dependencies first (for example, `pnpm install` or `npm install`) before modifying the codebase.
- Do not assume the code compiles.
- If the compilation fails, fix all TypeScript errors before returning the final result.
<!-- #endregion -->

<!-- #region Skills -->
Before modifying code, evaluate each installed skill against the current task.
For each skill, determine YES/NO relevance and invoke all YES skills before proceeding.
<!-- #endregion -->

<!-- #region Skill Transparency -->
# Skill Transparency

Whenever the agent decides to use a skill, it must explicitly state it in its response using direct phrasing, for example: "I will use the X skill."
<!-- #endregion -->
