# Favorite selections and invocation details

## Completed

- Favorite bookmarks default to All skills and optionally save selected names.
  The existing searchable profile picker supplies descriptions and retains choices
  through filtering. Empty or invalid selections never expand to all skills.
- Both per-source commands and the combined script honor each saved selection.
  Changing a source clears stale choices; saved selections can be edited offline.
  Missing names from a later scan stay visible until deliberately removed.
- Each source row has Copy install command, Edit, and Remove bookmark. The source
  remains selectable beneath its title.
- Conditional invocation explanations moved from secondary lines to a 44px
  information button left of the selector. The native popover supports click,
  Enter, Space, Escape, and outside dismissal. Desktop selectors and Inspect
  controls share their vertical alignment; the column leaves room for the icon.

## Evidence

All 101 regressions and the installer passed, as did typecheck, lint, build,
standalone JavaScript syntax, and `git diff --check`.

The isolated browser fixture confirmed real Skills CLI discovery, selection
retention after searching, persistence after reload, selection-aware clipboard
commands, editing without rediscovery, and clearing selection after changing a
source. A failed save retained the draft and selection with an inline error.
The inventory retained its original three Global skills and two project links.
No user skills or actual settings were changed; copied commands were not executed.

Desktop 1440×1000 and mobile 390×844 captures are in
`.impeccable/review/favorite-selection/`. The combined inspection found one clipped
desktop selector; the single repair/confirmation widened its column and verified
alignment and no horizontal overflow. Project inheritance and per-agent
differences still expose explanations; ordinary Global defaults have no icon.

Work remains local and uncommitted. Website edits are outside this pass;
`apps/site/src/docs/content/sources.mdx` needs a later update for optional selected
skill bookmarks and the removal of the source-copy button.
