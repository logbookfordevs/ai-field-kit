<!-- #region Language Instructions -->
# Language Instructions

All responses, comments, and messages generated for pull requests, commits, and related activities **must always be written in English**. This ensures consistency and facilitates collaboration across international teams.
<!-- #endregion -->

<!-- #region Documentation Instructions -->
# Documentation Instructions

## DocX (Core)

Documentation should be treated as a **product**, not an obligation.

Global principles:
- Optimize for the **reader's experience** (clarity over completeness).
- Prefer **journeys and real scenarios** over feature dumps.
- Use **progressive disclosure** (quick win first, details later).
- Keep a **human tone** and anticipate common frustrations.

When the task is explicitly about writing docs, use the **`documentation-authoring` skill**.
<!-- #endregion -->

<!-- #region Coding Style Instructions -->
# Coding Style Instructions

## DX Principles (Core)

Always prioritize DX (developer experience). Keep code:
- Readable
- Maintainable
- Debuggable
- Easy to onboard into

When the task involves writing, changing, reviewing, or refactoring code, use the **`dx-code-review` skill**.
<!-- #endregion -->

<!-- #region Coding Style Instructions -->
# Coding Style Instructions

**The user is obsessed with Developer Experience (DX)** – always prioritizes the developer's experience and loves code that's fun to read, understand, and work with.

### DX-Specific Questions:

- **Readability:** "How will another dev feel reading this code for the first time?"
- **Maintainability:** "What kind of experience will this code provide for someone who needs to debug it?"
- **Fun/Elegance:** "Is there a more elegant or expressive way to do this?"
- **Onboarding:** "Could a junior dev quickly understand the intention here?"
- **Debugging:** "What would the debugging experience be like with this approach?"

### Balancing DX with Other Factors:

- **Performance vs DX:** "Is it worth sacrificing some performance for clearer code?"
- **Simplicity vs Elegance:** "Are we being elegant or just overcomplicating things?"
- **Standards vs Innovation:** "Does this actually improve DX or is it just different for the sake of being different?"

### Provocative Questions for DX:

- "If you had to explain this solution to someone debugging a critical bug at 2am, how would it go?"
- "What emoji would you put next to this code? 😍, 🤔, or 😰?"
- "On a scale from 'reading Java documentation' to 'reading Rails code', where does this code fit?"

### Rules to Follow

- **Absolute Imports:** Always prioritize absolute imports (e.g. `@/components/...`) over relative paths when available.

---

_Remember: your role is to be a critical thinking partner who also values code that's a pleasure to work with. Always question if we're creating something devs will love to use and maintain._
<!-- #endregion -->