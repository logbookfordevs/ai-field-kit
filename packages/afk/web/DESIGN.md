---
name: AFK Fieldwork
description: A quiet paper ledger for local skills, shared profiles, and saved tool commands.
colors:
  bg: "#f3eddf"
  surface: "#fffaf0"
  fg: "#17201e"
  muted: "#5d6964"
  border: "#b9c0b7"
  accent: "#102c2c"
  accent-hover: "#24302c"
  warm: "#e9ddc9"
  accent-fg: "#f4efde"
  focus: "#3f8580"
  danger: "#8f3f2d"
typography:
  headline:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.35
  item-title:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  control:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.02em"
  label:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 500
  code:
    fontFamily: "'IBM Plex Mono', SFMono-Regular, Consolas, monospace"
    fontSize: "13px"
    lineHeight: 1.7
  tag:
    fontFamily: "'IBM Plex Mono', SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    lineHeight: 1
rounded:
  compact: "4px"
  control: "6px"
  panel: "8px"
  switch: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  control: "16px"
  lg: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.control}"
    padding: "0 6px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  navigation-current:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  tag:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.tag}"
    rounded: "{rounded.compact}"
    padding: "6px 8px"
  path-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.control}"
    padding: "12px 12px 12px 16px"
  code-panel:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.code}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
---

# Design System: AFK Fieldwork

## Overview

**Creative North Star: "AFK Fieldwork"**

Fieldwork translates the AFK field notebook into a calm operational ledger. Paper tones hold the workspace; ocean actions and ink rules establish hierarchy. Poppins carries the interface, while IBM Plex Mono makes commands, paths, and skill identifiers distinct.

This document applies only to `packages/afk/web`. The repository-root DESIGN.md remains the incumbent AFK brand record. Source evidence is the shipped `index.html` stylesheet and templates, `client.js` runtime states, and bundled fonts. The approved direction is `docs/specs/afk-pivot-design.md`; product behavior is owned by `docs/specs/afk-pivot.md`. Captures under `.impeccable/review/fieldwork/` evidence the desktop/mobile ledger, folder navigation, empty inventory, and save-error states. The build uses Field Paper for the rail as well as the canvas, despite the direction contract's warm-paper-navigation wording.

**Key Characteristics:**

- Open ruled ledgers with grouped actions and visible scope.
- Paper surfaces, ocean primary actions, and verdigris focus.
- Compact Poppins hierarchy with mono commands and paths.
- Focused native dialogs and five accessible sections on mobile.

## Colors

Warm paper provides the material; ocean and ink provide operational structure. Frontmatter records the reused source colors, without introducing a second palette.

### Primary

- **Deep Ocean** (`accent`): Primary actions and command panels.
- **Ocean Hover** (`accent-hover`): Primary-action hover and toast-action hover.
- **Verdigris** (`focus`): Visible keyboard focus.

### Secondary

- **Rust Deep** (`danger`): Destructive text, inline validation, and error boundaries. Meaning is also stated in text.

### Neutral

- **Field Paper** (`bg`): Canvas, navigation rail, and dialog footer.
- **Surface** (`surface`): Controls, member tags, selected navigation, and small path panels.
- **Ink** (`fg`): Main text, ledger top rules, and enabled switches.
- **Muted** (`muted`): Supporting prose and metadata; also the stronger form-control border.
- **Rule** (`border`): Quiet dividers and panel boundaries.
- **Warm Paper** (`warm`): Hover fills and readonly/sunken fields.
- **Lantern** (`accent-fg`): Text on ocean actions and command panels.

### Named Rules

**The Ocean Carries Operations Rule.** Deep Ocean anchors primary actions and commands; Rust Deep communicates errors and destructive actions.

## Typography

**Display and Body Font:** Poppins, with Avenir Next, Segoe UI, and sans-serif fallbacks.
**Label/Mono Font:** IBM Plex Mono, with SFMono-Regular, Consolas, and monospace fallbacks.

Bundled Poppins loads normal 400, 500, and 600; Plex Mono loads normal 400 and 600. The interface is compact and functional. Literata and Caveat from the broader brand are not used in this app.

### Hierarchy

- **Headline:** Page titles use the frontmatter headline role; at the mobile breakpoint the size becomes 26px.
- **Title:** Section titles use the title role. Profile-name links retain that size with 1.3 leading and subtle negative tracking. Dialog titles use 22px and -0.01em tracking.
- **Item title:** Skill and tool names use the item-title role.
- **Body:** The body role establishes the default rhythm. Paragraphs cap at 65ch; page descriptions cap at 60ch and use 14px supporting text.
- **Control / label:** Buttons use the control role, with primary weight 600. Native field labels use the label role with a 6px gap. Supporting metadata uses 13px; hints and errors use 12px.
- **Code / tag:** Commands and paths use Plex Mono. Command previews use the code role; inline commands use 1.55 leading. Tags use the compact tag role.

### Named Rules

**The Interface and Coordinates Rule.** Poppins carries headings, prose, and controls; Plex Mono distinguishes runnable commands, filesystem paths, and skill identifiers.

## Layout

The desktop shell is a 228px sticky rail beside a flexible workspace. The rail fills the viewport height. Main content caps at 1320px, with `20px clamp(20px,4vw,56px) 40px` padding. The top context row and footer use quiet horizontal rules. Page headings pair title/description with an action; their margin is `36px 0 28px`.

Ledgers start with an Ink top rule and use quiet row dividers. Standard rows use `22px 16px` padding. Profiles use `26px 16px` padding, a 32px gap, and `minmax(0,1.15fr) minmax(320px,1fr)` columns. A vertical rule with 28px inset separates scope controls from profile details. Settings pair a 200–280px description column with a flexible form column. Repeated gaps draw from the frontmatter spacing steps rather than a fabricated universal scale.

At 1180px and below, skill/tool column headers disappear and rows rearrange into labeled groups. At 1000px and below, the rail narrows to 184px; profiles, settings blocks, and notes become single-column, with profile scope moving below a horizontal rule.

At 760px and below, the rail becomes a sticky top navigation with five equal columns and shorter labels. Counts and rail footer disappear. Main gutters become 16px. Profile and ledger rows use `20px 4px`; scope controls stack and fill the width. Tool commands and source actions rearrange; settings paths wrap below project names. Dialogs widen to the viewport minus 16px and cap at 92vh. Toasts use 12px side and bottom offsets.

**The Ledger Reflows Rule.** Narrow layouts move related controls below their item and shorten section labels while preserving access to all five sections.

## Elevation & Depth

Resting workspace surfaces are flat. Paper fills and hairline boundaries establish grouping; shadows belong to temporary overlays. There are no decorative map layers or background grids in this application.

### Shadow Vocabulary

- **Dialog:** `0 28px 64px -28px color-mix(in srgb,var(--fg) 55%,transparent)`.
- **Toast:** `0 16px 40px -20px color-mix(in srgb,var(--fg) 70%,transparent)`.

The dialog backdrop mixes Ink at 38% with transparency. Native modal behavior supplies the interaction boundary.

**The Overlay Depth Rule.** Reserve soft elevation for dialogs and toast feedback; keep ledger rows flat.

## Shapes

Controls and path cards use the control radius; dialogs, code previews, toasts, and empty states use the panel radius. Compact tags, inline commands, and keyboard hints use the compact radius. Switch tracks alone use the pill radius, with circular thumbs. Ledger rows and folder lists remain open and ruled.

Form boundaries use the stronger Muted stroke. Quiet panels use Rule. Empty states use a dashed boundary; errors use a Rust Deep boundary. These distinctions reflect function rather than decorative framing.

## Components

### Buttons

Primary actions are ocean-filled; ordinary actions are light bordered controls; text actions are underlined with transparent fill. Standard buttons have a 44px minimum height and 8px content gap. Hover changes the fill/border; primary hover lifts by 1px, while ordinary active state lowers by 1px. Disabled buttons use half opacity and suppress movement. Destructive text uses Rust Deep.

All keyboard focus uses a 2px Verdigris outline with 3px offset. Button color and border transitions take 160ms. Keep accessible names and native button behavior.

### Inputs / Fields

Inputs and native selects use light fill, a strong 1px control border, a 44px minimum height, and compact corners. Hover strengthens the border to Ink. Selects use a drawn SVG chevron. Textareas are mono with 88px minimum height, `10px 12px` padding, and vertical resizing. Readonly command fields use Warm Paper and mono text. Validation uses adjacent error text and an invalid border where the source applies `aria-invalid`.

### Navigation

Desktop section controls have transparent backgrounds and left-aligned labels, with mono counts on the right. Hover uses Warm Paper. Current-page navigation uses Surface, a Rule border, and 600 weight, paired with `aria-current="page"`. Mobile uses five sections across the sticky top bar; count metadata is hidden. Folder breadcrumbs wrap, identify the current location, and retain parent navigation.

### Tags / Containers

Skill members are compact bordered mono tags with a 6px wrapping gap. Path cards group a path and related action on a quiet light panel; mobile stacks their contents. Ordinary content lists use rules rather than repeating elevated cards.

### Profile Ledger

A profile groups its linked name, members, preparation text, and manual-read action beside its selected target and activation state. Scope selection updates the displayed target; action labels and adjacent state text express the selected scope. On narrow screens that scope block follows the profile details. Keep preparation, activation, and manual reading visibly distinct.

### Switches

Availability switches pair visible text with a 36px by 20px track and a 12px thumb. Enabled state uses Ink and a Surface thumb, translated 16px. Disabled switches keep the text at full opacity while dimming the track. State is expressed with `role="switch"` and `aria-checked`, not just color. Thumb movement takes 420ms with the source easing; color changes take 200ms.

### Dialogs, Commands, and Feedback

Native dialogs use a width capped at 640px, a ruled header, scrolling body, and Field Paper footer. The desktop cap is `min(88vh,860px)`; inner body padding is 24px with 18px gaps. Native close controls and autofocus support keyboard operation. Command panels wrap long lines and paths rather than requiring horizontal scrolling.

Dialog entry fades and rises from 14px over 420ms using `cubic-bezier(.32,.72,0,1)`; backdrop fade takes 300ms. Toasts fade over 250ms and move from 12px over 420ms. Ordinary feedback clears after 4.5 seconds; feedback with an action lasts 7 seconds. Toasts expose a polite live status. Request failures retain entered form values and show feedback inside the open form when an error region is available. Empty states state what is missing and the next action.

Reduced-motion preferences remove transitions and animations. The skip link appears on keyboard focus. Preserve explicit status text and wrapping content when extending these components.

## Do's and Don'ts

### Do:

- **Do** use ocean actions, light controls, ink hierarchy, and quiet ruled ledgers.
- **Do** preserve the separate profile details, scope control, and explicit state text.
- **Do** retain five-section mobile navigation and stack row controls when space narrows.
- **Do** keep command and path text wrapping, visible focus, native dialogs, and reduced-motion support.
- **Do** keep save errors next to the entered form and retain the entered values.

### Don't:

- **Don't** replace open ledger rows with elevated decorative card grids.
- **Don't** use Rust Deep as the ordinary primary-action fill.
- **Don't** make state depend only on color or motion.
- **Don't** promote existing uppercase eyebrows or text-glyph status marks into reusable design rules.

Not canonized: the shipped build carries uppercase eyebrow/kicker treatments and Unicode status/folder marks. The Impeccable craft floor prohibits those devices; this documentation records the defect without creating tokens or preview components for it. They remain untouched because this handoff owns documentation only. Historical root PRODUCT.md schema/register drift is outside this scoped app record; `impeccable init` owns any requested product-record refresh.
