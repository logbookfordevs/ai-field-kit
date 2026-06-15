---
name: afk-ui-registry-preferences
description: Reference map for choosing UI registries, component primitives, and headless foundations in React/Tailwind frontend work. Use when a task needs a mature UI primitive, registry block, shadcn/ui component, community registry, or headless component foundation.
metadata:
  short-description: Choose preferred UI registries and primitives without defaulting blindly to shadcn.
---

# UI Registry Preferences

Pick the best-fit mature source for the UX problem, not a default registry by habit.

## Defaults

- Use existing repo components first when they already solve the interaction well.
- Use the project’s existing headless foundation if one exists. Otherwise prefer Base UI.
- Prefer mature primitives or registry components when they materially improve UX, accessibility, responsiveness, or interaction quality.
- Custom-build when the interaction is project-specific or registry adaptation would cost more than it saves.

## Preferred Sources

- `shadcn/ui`: app primitives, forms, tables, dialogs, sheets, sidebars, command menus, and dashboard surfaces.
- `Shadcn IO - AI`: AI-focused shadcn component references.
- `AI Elements`, `Assistant UI`: AI chat, assistant, and generative interface components.
- `KiboUI`: richer shadcn-compatible app components when the base primitive is too plain, especially kanban and data-table surfaces.
- `COSS`: scroll areas and mixed app primitives.
- `MagicUI`, `Aceternity UI`, `React Bits`, `Animate UI`, `EldoraUI`, `PaceUI`, `Watermelon`, `Hover`, `Neobrutalism`: expressive sections, motion-heavy UI, animated interactions, and visual delight.
- `Motion Examples`: React animation reference when the interaction depends on Motion patterns.
- `Remocn`: Remotion-related UI and video composition references.
- `Soundcn`: sound-effect references when audio feedback is part of the UX.
- `HeadlessUI`: headless component reference when it fits the existing project foundation.
- `Lucide React`: default icon family unless the repo already uses another one.

## Selection Heuristic

1. Match the UX pattern first: navigation, sidebar, sheet, command menu, form, table, modal, or showcase effect.
2. Check whether the repo already has a component or registry convention.
3. Choose the source that gives the strongest user experience with the least long-term ownership cost.
4. If the repo is not configured for the best-fit registry yet, compare setup cost against the UX cost of the workaround.
5. Do not ship cramped, clipped, wrapped, or awkward mobile controls just to avoid setup work.
