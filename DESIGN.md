---
name: AI Field Kit
description: Composable setup routes for practical AI development workflows.
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
  display:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(2.7rem, 5.5vw, 5.4rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "0"
  hero:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(4.3rem, 7vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.92
    letterSpacing: "0"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  narrative:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  handwritten:
    fontFamily: "Caveat, cursive"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0"
  label:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "0.66rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  icon: "5px"
  compact: "6px"
  control: "8px"
  panel: "12px"
  instrument: "16px"
spacing:
  compact: "10px"
  control: "12px 18px"
  card: "22px"
  section: "clamp(88px, 11vw, 148px)"
components:
  button-primary:
    backgroundColor: "{colors.deep-ocean}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "46px"
  button-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.deep-ocean}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
    height: "46px"
  command-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.deep-ocean}"
    rounded: "{rounded.control}"
    padding: "10px"
  code-panel:
    backgroundColor: "{colors.deep-ocean}"
    textColor: "{colors.lantern}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "24px"
---

# Design System: AI Field Kit

## Overview

**Creative North Star: "Composable Trail"**

AI Field Kit is a warm field-paper installation guide that makes a multi-agent setup legible as a route. The ocean structure comes from Logbook for Devs: Deep Ocean holds the decisive operational surfaces, Verdigris marks focus and confirmation, Signal Rust carries route energy, and Brass pinpoints an active installation choice. The page remains light-only in the shipped implementation; its warmth is paper material, not a brown-led identity.

The hero is the system diagram: one AFK core sends four animated dashed routes to named agent nodes. The remaining page turns that metaphor into an operational trail - ledger rows explain the problem, a sticky stack separates the kit's layers, a semantic tab set lets a visitor choose an install path, and command panels make the next step directly runnable. The effect is a technical field journal rather than a generic AI landing page or a wall of decorative cards.

**Key Characteristics:**

- Poppins provides the confident UI and display structure; Literata appears only as an italic narrative note or emphasis; IBM Plex Mono denotes commands, route metadata, indexes, and state.
- A quiet fixed paper grid and ruled boundaries create the field-paper material without obscuring content.
- Deep Ocean, Verdigris, Signal Rust, and Brass retain their Logbook semantic jobs on a warm light canvas.
- Layouts use a route instrument, ledgers, manifests, and layer stacks to explain composition.
- Motion reveals route progression and readiness, then yields completely to reduced-motion preferences.

## Colors

The shipped palette uses a warm paper foundation with ocean-led operational structure. The four Logbook anchors are semantic, not interchangeable decoration.

### Primary

- **Deep Ocean** (`#102c2c`): Primary action background, dark install section, code panel, wordmark tile, and the selected operational frame.
- **Verdigris** (`#3f8580`): Visible focus outline, copy-action hover color, footer-link hover color, and selection color.
- **Signal Rust** (`#c94f35`): Route-line accent and the readiness dot; it is the active route signal, not the default CTA fill.

### Secondary

- **Rust Deep** (`#8f3f2d`): Narrative emphasis, command labels, ledger metadata, and other readable rust text.
- **Brass** (`#bd9348`): The active install-tab inset marker. Keep it as precise instrument detail rather than body text.

### Neutral

- **Field Paper** (`#f3eddf`): The page canvas and light wordmark foreground; it carries the fixed 56px grid texture.
- **Surface** (`#fffaf0`): Primary paper panel and raised route-node background; it also supplies light text on dark sections.
- **Warm Paper** (`#e9ddc9`): The layers section background.
- **Ink** (`#17201e`): Primary text, strong borders, and route-core framing.
- **Muted** (`#5d6964`): Navigation and supporting prose.
- **Rule** (`#b9c0b7`): Ledger lines, panel borders, and quiet grid structure.
- **Lantern** (`#f4efde`): Code text and softened copy on Deep Ocean.

### Named Rules

**The Ocean Carries Operations Rule.** Use Deep Ocean for the strongest action, code, and major operational surfaces. Do not replace it with brown or make Signal Rust the ordinary CTA color.

**The Accent Has a Job Rule.** Verdigris indicates focus or an available action; Rust indicates route/signal; Brass indicates an active instrument detail. Every one needs an accompanying structural or text cue where meaning matters.

## Typography

**Display Font:** Poppins (with `system-ui` fallback)
**Body Font:** Poppins (with `system-ui` fallback)
**Narrative Font:** Literata (with Georgia fallback)
**Handwritten Accent:** Caveat (with `cursive` fallback)
**Label/Mono Font:** IBM Plex Mono (with `ui-monospace` fallback)

**Character:** Poppins constructs the bottle: direct, measured structure for UI, headlines, and short explanatory copy. Literata is the message inside it: italic and sparing in the Logbook attribution and hero emphasis. Caveat is a single handwritten margin note beside the final command. IBM Plex Mono is the coordinate system for commands, labels, indices, route metadata, and state.

### Hierarchy

- **Hero** (600, `clamp(4.3rem, 7vw, 6rem)`, `0.92`): The first-viewport AFK statement; it caps at `9.5ch`. The emphasized line switches to Literata at the same weight.
- **Display** (600, `clamp(2.7rem, 5.5vw, 5.4rem)`, `1.02`): Section and closing headings. Text uses balanced wrapping and zero letter spacing.
- **Title** (600-700, `1.45rem` to `2rem`, `1`-`1.08`): Layer-stack, ledger, context, and agent names.
- **Body** (400, `1rem`, `1.6`): Poppins for short, scannable explanatory copy. Leads rise to `clamp(1.08rem, 1.5vw, 1.25rem)` and are capped at `56ch`; section copy caps at `54ch`.
- **Narrative** (400, `1.1rem`, italic): Literata only for authored/narrative accents, such as the hero field-kit note and footer attribution.
- **Handwritten** (600, `1.45rem`, `1`): Caveat for one nonessential field-note flourish. It is never navigation, instruction, or required content.
- **Label** (600, `0.56rem`-`0.7rem`, uppercase): IBM Plex Mono for command labels, route metadata, selection state, list keys, and status. It does not carry ordinary body copy.

### Named Rules

**The Bottle Letter Rule.** Poppins is the durable interface; Literata is the rare human note; Plex Mono verifies the coordinates. Do not restore superseded font roles, and do not use the narrative face for controls or long UI copy.

**The One Scribble Rule.** Caveat appears once, beside the closing command. Do not repeat it elsewhere or use it to communicate information a user must perceive.

## Layout

The desktop content measure is `min(1180px, calc(100vw - 72px))`; section rhythm is `clamp(88px, 11vw, 148px)`. The sticky header is a three-column grid at `74px` minimum height: brand left, navigation centered, and the install action right. It uses a lightly translucent field-paper backdrop with a 16px blur.

The first viewport is a two-column trail: the copy uses `minmax(0, .84fr)` and the route instrument uses `minmax(500px, 1.16fr)`, separated by `clamp(48px, 7vw, 96px)`. The map is a `650px`-minimum framed instrument with an AFK core at center and four absolutely positioned agent nodes. Subsequent sections alternate ledger rows, a sticky three-layer stack beside a manual list, a dark install route, a stepped context stack, an agent band, and a rust closing action.

At `980px` and below, the content measure becomes `min(100% - 44px, 760px)`. The header becomes a two-column first row with navigation centered beneath it; the hero, kit, context, and closing become one column; the route map lowers to `600px`; and the stack becomes a three-column static grid. At `700px` and below, the measure becomes `100% - 32px`, sections use `76px` rhythm, the header is `66px`, hero actions stack, command labels take a full first row, the route map is `500px`, ledgers become one column, install tabs become two columns, the install panel reserves room for a bottom-right copy action, the agent band becomes two columns, and both footer groups stack.

## Elevation & Depth

Depth is border-led, with shadows reserved for the route instrument and selected paper pieces. The page grid is fixed behind content and fades toward the lower page; the route instrument adds its own 52px grid. `1px` rules create the ledger and manifest rhythm, while paper mixing and occasional soft brown-tinted shadows separate the few deliberate instruments from the canvas.

### Shadow Vocabulary

- **Route instrument** (`0 28px 72px rgba(72,47,28,.16)`): The hero route map.
- **Route core** (`0 24px 50px rgba(72,47,28,.14)`): The central AFK instrument.
- **Agent node** (`0 8px 20px rgba(72,47,28,.08)`): Individual destinations on the map.
- **Context layer** (`0 14px 28px rgba(72,47,28,.08)`): The stepped portable/personal/project stack.
- **Toast** (`0 18px 44px rgba(23,32,30,.2)`): Transient status feedback only.

## Shapes

Most controls, nodes, cards, and code surfaces use `8px` corners; compact copy and icon treatments use `6px` and `5px`. The install panel is `12px`; the route map and central AFK core are the only `16px` instrument frames. The fact list is deliberately pill-shaped (`999px`) and should remain a compact metadata treatment, not expand into a generic rounded-card language. Strong items retain `1px` Ink borders; quiet boundaries use Rule.

## Components

### Buttons

- **Primary:** Deep Ocean fill, Surface text, `1px` Deep Ocean border, `46px` minimum height, `12px 18px` padding, `8px` radius, and Poppins 700 at `0.86rem`.
- **Small / Light:** The header action reduces to `40px` minimum height. The dark closing section uses the light variant: Surface fill and Deep Ocean text.
- **Hover / Focus:** Primary buttons rise `-2px` over `180ms` and darken to `#24302c`; keyboard focus is the global 2px Verdigris outline with a 4px offset.
- **Text link:** A strong Ink underline is the secondary action; it is not a rounded button.

### Command Panel

The reusable command panel is the primary runnable artifact: a three-column grid of mono uppercase label, wrapping command, and compact copy control. It uses a 10px inset, Rule border, 8px corners, and translucent Surface background. At mobile width it becomes two columns, with the label spanning the first row and command content allowed to wrap anywhere. The copy button announces either success or a manual-selection fallback through the status toast.

### Route Instrument

The hero's route map is the signature component. Four dashed `1.5px` Rust/Rule paths connect a centered AFK core to compact agent nodes. It uses mono route metadata at the top and bottom, a semantic label for the map, and `aria-hidden` SVG paths because the adjacent label owns the relationship. The core has a double bezel; nodes use icon, agent name, and mono type metadata. The ready mark pairs text with a Rust dot.

### Ledger, Manual, and Context Stack

Ledger rows have a strong Ink top rule, three columns at desktop, and Rule dividers. The kit pairs a `top: 112px` sticky stack of three 22px paper panels with a manual list; the first stack panel receives the stronger Ink boundary. The context stack repeats the paper-panel grammar with three offset articles: 0, 30px, and 60px at desktop; it reduces to 0, 16px, and 32px on mobile.

### Install Tabs

The install chooser is a real `tablist` with four `tab` buttons and one `tabpanel`. Each tab exposes `aria-selected`, `aria-controls`, and roving `tabIndex`; ArrowLeft, ArrowRight, Home, and End select and move focus. On desktop, inactive tabs are transparent with a bottom divider; the selected tab gets a 3px inset Brass left marker and Surface text. At mobile, tabs become a two-column grid with full borders. The adjacent install panel is a Deep Ocean section containing a 12px light paper panel, a command block, copy action, and pill-shaped facts.

### Navigation and Status

The sticky header is a semantic `header` with labeled primary navigation. Its AFK mark is a squared 38px mono tile (34px mobile), while text navigation receives a Rust underline on hover. A fixed skip link remains off-screen until focused. The fixed lower-right toast has `role="status"` and `aria-live="polite"`; it fades and rises into view while it has content, then clears after 2.4 seconds.

### Accessibility and Motion

- **Keyboard and status:** Native buttons declare `type="button"`; command copy actions have an accessible name; install tabs implement keyboard selection and announce the selected path; external links add visually hidden new-tab context.
- **Focus:** `:focus-visible` always draws a 2px Verdigris outline with 4px offset. The visible control state is never only the focus color.
- **Motion:** Smooth page scroll is enabled. Buttons and toast use `180ms` transitions with `cubic-bezier(.16,1,.3,1)`. Route strokes animate over 8 seconds with a dashed offset; every even path reverses. `data-reveal` sections enter once at a 12% intersection threshold using opacity and `translateY(24px)` over 720ms.
- **Reduced motion:** The React observer immediately marks reveal content visible when reduced motion is requested. The stylesheet removes animation and transition duration, restores normal scroll behavior, and leaves reveal content visible.

## Do's and Don'ts

### Do:

- **Do** use the light field-paper base with Deep Ocean operational anchors and the exact semantic accents: Verdigris `#3f8580`, Signal Rust `#c94f35`, and Brass `#bd9348`.
- **Do** make composition visible through routes, ledger rows, named layers, real commands, and explicit setup ownership.
- **Do** keep Poppins as the UI/display face, Literata as sparse narrative emphasis, and IBM Plex Mono for technical labels and commands.
- **Do** preserve the real tab, copy, skip-link, focus, and reduced-motion behavior when changing these surfaces.
- **Do** keep the responsive route from desktop instrument to single-column mobile reading order.

### Don't:

- **Don't** restore superseded typography, palette, or token names from the previous direction.
- **Don't** turn the warm base into a brown-led beige page; the ocean semantic structure must remain visibly present.
- **Don't** replace route/map, ledger, and manifest structure with generic marketing cards or an unstructured card wall.
- **Don't** use Rust as the default action fill, Brass as body text, or mono type as generic decoration.
- **Don't** make animation necessary to understand the installation paths or hide content when reduced motion is enabled.
