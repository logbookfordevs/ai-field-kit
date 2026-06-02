# Facts

- Every interactive setup entry point, including `afk setup` and area subcommands such as `afk setup skills`, `afk setup mcps`, `afk setup utils`, `afk setup rules`, and `afk setup hooks`, asks which defaults source/origin to use before loading manifests when no one-run source flag is provided.
- When no saved default source exists, interactive setup requires the user to choose or enter a source before continuing.
- When a saved default source exists, interactive setup still shows the source question with that default preselected so pressing Enter continues with the saved source.
- Selecting a different source during interactive setup affects only that setup run and does not change the saved default source.
- `afk setup --default-source <source>` updates the saved default source, prints a success message, and exits without running setup installation work.
- `--defaults-source <source>` remains supported as a backwards-compatible alias, while help and examples prefer `--default-source <source>`.
- `--source` remains a one-run source override and does not change the saved default source.
- `--yes` skips interactive prompts and fails with an actionable error when neither a one-run source nor a saved default source is available; the error tells users to run interactive `afk setup` or `afk setup --default-source <source>`.
- Setup source resolution avoids silently relying on built-in AFK manifests as the default path for normal setup; the intended default setup origin is a remote or user-provided source.
