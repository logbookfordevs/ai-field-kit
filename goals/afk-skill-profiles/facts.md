# Facts

- AFK exposes profile management under the skills family as `afk skills profiles ...`.
- Profile commands support `--local` so profiles can be managed in the current directory.
- The global profile catalog is stored at `~/.agents/afk/catalog/profiles.json` and contains `version`, top-level `alwaysOn`, and profile `items` with `id`, `name`, and `skills`.
- The profile catalog does not store active runtime state such as `activeProfileId` or enabled profile IDs.
- Runtime profile state is stored separately under `~/.agents/afk/state/` and records enabled profile IDs, skills moved by profile filtering, and skills that were already disabled before filtering.
- Multiple profiles can be enabled at the same time.
- When profiles are enabled, the kept skill set is the union of all skills in enabled profiles plus every skill in top-level `alwaysOn`.
- Profile enablement temporarily disables only global shared skills that are currently active and are not in the kept skill set.
- Profile enablement can temporarily enable a previously disabled skill when that skill is in the kept skill set.
- Profile disablement restores AFK-moved skills and returns previously disabled skills to disabled once no enabled profile keeps them.
- V1 profile enablement and disablement operate only on the shared global skills library at `~/.agents/skills`.
- Profile commands include `list`, `show`, `create`, `edit`, `delete`, `enable`, `disable`, and `status`.
- Profile commands support dry-run behavior for filesystem-changing operations.
- Profile commands never delete skill folders; delete removes profile definitions only.
