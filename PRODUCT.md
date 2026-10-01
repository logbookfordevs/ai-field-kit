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

The product has five sections: Profiles, Installed Skills, Favorite skill sources,
Tools, and Settings. Profile definitions are shared; activation is global or
project-specific. Tools are always global. Configuration lives in one file whose
location the user chooses.

Skills CLI owns repository preparation and external install/update behavior. AFK
owns local availability, profile grouping, inspection, and supported invocation
preferences. It does not own catalogs, rules, hooks, MCP setup, custom-agent
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

The local app is implemented and tested. Live discovery inside agent conversations
still needs verification. Publication and the website rollout are separate work.
The behavior specification is `docs/specs/afk-pivot.md`; the local app's visual
system is `packages/afk/web/DESIGN.md`. Root `DESIGN.md` retains the AFK brand.
