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

## Install directly from a manifest

AFK 2.0.6 and newer support direct installation without adopting a profile or
opening the web app:

```sh
afk install https://example.com/stack.json
```

An interactive terminal shows the manifest's original repositories and explicit
skill selections, asks for an agent and Global/project destination, and confirms
before saving the stack and running Skills CLI. The saved manifest and origin URL
appear in Sources & Stacks using the same settings file (`AFK_SETTINGS` applies).
Reload an already-open app to see CLI changes. An existing stack with the same ID
is replaced by the reviewed manifest and URL; repeated installs do not create
duplicates. Changes to that saved stack during review abort before installation.
Declining confirmation saves nothing. The saved stack remains if installation
fails or is cancelled, so its presence does not prove successful installation.
Supported agents are `universal`, `codex`,
`claude-code`, `cursor`, and `opencode`. Project scope accepts an existing folder;
it does not require or save a configured AFK project.

For automation, specify both target options and confirmation:

```sh
afk install https://example.com/stack.json --agent codex --global --yes
afk install example.com/stack.json --agent claude-code --project ./my-project --yes
npx @logbookfordevs/afk install https://example.com/stack.json --agent codex -g --yes
```

The npm invocation requires AFK 2.0.6 or newer. To exercise a local checkout, build it with `pnpm afk:build`
and replace `afk` with `node packages/afk/dist/index.js`.

Bare domain/path arguments use HTTPS. The same manifest policy applies: no HTTP,
credentials, fragments, or redirects; a 15-second request timeout and 1 MB response
limit apply. Pass the direct JSON asset (for example `/stack.json`), rather than
the HTML `/stack/` guide. Fetch and validation errors prevent installation.

Sources install sequentially with their explicit selections using AFK's existing
Skills CLI runner. Installation may replace existing skills and make them
available. A failed source stops the remaining sources; completed or partial
files remain. The command reports the completed source count and exits nonzero
on failure (130 for installation cancellation). It does not claim rollback or
that every skill in a failed source was installed. `--yes` requires an explicit
agent and scope; without it, a terminal confirmation is required.

## Agent operations

Use `afk manage describe stack/preview` for live input guidance. Preview accepts
`{manifest: <object or JSON string>}` or `{origin: <HTTPS URL>}`, and optional
existing `id` for refresh. It returns `{stack, expected}`. After reviewing both,
pass that exact result to `stack/save`; `expected` is null for a new stack. AFK
rejects a changed saved snapshot. `stack/script` takes a saved `id`, optional
`scope` and `agent`; it returns script text. `stack/remove` takes `id` and the
reviewed saved stack as `expected`. Schema-guided settings edits also support
stacks; preserve unrelated and managed state, validate, then run doctor.
