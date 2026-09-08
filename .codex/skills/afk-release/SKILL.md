---
name: afk-release
disable-model-invocation: true
description: Development-only helper for preparing and publishing an AFK CLI npm release from this repository.
---

# AFK Release

Use only when explicitly asked to prepare, bump, release, or publish the AFK CLI.

A request to bump a version or prepare a release authorizes local preparation and validation only. A request to publish authorizes pushing the reviewed release commit and tag when the target and version are clear. Pushing a `v*` tag triggers npm publication and GitHub Release creation.

1. Use the requested bump (`patch`, `minor`, or `major`); otherwise state the default, `patch`.
2. Read `packages/afk/package.json` and compute the next semver version.
3. Edit only `CHANGELOG.md`:
   - keep a fresh empty `## TBD - TBD` heading at the top.
   - move current TBD bullets under `## vX.Y.Z - YYYY-MM-DD`.
   - if TBD is empty, ask before releasing.
4. Run:

```bash
pnpm afk:typecheck
pnpm afk:test
pnpm --dir packages/afk pack --dry-run
```

5. Commit the changelog only:

```bash
git add CHANGELOG.md
git commit -m "Prepare AFK vX.Y.Z release notes"
```

6. Let npm own the version commit and tag:

```bash
pnpm afk:version patch
```

Use `minor` or `major` instead when requested.

7. Before pushing, verify the intended branch, remote, version, release diff, and validation results. If publication is not already authorized, present that prepared result and request approval. Once authorized, push main and the new tag:

```bash
tag="v$(node -p "require('./packages/afk/package.json').version")"
git push origin main "$tag"
```

8. After pushing, inspect the Publish workflow for that tag. Report publication as complete only after the workflow succeeds; otherwise report its pending or failed state. The workflow publishes to npm and creates the GitHub Release.
