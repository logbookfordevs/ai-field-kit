# Resume Execution Tracking

Resume from checkpoint packets, not chat memory.

Find the active workflow from the user's hint, current repo, branch, and `docs/<task-slug>/tracking/` packets.

Read the smallest useful set: active checkpoints, blockers, handoff notes, packet sources, and directly referenced specs or ADRs.

Report done, active, blocked, and the next useful checkpoint.

Then continue the normal execution-tracking loop from the selected checkpoint.
