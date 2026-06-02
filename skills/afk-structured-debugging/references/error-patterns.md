# Error Patterns

Use these checklists after the failure type is known.

## Test Failures

Look for:

- outdated assertions
- hidden shared state
- order dependence
- timing issues
- incorrect test setup

## Build Failures

Look for:

- cited type errors
- broken imports or exports
- config drift
- dependency issues
- environment mismatches

## Runtime Errors

Look for:

- null or undefined assumptions
- broken data flow
- request/response mismatch
- auth or permission gaps
- unexpected external service responses

## No Error, But Behavior Is Wrong

Prefer:

- logging at key transitions
- value tracing across the relevant path
- comparison between expected data shape and actual data shape
