# Idea: merge Profiles into Stacks

Status: idea, not scheduled. Profiles and Stacks stay separate for now.

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
