---
name: afk-typecheck
description: Run TypeScript type checking, document failures in a temporary `typecheck.md`, fix the issues, and close the loop with the user before optionally deleting the report.
---

Run TypeScript type checking, document failures in a temporary `typecheck.md`, fix the issues, and close the loop with the user before optionally deleting the report.

## Usage
```bash
/afk-typecheck
```

## Goal

Use this workflow when the user wants a guided type-check pass with a visible audit trail of:

- what failed
- what needs to change
- what was changed
- whether the temporary report should be kept or removed

## Workflow

### Step 1: Run the type check

Run:

```bash
npx tsc --noEmit
```

Important:

- Do not use `--no-emitter`.
- Follow the repository TypeScript validation rule and treat `--noEmit` as the source of truth.

### Step 2: If the type check passes

If there are no TypeScript errors:

- Tell the user the type check passed.
- Do not create `typecheck.md`.
- End the workflow.

### Step 3: If the type check fails

If there are TypeScript errors:

1. Create a temporary `typecheck.md` file in the project root.
2. Keep it short, practical, and easy to scan.
3. Capture:
   - the relevant errors
   - the likely root cause
   - the necessary fixes you plan to apply

Use a structure like:

```md
# Typecheck Report

## Errors
- `path/to/file.ts:12` - short description

## Planned Fixes
- Fix incorrect type for `foo`
- Add missing null guard in `bar`

## Applied Fixes
- Pending
```

### Step 4: Fix the errors

After creating `typecheck.md`:

1. Apply the necessary code changes.
2. Re-run:

```bash
npx tsc --noEmit
```

3. Keep iterating until the type check passes, unless the user interrupts with new instructions.

### Step 5: Update `typecheck.md`

Once the fixes are complete, update `typecheck.md` so it reflects:

- what the problem was
- what was changed to fix it
- the final validation result

Use a final structure like:

```md
# Typecheck Report

## Problems Found
- `path/to/file.ts:12` - type mismatch between X and Y

## Fixes Applied
- Updated `foo` to use the correct type
- Added a guard before accessing `bar.baz`

## Validation
- `npx tsc --noEmit` passed
```

### Step 6: Ask the user to validate the summary

After the type check passes, ask the user to review the outcome by explicitly confirming:

- what the problem was
- what was done to fix it

Use direct language such as:

> Please review `typecheck.md` and confirm whether it correctly explains the problem and the fix.

Do not delete the file before the user responds.

### Step 7: If the user approves

If the user confirms the report is correct:

1. Ask whether they want to remove `typecheck.md`.
2. If they say yes, delete the file.
3. If they say no, keep the file.

Use a direct follow-up like:

> The report looks good. Do you want me to remove `typecheck.md`?

### Step 8: If the user does not approve

If the user says the report or fix is not correct:

1. Follow the user's instructions exactly, including strict or opinionated adjustments.
2. Update code as requested.
3. Update `typecheck.md` to reflect the revised problem statement and revised fixes.
4. Re-run:

```bash
npx tsc --noEmit
```

5. Ask the user again to validate:
   - whether `typecheck.md` correctly explains the issue
   - whether the fix is acceptable
6. After approval, ask again whether the file should be deleted or kept.

Repeat this loop until the user is satisfied or explicitly stops the workflow.

## Guardrails

- Always use `npx tsc --noEmit` for validation.
- Only create `typecheck.md` when there are actual type errors.
- Keep `typecheck.md` concise and actionable.
- Do not silently delete `typecheck.md`.
- After every revision round, ask for user validation again before removing the file.
- If dependency issues block `npx tsc --noEmit`, install or sync dependencies first, then continue.