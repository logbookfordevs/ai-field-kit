# /afk-interactive-code-review Command

Review Pull Requests or branch diffs step by step, following the developer's reasoning instead of reading files in arbitrary order.

## Usage
```
/afk-interactive-code-review <base-branch> <feature-branch>
```

## Workflow

Before starting, confirm the two branches involved in the Pull Request:

- **Base branch (target)** (e.g., `development`, `main`)
- **Feature branch (source)** (e.g., `feat/new-feature`, `fix/bug-123`)

This workflow builds context incrementally, maps cross-file impact, defines a logical read order, and pauses after each file so the user can inspect and discuss the review as it unfolds.

### Step 1: Identify the Scope of Change

Get the list of changed files first:

```bash
git diff --name-only <base_branch>...<feature_branch>
```

### Step 1.5: Expand Impact Beyond the Diff (Mandatory)

When a PR changes shared contracts, you **MUST** review impacted files outside the diff.

Treat the PR as "contract-touching" when it changes at least one of the following:

- Request/response fields (added, removed, renamed, required, optional)
- Endpoint paths or HTTP methods
- Validation rules (required fields, limits, conditional requirements)
- Shared constants/enums used for persistence, analytics, or branching
- Lifecycle/status transitions that affect behavior in multiple entrypoints

For contract-touching PRs, execute this mandatory flow:

1. Extract contract tokens from the diff (field names, endpoint fragments, constants, statuses).
2. Search the branch for every token and identify all callers/consumers.
3. Build an **Impact Map** that includes changed files, unchanged but impacted files, and any uncertain paths requiring follow-up.
4. Add impacted unchanged files to the review TODO list before file-by-file analysis starts.
5. Do not finalize the review until each discovered caller is reviewed or explicitly marked out-of-scope with a concrete reason.

Use commands such as:

```bash
git diff --name-only <base_branch>...<feature_branch>
git diff <base_branch>...<feature_branch>
git grep -n "<tokenA>\\|<tokenB>" <feature_branch> -- '*.js' '*.jsx' '*.ts' '*.tsx'
```

Before starting file-by-file analysis, always show:

- **Impact Map**
- **Unchanged files added to review scope**
- **Potential blind spots** (if any)

### Step 2: Define and Display the Logical Review Order

Do not review files alphabetically. Build a reading journey from foundation to dependent features.

A good order is often:

1. **Configuration and Setup**
2. **Low-Level Utilities/Shared Components**
3. **Core Entities and Business Logic**
4. **Feature-Specific Modules/Controllers**
5. **User Interface (UI) - Pages/Views**

Before diving into file details, show:

- The proposed review order
- A TODO list of files in that order
- A Mermaid or ASCII diagram when it helps explain dependencies

### Step 3: Review File by File

For each file:

```bash
git diff <base_branch>...<feature_branch> -- path/to/your/file.ext
```

For each analysis:

- Ground all claims in code you actually read
- Reference exact lines or show the relevant code when discussing complex logic
- Summarize what changed
- Call out positives
- Call out risks or improvement points
- End with a concise conclusion

### Step 3.1: Pause After Each File

After each file analysis, stop and ask whether to proceed to the next file.

Use a direct checkpoint like:

> Shall we proceed to the next file, `some-file.ts`?

Do not continue until the user explicitly confirms.

### Step 4: Final Summary

After all files are reviewed, provide:

1. Overall assessment
2. Recurring patterns
3. Key suggestions
4. Final recommendation or approval stance

## Comment Drafting Rule

If the user asks for help drafting a PR comment, provide only the comment substance. Do not include file paths, line numbers, or code blocks that the PR UI already provides.
