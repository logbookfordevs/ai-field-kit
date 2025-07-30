# Guide to Iterative and Logical Code Review

Before starting, identify the two branches involved in the Pull Request:

- **Base Branch (Target):** `_________________________` (e.g., `development`, `main`)
- **Feature Branch (Source):** `_________________________` (e.g., `feat/new-feature`, `fix/bug-123`)

---

This guide outlines a method for reviewing Pull Requests (PRs) or sets of changes in a structured manner, following the developer's line of reasoning. The goal is to build context incrementally, making the review more efficient, insightful, and focused on the "story" of the implementation, not just the final code. It's like trying to repeat the developer steps.

## The Process

### Step 1: Identify the Scope of Change

Before you begin, get a list of all the files that were changed. This provides a high-level overview of the scope and the areas of the system that were impacted.

Use the `git diff` command to list the files:

```bash
git diff --name-only <base_branch>...<feature_branch>
```

- `<base_branch>`: The target branch (e.g., `development`, `main`).
- `<feature_branch>`: The branch containing the changes to be reviewed.

### Step 2: Define and Display the Logical Review Order

Before diving into the files, map out the "story" of the changes by visualizing how the components are built or assembled, from foundational elements to dependent parts. This diagram illustrates the **dependency hierarchy** and the logical order in which the system's pieces fit together. It makes the abstract concept of a "logical flow" concrete and easy to follow for the **USER** to understand the proposed review flow and agree to it.

**Example Review Flow Diagram (Illustrating Build/Assembly Order):**

```
      [ config/setup/e2e-setup.ts ]
                 |
      (Foundation & Environment - the base layer)
                 v
        [ core_module.ts ]
                 |
      (Core Module - built upon the foundation)
                 v
+----------------+-----------------+
|                                  |
v                                  v
[ dependent_module_A.ts ]      [ dependent_module_B.ts ]
|                                  |
(Dependent Feature A - integrates with core) (Dependent Feature B - integrates with core)
```

Don't review files in alphabetical order. Instead, create a "journey" that starts from the foundation and moves toward the more specific features. A good order is often:

1.  **Configuration and Setup:** Start with foundational files that set up the environment or global configurations (e.g., `e2e-setup.ts`, `docker-compose.yml`, `.env.example`). These are the building blocks upon which everything else rests.
2.  **Low-Level Utilities/Shared Components:** Review any new or modified utility functions, helper libraries, or reusable components that are consumed by many other parts of the system. These are often the first pieces built.
3.  **Core Entities and Business Logic:** Move to the central data models, services, and core business logic that define the application's primary functionality (e.g., `referrals.model.ts`, `referrals.service.ts`, `referrals.test.ts`). These depend on the foundational setup and utilities.
4.  **Feature-Specific Modules/Controllers:** Next, review modules or controllers that implement specific features, often interacting with the core entities (e.g., `referral-invitations.ts`, `referral-updates.ts`).
5.  **User Interface (UI) - Pages/Views:** Finally, review the top-level UI components, pages, or views. These are the "end products" that integrate all the underlying logic and components.

### Step 3: Review File by File (Focused Analysis)

Before starting the review, create a TODO list where each item represents a file to be reviewed. This helps you track progress and ensures no file is missed. For example:

- [ ] src/main.py
- [ ] src/utils.py
- [ ] tests/test_main.py

With the order defined, begin the iterative process. For each file, focus only on its changes to avoid noise.

Use the `git diff` command to see the changes in a specific file:

```bash
git diff <base_branch>...<feature_branch> -- path/to/your/file.ext
```

For each file, use the following analysis template. **Adhere strictly to the rules within this template.**

---

### Analysis: `path/to/your/file.ext`

**Core Rules for Analysis:**

- **Ground all analysis in facts.** Never assume the existence of files, methods, or logic that you have not explicitly read or verified from the codebase. If you need more context, state that you will read other files first before making a claim.
- **Be specific and visual.** When discussing complex logic, specific functions, or potential issues, you **MUST** either reference the exact line numbers (e.g., "in lines 42-55") or display the relevant code block directly in your explanation to provide clear context to the user.

**Summary of Changes:**
_A brief description of what was changed in this file. What was the main goal? (e.g., "Added a full E2E test suite for the invitations module")._

**✅ Positives:**

- _Positive point 1: e.g., Excellent test coverage for all endpoints._
- _Positive point 2: e.g., Clear, well-documented code that follows project standards._
- _Positive point 3: e.g., Good handling of error cases and edge scenarios._

**⚠️ Points of Attention/Improvements:**

- _Point of attention 1: e.g., The `it('should do X')` test is monolithic and tests multiple functionalities. It could be broken down into smaller, more focused tests to make debugging easier._
- _Point of attention 2: e.g., The use of a 60s timeout might indicate a performance issue worth investigating._
- _Point of attention 3: e.g., The authentication mock uses a superuser, which could mask permission-related bugs._

**Conclusion:**
_A brief summary of the file analysis. (e.g., "High-quality work; the main suggestion is to refactor the monolithic test.")._

---

### Step 3.1: Pause and Confirm After Each File

This is the most critical step for an effective interactive review. After analyzing a file and presenting your findings, you **MUST** stop and ask for confirmation before proceeding to the next file in the agreed-upon flow.

This pause is essential to give the user space to ask questions, discuss the analysis, and provide feedback.

**Use a clear and direct prompt for this. For example:**

> `[Your analysis of file_A.ts goes here]`
>
> `---`
>
> `Shall we proceed to the next file, dependent_module_B.ts?`

**Do not proceed until you receive explicit confirmation from the user.**

### Step 4: Write the Final Review Summary

After analyzing all the files, synthesize your observations into a final summary.

1.  **Overall View:** Start with a general assessment of the changes. (e.g., "Excellent work in adding test coverage for the referral modules. The overall code quality is very high.").
2.  **Recurring Patterns:** Point out any patterns you observed across multiple files, whether good or bad. (e.g., "The test structure is consistent and robust across all files.").
3.  **Key Suggestions:** List the most important suggestions that should be addressed. (e.g., "The main recommendation is to refactor the monolithic tests identified in files X and Y to improve maintainability.").
4.  **Final Decision:** Conclude with your recommendation (e.g., "I approve the changes after the mentioned points are addressed," or "Requesting changes before approval.").

---

### Appendix: Assisting with Pull Request Comments

If the user asks for help drafting a comment to be posted on a Pull Request, your role is to provide the **substance** of the message, not the context that the PR platform already provides.

**The Core Rule: Be Context-Aware**

When drafting a comment, **DO NOT** include file paths, line numbers, or code blocks. The user will anchor the comment to the relevant code on the GitHub UI. Your drafted text should be ready to be copied and pasted directly.

**Example:**

Let's say the analysis identified a large, monolithic test.

❌ **Bad Draft (Redundant Context):**

> "In the file `test/e2e/modules/referrals.test.ts`, for the test starting on line 98, I noticed that it is too large. It should be broken down into smaller tests."

✅ **Good Draft (Concise and Actionable):**

> "This test has become monolithic, covering creation, counting, and multiple closing scenarios. To improve maintainability and make debugging easier, could we refactor this into several smaller, more focused `it` blocks, each testing a single piece of functionality?"

By providing only the concise text, you create a much better user experience.

---

### Appendix B: Going Beyond the PR for Macro-Understanding

A code change is never isolated. To perform a truly insightful review, you must understand the broader context.

**The Core Rule: Proactively Seek Context**

You **MUST** feel empowered to read and analyze files that are **NOT** part of the Pull Request to understand the full impact of the changes.

If you identify that a change in `file_A.ts` might affect logic in `file_B.ts` (which is not in the PR), you **SHOULD** proactively state your intention to read `file_B.ts` to provide a complete analysis.

**Example Interaction:**

> **AI:** "I've analyzed the changes in `auth-service.ts`. The modification to the `generateToken` function seems to alter the token's payload. To understand how this might affect user session validation, I need to review `session-middleware.ts`, where this token is consumed.
>
> Shall I proceed with reading `session-middleware.ts` to complete my analysis?"

This approach ensures your analysis is comprehensive and helps identify potential side effects that would otherwise be missed.
