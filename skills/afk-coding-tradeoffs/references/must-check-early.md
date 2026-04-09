# Must Check Early

These are not mandatory questions for every session.

Use this file as an early-signal reference:
- if the current scope clearly implies one of these categories
- and not asking early would likely create rework later
- then surface that preference near the start of the discussion

Do not turn this into a checklist. Only ask what is relevant.

## Registries and UI sources

Check early when:
- the feature will likely use borrowed UI primitives or blocks
- the user already has strong preferences about UI sources

Good things to lock:
- whether registries are acceptable at all
- preferred registries
- avoided registries
- whether the default should be registry-first or custom-first
- whether a preferred headless foundation already exists
- if shadcn/ui is in play, whether there is a preferred preset or setup flavor
- preferred icon families when the feature will visibly depend on iconography

Examples:
- shadcn/ui
- Magic UI
- React Bits
- Coss
- Animate UI
- Kibo UI
- Base UI patterns

Headless component examples:
- Base UI
- Radix UI
- Headless UI
- another project-preferred foundation

Shadcn-specific examples worth checking early:
- preferred shadcn preset

Icon examples:
- Lucide React
- Phosphor Icons
- Heroicons
- another project-preferred set

## Data fetching strategy

Check early when:
- the feature clearly depends on remote data
- the fetch strategy will shape the whole feature

Good things to lock:
- preferred client (`fetch`, `axios`, `ky`, project default)
- whether a query/cache library should be used
- whether the feature should stay close to existing repo conventions

## Query and cache structure

Check early when:
- the feature will use TanStack Query or an equivalent cache/query layer
- query reuse and invalidation consistency will matter

Good things to lock:
- raw `useQuery` calls vs reusable `queryOptions`
- custom hooks vs shared query definitions vs hybrid
- centralized query key dictionary vs ad hoc query keys

## Form strategy

Check early when:
- the feature clearly contains forms or complex input flows

Good things to lock:
- native form state vs form library
- preferred form library
- implementation style inside the chosen form library
- controlled vs uncontrolled preference where meaningful

Form library examples:
- React Hook Form
- TanStack Form
- another project-preferred form layer

Useful nuances to lock early:
- React Hook Form: `register` vs `Controller` / `useController` vs mixed
- TanStack Form: field component wrappers vs direct field render usage
- whether field abstractions should be thin wrappers or highly opinionated shared components
- whether the feature should stay close to the repo's current form patterns even if another approach is viable

## Validation boundary

Check early when:
- the feature includes user input, save flows, or server-backed validation

Good things to lock:
- frontend validation
- server validation
- both, with distinct responsibilities
- schema preference if relevant (`zod`, `yup`, existing project standard)

## Component composition and ownership

Check early when:
- the UI contains reusable pieces, nested local logic, or heavy interaction state

Good things to lock:
- shared controller vs local composable ownership
- local child component in same file vs separate file when the decision materially affects clarity or ownership
- wrapper component approach vs primitive composition approach

## Modal, drawer, and detail-surface strategy

Check early when:
- the feature includes overlays, side panels, detail surfaces, or row actions

Good things to lock:
- modal vs drawer vs inline detail
- one shared surface vs one per row/item
- fetch-inside-mounted-content vs fetch-before-open when that changes cost or UX

## State reactivity boundary

Check early when:
- it is obvious that some values might not belong in render-driven state

Good things to lock:
- reactive UI state vs mutable container / ref
- event-driven updates vs effect-driven derivation where the choice affects clarity or bug risk

## API and transport style

Check early when:
- the feature touches backend integration shape in a way that changes the feature architecture

Good things to lock:
- server actions vs API routes vs mixed model
- whether reads and writes should use the same transport style
- whether the project has observability/session-replay constraints that make one approach preferable

## Quick rule

Bring one of these up early only when:
- the scope clearly implies it
- the choice will shape multiple later decisions
- not asking now would likely create rework

If the category is only marginally relevant, wait until it naturally becomes the active trade-off area.

## Library follow-through

If the discussion lands on an external library or registry:
- record the chosen direction
- note which library-specific skill should be consulted next when one exists
- otherwise note that official docs should be checked through Context7 or another primary-source MCP path when available

The point is not to reopen the trade-off. The point is to avoid treating "we chose library X" as enough implementation guidance when the actual API/setup details still matter.
