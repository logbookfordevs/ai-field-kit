# AFK app redesign: brief

Status: Confirmed 2026-11-05. Shaped with impeccable `shape`.
Inputs: interface audit (15 findings, Block), [Git library spec](../git-library.md), `packages/afk/web/DESIGN.md`.

## Job and audience

The developer who owns AFK, at their desk, opening the local app for a quick task: most often changing a skill (on/off, Manual/Automatic, what it does) or adding something new (install from a repository or a zip, save a repository to try later). Sometimes checking that the setup is safe. Mode: Operate — scanning beats reading.

## Outcome

- Within three seconds of opening: what needs me, whether I'm backed up, where to go next.
- Changing a skill: one search, one click.
- Adding something new starts from one obvious place.

## Direction

- Keep the paper-ledger identity (tokens, Poppins, IBM Plex Mono). Replace the structure.
- Organize by subject, one page per kind of thing:

| Page | Subject | Jobs |
| --- | --- | --- |
| Overview | The setup | What needs you, backup state, quick actions. Opens here. |
| Skills | Individual skills | One searchable list; "Comes from" column (Core · Pack: name · This machine · Tool). On/off, Manual/Automatic, edit, update, delete. |
| Packs | Groups of skills | Turn a pack on/off, see and edit members. |
| Sources | Repositories | Install from a repository or a zip, Try later bookmarks, followed repositories. "Add something new" lives here. |
| Agent rules · Tools · Backup · Settings | As today | Backup joins the navigation. |

- A skill in a pack still appears in Skills, labelled with its pack. The pack as something you turn on lives in Packs.
- "To review" becomes a Needs-you item on Overview and a filter in Skills, not a tab.
- Overview centres on a Needs-you list that reads "All set · backed up 2 min ago" when empty.
- One vocabulary everywhere, from the install dialog's definitions ("On every machine, always on, backed up").

## Scope

- Redesigned: Overview, Skills, Packs, Sources, first run and library start, install dialog.
- Restyled to the new rules: Backup, Settings, Tools.
- Untouched: Agent rules content, all behaviour, the data model.
- Anti-goals: number-and-chart dashboards, marketplace feel, walls of names, explanations you must read before acting.

## States and ranges

- First run: empty machine, existing setup, restore.
- All set; something needs you (to review, edited outside AFK, backup off, backup error).
- Skills 0–150+, packs 0–10, Try later 0–50, names up to 40 characters, descriptions up to 280.

## Layout and interaction

- Desktop keeps the left navigation, with Backup added. Phone: a compact top bar with a section menu; no tab rows that hide items off-screen.
- Rows: name, one-line description, where it comes from, state. Rare actions in a menu.
- Library start: one summary line, headed groups with counts, names behind "Show names".

## Constraints

- Current stack: vanilla JS and one stylesheet. A React move is a separate decision.
- Keyboard and screen-reader support, nothing hidden past a scroll edge, meaning in text as well as color.
- None of the 15 audit findings may reappear.

## Next

A clickable prototype (local HTML) of Overview, Skills, Packs, Sources and first run, with real data: [prototype.html](prototype.html).
