---
name: afk-release
disable-model-invocation: true
description: Development-only helper for preparing and publishing an AFK CLI npm release from this repository.
---

# AFK Release

Use only when explicitly asked to release, bump, or publish the AFK CLI.

1. Confirm the bump: `patch`, `minor`, or `major`. Default to `patch`.
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
cd packages/afk
npm version patch
```

Use `minor` or `major` instead when requested.

7. Push main and the new tag:

```bash
git push origin main --follow-tags
```

8. Report the pushed tag and mention that a GitHub Release can be created from that tag if desired.
