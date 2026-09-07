# Keep skill post-install actions with the skill

Skill catalog entries may declare ordered `postInstall` actions for integration
work that depends on their installed payload. AFK runs these after successful
source installation and skill updates. They belong to the skill rather than a
separately selected tool: ordering, scope, and missing-source handling stay with
the installation that supplies the files. Catalog refresh remains data-only.

Actions support harness-scoped file copies and explicit commands. Copies use
AFK's existing harness roots and recorded content hashes to refresh unchanged
managed files while preserving user modifications. Commands run from the skill
directory and must be repeatable. A failed action is reported separately from
a successful skill installation and returns a nonzero status.

Impeccable uses a copy action to place its bundled Codex TOML agents in the
harness's `agents` directory. These are upstream-native files, so AFK does not
convert them into portable agents or register them in `agents.json`. Copy
receipts support safe refresh; disabling or deleting a skill does not delete
its copied integration files.
