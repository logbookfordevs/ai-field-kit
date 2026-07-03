# Notes And Decisions Examples

Use these examples only when the notes/ADR boundary is unclear.

## Implementation Notes

- Render/unmount ordering requires delaying submit until a modal is dismissed.
- A counter has mutually exclusive paths to avoid double-counting.
- Local state must be cleared before back/forward navigation.

## ADRs

- Shared dialog affordances belong in LexUI primitives, not individual modals.
- Disabled backend states are modeled as availability instead of generic errors.
- A display surface waits for a confirmed backend contract before shipping metrics.
