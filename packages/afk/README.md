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
setup scope, AFK-owned rule targets, individual AFK skills, recommended external
skills, MCP recommendations, and utility installs start
selected so you can remove only the pieces you do not want.

By default, `afk setup` prepares a global field kit for this machine. Choose
project scope when you want AFK config to live in the current repo instead:

```bash
node packages/afk/dist/index.js setup --scope project --dry-run
node packages/afk/dist/index.js setup --local --dry-run
```

In project scope, AFK omits the upstream `--global` flags for `skills` and
`add-mcp`, writes AFK-owned rule files under the current directory, and runs RTK
project initialization from that directory. Plannotator remains a global utility
install because its installer does not expose a project scope.

Workflow-style AFK procedures are shipped as skills. Their manifest entries set
`autoInvocation: false`, so AFK keeps them installed and available without
encouraging agents to call them implicitly.

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

Author your own manifests interactively:

```bash
afk manifests configure
afk manifests configure --local
afk manifests configure --from-current
```

`afk manifests configure` writes to `~/.agents/afk/manifests/`.
`afk manifests configure --local` writes to `./afk/manifests/`, matching the
GitHub defaults convention used by `--defaults-source`.

`--defaults-source` lets another GitHub repo become the manifest source as long
as it follows the AFK convention:

```text
afk/manifests/
  skills.json
  mcps.json
  presets.json
  rules.json
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
`setup rules sync` runs pointed at the same repo.

Skills can opt out of automatic invocation:

```json
{
  "version": 1,
  "defaultSource": "https://github.com/your-org/dev-kit",
  "items": [
    {
      "id": "review-pr",
      "label": "Review PR",
      "source": "https://github.com/your-org/dev-kit",
      "args": ["--skill", "review-pr"],
      "default": true,
      "autoInvocation": false
    }
  ]
}
```

Selected skills are grouped into non-interactive `skills` CLI calls with
`--yes`. Global scope adds `--global`; project scope leaves that flag out so
the official CLI installs into project skill locations. AFK keeps the default
symlink behavior. When `autoInvocation` is false, AFK adds Claude Code
`disable-model-invocation: true` frontmatter and OpenAI
`allow_implicit_invocation: false` policy metadata after the official install.

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

V1 owns AFK rules sync behavior for Codex, Claude Code, Gemini, and OpenCode.
More AFK-owned targets can be added over time. Skills and MCP
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
node packages/afk/dist/index.js setup rules sync --dry-run --source local
```

Update `rules.json` when you want a stable public setup:

```bash
node packages/afk/dist/index.js setup rules sync --dry-run
```

Install only utilities:

```bash
node packages/afk/dist/index.js setup utils install --dry-run
```
