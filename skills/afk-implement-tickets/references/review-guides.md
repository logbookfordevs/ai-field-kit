# Review Guides

Use this reference when accepting a checkpoint requires visual, copy, workflow, or product judgment.

### Product Review
For every user-facing behavior, copy, or workflow change, include a walkthrough of the implemented experience, even when the underlying product decisions were approved earlier.

### Design Review
Include when acceptance requires visual fidelity to an explicit reference or approved visual direction.

Write each included review as a reviewer journey, not as a generic QA checklist. When handing off the checkpoint, name the visual states, behavior, copy, or workflow to check.

Use this shape when helpful:

```markdown
### <Product or Design> Review: <phase or task name>

- Start from: <screen, command, route, state, or fixture>
- Walkthrough: <the happy-path flow the reviewer should try>
- Expected: <what should happen and what should feel different or correct>
- Stress: <edge cases, awkward inputs, slow states, empty states, permission boundaries, or repeated actions>
- Watch for: <regressions, confusing copy, visual mismatch, broken workflow, or product-fit concerns>
```

Keep the guide proportional to product risk. A small UI copy change may need two bullets. A workflow change that affects user decisions, data integrity, payments, permissions, onboarding, or cross-role behavior should get a fuller tour.
