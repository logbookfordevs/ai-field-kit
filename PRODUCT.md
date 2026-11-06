# Product

## Register

brand

## Users

Developers who use coding agents and want a small personal workspace for skill
availability, a kit of skills that follows them between machines, and saved tool commands. They need to see
which scope an action affects and keep occasional skills ready without repeatedly
installing and uninstalling them.

## Product Purpose

AI Field Kit manages the skills and tools a developer actually uses. Its CLI opens
a local web app and provides headless management operations, protected skill updates
and background lifecycle commands alongside kit management, sync, and pack reading and activation.

The app has eight sections, one per kind of thing: Overview (what needs you,
backup state, quick actions), Skills (one searchable list of every skill), Packs,
Sources (where new skills come in: repositories, uploads and Try later), Agent
rules, Tools, Backup and Settings. A first-run flow starts or restores the library
before the app opens.

Everything the user decides lives in a **library**: a Git repository at
`~/.afk/library` where every change is one save, optionally backed up to a private
remote and restored on another machine. The library holds Core (skills on every
machine, always on, backed up), packs (named groups turned on when needed), tools,
Try later bookmarks, invocation choices, agent folders and agent rules. A skill
kept on this machine only stays outside it. A skill in a pack still appears in
Skills, labelled with its pack; turning the pack on lives in Packs. Core and packs
are Global; projects manage only their own repository's skills. Tools are always
global.

Skills CLI owns repository preparation and external install/update behavior. AFK
owns local availability, the portable kit (Core, packs and source bookmarks), reconciling
a machine with the kit, inspection, and supported invocation preferences. Agent rules owns one local canonical document, references, and explicit
managed-region sync to chosen files. It does not own catalogs, rule layers, hooks, MCP setup, custom-agent
provisioning, or a general extension framework.

## Brand Personality

Precise, calm, practical, and personal. AFK should feel like a working field
notebook: clear about what an action changes, quiet enough for daily use, and
concrete about files, scopes, and command execution.

## Anti-references

Avoid generic AI SaaS dashboards, skill marketplaces, broad setup frameworks,
configuration taxonomies, and productivity claims without evidence. Do not make
simple bookmarks or skill packs feel like a package-management platform.

## Design Principles

- Put the activation target beside the action it controls.
- Distinguish shared definitions from project-specific activation.
- Make reading instructions distinct from enabling skills.
- Label copied commands separately from commands that execute.
- Keep tools visibly global and projects tied to folder paths.
- Preserve user-owned files and independent availability.
- Make errors recoverable without losing form input.

## Accessibility & Inclusion

Use keyboard-accessible controls, semantic landmarks, visible focus, readable
contrast, reduced-motion support, and responsive layouts. Explain scope and state
with text as well as color. Commands and paths should wrap on narrow screens.

## Current Delivery

The local app and the AFK 2.0 home and field manual are implemented and tested.
Live discovery inside agent conversations still needs verification. Package
publication and website deployment remain separate work.
The behavior specification is `docs/specs/afk-pivot.md`; the local app's visual
system is `packages/afk/app/DESIGN.md`. Root `DESIGN.md` describes the AFK website
and shared brand. Website evidence is in `docs/specs/afk-website-v2/implementation.md`.
