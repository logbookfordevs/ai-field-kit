# Profiles: define, read, activate

## Define a working set

Inspect the available skill IDs, existing definition, and runtime state first.

```bash
afk profiles catalog list --json
afk profiles catalog create review --name Review --skill afk-code-review --skill afk-static-review --dry-run
afk profiles catalog create review --name Review --skill afk-code-review --skill afk-static-review
afk profiles catalog show review --json
```

On `edit`, explicit `--skill` flags **replace membership**. To add one member, read the current list and supply the full intended set. Omitting the flags preserves membership.

`--mode` and `--always-on` change shared profile catalog policy, not just the named profile. `--profile-only` also changes selected skills' start-disabled policy and moves active shared folders. Preview these effects.

For remote packages, inspect version 2 `profiles.json`: `catalogSkills` references known catalog IDs; `packages` names install sources, optionally with selected `skills`. Omitting a package's skill list selects the whole package. Follow [Catalogs](catalogs.md) for direct schema edits.

## Choose context loading or activation

| Intent | Operation | Effect |
| --- | --- | --- |
| Read a profile for this request | `afk skills profiles use review` | Prints available descriptions and commands to read relevant skills. |
| Read every member in full | `afk skills profiles use review --all` | Prints complete locally available instructions. |
| Make its skills available | `afk skills profiles enable review` | Activates additively. |
| Limit the active working set | `afk skills profiles enable review --focus` | Activates with filtering. |
| Leave the profile | `afk skills profiles disable review` | Reconciles remaining activations and restoration history. |

`use` does not install, move folders, or activate. Follow the returned `afk skills get` commands for relevant requested instructions; report missing content instead of treating it as loaded.

For activation, preview with `--dry-run`, apply, then read `afk skills profiles status`. Package skills may install during enablement; an installation failure leaves that activation disabled. Inspect missing members and command output before claiming the working set is ready.

## Focus and restoration

Default enablement is additive. Focus keeps the union of enabled profiles plus `alwaysOn`. Catalog mode governs skills outside that set:

- `strict`: move unrelated active skills into disabled storage.
- `context`: retain cataloged manual skills; hide unrelated auto-discoverable or uncataloged skills.

Disable an active profile before switching it between additive and focus behavior. Disable restores eligible prior storage while preserving members needed by other active profiles. It does not uninstall content.

`--local` selects project-local profile definitions and runtime state, **but reconciliation still moves the shared global skill library**. It is not an isolated project sandbox.

Delete a definition with `afk profiles catalog delete <id>` only when definition removal is intended; use skill deletion for actual folders. `afk skills reset` clears all profile runtime state and reapplies catalog policy, so it is broader than leaving one profile.
