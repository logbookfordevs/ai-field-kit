# AFK 2.0 website direction

Status: approved by Leonardo; implementation authorized with restrained motion and tilted paper details. Not published.
Date: 2026-10-01.
Brilliant canvas: **AFK 2.0 — Website proposal**.

## Recommendation

Make the website explain one useful workflow immediately: keep occasional skill
groups ready, enable them where needed, and put them away afterwards. Show the
alternative of reading a group's guidance with an agent without activating it.

The proposed headline is **Bring the right skills to work.** Supporting copy:

> A local field kit for your coding agents. Prepare skill groups once. Enable them
> for a project, or read their guidance only when you need it.

Profiles lead the story because they express the problem Leonardo actually uses
AFK to solve. Installed Skills, Favorite sources, Tools and Settings support that
story. Give them a short ledger and their own guides rather than five competing
hero messages.

Keep the existing AFK identity: field paper, Deep Ocean actions, Poppins, IBM Plex
Mono commands, ruled layouts and the Logbook attribution. Replace the four-agent
setup-routing instrument with a concrete profile example. The product has changed;
its visual identity does not need to become a generic dashboard brand.

## What is ready to review

The canvas contains ten connected frames, not ten competing proposals. Native
layers remain editable in Brilliant. These are static visual designs; buttons
describe proposed website behavior and do not execute AFK operations.

| Frame | Review question | Export |
| --- | --- | --- |
| 00 — Read first | Does the recommendation and old-to-new mapping make sense? | [Decision board](../../../work/afk-website-v2/00-read-first.png) |
| 01 — Home / desktop | Does the full page explain AFK quickly and give a useful next step? | [Home](../../../work/afk-website-v2/01-home.png) |
| 02 — Docs / start here | Can a new user open AFK and create one useful group? | [Start here](../../../work/afk-website-v2/02-start.png) |
| 03 — Docs / profiles | Are shared definitions, target activation and physical storage clear? | [Profiles](../../../work/afk-website-v2/03-profiles.png) |
| 04 — Docs / settings & storage | Is portable configuration distinct from local files? | [Settings](../../../work/afk-website-v2/04-settings.png) |
| 05 — CLI / legacy reference | Are real command syntax and old-version guidance separated? | [CLI and legacy](../../../work/afk-website-v2/05-cli-legacy.png) |
| 06 — Agent reading | Is the user → agent → AFK flow understandable without implying chat injection? | [Agent flow](../../../work/afk-website-v2/06-agent-reading.png) |
| 07 — Home / mobile | Does the home story retain its order on a small screen? | [Mobile home](../../../work/afk-website-v2/07-home-mobile.png) |
| 08 — Profiles / mobile docs | Are chapter navigation, instructions and commands readable? | [Mobile docs](../../../work/afk-website-v2/08-docs-mobile.png) |
| 09 — Navigation, states & rollout | Are all chapter responsibilities, edge states and release steps covered? | [Navigation and states](../../../work/afk-website-v2/09-navigation-states.png) |

All ten chapters have a content contract below. Five representative desktop docs
pages are drawn; the remaining chapters use the same reading template. Their
complete article copy will be written during implementation after approval.

## Home page sequence

| Section | Purpose and proposed content | Next action |
| --- | --- | --- |
| Header | AFK identity, visible 2.0 label, How it works, Documentation, GitHub. | Get AFK 2.0 → Start here |
| Hero | Headline, one short promise, illustrative profile showing its target beside Enable and a separate Use with your agent action. | Get AFK 2.0; See how profiles work |
| Two ways to use a group | Enable exposes prepared skills for ongoing work; reading prints guidance when requested without changing activation. A small storage diagram and real command explain the difference. | Profiles guide; Agent-reading guide |
| Five-section ledger | Profiles, Installed Skills, Favorite sources, Tools, Settings. One sentence per responsibility. | Relevant guide |
| Portable setup | One settings file can live in a provider-synced folder; real skill copies and project paths remain local. | Settings & storage |
| Ownership ledger | AFK manages grouping/local availability; Skills CLI owns preparation and its tracked installs/updates; the agent reads and applies guidance. | Detailed boundaries |
| Get started | Current source-build path; later, a verified published command. | First-run guide |
| Coming from AFK 1.x | Install a pre-2.0 release or fork its tagged source to retain old behavior. | Clearly labeled pre-2.0 releases |
| Footer | Logbook attribution, Docs, GitHub, Releases, Pre-2.0. | Durable destinations |

The hero example is illustrative. In implementation, use a deliberately chosen
real profile example or a real app capture. Reuse the existing AfkMark; the draft's
text wordmark is a placeholder, not a proposed new logo. Do not make the website's
sample target selector look like it manages a visitor's actual projects. If the
sample becomes interactive, label it as a demonstration and keep state local to
that illustration.

Avoid broad claims about token savings, agent compatibility or automatic context
management. Explain concrete availability and reading behavior instead. Current
filesystem and invocation metadata behavior is tested; live discovery inside all
agent conversations is not a verified universal guarantee.

## Documentation structure

Keep the existing `/docs?chapter=<id>` convention. The nav label can remain
Documentation; **Field manual** describes the docs surface within its header and
rail. Do not require users to learn another product name.

| ID | Chapter | Content contract |
| --- | --- | --- |
| start | Start here | Requirements, release status, launch, one profile, project folder, enable versus reading, Exit AFK/Ctrl+C. |
| skills | Skills & invocation | Scope-specific inventory, preview real files, individual toggles, Manual/Auto/Original, project overrides, copy update-all command and tracking limits. |
| profiles | Profiles | Create from a repository or existing Global skills; select members; prepare missing copies disabled; activation target; overlap ownership; disable before edit/remove. |
| agent | Use with your agent | Start with a task, choose an approach, copy the real profile-ID command, agent reads returned instructions and resources, no activation/chat injection. |
| sources | Favorite sources | Shared bookmarks; add/edit/remove; copy link, per-source install command or sequential all-source script; destination selection affects copied commands only. |
| tools | Tools | Always Global; name/install/update; update fallback; commands run explicitly from home; output and exit status; entry removal does not uninstall. |
| settings | Settings & projects | Settings location and precedence, folder selection, project definitions, import review/remapping, export, selected state versus local files, provider-managed sync. |
| reference | CLI reference | Every supported command, actual IDs, default Global scope, configured project names, examples and related guides. |
| troubleshooting | Troubleshooting | Missing members, link conflicts, same-name source collisions, inactive-profile requirements, moved folders, copy fallback, server startup/exit and compatibility limits. |
| legacy | AFK 1.x releases | Historical behavior, pre-2.0 install/fork instructions, release/tag links, no automatic purge or migration of old user files. |

### Article template

Each article starts with the outcome, then gives short actionable steps, real
commands when needed, what changed, and the relevant next task. Explain technical
details beside the action that needs them. Keep pages in an unframed reading
column, with restrained callouts for material conditions.

Desktop has a chapter rail, bounded reading column and on-page heading links.
Drop the heading rail first as space narrows; mobile replaces the chapter rail
with a labeled native select. Keep code wrapping and ordinary links. Do not add a
command palette or full-text search service just to navigate ten chapters.

Chapter filtering matches titles only. Current chapter state uses text/shape as
well as color. Heading links, previous/next links and query URLs remain shareable.
Previous/next follows chapter order; in-article links can suggest a more specific
next task.

### Commands and copying

Command blocks distinguish **Copy** from execution. Provide in-place success
feedback and a visible, selectable command when clipboard access fails. Do not
show an installation or update success state after copying text.

Recommend **Copy page** for article Markdown that an agent can read, with a
separate **Copy page link** action. Copy only the article, excluding navigation
and site chrome. These actions do not start an agent session or inject a chat.
The canvas shows the intended controls; implementing Markdown output and copy
fallback remains part of the website work.

## Behavior that the content must preserve

- Profile definitions are shared. Activation is independently selected for Global
  or a configured project; selecting a target does not activate it.
- The current profile definition has one source reference. Do not illustrate
  unsupported multi-repository creation as an existing feature.
- Repository preparation delegates to Skills CLI in isolation. Selected missing
  copies remain under `~/.agents/skills/.disabled/`. Existing available skills stay
  available when a group is created.
- Project activation creates owned links into discovery paths, rather than
  downloading a second copy. Disable preserves other owners and user files.
- Project inventory excludes global-only entries. It is not an isolation boundary;
  an agent may still discover Global skills in that project.
- A project invocation override can make an isolated local copy. Reset reconnects
  shared inheritance where AFK owns those links.
- Use with your agent shows instructions and a command. `afk profiles use <id>`
  reads prepared local members. It has no remote fallback, built-in slash command
  or connection to another conversation. Content already read remains in context.
- Favorite-source install scripts and skill update commands are copy-only.
  Skills CLI updates its tracked installs; AFK is not an upstream update registry.
- Tools are always Global. Their Install/Update buttons do execute saved commands;
  deleting a managed entry does not remove the installed tool.
- Import remaps local paths, clears activation/ownership receipts and readiness,
  and does not execute tools or write native invocation metadata automatically.
- The settings file can be synced by the user's provider. AFK does not reconcile
  concurrent machines or automatically apply another machine's activation state.

## Retire old content deliberately

The current site teaches a setup router. The proposed site teaches the local app.

| Current material | Proposed treatment |
| --- | --- |
| Four-agent routing hero and generic agent band | Replace with the profile workflow and precisely supported control boundaries. |
| Kit layers, catalog and workflow composition | Remove from the 2.0 story; explain the five app sections briefly. |
| Setup previews, dry runs, catalog validation and sync | Remove obsolete commands from primary instructions. |
| Concepts/customize chapters | Move still-useful scope/storage explanations into Skills, Profiles and Settings. |
| Setup/catalog command reference | Replace with the focused CLI. |
| Old-install audience | Preserve a clearly labeled route to pre-2.0 releases and tagged source. |

Keep compatible IDs (`start`, `skills`, `profiles`, `reference`,
`troubleshooting`) with rewritten 2.0 content. Retired IDs (`setup`, `concepts`,
`kit`, `workflows`, `customize`, `catalog`) should show an explicit historical
notice and separate choices for AFK 2.0 guidance and pre-2.0 releases. Do not
silently redirect catalog instructions into an unrelated profile guide.

## Visual and interaction contract

- Preserve the palette in root `DESIGN.md`: paper `#F3EDDF`, surface `#FFFAF0`,
  ink `#17201E`, Deep Ocean `#102C2C`, Rule `#B9C0B7`, Verdigris `#3F8580`.
- Keep Ocean for actions/code, Poppins for UI/prose, Plex Mono for commands, and
  restrained Literata for narrative accents. The proposal introduces no new font.
- Retain light paper surfaces, visible rules, generous section rhythm and compact
  corners. Use one purposeful app illustration, not a wall of feature cards.
- Keep the docs quieter than the home page. No animated route map or scroll reveal
  is needed to read an article.
- Use semantic landmarks, a skip link, visible focus, real buttons/links and clear
  accessible names. Mark the current chapter with `aria-current`.
- The home mobile menu has an explicit dismiss action, Escape handling and sensible
  focus behavior. Prefer mature existing/native patterns during implementation.
- Copy feedback is polite and local to its control. Empty filter results include
  Clear filter. Commands wrap without adding fake newlines to copied text.
- Essential content is visible immediately. Reduced motion leaves the entire page
  readable and removes nonessential transitions.

## Release and implementation sequence

AFK 2.0 is implemented on `feat/afk-fieldwork-pivot`, but is not published as a 2.0
package. The proposed first-run page therefore clones the repository, selects that
branch, installs dependencies, builds, and launches the actual local app.

The Get AFK 2.0 CTA leads to this guide. A public website cannot start the visitor's
local server; do not offer Open app without a real supported integration. After a
verified release, replace the primary source-build path with the published command
and retain source builds in developer guidance.

After approval:

1. Rewrite home and docs together, reusing existing site components and tokens.
2. Write the remaining articles to their content contracts; replace illustrative
   profile content with an intentional real example or app capture.
3. Implement copy-page, command feedback, responsive navigation and old-link notices.
4. Update metadata, social descriptions and install wording for the actual release
   state. Update design documentation to reflect the shipped site.
5. Run site typecheck/build/tests and browser-check first-run navigation, commands,
   old URLs, copy failure, keyboard focus, reduced motion and mobile reading.
6. Review the rendered implementation before publishing. A design approval does
   not mean a release or deployment has happened.

## Approval points

1. Is the profile-first promise the right public explanation of the new AFK?
2. Does the home page sequence make the value clear before describing supporting
   sections and implementation details?
3. Is the field-manual structure the right way to teach the app, with legacy
   instructions visibly separated?
4. Does the retained brand feel appropriately calm, practical and personal?

Leonardo approved this direction and requested implementation with additional
charm. See [the implementation record](implementation.md) for the built result
and validation.

## Evidence and source records

The live home and docs were inspected alongside `apps/site` source and root
`DESIGN.md`. Product copy was grounded in `PRODUCT.md`, `docs/specs/afk-pivot.md`,
`docs/settings.md` and the current package guide, rather than the old prototype.

All ten rendered Brilliant exports were visually inspected. Corrections covered
code-panel contrast, command newlines, flow-diagram orientation, visible scope/path
labels, wordmark contrast and page ordering. This is visual proposal review, not
functional website QA. No production site files were edited or deployed.

Source HTML, PNG exports and provenance: [work/afk-website-v2](../../../work/afk-website-v2/manifest.json).
HTML records are draft inputs for Brilliant, not production components or a
functional preview; they do not bundle fonts or wire their controls.
