# Resume Tracked Implementation

Resume from the selected Implementation Record, not chat memory.

Find the active workflow from the user's hint, current repo, branch, existing local or remote Implementation Records, and active artifact convention.

Read the smallest useful set: active records, blockers, handoff notes, their sources, and directly referenced specs or ADRs.

Recover the active record's `review_base`, last green atomic commit, implementation-owned dirty paths, validation state, automatic code-review evidence, and review-gate states. Keep the original `review_base` across the resumed implementation.

If implementation-owned paths are dirty, separate unfinished behavior work from local tracking updates. Honor any explicit opt-in from the user or repository convention; otherwise keep local tracking outside agent-created commits. Preserve unrelated working-tree changes.

Report done, active, blocked, and the next useful implementation slice.

Then continue the normal implementation loop from the selected record and its Tracking Home.
