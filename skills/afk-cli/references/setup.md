# Setup an environment

## Choose the bundle and destination

Inspect `afk show presets` for named bundles or `afk show <area>` for one surface. Presets are setup selections across areas; profiles are skill working sets. A preset may select all items, so read its actual definition before applying it.

```bash
# Apply a known bundle to one harness.
afk setup preset afk-architect --agent codex --dry-run
afk setup preset afk-architect --agent codex --yes

# Apply rules to the current project.
afk setup rules --scope project --agent codex --dry-run
afk setup rules --scope project --agent codex --yes
```

On setup, `--local` means project installation scope. On catalog commands it means `./afk/catalog`. To consume a specific catalog, select it with `--source`; choosing project scope alone does not identify the intended source.

A one-off setup source leaves the remembered default unchanged. Inspect it first with `afk show --source <source>`. Use `--refresh` only when refreshing before setup is part of the request.

## Choose the surface

| Area | Setup does | Verify afterward |
| --- | --- | --- |
| `rules` | Applies ordered layers and dependency files to managed locations. | Read the affected managed rule region and referenced files. Preserve surrounding user-authored content. |
| `skills` | Delegates installation and reconciles AFK policy. | Inspect installed skills and invocation/storage state. |
| `profiles` | Prepares the cached profile catalog only. | Inspect profile definitions; skill storage and activation are unchanged. |
| `agents` | Provisions portable Custom Agents for selected harnesses. | Read the generated agent definitions in the reported destinations. |
| `mcps` | Delegates MCP configuration. | Inspect the target harness configuration; check connectivity separately when requested. |
| `tools` | Runs cataloged tool installers. | Check the installed executable/version or tool-specific health command. |
| `hooks` | Merges lifecycle hooks into supported harness configuration. | Inspect the configured event, command, and script destination. |

`afk setup skills --profile [id]` explicitly installs profile members; omit the ID for a picker. Add `--local` for project scope. New package skills start disabled; catalog startup policy and existing disabled state are preserved. With `--yes`, supply an ID.

Custom Agents require selection: `--yes` alone does not choose them.

```bash
afk setup agents --custom-agent afk-builder --agent codex --dry-run
afk setup agents --custom-agent afk-builder --agent codex --yes
```

For areas whose help exposes no per-item selection flags, inspect their default selection or use the picker. `--all` deliberately broadens installation; use it when the requested scope includes every item.

Complete when the selected surfaces exist at the intended destinations and any deferred installs or manual integration steps have been reported.
