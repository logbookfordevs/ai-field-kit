---
name: AFK Fieldwork
description: A quiet paper ledger for local skills, shared profiles, saved commands, and agent rules.
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
  mobile-headline:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  dialog-title:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
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
    fontSize: "16px"
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
  hint:
    fontFamily: "Poppins, 'Avenir Next', 'Segoe UI', sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
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
  rule-editor:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    typography: "{typography.code}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
  reference-suggestion-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.compact}"
    padding: "6px 10px"
  diff-panel:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.panel}"
    padding: "8px 0 10px"
  import-mapping:
    textColor: "{colors.fg}"
    padding: "10px 0"
---

# Design System: AFK Fieldwork

## Overview

**Creative North Star: "AFK Fieldwork"**

Fieldwork translates the AFK field notebook into a calm operational ledger. Paper tones hold the workspace; ocean actions and ink rules establish hierarchy. Poppins carries the interface, while IBM Plex Mono makes commands, paths, and skill identifiers distinct.

This document applies only to `packages/afk/web`; repository-root DESIGN.md retains the shared brand. Source evidence is the shipped `index.html` stylesheet and templates, `client.js`, `rules.js`, `onboarding.js`, and bundled fonts. The approved direction is `docs/specs/afk-pivot-design.md`; product behavior remains in the app specifications. The build uses Field Paper for both rail and canvas. The refinement keeps that identity while making ledgers denser, metadata readable, and secondary explanations collapsible.

**Key Characteristics:**

- Open ruled ledgers with grouped actions and visible scope.
- Paper surfaces, ocean primary actions, and verdigris focus.
- Compact Poppins hierarchy with mono commands and paths.
- Focused native dialogs, a dismissible Welcome, and compact native mobile navigation.

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

- **Headline:** Page titles use the frontmatter headline role; at the mobile breakpoint they use the mobile-headline role.
- **Title:** Section titles use the title role. Profile-name links retain that size with 1.3 leading and subtle negative tracking. Dialog titles use the dialog-title role.
- **Item title:** Skill and tool names use the item-title role.
- **Body:** The body role establishes the default rhythm. Paragraphs cap at 65ch; page descriptions cap at 60ch and use 14px supporting text.
- **Control / label:** Buttons use the control role, with primary weight 600. Native field labels use the label role with a 6px gap. Supporting metadata, hints, and form errors use 13px; hints have 1.5 leading. Table labels and status text use sentence case Poppins at 13px/1.5. Mobile native fields become 16px.
- **Code / tag:** Commands and paths use Plex Mono. Command previews use the code role; inline commands use 1.55 leading. Tags use the compact tag role.

### Named Rules

**The Interface and Coordinates Rule.** Poppins carries headings, prose, and controls; Plex Mono distinguishes runnable commands, filesystem paths, and skill identifiers.

## Layout

The desktop shell is a 228px sticky rail beside a flexible workspace. The rail fills the viewport height. Main content caps at 1320px, with `20px clamp(20px,4vw,56px) 40px` padding. The top context row and footer use quiet horizontal rules. Page headings pair title/description with an action; their margin is `24px 0`.

Ledgers start with an Ink top rule and use quiet row dividers. Standard rows use `14px 16px` padding. Profiles use `16px` padding, a 24px gap, and `minmax(0,1.15fr) minmax(320px,1fr)` columns. A vertical rule with 28px inset separates scope controls from profile details. Settings pair a 200–280px description column with a flexible form column. Repeated gaps draw from the frontmatter spacing steps rather than a fabricated universal scale.

At 1180px and below, skill/tool and destination column headers disappear and rows rearrange into labeled groups. Destinations retain a 44px selection column, file identity and actions on the first row, and status/last-sync metadata below. At 1000px and below, the rail narrows to 184px; profiles, settings blocks, and notes become single-column, with profile scope moving below a horizontal rule.

At 760px and below, the rail becomes a compact sticky header with the 26px brand, a native Section select, and a More control for a native utilities popover. The desktop navigation, counts, top context row, and rail footer disappear. Main gutters are 16px; page headings use `20px 0 18px` margins. Profile and ledger rows use `14px 0`; the scope select and 130px action share one row. Tool commands and source actions rearrange; settings paths wrap below project names. Dialog bodies use 18px padding and 14px gaps, ordinary dialogs widen to viewport minus 16px and cap at 92vh, and toasts use 12px side and bottom offsets. At 480px Welcome columns stack; the header stays sticky. At 360px the Section select narrows from 150px to 130px.

The rule workbench pairs a 232px file list with a flexible editor, separated by a quiet vertical rule and a 24px editor inset. At 1000px the file column narrows to 190px. At 760px the workbench becomes one column: file buttons wrap above the editor, the vertical rule becomes a horizontal divider, and the editor loses its side inset. Editor minimum height falls from 420px to 300px. Destination rows stack identity, status, last sync, and actions beside the retained selection column; the sync action fills the available width.

**The Ledger Reflows Rule.** Narrow layouts move related controls below their item while a compact Section select preserves access to all six sections.

## Elevation & Depth

Resting workspace surfaces are flat. Paper fills and hairline boundaries establish grouping; shadows belong to temporary overlays. There are no decorative map layers or background grids in this application.

### Shadow Vocabulary

- **Dialog:** `0 28px 64px -28px color-mix(in srgb,var(--fg) 55%,transparent)`.
- **Toast:** `0 16px 40px -20px color-mix(in srgb,var(--fg) 70%,transparent)`.
- **Reference suggestions:** `0 18px 36px -22px color-mix(in srgb,var(--fg) 55%,transparent)`, confined to the temporary listbox within the editor.

The dialog backdrop mixes Ink at 38% with transparency. Native modal behavior supplies the interaction boundary.

**The Overlay Depth Rule.** Reserve soft elevation for dialogs, reference suggestions, and toast feedback; keep ledger rows flat.

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

Desktop section controls have transparent backgrounds and left-aligned labels, with mono counts on the right. Hover uses Warm Paper. Current-page navigation uses Surface, a Rule border, and 600 weight, paired with `aria-current="page"`. Mobile uses a labeled native Section select and More popover beside the brand; count metadata is hidden. The 220px Surface popover has a strong control border and left-aligned utility actions. Folder breadcrumbs wrap, identify the current location, and retain parent navigation.

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

### Rule Workbench and Destinations

The canonical document and its reference files use an open ruled workbench. File controls are mono, have 44px targets, wrap long filenames, and identify the current file through Surface fill, a Rule border, and 600 weight. Edited/new indicators are plain Rust Deep text. The editor has a mono filename heading, explicit saved/unsaved state, adjacent save/revert actions, a vertically resizable light textarea, and a Verdigris caret. Supporting paths and reference counts wrap below it. Retained drafts use a Warm Paper strip with restore/discard controls.

Destinations extend the ledger rather than introducing cards: selection, file identity/path, explicit status/reason, last successful sync, and grouped actions remain together. Rule states suppress the incumbent status pseudo-glyphs. Save and sync remain visually separate operations; sync opens a preview, and blocked destinations expose a conflict review action.

### Reference Suggestions

Typing `{{` in the canonical editor opens a positioned native-style listbox, capped at 340px and the available editor width. Surface fill, a strong stroke, compact corners, and temporary depth separate it from the textarea. Options have 44px minimum targets; keys are mono and metadata is muted, with long metadata ellipsized. Hover uses Warm Paper; the selected option uses Deep Ocean and Lantern for both key and metadata. Keyboard selection, insertion, dismissal, and a polite status announcement accompany pointer selection. Keyboard hints use 13px mono keycaps and disappear on touch devices. Entry fades over 120ms with the source easing; reduced motion removes it.

### Diff Review and Import Mapping

Sync previews and conflict comparisons extend the native dialog to a 900px desktop width cap. Each destination uses a ruled plan section with identity/path, status, explanatory text, and expandable diffs. Diff panels use Ocean/Lantern, mono text (12.5px/1.65), a 30px marker gutter, wrapping lines, and a 340px maximum scrolling height. Added lines mix Verdigris at 42% into Ocean; removed lines mix Rust Deep at 36%. Plus/minus markers and screen-reader added/removed labels supplement color. Long unchanged runs fold into plain mono context labels; the comparison region remains keyboard focusable.

Import review uses the same wide dialog and ordinary labeled inputs. Project folder mappings precede destination mappings; each destination is a quiet ruled group (10px vertical padding) with an unchecked selection control and a local-file-path input. Conflict dialogs put the destination identity and consequences before the comparison. Both decisions use outlined buttons; the replacement action uses a Rust Deep outline and text. Each decision pairs a heading with explanatory prose, then stacks its action below at the mobile breakpoint. Configuration/rule import remains distinct from destination sync, with adjacent errors. The rules folder context and Settings JSON actions use collapsed native details; the main Settings view keeps the AFK folder and ZIP actions visible. Favorite sources keeps installation destination and the copy-all action visible, with optional Installation agent selection inside native details.

### Profile Member Picker

The native dialog separates repository and local sources with a compact radio group; its radio controls remain 18px wide beside their labels. A labeled search field, selection count, Selected only toggle, and text actions sit above a scrolling checkbox list capped at `min(36vh,360px)`. Rows have 48px minimum targets; descriptions use 13px/1.5 Poppins and clamp to two lines. Search filters names and descriptions while retaining checked members; selected-only state uses Ocean fill plus `aria-pressed`. An empty result explains how to adjust the filters. Favorite-source dialogs reuse this picker after choosing Choose skills; All skills keeps it hidden. Source rows show All skills or a native disclosure containing the selected names.

Invocation remains a native select. For Global inheritance, different agent outcomes or unreadable metadata, an outlined SVG information icon sits to its left in a 44px button. Native popover behavior exposes the explanation on click, keyboard activation or touch; Escape and outside clicks dismiss it. The panel uses the existing Paper surface and temporary elevation, stays within the viewport, and repositions on scroll and resize. No secondary line changes the select/Inspect alignment.

### Welcome

Welcome extends the native dialog to `min(720px,calc(100vw - 32px))`. A 16px introduction leads into ruled explanatory sections with 16px item titles and 14px supporting copy. Related choices use two columns with a 16px gap, stacking at 480px. Secondary guidance uses a collapsed details section. The footer offers dismissal and ordinary destination actions, with one Ocean primary action. Welcome can be reopened from app help.

## Do's and Don'ts

### Do:

- **Do** use ocean actions, light controls, ink hierarchy, and quiet ruled ledgers.
- **Do** preserve the separate profile details, scope control, and explicit state text.
- **Do** retain the native mobile Section select and More utilities and stack row controls when space narrows.
- **Do** keep command and path text wrapping, visible focus, native dialogs, and reduced-motion support.
- **Do** keep save errors next to the entered form and retain the entered values.
- **Do** preserve selected members while filtering and put secondary explanations in native details.

### Don't:

- **Don't** replace open ledger rows with elevated decorative card grids.
- **Don't** use Rust Deep as the ordinary primary-action fill.
- **Don't** make state depend only on color or motion.
- **Don't** promote inherited text-glyph icons into reusable design rules.

Not canonized: folder navigation retains a Unicode chevron. The craft floor excludes text-glyph icons from reusable design rules; this documentation does not create a token or preview for it. It remains untouched because this handoff owns documentation only.

### Sources & Stacks

The shared Sources & Stacks page retains the ruled source ledger and its optional
agent selector. A wrapping page-action group contains Add source, Create stack,
and Import stack; installation destination affects copied commands only. Sources
and Stacks have distinct headings. Each stack identifies its source count, selected
member count, and local or remote provenance. A native disclosure groups members
under their original repository references. Stack controls copy a script, edit,
export JSON, explicitly refresh a remote manifest, or remove the saved definition.

Import uses the native dialog with JSON/HTTPS choices and retains invalid input.
Creation selects existing explicit source selections; all-skills bookmarks remain
outside this flow. Review shows the proposed source groups and a disclosure of the
saved version before complete replacement. Refresh and saving remain separate from
installing and profile activation. Stack groups use flat ruled boundaries; mobile
controls follow the same two-column ledger action pattern without horizontal overflow.
