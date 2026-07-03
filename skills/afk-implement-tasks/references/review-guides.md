# Review Guides

Use this reference when a checkpoint includes a `design` or `product` review gate.

Write the guide as a reviewer journey, not as a generic QA checklist. When handing off the checkpoint, name the reviews needed and the visual states, behavior, copy, or workflow to check.

Use this shape when helpful:

```markdown
### Review Guide: <phase or task name>

- Start from: <screen, command, route, state, or fixture>
- Walkthrough: <the happy-path flow the reviewer should try>
- Expected: <what should happen and what should feel different or correct>
- Stress: <edge cases, awkward inputs, slow states, empty states, permission boundaries, or repeated actions>
- Watch for: <regressions, confusing copy, visual mismatch, broken workflow, or product-fit concerns>
```

Keep the guide proportional to product risk. A small UI copy change may need two bullets. A workflow change that affects user decisions, data integrity, payments, permissions, onboarding, or cross-role behavior should get a fuller tour.
