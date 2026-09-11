---
name: afk-setup-project
description: Agree on a new web project's stack and scaffold it using AFK preferences.
disable-model-invocation: true
---

# Setup Project

Carry forward the `AGENTS.md` requirements: TypeScript, Tailwind CSS v4, and linting.

## Agree, then scaffold

1. Read the conversation, brief or spec, prior planning or grilling decisions, existing files, and applicable rules. Identify known capability and tooling needs; treat choices already specified by the user as settled. Ask for missing requirements that affect the stack, including application scope, deployment constraints, and foreseeable needs.
2. Recommend the framework and relevant core choices using the preferences below. Explain departures briefly. Discuss database and ORM choices with the user when persistence is needed; mark unnecessary capabilities as out of scope.
3. Confirm unresolved choices and wait for the user's answer before scaffolding. Once the stack is agreed, scaffold the project, initialize its registries, and configure the required checks using current official tooling. Preserve any existing work.
4. Run the configured lint, formatting, typecheck, and build checks. Report the selected stack, how to run the project, and any verification gaps.

## Preferences

- **Curated tools:** before recommending libraries or tools for identified needs, use `use-logbook-notion` to search Logbook Treasures by the closest `Category`. Prefer suitable curated options that fit the project's constraints; report unavailable access or missing matches rather than implying the lookup succeeded.
- **Framework:** prefer Next.js first, then TanStack Start, then Vite. Recommend a fallback when current and foreseeable needs do not justify the earlier option.
- **Routing:** use the framework's integrated router. With Vite, choose React Router or TanStack Router rather than hand-rolled routing.
- **Data fetching:** use TanStack Query for client-side fetching, caching, and server state.
- **Tables:** use TanStack Table for table logic when needed.
- **Component registries:** initialize shadcn for new web projects so `components.json` supports registry use over time.
- **Backend:** when a separate backend is needed, choose NestJS or Node.js with Express or Fastify based on scope and complexity.
- **Database and ORM:** recommend suitable options based on persistence, hosting, and operational needs; agree on them with the user.
