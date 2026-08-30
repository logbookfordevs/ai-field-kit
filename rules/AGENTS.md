## Library Preferences
- Import animation APIs from `motion` or `motion/react`.
- Prefer the project's existing headless foundation; otherwise use Base UI.
- Use Tailwind CSS v4 without a configuration file unless the project requires one.

## Skills
State "I will use the X skill" whenever using a skill.

## Artifacts
Artifact location unresolved: read `{{AFK_RULES_DIR}}/artifacts.md`.

## Imports
- Prefer configured absolute imports such as `@/components/...`.

## TypeScript
- Avoid `any` unless necessary or specifically requested.
- TypeScript changes must pass the repository typecheck before handoff.

## Testing
- Add regression tests when they protect meaningful behavior. Test observable behavior; tautological tests that merely restate the implementation are harmful. Trivial copy and other low-risk changes do not require coverage.

## React
- Name compound JSX conditions before the return with domain-specific booleans. JSX conditions should contain one named boolean, optionally negated.
- For two mutually exclusive branches, name the deciding condition and use paired `&&` expressions, such as `{showsDetails && <Details />}` followed by `{!showsDetails && <Summary />}`.
- For three or more mutually exclusive branches, both named `&&` branches and a local render function with early returns are acceptable. Invoke a local render function as a function from JSX. Extract a component when the rendered section has a meaningful interface or obscures the surrounding structure.
- Keep short, flat ternaries for selecting non-JSX values such as strings, classes, or numbers. Hoist nested or hard-to-scan value expressions. Move repeated condition logic into a shared helper.

## Browser Testing
- Prefer `agent-browser` over Playwright CLI when available.

## Commands
- Treat the development server as already running and use the existing instance.

## Worktrees
- Prefer `yggtree` for worktree operations when available; consult `yggtree --help` before using native Git worktree commands.

## Package Managers
- Use the project's existing package manager; use pnpm for new projects.

## Tech Stack
- For new web applications, prefer React, TypeScript, and Tailwind CSS v4. Prototypes may use the stack that best fits the experiment.

## Frontend UX Defaults
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Mobile is not degraded desktop; replace cramped, wrapped, clipped, or awkward controls with responsive patterns.
- Push back when implementation convenience would materially degrade the user experience.

## Decision Quality
Use Truss Evaluation for consequential comparisons and critiques across plans, architecture, investigations, and code.

## Comments
- Keep code comment-sparse. Use comments only to preserve enduring, non-obvious invariants, dangerous edge cases, external contracts, or trade-offs; describe lasting behavior rather than task history.

## Sub-agents
When spawning sub-agents, use the `afk-architect` skill as the coordination policy.
