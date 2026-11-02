# Idea: merge Profiles into Stacks

Status: done. Superseded by [the kit guide](../kit.md) and
[ADR 0011](../adr/0011-kit-replaces-stacks-and-profiles.md). This file is kept as the
original proposal.

## What shipped

Profiles and stacks merged into **packs**, and a new **kit** (Core, packs, Try later)
sits above them. It differs from this proposal in a few ways:

- The noun is **Pack**, not Stack. The manifest keeps the `skill-stack.v1` name and is the
  publish format for packs. `afk profiles` is an alias of `afk packs`.
- Packs stay in the settings `profiles` array. IDs and member data are unchanged so
  machine-local activation, keyed by a hash of the definition, survives. New optional
  `description`, `origin` and `sourceNames` fields are not hashed.
- There is no local-group rewrite. Local skills stay in a pack as a "Local skill
  selection" source, and such a pack can't be exported as a manifest.
- A pack that is on can be edited: added skills are exposed, dropped skills lose only
  AFK-owned links, and a failure restores it.
- Stack storage, stack install and saved skills lists are gone. `afk install <url>` saves
  a manifest as a pack with ID `stack-<manifest id>`, then installs it. A manifest that
  selects one skill from two sources is rejected.
- Pages: Kit replaces Profiles and Sources & Stacks, with tabs for This machine, Core,
  Packs and Try later.

The rest of this file is the proposal as written.

## Why

A stack's definition is a superset of a profile's: named, explicit skill
selections across many sources, versus one source per profile. Users read both
as "a named group of skills for a purpose". Two nouns for one idea add friction.

## Proposed shape

- Keep the **Stack** name. The published manifest (`skill-stack.v1`) and
  `afk install <url>` already use it; `afk profiles …` becomes an alias.
- A stack gains profile behavior: prepared copies, turning on and off per Global
  or project, and on-demand reading.
- One lifecycle: **Defined → Installed (prepared, off) → On per scope**.
  - Install prepares disabled copies in the store; it no longer installs straight
    into an agent folder.
  - The Install dialog has **Turn on after installing**, checked by default, so an
    always-on stack stays one action. Turning off stays available per scope.
- Saving an edit to a stack that is on syncs the change instead of requiring it to
  be turned off first: added skills are prepared and linked where the stack is on,
  removed skills lose only AFK-owned links.
- Activation rules stay as they are today: a skill stays on while another stack,
  the user's own choice, or a folder AFK didn't create still holds it.
- Pages: Stacks replaces Profiles; Sources becomes its own page.
- Existing profiles migrate to single-source stacks, keeping their enabled scopes.

## Open questions

- Collision rule when one stack selects the same skill name from two sources
  (activation is keyed by name). Likely: reject at install/turn-on.
- Profiles built from "skills on this machine" have no repository source; a
  stack needs a local-group representation that export and scripts can handle.
- Whether removing the Skills CLI agent choice from stack installation is
  acceptable for every supported agent (verify each one reads AFK's links).
- Settings and machine-local state migration while older AFK versions may still
  read the same file (keep writing `profiles: []`).
- A per-scope "skip this skill" option for stacks that are always on, if turning
  a whole stack off for one noisy skill becomes a real problem.
