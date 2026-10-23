# 0010: Hybrid agent management

Status: Accepted

## Decision

Agents can author simple definitions in the selected settings file using editor
schema guidance and runtime validation. Profile preparation and activation,
invocation metadata, rule ownership, location changes and imports use headless
AFK operations. The web app and CLI share `FieldworkOperations` rather than
maintaining separate implementations. The operation catalog supplies live payload
guidance; the `afk-cli` skill describes the workflow and its boundaries.

`doctor` is a read-only check of configuration and known local state. Its clean
result is not proof of discovery inside a running agent. Repair remains an
intentional operation, rather than changing user files during diagnosis.

## Reason

Schema-guided editing handles favorite bookmarks and saved tool definitions with
little CLI surface. Schema validity cannot establish links, apply native metadata,
preserve managed-region boundaries, or recheck a reviewed destination. Shared
operations retain these checks for both interfaces. A headless agent does not
need the browser, its session token, or a running web server.

## Consequences

- Simple edits preserve AFK-managed fields and validate a candidate before
  replacing the original. The workflow checks for intervening changes.
- Operation inputs reject unknown fields and invalid flag types before effects;
  location paths and ownership-changing inputs require explicit values.
- Rules sync and replacement require unchanged reviewed previews. Individual
  availability has an explicit, repeatable desired-state operation.
- Settings import preserves ownership until profiles and individual skills are
  disabled and managed links resolved. Tool removal remains management-only;
  tool execution is explicit and reports the command's exit code.
- Operation writes are serialized within one process. Separate processes and
  synced storage providers remain independent writers; cross-process locking and
  concurrent-machine reconciliation are outside this decision.
- Skills CLI continues to own external skill installation and updates. The
  management skill ships with the AFK executable; `afk guide` locates its entry
  file for agents without a separate skill installation. The build copies the
  canonical repository skill and references into the package. Optional installation
  into an agent's discovery directory remains a separate action.
