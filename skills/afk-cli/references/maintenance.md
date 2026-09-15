# Maintenance and diagnosis

## Choose the update owner

| Desired result | Operation | Boundary |
| --- | --- | --- |
| New catalog definitions | `afk refresh [category]` | Does not update installed content. |
| Maintain an existing preset | `afk sync --preset <id>` | Global environment; refreshes catalogs and updates installed members. |
| Update tracked skills from installed provenance | `afk skills update <id>` | Uses skills lock metadata. |
| Update cataloged tools | `afk tools update <id>` | Runs the tool's declared update command. |
| Reapply rules, hooks, MCPs, or Custom Agents | `afk setup <area>` | Applies selected definitions to target harnesses. |
| Update AFK itself | `afk update` | Separate from preset sync. |
| Restore cached skill policy | `afk skills reset` | Reconciles storage/invocation and clears profile state; no install/update/delete. |

## Maintain a preset

```bash
afk show presets
afk sync --preset daily-routine --dry-run
afk sync --preset daily-routine --yes
```

Use the actual selected preset. Sync skips missing members unless `--install-missing` is requested. It preserves local-only entries and does not uninstall items removed upstream; inactive package skills remain deferred.

Sync installs skill updates through `skills add` using the refreshed catalog source. This allows a same-named skill to move sources. `afk skills update` instead follows installed lock provenance. Choose according to whether the user wants the catalog's current selection or an update from the installed source.

Sync aggregates independent failures and returns nonzero if any fail. Read the complete summary: some changes may already have succeeded. Correct the failed dependency and retry the affected operation rather than claiming the whole environment is unchanged.

## Diagnose by layer

| Symptom | Inspect | Recovery |
| --- | --- | --- |
| Unknown command or flag | `afk --version`, command help | Use supported syntax or update AFK within the requested scope. |
| Invalid catalog | `afk doctor` in the correct scope | Repair the reported file/entry and validate again. |
| Installed skill absent from catalog | `afk skills catalog status` | Preview/import recoverable lock-backed entries. |
| Skill missing from normal discovery | Enabled and disabled lists, invocation metadata, profile status | Change the relevant storage, invocation, or profile state. |
| Profile member unavailable | Definition, catalog IDs, package install output, local skill folders | Resolve missing references or installation before retrying activation. |
| Unexpected state after profiles | Profile status and reset dry-run | Leave the relevant profile, or reset only when restoring all catalog policy is intended. |
| Installer or integration fails | Verbose output, target paths, credentials and executable availability | Fix the actual failed dependency; validate the external tool separately. |

`doctor` validates catalog structure, not remote availability, credentials, executable health, or installed-state completeness. Use its result for the layer it checks.

Complete with the requested state verified, successful partial changes identified, and any unresolved failure tied to a concrete next action.
