# AFK pivot: design brief

Status: Leonardo approved the finished Open Design Fieldwork proposal for implementation on 2026-10-01.

## Authority

Use [the product spec](afk-pivot.md) for behavior. Preserve the AFK name. Create a fresh application design rather than translating the inline prototype's layout.

The approved visual authority is [the complete Open Design export](../references/afk-pivot/open-design/afk-fieldwork.html), preserved with its assets and provenance. Brilliant alternatives and the inline prototype are historical exploration, not implementation references. Inherit the AFK website palette and typography from root DESIGN.md.

## Outcome

A user should immediately understand what each section manages, whether an action is global or project-scoped, and what enabling, disabling, and manual invocation change. Favor clear controls, few necessary clicks, quiet hierarchy, and an elegant operational interface.

The current prototype is behavioral evidence and an anti-reference for unresolved UX. Its repeated rows, ambiguous state labels, inline forms, instructional clutter, and simulated inventory should not define the final interface.

## Required surfaces

- Profiles: shared definitions, per-profile scope selection beside activation, separate manual group invocation, source discovery and member selection during creation, and a clear preparation state.
- Installed Skills: inventory scoped to global or a selected project; project scope excludes global-only entries; inspection and invocation preferences are accessible without spreading unrelated actions across each row.
- Favorite skill sources: lightweight repository bookmarks, link copying, per-source install command copying, and a combined install script. No installation runs from this page.
- Tools: always global, with saved install and update commands, explicit execution, output/result states, add/edit/remove management, and no project control.
- Settings: selectable configuration-file location, export/import, and project definitions through folder browsing. No profile activation controls in project creation.

## Important flows and states

- Create a shared profile from a repository or existing skills; select members and prepare missing copies disabled.
- Enable a profile in one target without affecting another. Show selected-target state and global availability distinctly.
- Invoke a disabled profile manually without creating discovery links. Explain supporting resources and agent command entry at the point they matter.
- List project links and project-local skills without implying that the entire global library is installed there.
- Edit a tool with an empty update command and visibly explain the install-command fallback.
- Remove a tool entry without implying uninstall.
- Run a tool command in a global context and see pending, success, and failure results.
- Add a project with home-rooted folder navigation, breadcrumbs, parent navigation, folder selection, suggested naming, and optional path policy.
- Select a settings-file location in a synced folder without implying AFK provides synchronization.
- Import configuration, reconnect paths, and prepare/apply explicitly without executing saved commands automatically.

Empty, loading, error, partial preparation, missing path, overlapping profile ownership, and existing-file collision states must be designed where relevant. Keep the information necessary to act visible; move explanations and infrequent controls into appropriate details.

## Implementation boundary

The user authorized importing the complete finished design and implementing the pivot in the repository. Preserve the original exported proposal as a reference. Replace simulated state with real local operations; do not publish or release as a side effect.

## Direction contract

THESIS: A full-width profile ledger keeps a reusable skill group and its relevant actions together. It avoids an expanding activation matrix and avoids treating profiles as project-owned.

OWN-WORLD: AFK field paper, warm-paper navigation, ocean primary actions, Poppins interface text, IBM Plex Mono for commands and paths, hairline rules and restrained rounded controls. No new identity.

STORY: Choose a shared profile, inspect its members, choose the target beside activation, or retrieve its instructions once. Tools remain visibly global; project inventory and project definitions stay in their own areas.

FIRST VIEWPORT: A compact left navigation rail and a full-width ledger, with focused dialogs for creation, inspection, and commands. Responsive navigation preserves access to the five sections without squeezing desktop rows into mobile widths.

FORM: Open Design Fieldwork, selected and polished by Leonardo. External approved-export exception: no concept roll or seed is required; the supplied and explicitly approved design is the authority. Signature interaction: choosing another activation target changes displayed state without changing availability; applying the action changes only that target. Profile reading opens instructions and a copyable CLI command; it does not claim to inject into another conversation.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

This delivery is a runnable local application. Preserve root DESIGN.md; record app-specific decisions separately.
