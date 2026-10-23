# Source folder tree

Requested: show the original source folders while selecting skills for a favorite
bookmark, including repositories with grouped folders such as `agent-skills/3d`.

| Task | State |
|---|---|
| Preserve original repository directory metadata from Skills CLI discovery | Complete |
| Render expandable source folders with selection counts and folder-aware search | Complete |
| Verify retained selection, copied commands, fallback, and desktop/mobile behavior | Complete |
| Complete finish review and design-system comparison | Complete |

The existing picker, native controls, palette and typography remain the visual
authority. Repository folder labels come from Skills CLI metadata rather than
skill names. Missing paths retain the flat selection behavior. Stored bookmarks
keep source references and skill names; folder structure is discovery metadata.

Backend discovery and the picker can be implemented independently, then tested
together. Tests use temporary homes and fixture files, preserving real skills and
settings. Website, installed skills, publishing and Git delivery are outside scope.

## Verification

- Build, typecheck and CLI lint pass. All 150 tests and the installer checks pass;
  regressions cover original paths, missing/invalid metadata, filtering and saved
  selections without persisting directory metadata.
- Real Skills CLI discovery of MengTo/Skills found 157 skills grouped under
  `agent-skills` with eight category folders. Discovery used a temporary home,
  project and state directory, leaving user inventory untouched.
- Browser checks at 1440×1000 and 390×844 cover Enter/Space expansion, retained
  checkbox focus while counts update, folder-path search, selected-only filtering,
  saved bookmark editing and command generation. The fixture inventory stayed
  empty. Saved JSON contains source and skill names only.
- The browser denied clipboard reads; the test captured the text passed to the
  native clipboard writer and confirmed both copy actions use exactly the saved
  skill names. The native writer completed and displayed its copied status.
- Validated captures are in `.impeccable/review/source-folder-tree/`: `desktop.png`,
  `desktop-folders.png`, `selected.png`, `mobile.png`, and `mobile-folders.png`.
- One detector pass reported the existing paper palette and dialog shadow. Both
  are incumbent design choices retained for this ordinary extension.
- Website documentation is outside this change.
  `apps/site/src/docs/content/sources.mdx` still needs the folder-tree behavior
  described before publication.

## Finish review

Disposition: **ship**, limited to the folder-tree extension. The fresh reviewer
validated all five captures, confirmed hierarchy, search and fallback against
the source, and found no material fixes. Incumbent typography, paper/ocean palette,
native controls and quiet rules are retained. Backend and test conclusions rely
on the implementation verification above rather than the visual review.

The documenter compared source and all five captures against the incumbent design
system. DESIGN.md and its sidecar are preserved. Evidence is recorded in
`source-folder-tree-design-check.md`.
