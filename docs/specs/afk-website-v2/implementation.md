# AFK 2.0 website implementation

Date: 2026-10-01. Approved direction: [Brilliant proposal](proposal.md).
Artifact: `apps/site/`. Local preview: http://127.0.0.1:5173/.
This implementation is not a package release or website deployment.

## Direction contract

THESIS: Show occasional skill groups at work, rather than a setup router.
OWN-WORLD: Retain AFK's field paper, Ocean actions, Poppins, Plex Mono and ruled
ledgers, with restrained Literata accents.
STORY: Prepare a group, enable it for a target or read it with an agent, then
explore the supporting sections and first-run guide.
FORM: Leonardo approved the native Brilliant profile-first composition, then
said “you can jump straight to implementation now” with micro animations and
slightly bent elements. No randomized seed was run for this pinned direction;
the references and provenance are in the proposal and `work/` manifest.
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.

Home is Persuade: a visitor understands occasional skill groups, separate target
activation, and reading with an agent before meeting the supporting app sections.
Docs is Read: a developer can launch the source build and complete a specific
task without learning the old setup router.

The retained world is AFK's field paper, Ocean actions, Poppins, Plex Mono,
Literata accents and ruled ledgers. The approved Brilliant frames are layout and
content references for a code-led build; they are editable vector/UI designs,
not generated raster comps. No decorative raster plate is required.

FIRST VIEWPORT: the concrete Video tools profile shows three illustrative skill
members, a target beside Enable, its availability state, and a separate Use with
your agent control. The headline is “Bring the right skills to work.” The example
is explicitly labeled interactive and changes no real files or settings.

Signature interaction: a small stack of paper settles from an already-visible
state; focusing its controls straightens the top sheet. Enabling changes the
target's state and checkmark. Reading expands copyable instructions. The portable
settings sheet has a restrained tilt. Feedback is finite; there is no continuous
animation or scroll reveal. Reduced motion removes nonessential transitions and
moving transforms while keeping every action available.

## Coverage and quality bar

Home follows the approved profile / two workflows / five sections / portable
settings / tool boundaries / source build / legacy sequence. Ten MDX chapters
cover Start, Skills, Profiles, Agent reading, Sources, Tools, Settings, CLI,
Troubleshooting and Legacy. Six retired chapter IDs show a historical notice.

Command and article Markdown copying have visible feedback and recovery; copying
does not execute anything or start an agent conversation. Desktop has chapter and
heading rails. Mobile uses a native chapter selector and the existing mature home
menu primitive. Source builds remain primary until a published 2.0 is verified.

Preserve the approved composition and brand without reinstating the old routing
diagram. Demonstration values must be honest, controls must name actions, and
docs must stay legible on mobile. Judge visual quality separately from build
success. Required captures live in `.impeccable/review/site-v2/`.

## Validation record

Production build/typecheck, lint and all 11 site tests passed during implementation.
Browser checks confirmed independent demonstration targets, mobile menu dismissal
and returned keyboard focus, mobile reading layout, and command selection after
clipboard failure. Home's automated accessibility scan has zero violations;
paper-stack pseudo-elements require manual contrast checks.

The one detector pass returned no primary findings. Advisories concerned the
changed type/radius scale and one hover shade; that shade now derives from existing
tokens. The final design record must describe the actual shipped scale.
Final reviewer and documenter outcomes are recorded after their handoffs.

### Finish review

The fresh full review matched the approved brand, structure, task docs and honest
product boundaries. It required two fixes: mobile first-viewport coverage and the
filled animation suppressing focus straightening. The correction batch tightened
mobile spacing and introductory copy without reducing reading text or controls,
and changed settling to backwards-only fill.

The verdict scored both fixes resolved with `ship`; its scope is those two fixes,
with no regressions observed from that batch. The updated 390×844 capture shows
both actions and the example disclosure. Keyboard focus changes the settled
transform to the identity matrix; the focused capture shows the straight top
sheet and visible focus ring. Reduced motion still yields animation and transform
`none`. Build/typecheck, lint and all 11 site tests passed after correction.

Final evidence: home-desktop-final, home-mobile-final, home-desktop-viewport,
home-mobile-viewport, docs-desktop-final, docs-mobile-final, docs-mobile-viewport,
legacy-final and home-focus-final PNGs under `.impeccable/review/site-v2/`.
Social artwork was rendered from the authored SVG with the brand fonts. Both
shipping rasters carry origin metadata; the provenance scan has no missing items.

### Design handoff

The documenter recorded the built website in root `DESIGN.md` and
`.impeccable/design.json`, preserving the shared palette and local-app boundary.
The record includes actual type, corner, spacing, responsive, copy-recovery and
motion rules. The old routing and unused Caveat declarations are not active
patterns. No implementation or local-app design files changed in this handoff.
