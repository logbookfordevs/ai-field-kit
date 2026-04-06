---
name: afk-documentation-authoring
description: Write documentation using the DocX playbook (journeys, progressive disclosure, validation). Use when the user asks to write, rewrite, structure, or audit docs (READMEs, guides, API docs, onboarding, troubleshooting, runbooks) and wants a reader-first approach with quick wins first.
---

# Documentation Instructions

## Core Philosophy: Documentation Experience (DocX)

- **Documentation should be as enjoyable to consume as well-written code is to read**
- **Always prioritize the experience of those who will use the documentation**
- **Treat documentation as a product, not as an obligation**
- **Do not stop at readable — aim for readable, usable, and enjoyable**
- **When the material is technical or dry, use smart framing, strong examples, and the occasional apt analogy to keep the reader engaged without becoming gimmicky**

## Rule 1: Question Before Documenting

**NEVER start documenting without first asking:**

- Who will read this and in what context?
- What problem is this person trying to solve?
- How rushed/stressed is this person?
- What do they already know vs what do they need to learn?

## Rule 2: Prioritize Journeys, Not Features

**❌ Avoid:** "Here are all the API functions"  
**✅ Prefer:** "How to make your first integration in 5 minutes"

### Structure by real scenarios:

- "When you want to do X, follow these steps..."
- "If you're migrating from Y, then..."
- "To debug problem Z, start here..."

When a pure journey format is not enough, combine:
- the reader journey
- the key decision or rationale behind the behavior

Good docs often answer both:
- "How do I do this?"
- "Why is it designed this way?"

## Rule 3: Gratification First, Details Later

**Priority hierarchy:**

1. **Quick Start that works** (copy/paste and run)
2. **Common use cases** (80% of needs)
3. **Advanced configurations** (for when needed)
4. **Complete reference** (for specific queries)

## Rule 4: Code First, Explanation Second

```javascript
// ✅ This is clear and executable
const user = await api.getUser({
  id: "abc123",
  include: ["profile", "preferences"],
});

// Now explain the nuances...
```

**Vs** pages of text explaining concepts before showing code.

When documenting decisions or trade-offs, reverse the order only if the rationale is the product.

Examples:
- ADRs
- architectural choice records
- migration decisions
- public API changes with meaningful trade-offs

## Rule 5: Test the Journey in Practice

**Before publishing any doc:**

- Get someone who has never seen the project
- Ask them to follow the documentation without your help
- Observe where they get stuck, confused, or give up
- **Rewrite based on the real experience**

## Rule 6: Keep a Human Tone

**❌ Avoid robotic tone:**  
"To use the authentication feature, you must configure the parameters as specified..."

**✅ Prefer conversational tone:**  
"Let's set up authentication. You'll need two things: your API key and..."

## Rule 7: Anticipate Frustrations

**Include sections like:**

- "If it didn't work, it's probably because..."
- "Common error: if you see X, it means Y"
- "Quick troubleshooting"
- "FAQ of the problems that always come up"
- "Why this weird constraint exists"
- "What future readers and agents are likely to misread"

## Rule 8: Visual > Textual When Possible

- **Diagrams** for flows
- **Screenshots** for UIs
- **GIFs** for sequences
- **Colored code** always
- **Visual examples** of outputs

## Rule 9: Progressive Disclosure

**Layered structure:**

```
# Quick Start (5 min)
## Essentials
## First Example

# Practical Guides (when needed)
## Common Use Cases
## Configurations

# Reference (for consultation)
## Complete API
## All Parameters
```

This is especially important for technical docs that also need durable engineering context.

Layering often looks like:
- quick start first
- practical guide second
- why / architecture notes next
- deep reference or ADRs last

## Rule 10: Success Metrics

**Document with these metrics in mind:**

- Time until first implementation works
- Drop-off rate in the documentation
- Number of support tickets avoided
- **“Reaction test”**: would a reader feel delighted, neutral, or frustrated after following your doc?

## Rule 11: Keep It Alive

- **Code examples must run** (test in CI)
- **Links must work** (automatic checking)
- **Screenshots must be up to date**
- **Clear versioning** (what changed between versions)

For engineering docs, also keep alive:
- architectural decisions that have changed
- superseded choices
- public API behavior changes
- gotchas that future agents or teammates will otherwise rediscover painfully

## Rule 12: Developer Empathy

**Always ask yourself:**

- "How would I feel reading this at 11pm with a tight deadline?"
- "Would this make me excited to use it or look for alternatives?"
- "If I were a junior, could I understand?"
- "If I were a senior, would I be annoyed by unnecessary info?"

## Rule 13: Document the Why When It Matters

Documentation should not only explain what exists. It should capture why key decisions were made when future humans or agents will need that context.

Especially document:
- significant architectural decisions
- public API or interface changes
- non-obvious constraints
- trade-offs between rejected alternatives
- gotchas that are expensive to rediscover

Do not write "why" sections for obvious code or throwaway changes.

## Rule 14: Record Decisions, Not Just Instructions

When the doc is really carrying a decision, prefer a simple decision-friendly shape:

```md
## Context
[What problem or constraint existed]

## Decision
[What was chosen]

## Alternatives Considered
[What else was plausible and why it lost]

## Consequences
[What this means going forward]
```

This does not always need to be a formal ADR, but the reasoning should be durable.

## Rule 15: Public APIs and Shared Interfaces Deserve Better Docs

When documenting public APIs, shared interfaces, or team-facing modules, include:
- what the interface is for
- expected inputs and outputs
- error behavior or failure modes
- examples of correct usage
- non-obvious constraints or compatibility assumptions

Do not dump parameters without giving the reader a mental model.

## Rule 16: Preserve Joy in Technical Docs

Enjoyable documentation is not fluff.

It can mean:
- strong headings that create momentum
- examples that feel realistic instead of sterile
- smart analogies when they reduce confusion
- a little warmth or wit where it helps the reader keep going

It does **not** mean:
- jokes that age badly
- theatrics that distract from clarity
- cute language that hides technical truth

## Final Checklist: Doc Review

Before publishing, ask:

- [ ] Can someone use this without asking me anything?
- [ ] Does the first example work in under 5 minutes?
- [ ] Does it look like a product I'd enjoy using?
- [ ] Did I anticipate the 3 most common problems?
- [ ] Is the tone human and empathetic?
- [ ] Did I capture the why for the decisions that future readers will otherwise have to rediscover?
- [ ] If this touches a public API, major behavior, or architecture choice, is the rationale durable enough for future humans and agents?

---

**Remember: Bad documentation is worse than no documentation. If you're not going to invest in doing it well, it's better not to do it at all.**
