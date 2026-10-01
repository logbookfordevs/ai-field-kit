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

## Checks

```sh
pnpm afk:typecheck
pnpm afk:lint
pnpm afk:test
pnpm afk:build
node --check packages/afk/web/client.js
```

The test command runs skill/settings/server regressions and the installer test.
The server test requires permission to bind a loopback port. Use a temporary home
and fixture skills for activation tests; a read-only inventory check can use real
skills without changing them. Confirm persistence failures, overlap handling,
project isolation, and shutdown rather than pinning authored instruction prose.

## Boundaries

`src/index.ts` delegates to `src/fieldwork/cli.ts`. The fieldwork modules own
settings, availability, invocation metadata, Skills CLI preparation, and local APIs.
The app's HTML and JavaScript live under `web/`; its fonts are bundled locally.

APIs require a per-session token and matching local host/origin. Settings writes
are serialized. Tool execution is explicit and its result survives closing the
dialog during the session. Repository preparation uses an isolated temporary home;
only selected skill copies are kept in the shared disabled store.

Read root PRODUCT.md for scope, the product spec for behavior, and the scoped
web DESIGN.md for interface work. Root DESIGN.md remains the brand reference.
Do not redesign or update `apps/site/` as part of app maintenance unless requested.

## Release status

The pivot is not published. A branch push does not publish npm or deploy the website.
The package version has not been bumped. Release preparation is handled by the
repository's `afk-release` skill only when explicitly requested; the existing tag
workflow publishes npm and creates a GitHub Release.

The update command copied by the app belongs to Skills CLI and only updates
installations it tracks. AFK's staged disabled copies do not establish a separate
upstream-update registry. Native invocation files and links are tested; discovery
inside live agent conversations is a separate verification step.
