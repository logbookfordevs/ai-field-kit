# AI-Assisted Guide to Generating PR Mermaid Flow

This guide outlines a structured process for generating a comprehensive and clear Pull Request (PR) mermaid flow by analyzing the changes between two branches.

## The Process

The process involves the AI gathering context from you, analyzing the code changes and structuring them into a standardized mermaid.

### Step 1: Analyze the Changes

Armed with your summary and the list of changed files, the AI will then read the content of those files and analyze the diffs to understand the "what" and "how" of the modifications. It will focus on:

- The core purpose of the changes (cross-referencing your summary).
- New features added.
- Bugs fixed.
- Refactoring performed.
- Dependencies changed.

### Step 2: Generate a Mermaid Flow

Based on all the gathered information, the AI will generate a mermaid flow using the instructions below. The goal is to provide a clear, concise, and context-rich flow that helps reviewers understand the changes quickly. The mermaid should only focus on files. Return a working mermaid flow.

### Review Flow Diagram

Map out the "story" of the changes by visualizing how the components are built or assembled, from foundational elements to dependent parts. This diagram illustrates the **dependency hierarchy** and the logical order in which the system's pieces fit together.
In addition, generate a **mermaid flow diagram** that not only shows the dependencies but also instructs the **USER** on the **best order to read the files**. The flow should make it clear where to start, how each file connects, and the most effective path for reviewing the system step by step.

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

A good order is often:

1.  **Configuration and Setup:** Start with foundational files that set up the environment or global configurations (e.g., `e2e-setup.ts`, `docker-compose.yml`, `.env.example`). These are the building blocks upon which everything else rests.
2.  **Low-Level Utilities/Shared Components:** Any new or modified utility functions, helper libraries, or reusable components that are consumed by many other parts of the system. These are often the first pieces built.
3.  **Core Entities and Business Logic:** Move to the central data models, services, and core business logic that define the application's primary functionality (e.g., `referrals.model.ts`, `referrals.service.ts`, `referrals.test.ts`). These depend on the foundational setup and utilities.
4.  **Feature-Specific Modules/Controllers:** Next, modules or controllers that implement specific features, often interacting with the core entities (e.g., `referral-invitations.ts`, `referral-updates.ts`).
5.  **User Interface (UI) - Pages/Views:** Finally, the top-level UI components, pages, or views. These are the "end products" that integrate all the underlying logic and components.
