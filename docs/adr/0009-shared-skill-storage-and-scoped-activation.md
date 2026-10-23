# Shared skill storage and scoped activation

Status: accepted for the Fieldwork pivot, 2026-10-01.

## Context

The useful AFK workflow is temporarily making a group of skills available without
repeated installation and removal. Remote-only profiles would require a second
retrieval path during every on-demand use. Full per-project copies would duplicate
storage and complicate shared updates.

## Decision

Keep profile definitions shared in one settings file. Prepare selected repository
skills once through Skills CLI in an isolated workspace and retain them disabled
in the home agents directory. Activate by creating owned links in Global or a
configured project's discovery paths. Read the same local copies for on-demand use.

Track ownership so overlapping profiles and independent activation survive disabling
one profile. Preserve preexisting files; refuse conflicting destinations. Project
invocation overrides use isolated local copies, and reset reconnects shared links.

## Consequences

Creation needs repository access, but group reading needs no remote fetch after
preparation. Import carries definitions rather than installed files; each machine
prepares its own library. Shared definitions do not imply global activation.

Skills CLI retains responsibility for its tracked installations and external
updates. AFK does not recreate its lockfile or update registry. The app copies
update commands; it does not run them. Agent discovery and disabled-folder behavior
must be verified per client, beyond filesystem tests.

This replaces the removed catalog-ownership, focus-activation, custom-agent, and
post-install decisions. Their historical text remains in Git history.
