# Developing AFK

Requires Node.js 20 or newer and the pnpm version declared in root `package.json`.
From the repository root:

```sh
pnpm install
pnpm afk:build
node packages/afk/dist/index.js ui --no-open
```

Open the loopback URL printed in the terminal. The CLI normally opens a browser;
`--no-open` leaves that to you. Exit AFK or Ctrl+C shuts down the server.

## Background testing

Build first, then use the local executable:

```sh
node packages/afk/dist/index.js --background --port 4310
node packages/afk/dist/index.js status
node packages/afk/dist/index.js stop
```

The background process detaches from the terminal and prints its loopback URL.
Status reports the server’s resident memory (RSS) in MiB, excluding browser and
child tool processes. Status and stop address only that machine's background instance; a foreground
server is independent. Runtime records and logs live under `~/.afk/`, rather than
in the portable AFK folder. Use a temporary home for lifecycle tests.

## Checks

```sh
pnpm afk:typecheck
pnpm afk:lint
pnpm afk:test
pnpm afk:build
node --check packages/afk/web/client.js
node --check packages/afk/web/rules.js
node --check packages/afk/web/onboarding.js
node --check packages/afk/web/members.js
node --check packages/afk/web/sources.js
node --check packages/afk/web/stacks.js
node --check packages/afk/web/invocation-info.js
```

The test command runs skill/settings/server, rule-sync and portable ZIP regressions,
plus the installer test.
The server test requires permission to bind a loopback port. Use a temporary home
and fixture skills for activation tests; a read-only inventory check can use real
skills without changing them. Confirm persistence failures, overlap handling,
project isolation, and shutdown rather than pinning authored instruction prose.

## Boundaries

`src/index.ts` delegates to `src/fieldwork/cli.ts`. The fieldwork modules own
settings, availability, invocation metadata, Skills CLI preparation, and local APIs.
`operations.ts` owns the actions shared by the HTTP app and headless CLI;
`operation-catalog.ts` exposes their current payload guidance. `doctor.ts` checks
schema and local consistency without mutation, and `settings-schema.ts` supplies
editor guidance while the runtime validator owns cross-field validation.
`stacks.ts` owns the versioned manifest contract, bounded HTTPS JSON fetching and
sequential script generation. Keep its exported schema synchronized with
`docs/schemas/skill-stack.v1.schema.json`; the schema regression checks equality.
`rules.ts` owns canonical rule files and managed destination regions; `bundle.ts`
owns portable ZIP validation and restoration. Rule operations use temporary target
files in tests; they must preserve surrounding text and restore owned changes after
failed writes. Importing a bundle never writes agent destinations.
The app's HTML and JavaScript live under `web/`; its fonts are bundled locally.

`skills/afk-cli/` at the repository root is the canonical agent skill. The package
build copies it and its references into `packages/afk/skills/afk-cli/`, which is
generated and ignored by Git. Package files include that copy for npm and release
archives. `afk guide` resolves its path relative to the installed executable,
independently of the working directory and settings location. Edit the canonical
source, then rebuild; avoid editing the generated copy.

APIs require a per-session token and matching local host/origin. Settings writes
through shared operations are serialized within the process. Direct settings
edits and separate processes require checking for intervening changes; AFK does
not reconcile concurrent writers. Tool execution is explicit and its result survives closing the
dialog during the session. Repository preparation uses an isolated temporary home;
only selected skill copies are kept in the shared disabled store.

Read root PRODUCT.md for scope, the product spec for behavior, and the scoped
web DESIGN.md for interface work. Root DESIGN.md remains the brand reference.
Do not redesign or update `apps/site/` as part of app maintenance unless requested.

## Release status

AFK 2.0 is released. Changes under **Next Release** in the changelog remain
unreleased until a new version is published. A branch push does not publish npm
or confirm a website deployment. Release preparation is handled by the
repository's `afk-release` skill only when explicitly requested; the existing tag
workflow publishes npm and creates a GitHub Release.

The update command copied by the app belongs to Skills CLI and only updates
installations it tracks. AFK's staged disabled copies do not establish a separate
upstream-update registry. Native invocation files and links are tested; discovery
inside live agent conversations is a separate verification step.
