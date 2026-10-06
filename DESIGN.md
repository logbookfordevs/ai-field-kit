---
name: AI Field Kit
description: A calm working field notebook for skills, profiles, and tools.
colors:
  field-paper: "#f3eddf"
  surface: "#fffaf0"
  warm-paper: "#e9ddc9"
  ink: "#17201e"
  deep-ocean: "#102c2c"
  muted: "#5d6964"
  rule: "#b9c0b7"
  verdigris: "#3f8580"
  signal-rust: "#c94f35"
  rust-deep: "#8f3f2d"
  brass: "#bd9348"
  lantern: "#f4efde"
typography:
  hero:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(2.9rem, 4.8vw, 4.4rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(1.8rem, 2.5vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  lead:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.65
  narrative:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.65
  code:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.8
  docs-headline:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 600
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  docs-title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  docs-body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.8
  docs-lead:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.8
  docs-code:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.8
rounded:
  inline: "3px"
  small: "4px"
  icon: "5px"
  compact: "6px"
  panel: "8px"
spacing:
  unit: "8px"
  compact: "12px"
  inset: "16px"
  rhythm: "24px"
  sheet: "28px"
  section: "clamp(72px, 7vw, 104px)"
components:
  button-primary:
    backgroundColor: "{colors.deep-ocean}"
    textColor: "{colors.surface}"
    rounded: "{rounded.compact}"
    padding: "12px 18px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.deep-ocean}"
    rounded: "{rounded.compact}"
    padding: "12px 18px"
  command-panel:
    backgroundColor: "{colors.deep-ocean}"
    textColor: "{colors.lantern}"
    typography: "{typography.code}"
    rounded: "{rounded.panel}"
  profile-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "28px"
  docs-chapter-current:
    backgroundColor: "{colors.deep-ocean}"
    textColor: "{colors.surface}"
    rounded: "{rounded.small}"
    padding: "10px 12px"
  docs-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.compact}"
    padding: "8px 10px"
  version-tag:
    rounded: "{rounded.small}"
    padding: "2px 6px"
---

# Design System: AI Field Kit

## Overview

**Creative North Star: "Composable Trail"**

The incumbent AFK identity remains a warm working field notebook: precise, calm, practical, and personal. Deep Ocean anchors operations, Poppins gives the structure, Plex Mono makes commands recognizable, and Literata adds a sparse human note. The retained North Star names the brand continuity; the old routing instrument no longer defines its website expression.

The shipped 2.0 website uses unframed copy, ruled ledgers, native controls, and lightly bent paper. Its paper stack is built from CSS geometry around real controls, not a raster illustration. Docs use the same material with quieter reading measures. PRODUCT.md owns product strategy; the approved composition and surface modes belong in `docs/specs/afk-website-v2/implementation.md` and `proposal.md`, rather than becoming global brand rules.

This root system owns AFK branding and the website in `apps/site/`. The local application's interface remains governed by `packages/afk/web/DESIGN.md`; website sizes and composition do not replace its controls or density.

**Key Characteristics:**

- Light field-paper canvas, Ocean operations, and visible ruled boundaries.
- Poppins structure and prose, Plex Mono commands, restrained italic Literata notes.
- Bounded reading columns and responsive navigation instead of compressed desktop chrome.
- Small paper bends and finite state motion; essential content is visible immediately.
- Clear targets, textual state, and local copy feedback beside the relevant action.

Evidence: `apps/site/src/index.css`, `App.tsx`, `components/ProfileExample.tsx`, `components/CommandPanel.tsx`, `docs/Docs.tsx`, `docs/docs.css`, `docs/PageActions.tsx`, and `apps/site/index.html`. Final home, docs, legacy, and focus captures are under `.impeccable/review/site-v2/`.

## Colors

The palette retains the Logbook ocean identity on warm paper. Frontmatter values preserve the existing brand names; the stylesheet maps them to `--paper`, `--surface`, `--warm`, `--command`, and the other source variables.

### Primary

- **Deep Ocean:** Primary actions, command blocks, docs header, current chapters, and highlighted menu items.
- **Verdigris:** Keyboard focus, selection, command-bar borders, and article-link underlines.

### Secondary

- **Rust Deep:** Readable italic paper notes and docs article-link hover.
- **Signal Rust and Brass:** Retained declared brand anchors. The 2.0 website does not use the former animated rust routes or brass installation-tab marker; their presence in the palette does not prescribe new decoration.

### Neutral

- **Field Paper:** The home and docs canvas, chapter hover, inline code, and table headers.
- **Surface:** Paper sheets, fields, menus, and light foregrounds on Ocean.
- **Warm Paper:** Backing sheets and restrained informational callouts.
- **Ink:** Main prose and strong ledger rules.
- **Muted:** Supporting copy, navigation, and explanation.
- **Rule:** Panel borders and section/row dividers.
- **Lantern:** Command text on Ocean.

### Named Rules

**The Ocean Carries Operations Rule.** Deep Ocean carries decisive actions and command surfaces; warm paper supplies material rather than replacing the operational accent.

**The Accent Has a Job Rule.** Focus, selection, and state pair color with visible structure or text. Retained brand accents are not a quota for decoration.

## Typography

**Display and Body Font:** Poppins, with system-ui and sans-serif fallbacks.
**Narrative Font:** Literata, with Georgia and serif fallbacks.
**Command Font:** IBM Plex Mono, with ui-monospace and monospace fallbacks.

Poppins is loaded at 400, 500, 600, and 700; Plex Mono at 400, 500, and 600; italic Literata at 400 and 600. Caveat's old CSS variable remains unused and is not an active typography role.

### Hierarchy

- **Hero:** Frontmatter hero scale, bounded to 12ch. At 800px and below it uses `clamp(2.7rem, 7vw, 4rem)` and 14ch; at 500px and below it is 2.4rem.
- **Headline:** Frontmatter headline scale for home sections. Headings balance their wrapping; H1/H2 use slightly tightened tracking.
- **Title:** Home H3 is 1.25rem/600; paper title is 1.3rem/600 with normal tracking; ledger titles are 1rem.
- **Body and lead:** Default leading is 1.65. Home lead is bounded to 54ch; supporting section/workflow copy uses 65ch. Mobile lead is .95rem, rather than shrinking all body text.
- **Label:** Ordinary explanatory labels use Poppins, generally .75rem. The version tag is Plex Mono .7rem/400; commands use the code role. Technical type is not an uppercase decorative eyebrow system.
- **Narrative:** Italic Literata in the paper tab, settings-adjacent/sidebar note, and footer attribution. Footer is .8rem and sidebar note 1rem.
- **Docs:** H1 uses docs-headline and 26ch; H2 uses docs-title; H3 is 1.05rem/600 with 1.5 leading. Paragraphs cap at 72ch. Article body, lead, and shared commands use their docs roles. At 760px and below H1 is 2rem, H2 1.3rem, body .9rem, and lead 1rem.

### Named Rules

**The Bottle Letter Rule.** Poppins is the durable interface, Literata the rare human note, and Plex Mono the command coordinate system.

**The Reading Measure Rule.** Docs keep bounded prose and 1.8 body leading; the home hero scale does not transfer to articles.

## Layout

Home uses `min(1152px, calc(100% - 96px))` content width. The sticky opaque paper header has an 80px minimum height. Hero copy and paper share equal columns, with a 70px gap and 110px/94px vertical padding. Section spacing follows the frontmatter section token; 1px rules separate sections. Workflow columns use 64px gaps. Portable and start sections use 1.3/.7 and 1.2/.8 tracks with 80px gaps. Feature and ownership ledgers use a 230px title column beside prose; feature rows include a 24px arrow track.

At 1050px and below gutters become 32px, principal column gaps 40px, and ledger titles 190px. At 800px gutters become 24px, section spacing 68px, the header 70px, and the principal sections become one column. Home navigation becomes a 44px menu trigger. The paper caps at 540px; its reading row remains a usable action row. At 500px the hero uses 30px/54px padding and a 32px grid gap; the sheet inset becomes 18px, the activation label takes its own row, and the reading action has at least 44px height. Feature rows and ownership ledgers stack their prose; the footer wraps and stacks. At the checked 390×844 viewport both hero actions and the demonstration disclosure remain visible without reducing the body or controls to fit.

Docs use a 74px sticky opaque Ocean header and a 1376px maximum shell with 32px gutters. The final desktop tracks are `210px minmax(0, 760px) 170px` with 40px gaps. The chapter rail sticks beneath the header, scrolls independently, and has a Rule divider; the heading rail sticks at 114px. Article padding is 48px/24px; H2 blocks use 40px top spacing and a 110px scroll margin. At 1150px the heading rail disappears, gaps become 32px, and two tracks remain. At 760px the chapter rail becomes a labeled native select with 44px minimum height, the shell uses 20px gutters, the header is 66px, and article top padding is 32px. Tables may scroll horizontally; command text wraps anywhere without modifying the copied value.

## Elevation & Depth

Depth is paper-led and otherwise flat. Sheets use 1px Rule borders; ledgers and reading rails use rules instead of raised cards. A quiet shadow on the lower hero backing sheet (`0 20px 38px rgba(23,32,30,.08)`) separates the stack from the canvas. The former route/core/node/context/toast shadow vocabulary is retired. Docs use tonal blocks and borders without shadow or decorative grid.

**The Paper Depth Rule.** Use elevation to explain physical paper layering; ordinary article and ledger content stays unframed.

## Shapes

Compact controls use 6px corners; paper, command, and menu surfaces use 8px. Small chapter/menu items and the docs chapter selector use 4px, home select/menu trigger 5px, and inline code 3px. The paper tab rounds only its top corners. Quiet contours use 1px Rule; primary actions use 1px Ocean.

The paper stack has -3° and 2° backing sheets, a 3° tab, and a -.8° top sheet. The settings sheet rests at 2°. These slight bends are native CSS material details; they are not a license to rotate navigation, prose columns, or all cards.

## Components

### Buttons and Text Links

Primary buttons use the frontmatter primitive with Poppins .86rem/500, 1.4 leading, 12px gap, and at least 46px height. Small buttons use 40px minimum height, 10px 14px padding, and .78rem type. Outline buttons retain Ocean text and border on transparent paper. Primary hover mixes 12% Surface into Ocean and lifts 2px; active returns to rest. Outline hover uses Field Paper. Secondary links remain visibly underlined, with a small SVG arrow that moves 3px on hover. Global keyboard focus is a 2px Verdigris outline offset 4px.

### Navigation and Fields

Home uses the existing AfkMark beside the Poppins wordmark and a bordered mono version tag. Desktop text links underline on hover. At the mobile breakpoint a mature Menu primitive supplies highlighted Ocean/Surface rows, trigger/outside dismissal, Escape dismissal, and return focus to its trigger. The menu has an 8px inset and 8px corner; rows have 12px 14px padding and 4px corners. SVG icons carry shapes; icon-only controls have accessible names.

Docs chapter filtering is a labeled search field with 42px minimum height and Verdigris caret. It matches chapter titles and provides a Clear filter recovery on no results. Current links use the frontmatter current-chapter primitive, weight 700, and `aria-current="page"`. The native mobile chapter select uses the same query URLs. Heading links and previous/next navigation remain ordinary links. Native fields inherit the visible focus outline.

### Command Panel and Article Actions

Home and MDX docs share one Ocean/Lantern command component. It has a 10px 16px label/copy bar, Verdigris divider, 20px 18px 14px pre inset, wrapping code, and a 28px minimum in-place status region with 0 18px 10px padding. Copy controls are transparent with Verdigris borders, 4px corners, and 36px minimum height; hover uses Surface/Ocean. Successful copy feedback clears after 3.5 seconds and explicitly says nothing ran. Failure persists with a Select command action that selects and focuses the real code. Article copy uses a separate 44px split control, mature menu, visible polite feedback, and a Markdown recovery link.

**The In-Place Command Feedback Rule.** Keep copy success and recovery beside the command or article control; copying must not imply execution.

### Paper Example and Informational Surfaces

The profile sheet uses the frontmatter sheet primitive, ruled internal groups, a target beside its activation action, and a separate reading disclosure. Preparation/availability is textual and paired with an outlined SVG state mark; enabling shows its check. The demonstration state is local and explicitly labeled, with a visible disclosure below. Reading uses `aria-expanded` and `aria-controls`; the adjacent command retains normal copying and failure recovery.

Storage boxes and settings sheets use 6px corners and Surface; informational notes use Warm Paper, 22px 24px padding, and 6px corners. Docs definition lists and details use ruled boundaries. Tables use Field Paper headers, 12px 10px cells, and Rule row borders; article links remain underlined.

### Accessibility and Motion

Semantic landmarks, a focusable main skip target, native buttons/fields, named navigation, polite status, and text plus shape for state remain part of the system. Menus handle keyboard navigation and dismissal through the existing primitive. Content starts visible; there is no scroll reveal or continuous animation.

The shared ease is `cubic-bezier(.16,1,.3,1)`. Paper settles once over 700ms with backwards fill from a visible 2°/7px start. Hover or focus within straightens it over 420ms. State ink clears a .5px blur over 240ms; reading instructions fade from .6 to 1 over 220ms. Settings straightens over 300ms. Button colors use 180ms and lift 220ms; small control colors/backgrounds 140ms; menus fade 150ms and translate over 180–220ms. Home scroll is smooth; docs scroll is immediate. Reduced motion disables animations, reduces transitions to .01ms, restores immediate scroll, and removes sheet/hover transforms while retaining every control and content state.

## Do's and Don'ts

### Do:

- **Do** preserve light field paper, Ocean operational surfaces, and the existing AFK mark.
- **Do** use Poppins for structure and prose, Plex Mono for commands, and Literata sparingly for italic notes.
- **Do** keep ruled ledgers, bounded article measures, wrapping commands, and responsive native navigation.
- **Do** show targets and states beside actions and keep copy feedback and recovery in place.
- **Do** keep essential content visible from first paint and all actions available under reduced motion.
- **Do** consult the separate local-app design system before changing `packages/afk/web/`.

### Don't:

- **Don't** turn the warm material into a brown-led identity or make Rust the default action fill.
- **Don't** use mono as generic decoration, Brass as body text, or system fallback faces as the intended display typography.
- **Don't** inherit obsolete route instruments, install tabs, reveal observers, toast feedback, or Caveat accents into new website surfaces.
- **Don't** compress desktop navigation rails into mobile reading columns.
- **Don't** make color or animation the only explanation of state, or imply that copying runs a command.
- **Don't** promote the approved page composition or surface modes into global product strategy.
