# AFK CLI

Local setup router for AI Field Kit.

```bash
pnpm --dir packages/afk install
pnpm --dir packages/afk run build
node packages/afk/dist/index.js setup --dry-run
```

From the repo root, install this checkout as a local `afk` command:

```bash
./install.sh
afk setup --dry-run
```

`afk setup` opens with a branded banner and checkbox prompts. Setup areas,
setup scope, AFK-owned rule/workflow targets, individual AFK skills,
recommended external skills, MCP recommendations, and utility installs start
selected so you can remove only the pieces you do not want.

By default, `afk setup` prepares a global field kit for this machine. Choose
project scope when you want AFK config to live in the current repo instead:

```bash
node packages/afk/dist/index.js setup --scope project --dry-run
node packages/afk/dist/index.js setup --local --dry-run
```

In project scope, AFK omits the upstream `--global` flags for `skills` and
`add-mcp`, writes AFK-owned rule/workflow files under the current directory,
and runs RTK project initialization from that directory. Plannotator remains a
global utility install because its installer does not expose a project scope.

Workflow sync writes managed files instead of symlinking back to a repo
checkout. Markdown command consumers receive copied markdown files, Gemini gets
rendered TOML, and Codex gets generated skills. Workflow sources come from
`workflows.json`, where each item points directly at the raw markdown file to
install.

The CLI stores editable local setup manifests under:

```text
~/.agents/afk/manifests/
```

First run seeds those files from AFK defaults. After that, commands read the
local manifests, so you can add, remove, or replace skills, MCPs, and utilities
without patching the CLI.

Useful manifest setup modes:

```bash
node packages/afk/dist/index.js setup --init-only
node packages/afk/dist/index.js setup --init-only --empty
node packages/afk/dist/index.js setup --refresh-defaults
node packages/afk/dist/index.js setup --refresh-defaults --defaults-source your-org/dev-kit
node packages/afk/dist/index.js setup --defaults-source your-org/dev-kit
```

`--defaults-source` lets another GitHub repo become the manifest source as long
as it follows the AFK convention:

```text
afk/manifests/
  skills.json
  mcps.json
  presets.json
  rules.json
  workflows.json
  utils.json
```

For monorepos, AFK also falls back to `packages/afk/manifests/`. You can pass
`owner/repo`, a GitHub repo URL, a GitHub `tree` URL for a custom manifest
folder, or a raw GitHub manifest directory URL.

When you pass `--defaults-source`, AFK writes that source into `presets.json`.
Later, `--refresh-defaults` reuses the remembered source, so you do not need to
repeat the flag.

For rules, keep the source repo explicit in `rules.json`:

```json
{
  "version": 1,
  "source": "github",
  "url": "https://raw.githubusercontent.com/your-org/dev-kit/main/rules/AGENTS.md"
}
```

That lets a personal defaults repo refresh the manifest and keep future
`rules sync` runs pointed at the same repo.

Workflow defaults use the same direct-URL idea, but with multiple items:

```json
{
  "version": 1,
  "source": "github",
  "items": [
    {
      "id": "my-workflow",
      "label": "My Workflow",
      "url": "https://raw.githubusercontent.com/your-org/dev-kit/main/workflows/my-workflow.md",
      "default": true
    }
  ]
}
```

Selected skills are grouped into non-interactive `skills` CLI calls with
`--yes`. Global scope adds `--global`; project scope leaves that flag out so
the official CLI installs into project skill locations. AFK keeps the default
symlink behavior, and adds a separate Claude Code target only when Claude is
selected.

Utilities are curated developer tools AFK can install by delegating to their
official install scripts. V1 includes Plannotator for plan review loops and RTK
for token-light command output. When RTK is selected, AFK follows up with
agent-specific `rtk init` commands for the selected AFK targets. In global
scope, Codex is initialized from `~/.codex` so RTK lands in the global Codex
rules location instead of the current project. In project scope, RTK init runs
from the current project without global flags. Utility installs are best-effort:
if one third-party script fails, AFK reports the failure and continues with the
rest.

During `afk setup`, each selected area runs independently. If Skills fails, AFK
still tries MCPs and Utils, then exits non-zero with a summary of failed areas.

V1 owns AFK rules and workflow sync behavior for Codex, Claude Code, Gemini,
and OpenCode. More AFK-owned targets can be added over time. Skills and MCP
installation are delegated to the official CLIs, so their broader compatibility
belongs to those tools.

Rules sync fetches the latest AFK rule markdown from GitHub by default, then
injects it into a managed region inside the user-owned host file:

```text
~/.agents/AGENTS.md
```

The CLI preserves content outside the `AFK:RULES` region and updates that
region in place on later runs. Agent-specific rule files still symlink to the
shared host file, matching the older sync script behavior.

In project scope, rules are injected directly into project host files instead
of global agent files: `AGENTS.md` for Codex/OpenCode, `GEMINI.md` for Gemini,
and `CLAUDE.md` for Claude Code.

Use a local checkout while developing rule changes:

```bash
node packages/afk/dist/index.js rules sync --dry-run --source local
```

Update `rules.json` when you want a stable public setup:

```bash
node packages/afk/dist/index.js rules sync --dry-run
```

Install only utilities:

```bash
node packages/afk/dist/index.js utils install --dry-run
```
