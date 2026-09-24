# Separate default catalog ownership from the CLI

Status: accepted; implementation prepared locally, distribution requires publication.

AFK owns the CLI, manifest schema support, installation lifecycle, and harness adapters. Logbook Atlas owns the current default manifests, skills, rules, hooks, portable agents, legacy source history, registry, and catalog-method documentation. This extraction preserves current skill IDs and behavior; the proposed Atlas workflows are outside this change.

The built-in source is `logbookfordevs/logbook-atlas`, matching Atlas's configured remote. Existing exact AFK repository sources and main-branch catalog/asset URLs resolve to Atlas. Cached manifests migrate through normal planned writes; custom sources, user selections, and pinned historical raw URLs remain unchanged. Skill updates migrate selected legacy lock entries and preserve a `.before-atlas` backup. Dry runs leave locks untouched.

Publish the Atlas content first, then release the updated CLI and its documentation. Editing these repositories does not migrate already-installed CLI binaries. Older versions can select Atlas explicitly with `afk refresh --default-source logbookfordevs/logbook-atlas`. Users invoking the skills CLI directly should reinstall affected skills from Atlas to change their upstream metadata.

AFK no longer bundles a default catalog. Existing caches remain usable; obtaining new defaults requires access to the selected source. Tests use explicit fixtures rather than a production catalog. Atlas validates its own metadata, asset paths, and hook behavior.
