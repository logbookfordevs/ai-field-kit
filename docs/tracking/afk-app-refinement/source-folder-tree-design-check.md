# Source folder tree design check

Disposition: preserves the incumbent AFK Fieldwork system. No changes made to
`packages/afk/web/DESIGN.md` or `packages/afk/web/.impeccable/design.json`.
This is an ordinary extension of the existing member picker, without a new world,
palette, typography role, or shipping raster asset.

## Evidence checked

- `PRODUCT.md`, the scoped app `DESIGN.md`, its design sidecar, and Impeccable's
  `reference/document.md`.
- `packages/afk/web/index.html`: existing color/font properties, picker and native
  dialog styles, plus folder summary, nesting, count and path treatments.
- `packages/afk/web/members.js`, `sources.js`, and `client.js`: native details and
  checkbox rendering, inline SVG icons, discovery paths, filtering, retained
  selections, flat fallback, and bookmark save shape.
- All five captures in `.impeccable/review/source-folder-tree/`: `desktop.png`,
  `desktop-folders.png`, `selected.png`, `mobile.png`, and `mobile-folders.png`.
  Captures show desktop and 390px layouts, collapsed folders, selected leaves,
  textual counts, and the existing Verdigris focus treatment.
- `source-folder-tree.md` records separate interaction verification and a finish
  reviewer ship disposition; this documentation comparison does not rerun them.

## System comparison

The tree keeps Field Paper and Surface, Ink and Muted text, quiet Rule dividers,
Warm Paper hover, Ocean selection/actions and Verdigris focus. Poppins remains
the interface face; folder coordinates use Plex Mono. The existing type ramp
remains 32px page headings (26px mobile), 22px dialog titles, 20px section titles,
16px item/body text, 14px controls, and 13px supporting copy, with 12px compact
metadata.

The Ocean Carries Operations and Interface and Coordinates rules still hold.
Ledger Reflows is visible in wrapped mobile selection controls and readable
nested rows. Overlay Depth remains confined to the native dialog; folders are
flat ruled disclosures, not elevated cards. Folder summaries retain 44px minimum
targets and member rows retain 48px targets. Inline drawn SVG folder/chevron
icons avoid introducing text-glyph icon rules.

Path-aware discovery extends the documented name/description search while
preserving selection and native controls. Repository paths are discovery-only;
saved bookmarks retain source references and skill names. This task-specific
behavior does not warrant changing normative design tokens or regenerating the
sidecar.

## Drift not canonized

The incumbent design record already excludes the unrelated folder chooser's
Unicode chevron from reusable rules. It remains outside this extension. The
paper palette and dialog-shadow detector advisories match recorded incumbent
choices and do not justify maintenance changes. No new defect is canonized.
