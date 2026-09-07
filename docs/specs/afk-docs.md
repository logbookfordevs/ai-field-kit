# AFK Docs

## Scope and Mode

Read mode. Implement `/docs` within the existing AFK visual identity. The saved
HTML prototype is inspiration, not a pixel contract; the user explicitly asked
to improve its organization and clarity. Homepage changes are limited to access
to docs and loading the existing body font's normal weight.

## Reader and Outcome

A developer familiar with a terminal but new to AFK should preview setup, know
what the preview means, and apply only chosen changes. They should not need to
understand the entire catalog before starting.

## Direction

Start here, first setup, mental model, customization, reference, troubleshooting.
Keep the established Poppins, Literata, Plex Mono, field-paper and ocean system.
Desktop chapter rail, unframed reading column, lightweight on-page navigation.
Mobile uses a native chapter selector instead of a compressed sidebar.

## First Viewport

Product identity, short orientation, prerequisite, real preview command. The
command surface is the operational focal point, not an ornamental hero.

## Behavior and Quality Bar

Every chapter has a stable query URL; normal links support browser history and
deep links. Copy provides success and failure feedback. Heading anchors,
previous/next links, chapter filtering and its empty state, keyboard focus, and
mobile chapter selection must work. Keep long commands wrapping without page
overflow and keep content visible without animation.

## Evidence and Boundaries

Consequential commands and claims trace to packages/afk/src/cli.ts, setup.ts,
manifest.ts, package README, and package.json. No installation or setup command
is executed as documentation validation. Browser tests cover the docs, not
successful configuration of a real agent. No dependency installation authorized.
No unresolved design choice; user approved this direction directly, no seed key.

## Validation

- Production build and whitespace checks passed.
- All six chapters captured on desktop and mobile in `.impeccable/review/docs/`.
- Mobile checks found one H1 per chapter, no broken fragment targets, and no
  page overflow. Native chapter selection and the homepage Docs link navigated.
- Chapter filtering returned its empty state. Clipboard payload, success, and
  failure messages were tested with a browser-only clipboard stub.
- Impeccable reviewer found no material visual or craft defect. Its final
  disposition remains `fix` solely for an unavailable seed record: the reviewer
  could not apply the playbook's pinned-direction exception. No provenance was
  invented and no UI changes were requested by that verdict.
- The detector was not run: its updated launcher requires an unavailable binary
  download, and dependency installation was not authorized.
- No real AFK installation, configuration writes, or deployment was tested.
