# Impeccable installation comparison

Checked: 2026-08-27

Scope: official Impeccable documentation and source, plus the official Vercel
`skills` installer. This note compares the core Agent Skill with
`npx impeccable install`; it does not inspect third-party mirrors or AFK's
installer implementation.

## Finding

Impeccable should be available as an AFK catalog skill. The standard skill
route is materially complete for the core Impeccable behavior, including its
references, scripts, and Codex-nested subagents. However, it is not equivalent
to `npx impeccable install` for provider integration.

Recommended model:

- Catalog `impeccable` as a skill for normal composition and Agent Skills
  installation.
- Treat `npx impeccable install` as an optional full-integration companion (or
  tool entry), not as a prerequisite for using the skill.
- Keep the full CLI path available when the user wants provider-specific
  compilation, native agent files, project hooks, detector CLI usage, or
  Impeccable-aware update/migration behavior.

## What the skill package already contains

Impeccable is intentionally distributed as one `impeccable` skill exposing its
commands through `/impeccable <command> <target>`, rather than as 23 separately
installed skills. The official getting-started guide documents both the
Impeccable installer and `npx skills add pbakaus/impeccable`; it describes the
latter as a shared build rather than a build compiled for the current harness.
See the [official getting-started guide](https://impeccable.style/tutorials/getting-started/)
and [README](https://github.com/pbakaus/impeccable#readme).

The repository's generated Agent Skills output includes, inside the skill
directory:

- `SKILL.md`, references, and runtime scripts;
- four Codex-format subagents under `agents/*.toml` plus `agents/openai.yaml`;
- degraded fallback reference files generated from those subagents.

This is visible in the [source skill layout](https://github.com/pbakaus/impeccable/tree/main/skill),
the [generated Agents/Codex skill](https://github.com/pbakaus/impeccable/tree/main/.agents/skills/impeccable),
and the [transformer factory](https://github.com/pbakaus/impeccable/blob/main/scripts/lib/transformers/factory.js#L328-L388).
The official Vercel installer recursively copies the contents of a selected
skill directory, so a normal `npx skills add` does not drop these nested files;
see its [directory-copy implementation](https://github.com/vercel-labs/skills/blob/main/src/installer.ts#L2972-L3065).

For a Codex/Agents-style installation, this means the skill route retains the
subagents that are part of the skill payload. The old assumption that the
Impeccable CLI is required merely to obtain those Codex subagents is therefore
too strong.

## What `npx impeccable install` adds or owns

The npm package exposes the `impeccable` executable; the CLI downloads the
current universal bundle, selects provider output, and installs it at project
or user scope. It is a distribution/integration installer, not the chat
command that runs `/impeccable init`. See the [npm package manifest](https://raw.githubusercontent.com/pbakaus/impeccable/main/package.json),
[CLI router](https://github.com/pbakaus/impeccable/blob/main/cli/bin/cli.js#L0-L78),
and [skills command source](https://github.com/pbakaus/impeccable/blob/main/cli/bin/commands/skills.mjs#L579-L631).

| Surface | `npx impeccable install` | Standard `npx skills add` / catalog skill route |
| --- | --- | --- |
| Core skill | Installs the provider-compiled skill selected for the detected or requested host. | Installs the shared/generated Agent Skills build and recursively preserves its nested content. |
| Host-specific output | Chooses provider directories such as `.claude`, `.cursor`, `.gemini`, `.agents`, and `.github`; the build system adapts metadata, scripts, and frontmatter for the host. | Installs the skill directory; it does not select and materialize Impeccable's provider-native build variants. |
| Codex subagents | Installs the `.agents/skills/impeccable/agents/*.toml` payload (Codex uses nested subagents inside the skill). | Preserves the same nested subagents when the selected source is the skill directory. |
| Native agent files | Also copies provider-native files where supported, notably Claude `.md`, Cursor `.md`, and Copilot `.agent.md` files in their top-level `agents` directories. | Does not create those sibling provider `agents` directories; it only installs the selected skill directory. |
| Hooks | Can install and later merge/prune project hook manifests for Claude, Cursor, Codex, Copilot, and Grok. | Does not install those top-level provider hook manifests. |
| Scope and detection | Detects supported harnesses, offers project/global scope, supports explicit providers, and handles linked installs. | Provides generic project/global, copy/symlink, update, and remove behavior, but not Impeccable's provider integration policy. |
| Lifecycle | `check`, `update`, migration of old prefixes, hash comparison, deprecated-file cleanup, hook/config preservation, and `link` are Impeccable-aware. | Generic skill lifecycle; it does not know how to migrate Impeccable hooks/config or clean its deprecated artifacts. |
| Standalone detector CLI | The npm CLI also owns `detect`/related deterministic detector operations. | Installing a skill does not install the `impeccable` npm executable as a standalone command. |

The provider-specific distinction is deliberate in the official source: the
Impeccable CLI explicitly does not shell out to `npx skills add`, because a
name-based installer can select an uncompiled/shared source and because one
shared symlink is not the correct build for every harness. See the [installer
source's rationale](https://github.com/pbakaus/impeccable/blob/main/cli/bin/commands/skills.mjs#L1852-L1856).
The provider map and build pipeline show the separate output formats and the
hosts that receive native agents or hooks in [providers.js](https://github.com/pbakaus/impeccable/blob/main/scripts/lib/transformers/providers.js)
and [hooks.js](https://github.com/pbakaus/impeccable/blob/main/scripts/lib/transformers/hooks.js).

The CLI also deliberately avoids overwriting the user-authored `PRODUCT.md`
and `DESIGN.md`; its update path is responsible for refreshing generated
artifacts while preserving those documents. The [official FAQ](https://impeccable.style/faq/)
documents this behavior, as well as hook configuration, cleanup, and the
fact that `npx skills add` remains a supported shared-build alternative.

## Practical recommendation for AFK

There are two different questions:

1. **Can an agent use Impeccable?** Yes: catalog the skill. The skill payload
   is the important composition primitive, and the standard route preserves
   its nested references, scripts, and Codex subagents.
2. **Should Impeccable integrate deeply with a host?** Use the official CLI
   when native agents, hooks, exact provider compilation, detector commands,
   or Impeccable-specific update/migration are wanted.

Therefore, adding Impeccable to the AFK catalog does not make the CLI
redundant; it makes the core skill composable. AFK should not imply that its
normal skill installer creates the full Impeccable integration. If AFK later
supports companion tools, expose `npx impeccable install` as an explicit
optional full-integration path rather than silently running it as part of
ordinary catalog setup.

