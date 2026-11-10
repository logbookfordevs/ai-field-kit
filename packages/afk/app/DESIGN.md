---
name: AFK Fieldwork
description: A quiet paper ledger for local skills, your kit, saved commands, and agent rules.
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

This document applies only to the local app in `packages/afk/app/` (React, built into `packages/afk/web/`); repository-root DESIGN.md retains the shared brand. Tokens live as CSS custom properties in `app/src/styles/tokens.css`; shared components are in `app/src/components/` and can be seen together in `app/gallery.html` during development. The structure follows the redesign brief (`docs/specs/afk-app-redesign/brief.md`) and its prototype; product behavior remains in the app specifications. Field Paper fills both rail and canvas.

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
- **Title:** Section titles use the title role. Pack-name links retain that size with 1.3 leading and subtle negative tracking. Dialog titles use the dialog-title role.
- **Item title:** Skill and tool names use the item-title role.
- **Body:** The body role establishes the default rhythm. Paragraphs cap at 65ch; page descriptions cap at 60ch and use 14px supporting text.
- **Control / label:** Buttons use the control role, with primary weight 600. Native field labels use the label role with a 6px gap. Supporting metadata, hints, and form errors use 13px; hints have 1.5 leading. Table labels and status text use sentence case Poppins at 13px/1.5. Mobile native fields become 16px.
- **Code / tag:** Commands and paths use Plex Mono. Command previews use the code role; inline commands use 1.55 leading. Tags use the compact tag role.

### Named Rules

**The Interface and Coordinates Rule.** Poppins carries headings, prose, and controls; Plex Mono distinguishes runnable commands, filesystem paths, and skill identifiers.

## Layout

The desktop shell is a 228px sticky rail beside a flexible workspace (`app/src/shell/`). The rail fills the viewport height and holds the brand, the eight sections and a footer with the version and update action. Main content caps at 1240px with `36px clamp(20px,4vw,56px) 72px` padding. Every page starts with `Page`: an h1, an optional 60ch description, and its actions on the right.

Ledgers start with an Ink top rule and use quiet Rule dividers. A row (`Row`) is a grid of title block, aside and actions with a 64px minimum height and `12px 0` padding: a 15px semibold title, a 13px muted description and an optional mono meta line. Rare actions live in a ⋯ menu rather than more buttons.

At 960px and below the rail narrows to 196px. At 760px and below it is replaced by a sticky top bar with the brand, a native section select and a More menu holding the version, update and other utilities. Main gutters become 16px. Rows stack their aside and actions below the title; dialogs widen to the viewport minus 16px. Nothing scrolls horizontally: commands, paths and long names wrap.

**The Ledger Reflows Rule.** Narrow layouts move related controls below their item while the section select keeps every section one choice away.

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

Sections, in order: Overview, Skills, Packs, Sources, Agent rules, Tools, Backup, Settings. Rail links are left-aligned with transparent fill; hover uses Warm Paper, and the current page uses Surface, a Rule border, 600 weight and `aria-current="page"`. A section that needs the user shows a short text signal beside its name (for example "2 need you" or "Off"), with a filled dot for something to do, a hollow dot for a quiet state and Rust Deep for a failure. Signals are words, never bare totals, and are announced. The phone section select repeats the same signals in its option labels.

Routing uses hash addresses such as `#/skills?q=kami`; other screens link with these parameters instead of shared state.

### Tags / Containers

Skill names in a group are compact bordered mono tags with a 6px wrapping gap; long lists show a count and put names behind a "Show names" disclosure. Path cards (`PathCard`) group a label, a mono path and a copy action on a quiet light panel. Empty states (`EmptyState`) use a dashed boundary, say what is missing and offer the next action. Content lists use rules rather than repeated elevated cards.

### Switches

Availability switches pair visible text with a 36px by 20px track and a 12px thumb. Enabled state uses Ink and a Surface thumb, translated 16px. Disabled switches keep the text at full opacity while dimming the track. State is expressed with `role="switch"` and `aria-checked`, not just color. Thumb movement takes 420ms with the source easing; color changes take 200ms.

### Dialogs, Menus, Commands, and Feedback

`Dialog` wraps the native modal dialog: a ruled header with title and description, a scrolling body and a Field Paper footer. Variants are default (640px), small (480px), wide (900px, for editors and diffs) and sheet (a full-height 560px panel from the right, used for a skill's details). The desktop height cap is `min(88dvh,860px)`. A dialog that is busy can refuse to close and says why. Entry fades and rises from 14px over 420ms with `cubic-bezier(.32,.72,0,1)`; the backdrop mixes Ink at 38%.

`Menu` is a native popover of plain buttons for rare actions; Tab moves through them and Escape closes it. An unavailable item stays visible, marked `aria-disabled`, with its reason as the accessible description. Destructive items use Rust Deep.

Commands and live output use mono text that wraps. A running command's output (`RunOutput`) is a keyboard-scrollable block that follows new lines unless the reader scrolled up; Tools, the first-run tool step and a tool skill's update all use it. `Progress` pairs an indeterminate bar with a status label.

Toasts (`useToast`) fade over 250ms and move from 12px over 420ms, expose a polite live status, clear after 4.5 seconds (7 with an action such as Undo) and can show a busy state. Request failures keep entered form values and show the message beside the form. Reduced-motion preferences remove transitions and animations.

### Sections

**Overview** opens the app. It leads with Needs you (skills installed outside AFK, edits or replacements found by local checks, backup off or failing) or, when empty, "All set · backed up 2 min ago". Your setup summarises each section with a link; Quick actions offers Find a skill (opens Skills with the search) and Add something new (opens the install dialog).

**Skills** is one searchable list of every Global skill, filtered by Comes from (Core, a pack, this machine, a tool, to review) and state. A row shows the name, description, where it comes from, the on/off switch and the Manual/Automatic choice, with update, edit, move and delete in its ⋯ menu. Selecting the name opens a side sheet with details and files. Selecting rows shows a bulk bar. The editor is a wide dialog with a file list, an Edit/Preview segmented control and an explicit choice, for a skill that updates from a repository, between keeping the edit and letting updates replace it. A project scope shows that project's own skills.

**Packs** lists packs with their on/off switch, members behind "Show names", and dialogs to create, import and edit members.

**Sources** is where new things come in: install from a repository or from a zip, `.skill` file or folder, the Try later bookmarks, and followed repositories. The install dialog (`openInstall`) can be opened from any screen with a repository, skills or destination already chosen; it still asks for whatever is missing, and its destination cards use the shared vocabulary ("On every machine, always on, backed up").

**Agent rules**, **Tools**, **Backup** and **Settings** keep their jobs. The Rule Workbench pairs a file list with a mono editor; sync previews and conflicts use wide dialogs with diffs whose added and removed lines carry text markers as well as color. Tools run saved commands only on request and show the exact command first. Backup shows its state, history and Needs attention. Settings holds the library, projects, agent folders, Manual/Automatic defaults and the update schedule.

**First run** replaces the app when the machine has no library, a restore did not finish, or AFK started an empty library nobody has answered for. Three steps (Choose, Preview or Pick library, Done): starting a library previews one summary line and counted groups; restoring checks the repository, restores it, then asks which saved tools to run, running none by default. Settings links to `#/overview?start=library` or `?start=restore` to open the matching step.

## Do's and Don'ts

### Do:

- **Do** use ocean actions, light controls, ink hierarchy, and quiet ruled ledgers.
- **Do** put the activation target beside the action it controls and state it in text.
- **Do** keep rare actions in a ⋯ menu and give unavailable ones a reason.
- **Do** keep command and path text wrapping, visible focus, native dialogs, and reduced-motion support.
- **Do** keep save errors next to the entered form and retain the entered values.
- **Do** reuse the shared components before adding a one-off.

### Don't:

- **Don't** replace operational ledgers with elevated decorative card grids or number dashboards.
- **Don't** use Rust Deep as the ordinary primary-action fill.
- **Don't** make state depend only on color or motion.
- **Don't** hide items past a scroll edge, such as tab rows that scroll sideways on phones.
