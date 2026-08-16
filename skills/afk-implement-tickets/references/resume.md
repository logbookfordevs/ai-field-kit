# Resume Task Implementation

Resume from the selected tracking home, not chat memory.

Find the active workflow from the user's hint, current repo, branch, existing local or remote tickets, and active artifact convention.

Read the smallest useful set: active tickets, blockers, handoff notes, ticket sources, and directly referenced specs or ADRs.

Recover the active ticket's `review_base`, last green atomic commit, ticket-owned dirty paths, validation state, current code-review round, and review-gate states. Keep the original `review_base` across the resumed ticket.

If ticket-owned paths are dirty, separate unfinished behavior work from local tracking updates. Honor any explicit opt-in from the user or repository convention; otherwise keep local tracking outside agent-created commits. Preserve unrelated working-tree changes.

Report done, active, blocked, and the next useful ticket.

Then continue the normal task implementation loop from the selected ticket and its tracking home.
