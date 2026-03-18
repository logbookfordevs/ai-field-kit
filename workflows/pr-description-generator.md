# /pr-description-generator Command

Generate a structured Pull Request description by combining branch diffs with a short user-provided summary.

## Usage
```
/pr-description-generator <base-branch> <feature-branch>
```

## Workflow

### Step 1: Gather Context

Ask for:

- **Base Branch (Target)** (e.g., `development`, `main`)
- **Feature Branch (Source)** (e.g., `feat/new-feature`, `fix/bug-123`)
- **High-Level Summary** of what the user intended to ship

### Step 2: Identify the Scope of Change

Run:

```bash
git diff --name-only <base_branch>...<feature_branch>
```

Do not ask the user to paste the diff manually.

### Step 3: Analyze the Changes

Read the relevant files and diffs to understand:

- The core purpose of the changes
- New features added
- Bugs fixed
- Refactors made
- Dependency or config changes

### Step 4: Generate the PR Description

Produce a PR description with these sections:

- **Title**
- **Summary**
- **Type of Change**
- **Related Issues**
- **Changes Made**
- **Testing Considerations**
- **Additional Notes**
- **Screenshots or GIFs** when relevant
- **Review Flow Diagram** showing the best reading order for reviewers

## Output Guidelines

- Optimize for reviewer comprehension, not exhaustiveness
- Make testing steps concrete and scenario-based
- When useful, include a Mermaid review flow based on dependency order
- If a file's purpose is ambiguous from the diff alone, ask the user for a short clarification before finalizing
