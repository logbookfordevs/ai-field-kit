# Decision Artifact Guidance

Use this reference when writing the ADR-style output for `afk-coding-tradeoffs`.

Use sequential ADR filenames under `docs/<task-slug>/decisions/`, such as `0001-shared-modal-ownership.adr.md`. Scan existing files in that folder and increment the highest number.

Keep ADRs focused. A decision deserves its own ADR when it is:

- hard enough to reverse that changing it later would matter
- surprising without context, so a future reader may wonder why it was done this way
- the result of a real trade-off with plausible alternatives

If the discussion resolves several unrelated decisions, create one ADR per meaningful decision area. Update an existing ADR only when the new information belongs to the same decision and does not reverse it. If an accepted decision changes direction, create a new ADR that supersedes the old one instead of rewriting history.

Recommended sections:

- `Status`
- `Context`
- `Decision`
- `Gray Areas Discussed`
- `Options Considered`
- `Truss Evaluation`
- `Trade-offs Accepted`
- `Consequences`
- `Open Questions`
- `Next Step`

Adapt section names to the repository's conventions when needed.
