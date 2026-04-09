# Examples

Use these examples to calibrate question quality.

The goal of `afk-coding-tradeoffs` is not to ask every possible implementation question. The goal is to ask only the questions that materially change UX, implementation shape, maintenance cost, or future flexibility.

## Smart Questions Worth Asking

### Modal ownership in a table

Good question:

```text
For row actions in this table, do we want:
1. one shared modal outside the table, controlled by selected row state
2. one modal per row, owned locally by each row action
3. a hybrid approach if some actions need local ownership and others need centralized control
```

Why this is high leverage:
- changes component ownership
- changes state strategy
- changes render shape and maintenance cost
- can affect performance and bug surface in dense tables

### React state strategy

Good question:

```text
Does this value need to be reactive in the UI, or is it only a mutable container for imperative logic?
```

Why this is high leverage:
- affects `useState` vs `useRef`
- changes render behavior
- changes bug risk and mental model

### Event handler vs useEffect

Good question:

```text
Should this transition happen directly in the event handler when possible, or should it be derived indirectly through `useEffect`?
```

Why this is high leverage:
- affects clarity
- affects correctness and race-condition risk
- changes how easy the flow is to reason about later

### TanStack Query structure

Good question:

```text
For this feature, do we want:
1. reusable `queryOptions` definitions
2. custom hooks per endpoint
3. both, with `queryOptions` as the base and hooks where feature logic needs composition
```

Why this is high leverage:
- changes reuse strategy
- changes how query keys and behavior stay consistent
- affects maintainability and extension cost

### Same file vs separate file for local child components

Good question:

```text
This child component is only used inside this screen. Should it stay in the same file for local readability, or move to its own file because it has enough behavior, weight, or reuse pressure to justify separation?
```

Why this is high leverage:
- changes code ownership and navigability
- can improve local readability or reduce file sprawl depending on the case
- becomes especially meaningful when the child has its own fetches, memoization, effects, or dense UI logic

### Fetch only when a modal opens

Good question:

```text
Should the modal content own the fetch so data loads only when it mounts, or should the parent fetch earlier and pass data down even before the modal opens?
```

Why this is high leverage:
- changes data timing and perceived performance
- changes whether work happens lazily or eagerly
- affects modal responsiveness, network usage, and component ownership

### Form library strategy

Good question:

```text
Do we want native form state here, or a form library? If we use React Hook Form, do we prefer `register`, `useController`, or a mixed approach based on field complexity?
```

Why this is high leverage:
- commits the feature to a specific form mental model
- changes how reusable field wrappers work
- affects validation style, controlled/uncontrolled strategy, and future maintenance

### Validation boundary

Good question:

```text
Should validation live mainly in the frontend, mainly on the server, or in both with different responsibilities?
```

Why this is high leverage:
- changes user feedback timing
- changes error handling shape
- changes how much trust the client can place in local validation

### Query key strategy

Good question:

```text
For TanStack Query, do we want a centralized key dictionary for consistency, or is ad hoc key creation acceptable for this scope?
```

Why this is high leverage:
- changes cache consistency and invalidation safety
- affects maintainability across larger query surfaces
- matters more as the feature grows or shares data dependencies

### Registry preference

Good question:

```text
If we use registry components here, which families are acceptable for this project and which should be avoided by default?
```

Why this is high leverage:
- sets practical implementation boundaries
- affects consistency with the rest of the UI
- changes how much custom code versus borrowed primitives the feature will own

### Registry vs custom implementation

Good question:

```text
Should we start from a preferred registry component here, or build the behavior custom because the interaction is specific enough to justify it?
```

Why this is high leverage:
- affects delivery speed
- affects consistency with the rest of the system
- changes future ownership and customization cost

### Fallback and feedback strategy

Good question:

```text
When data is missing or delayed, do we want a generic fallback, contextual feedback, or a more explicit empty/error state?
```

Why this is high leverage:
- materially changes UX
- changes what the user learns from failure or absence
- changes implementation behavior around edge states

## Boring Questions Worth Suppressing

### `type` vs `interface`

Usually bad question:

```text
Do you prefer `type` or `interface` here?
```

Why this is usually low leverage:
- often style-only
- usually answered by repo conventions
- rarely changes the real implementation strategy

### `useState` vs `useReducer` for trivial state

Usually bad question:

```text
Should this simple two-field local state use `useState` or `useReducer`?
```

Why this is usually low leverage:
- if state is trivial, the decision rarely matters
- this often becomes taste instead of strategy

### Syntax or formatting preferences

Bad question:

```text
Should helper functions use arrow syntax or function declarations?
```

Why this is low leverage:
- usually repo/linter/style territory
- rarely changes UX, architecture, or code ownership

### Convention questions already answered by the codebase

Bad question:

```text
Should we keep one component per file?
```

Why this can be low leverage:
- if the repo already has a clear pattern, ask only when this specific feature creates a real trade-off
- otherwise prefer discovered conventions over user re-decision

Better version when it becomes intelligent:

```text
This child component is only used here, but it has enough UI logic/data loading that separation might improve ownership. Should it stay local in the same file or move out?
```

Why this version is better:
- it is no longer abstract style preference
- it ties the decision to real local complexity, ownership, and runtime behavior

### Premature file splitting

Bad question:

```text
Should every nested UI fragment become its own file?
```

Why this is low leverage:
- often creates ceremony without clearer ownership
- usually matters only when the fragment has real logic, data, or reuse pressure

### Library choice with no real need

Bad question:

```text
Do you want axios, fetch, ky, superagent, or something else for this tiny one-off request?
```

Why this is often low leverage:
- if the project already has a standard client, the question is already answered
- if the request is tiny and isolated, the difference may not justify discussion
- ask this only when the choice affects the broader request layer or future consistency

## Quick Heuristic

Ask the question only if different answers would lead to meaningfully different:
- UX behavior
- implementation shape
- reuse strategy
- maintenance cost
- correctness risk
- library/pattern commitment

If the answer mostly changes personal style, wording, syntax, or formatting, do not ask.
