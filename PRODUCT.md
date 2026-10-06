# Product

## Register

brand

## Users

Developers who use coding agents and want a small personal workspace for skill
availability, reusable skill groups, and saved tool commands. They need to see
which scope an action affects and keep occasional skills ready without repeatedly
installing and uninstalling them.

## Product Purpose

AI Field Kit manages the skills and tools a developer actually uses. Its CLI opens
a local web app and exposes a small set of reading and profile activation commands.

The product has six sections: Profiles, Installed Skills, Sources & Stacks,
Tools, Agent rules, and Settings. Profile definitions are shared; activation is global or
project-specific. Tools are always global. Configuration lives in one file whose
location the user chooses.

Skills CLI owns repository preparation and external install/update behavior. AFK
owns local availability, profile grouping, source bookmarks and portable declarative
stacks, inspection, and supported invocation
preferences. Agent rules owns one local canonical document, references, and explicit
managed-region sync to chosen files. It does not own catalogs, rule layers, hooks, MCP setup, custom-agent
provisioning, or a general extension framework.

## Brand Personality

Precise, calm, practical, and personal. AFK should feel like a working field
notebook: clear about what an action changes, quiet enough for daily use, and
concrete about files, scopes, and command execution.

## Anti-references

Avoid generic AI SaaS dashboards, skill marketplaces, broad setup frameworks,
configuration taxonomies, and productivity claims without evidence. Do not make
simple bookmarks or skill groups feel like a package-management platform.

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
system is `packages/afk/web/DESIGN.md`. Root `DESIGN.md` describes the AFK website
and shared brand. Website evidence is in `docs/specs/afk-website-v2/implementation.md`.
