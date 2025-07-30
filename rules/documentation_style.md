# Rules for Creating Documentation

## Core Philosophy: Documentation Experience (DocX)

- **Documentation should be as enjoyable to consume as well-written code is to read**
- **Always prioritize the experience of those who will use the documentation**
- **Treat documentation as a product, not as an obligation**

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

## Rule 10: Success Metrics

**Document with these metrics in mind:**

- Time until first implementation works
- Drop-off rate in the documentation
- Number of support tickets avoided
- **"Emoji test"**: what emoji would someone use after your doc? 😍, 😐, or 😤?

## Rule 11: Keep It Alive

- **Code examples must run** (test in CI)
- **Links must work** (automatic checking)
- **Screenshots must be up to date**
- **Clear versioning** (what changed between versions)

## Rule 12: Developer Empathy

**Always ask yourself:**

- "How would I feel reading this at 11pm with a tight deadline?"
- "Would this make me excited to use it or look for alternatives?"
- "If I were a junior, could I understand?"
- "If I were a senior, would I be annoyed by unnecessary info?"

## Final Checklist: Doc Review

Before publishing, ask:

- [ ] Can someone use this without asking me anything?
- [ ] Does the first example work in under 5 minutes?
- [ ] Does it look like a product I'd enjoy using?
- [ ] Did I anticipate the 3 most common problems?
- [ ] Is the tone human and empathetic?

---

**Remember: Bad documentation is worse than no documentation. If you’re not going to invest in doing it well, it’s better not to do it at all.**
