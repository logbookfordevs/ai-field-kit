# Sources & Stacks

Sources are repository bookmarks with all skills or an explicit selection. Stacks
combine explicit selections from multiple original repositories under one name.
They are portable install plans, separate from activation profiles and local inventory.

## Manifest contract

The canonical [version 1 schema](schemas/skill-stack.v1.schema.json) and
[complete example](examples/skill-stack.v1.json) define the publisher contract:

- `version`: exactly `1`.
- `id`: stable identifier, distinct from the display name.
- `name`: display name; `description` is optional.
- `sources`: ordered, nonempty groups with `name`, `source`, and `skills`.
- `source`: the original Skills CLI repository reference, kept unchanged.
- `skills`: a nonempty list of unique explicit skill names; no wildcards.
- `$schema`: optional editor guidance; AFK never fetches or executes it.

Unknown fields and executable directives are rejected. A manifest has at most
100 groups and 1000 names per group. Names/identifiers and source references
cannot contain control characters. Source references cannot begin with a dash.
The same skill name may occur in different source groups; review potential
installation collisions rather than silently rewriting or renaming upstream skills.

Publish JSON at a directly fetchable HTTPS URL (for GitHub, use the raw file URL).
Users can paste the JSON or its HTTPS URL into AFK. Redirects are rejected;
use the final raw JSON URL. Import reviews the manifest
before saving and never downloads skills, installs packages, or creates profiles.
The manifest URL is provenance for explicit refresh, not an installation source.

A saved stack stores its manifest and optional `origin` URL in the optional
`stacks` array of settings version 1. Existing `favoriteSources` remains unchanged.
Old settings files without `stacks` still work. Pasted manifests have no remote
origin; they can be edited and exported as JSON.

Remote refresh fetches only JSON and proposes a replacement. Users compare the
saved name, description, source references and selections with the proposal before
applying it. Local edits remain until that explicit decision. Refreshing a manifest
does not update installed packages; Installed Skills' update command stays separate.

The copied shell script runs Skills CLI sequentially for each source, with the
saved explicit names and chosen destination/agent. AFK copies text only; users
choose when to run it. Removing a source or stack leaves installed skills alone.

## Agent operations

Use `afk manage describe stack/preview` for live input guidance. Preview accepts
`{manifest: <object or JSON string>}` or `{origin: <HTTPS URL>}`, and optional
existing `id` for refresh. It returns `{stack, expected}`. After reviewing both,
pass that exact result to `stack/save`; `expected` is null for a new stack. AFK
rejects a changed saved snapshot. `stack/script` takes a saved `id`, optional
`scope` and `agent`; it returns script text. `stack/remove` takes `id` and the
reviewed saved stack as `expected`. Schema-guided settings edits also support
stacks; preserve unrelated and managed state, validate, then run doctor.
