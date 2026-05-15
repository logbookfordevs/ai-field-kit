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

## Workflow Framing
- Treat the path from PRD/spec to implementation plan as a **workflow slice**, not the whole delivery lifecycle.
- Work may start before this slice with brainstorming, discovery, elicitation, deep interview, or similar clarification flows.
- Work usually continues after this slice with execution, testing, verification, review, and approval gates.

### Artifact Boundaries
- **PRD** explains the product vision, motivation, and why the work matters.
- **Spec** explains the expected behavior, flow logic, and design intent. In smaller or solo contexts, it can absorb the PRD.
- **RFC** explains a proposed direction and invites review and feedback before implementation. In some team contexts, this document may be called an ERD.
- **Implementation Plan** is the technical execution artifact: files, types, interfaces, pseudocode, tasks, and build strategy.

### Artifact Storage
- Store generated workflow artifacts under `specs/<task-slug>/` by default.
- Use a concise kebab-case task slug, such as `smart-filters` or `checkout-retry-flow`.
- Use this folder for PRDs, specs, RFCs, implementation plans, testing plans, acceptance notes, and task-specific references.
- Prefer clear suffixes: `.prd.md`, `.spec.md`, `.rfc.md`, `.plan.md`, `.test-plan.md`, `.test-spec.md`, `.notes.md`.
- Keep passive fetched material, screenshots, exports, and source references under `specs/<task-slug>/references/` when they belong to the task.
- Treat these as local working artifacts unless the repo convention or the user says they should be committed.

### RFC Positioning
- RFC is **optional** and usually sits outside the core linear timeline, even when it happens between spec and implementation planning.
- Use RFC when external or cross-team feedback may change the spec, PRD, or implementation plan.

### Implementation Planning Doctrine
- An implementation plan should act as an **execution index**, not a restatement of every prior document.
- Prefer task-oriented plans with **on-demand references** to the exact prior docs, sections, or snippets needed for that task.
- Optimize plans to reduce **context rot** and keep room for the codebase context that implementation will need.
- Prefer a structure where **1 task can map to 1 clean agent session** when that improves focus, traceability, or parallel work.
- When prior docs already exist, treat them as the primary planning source of truth.

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
