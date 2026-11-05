# Developing AFK

Requires Node.js 20 or newer and the pnpm version declared in root `package.json`.
From the repository root:

```sh
pnpm install
pnpm afk:build
node packages/afk/dist/index.js --foreground --no-open
```

Open the loopback URL printed in the terminal. The CLI normally opens a browser;
`--foreground` keeps it attached to this terminal and `--no-open` leaves opening the page to you. Exit AFK or Ctrl+C shuts it down. Without `--foreground`, AFK starts in the background.

## Background testing

Build first, then use the local executable:

```sh
node packages/afk/dist/index.js start --no-open --port 4310
node packages/afk/dist/index.js status
node packages/afk/dist/index.js restart
node packages/afk/dist/index.js stop
```

The background process detaches from the terminal and prints its loopback URL.
Status reports the server’s resident memory (RSS) in MiB, excluding browser and
child tool processes. Status, stop and restart address only that machine’s
background instance; a foreground server is independent. The restart command verifies and stops the instance before starting a replacement on
the same port and current settings path. Changed terminal environment settings do
not override that path. If shutdown is still draining operations, restart reports
the wait rather than starting another process. Runtime records and logs live under `~/.afk/`, outside
the library. Use a temporary home for lifecycle tests.

Every outside command (Skills CLI, tool commands, the AFK installer) starts through
`command-runner.ts`, which enforces a silence limit and an overall limit, kills the
whole process group on timeout or cancel, and names the step in its failure.
`AFK_COMMAND_IDLE_MS` and `AFK_COMMAND_TIMEOUT_MS` override the limits for tests.
Only the browser opener and the background and app-update launchers spawn directly.
A recorded background server that is alive but not answering is reported by
`afk status` with its PID; `afk stop --force` stops it after checking the PID is an
AFK background server, and clears the record.

## Skill update testing

`afk skills update -g` and `afk skills update -p <project>` delegate updates in an
isolated workspace, then replace existing stored copies. Use temporary homes and
receipts to test update failures, skills that are off, agent folder links and
intervening edits. The web app uses the same `skills/update` operation;
`skills/update-state` exposes session progress without waiting for the mutation queue.

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
node --check packages/afk/web/packs.js
node --check packages/afk/web/kit.js
node --check packages/afk/web/install.js
node --check packages/afk/web/invocation-info.js
node --check packages/afk/web/skill-schedule.js
node --check packages/afk/web/agent-folders.js
node --check packages/afk/web/editor.js
node --check packages/afk/web/skills.js
node --check packages/afk/web/backup.js
node --check packages/afk/web/first-run.js
```

The test command runs skill, library, backup, restore, settings, server and rule-sync
regressions, plus the installer test. Library and backup tests use a temporary home, an
isolated Git config and a local bare repository as the remote; they never contact GitHub.
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
`stacks.ts` still owns the versioned manifest contract and bounded HTTPS JSON
fetching. Its script generation and stack storage are gone; manifests are the
publish format for packs. `kit.ts` compares Core with one machine's Global
inventory. `kit-cli.ts` implements `afk kit`, `afk add` and `afk migrate`. `migration.ts` is a pure mapping from version 1 stacks to Core
and packs, with `assertNothingLost` as its last check; `SettingsStore.save` is the
single gate that refuses writes to a version 1 file with stacks. Pack definitions
must stay byte-identical across migration because machine-local activation is keyed
by their hash. `skill-install.ts` runs explicit installation jobs through Skills CLI; state/cancellation operations bypass
the mutation queue. Use temporary homes and a local repository for browser tests. Keep its exported schema synchronized with
`docs/schemas/skill-stack.v1.schema.json`; the schema regression checks equality.
`rules.ts` owns canonical rule files and managed destination regions. Rule operations use
temporary target files in tests; they must preserve surrounding text and restore owned
changes after failed writes. `library.ts` owns the library repository, storage and links;
`library-init.ts` starts a library (`library/init-preview`, `library/init`, `afk library
init`), `library-backup.ts` pushes it, `library-restore.ts` restores it and
`library-checks.ts` finds edits made outside AFK.
`agent-table.ts` is Skills CLI 1.7.6's agent table (folders, detection, known invocation mechanisms); `agent-folders.ts` builds the Agent folders list and validates custom folders, and the library saves the enabled ones in `.afk/settings.json`. Agent icons in `web/assets/agent-icons/` are Skills Manager's, with its MIT notice beside them.
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
only selected skill copies are kept in AFK's storage.

Read root PRODUCT.md for scope, the product spec for behavior, and the scoped
web DESIGN.md for interface work. Root DESIGN.md remains the brand reference.
Do not redesign or update `apps/site/` as part of app maintenance unless requested.

## Release status

AFK 2.0 is released. Changes under **Next Release** in the changelog remain
unreleased until a new version is published. A branch push does not publish npm
or confirm a website deployment. Release preparation is handled by the
repository's `afk-release` skill only when explicitly requested; the existing tag
workflow publishes npm and creates a GitHub Release.

The app and `afk skills update` use the protected staged updater, which delegates
to Skills CLI and only updates installations it tracks. Pack preparation does
not establish tracking receipts for those copies. Direct `npx skills update`
bypasses AFK’s availability protection. Native invocation files and links are
tested; discovery inside live agent conversations is a separate verification step.

## App update notice

The web app checks the latest stable GitHub release on opening; successful and failed checks are cached for one hour. **Check for updates** explicitly refreshes the result. No installer runs during a check. The authenticated web-only endpoints are `GET /api/app/update-check`, `GET /api/app/update-state`, and `POST /api/app/update`.

**Update & restart** launches a detached worker that runs the existing `afk update` implementation, verifies the new launcher version, closes this app, and starts the updated launcher in the background on the same port with the same settings path. It supports both foreground and background app sessions. Queued mutations finish first; running tools must finish before updating. New mutations are blocked while updating. The page reloads when the restarted app supplies its new session token.

Progress and failure output stay machine-local in `~/.afk/app-update.json`. Failed notices are reconciled against the running version: reaching the recorded
update target clears the notice while preserving the log. Older records without a
target are cleared after a successful version check verifies recovery. Pending
updates and unresolved failures remain visible.

An installation or verification failure leaves the current app running. A restart failure keeps recovery output in that file; reopen AFK from the terminal. Verify orchestration with injected command runners and preview with a simulated release; do not install real updates as part of automated QA.
