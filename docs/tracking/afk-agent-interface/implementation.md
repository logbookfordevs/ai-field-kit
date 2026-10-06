# AFK agent interface

Approved approach: agents edit simple configuration using the documented schema;
AFK validates it and owns operations that change skill files, links, rule regions,
workspace location, and portable imports. The agent skill complements the web app.

| Task | Responsibility | State |
|---|---|---|
| 1 | Add settings schema, read-only doctor, and regression coverage | Complete |
| 2 | Expose shared web operations through a headless CLI interface | Complete |
| 3 | Restore a focused AFK 2.0 skill with on-demand workflow reference | Complete |
| 4 | Verify agent workflows, shared HTTP behavior, packaging, and documentation | Complete |
| 5 | Bundle the skill and expose its path through `afk guide` and CLI help | Complete |

Tasks 1 and 3 can run independently of the operation implementation. Task 4
depends on all three. Preserve existing local changes; leave the website, real
settings and agent files untouched. Delivery remains local and uncommitted.

The settings format remains version 1. Profiles, invocation preferences, ownership
receipts and activation use AFK operations. Agents can edit favorite bookmarks,
tool definitions and inactive project definitions while preserving managed fields.
Doctor reports validity and local drift without changing files or executing tools.

## Verification

- All 127 regression tests and the installer check pass. Repository typecheck,
  lint, and build pass; standalone and inline web scripts pass syntax checks.
- An isolated built-executable workflow passed without opening a browser:
  definition edits and validation; genuine Skills CLI discovery and selected-member
  preparation; project activation links; profile reading; isolated invocation and
  reset; saved tool execution with update fallback; previewed rule sync preserving
  surrounding text; and a clean doctor report.
- The interface review found three shared-operation issues. Required paths and
  boolean flags are now validated before effects, and settings import preserves
  the activation ownership boundary by requiring individual skills and managed
  links to be resolved. Focused regression coverage passes; the reviewer confirmed
  the fixes.
- Skills CLI lists the checkout's `afk-cli` skill without installation. Package
  file inspection includes the new runtime modules and web assets and excludes
  test modules. This was a script-free dry run after the separate build; it does
  not verify publication or the release lifecycle. A temporary npm cache avoided
  the sandbox's default-cache write restriction.

### Bundled guide follow-up

- The build generates the packaged skill and references from the canonical
  repository skill. `afk guide` returns its absolute entry path, and CLI help
  directs agents to read it before management.
- All 128 regression tests and the installer check pass. Typecheck, lint,
  the build, and lint for the packaging script pass.
- A real npm pack, including its prepack build, contains both skill files and
  excludes test modules. The extracted package returned the correct guide path
  from a different working directory with spaces in its installation path.
  Skill metadata parses and its relative workflow reference resolves. This
  required no separately installed skill and left an invalid settings fixture
  and empty fixture home untouched. The smoke reused the checkout's installed
  dependencies; it did not test a fresh dependency installation or publication.
- Documentation, the product spec, ADR, and changelog describe bundled access
  and optional skill installation. Website agent/reference documentation remains
  outside this task.

## Delivery boundaries

The skill, agent guide, settings/development docs, specification, ADR, and changelog
are updated. The website remains untouched; its agent, reference, settings, and
source guides need a separate documentation pass. The installed legacy skill and
real AFK settings, skill storage, and agent destinations are unchanged. Test
fixtures and their temporary processes are cleaned up.

Changes are local and uncommitted. This work does not bump the package version,
push the branch, publish AFK, or certify discovery in a running agent client.
