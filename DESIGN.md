# DESIGN.md — Landing Page Planning

> Planning document for the AI Field Kit landing page.
> This is a content and design brief — not a build spec yet.

---

## What Is This Product?

**AI Field Kit** is a curated, version-controlled collection of rules, skills, workflows, and MCP configs that makes AI coding agents (Gemini, Claude, Codex, Cursor, etc.) actually useful in a real dev environment.

The core promise: one repo, one sync command, and every agent on your machine shares the same instructions, commands, and server configs.

It's part personal toolkit, part open-source standard for serious AI-assisted dev workflows — and it lives under the Logbook for Devs brand.

---

## Target Audience

### Primary: The Multi-Agent Developer

- Uses 2+ AI coding agents daily (Claude, Gemini CLI, Cursor, Codex, etc.)
- Frustrated by context fragmentation — same prompt behavior can't be easily replicated across tools
- Values DX and cares about how their tools are configured, not just what they output
- Likely works solo or on a small team; self-sufficient, opinionated about workflow

### Secondary: The AI-Curious Builder

- Experimenting with AI agents but doesn't yet have a systematic approach
- Looking for a reference point: "how do serious devs set this stuff up?"
- Will benefit from the skill and workflow library even without using the sync scripts

### Tertiary: Open-source contributors and skill authors

- Developers who want to share reusable skills or workflows for their team/community
- Already know the skills.sh CLI ecosystem

---

## Value Proposition

### Core headline idea

> *One config. Every agent. Real workflows.*

The kit eliminates the tax of maintaining separate AI configurations per tool. You write once — rules, skills, workflows, MCPs — and a sync command distributes everything.

### Supporting value props

1. **Stop repeating yourself across agents.** Your best prompts and behaviors shouldn't live in one tool's settings. AI Field Kit makes them portable.

2. **Skills that teach agents *how* to think.** Not just one-shot prompts — modular instructions that shape agent behavior across many requests (debugging, DX review, motion design, business analysis, and more).

3. **Workflows for the things you always do the same way.** Code review, PR descriptions, TypeScript checks, landing page builds — slash commands that run a repeatable playbook.

4. **MCP configs without the key juggling.** One registry, placeholder keys, one sync script. Your real credentials never touch the repo.

5. **Grows with real-world use.** Every skill and workflow came from actual daily development work, not speculation.

---

## Tone & Voice

- **Confident and direct.** Developers don't need to be sold to — they need to see that it works.
- **DX-first.** The copy should model the same principles the kit teaches: clarity, low friction, no fluff.
- **A little editorial personality.** "No fluff — just the config that ships every day." This isn't a corporate product page.
- **Not AI hype.** Avoid the buzzword salad. This is tooling — treat it like tooling.
- **Logbook for Devs voice.** Nautical metaphor as a light brand thread ("field kit", "charting seas", "one commit at a time") without overdoing it.

---

## Suggested Page Sections

### 1. Hero

**Goal:** Immediately communicate what it is and who it's for.

- Headline: something in the vein of *"Your AI agents. One config. Actually useful."*
- Subheadline: 1–2 sentences expanding the promise — cross-agent sync, real skills, repeatable workflows
- Primary CTA: **"Get the Kit"** → GitHub repo or `npx skills add` install command
- Secondary CTA: **"See the skills"** → jumps to skills section
- Visual: terminal animation showing a sync command running and distributing config across multiple agent icons, OR a before/after split showing fragmented configs vs. the unified kit

---

### 2. The Problem (Empathy Hook)

**Goal:** Make the pain legible before presenting the solution.

Short, punchy framing — 2–3 sentences or a minimal visual:

> You're using Claude for reviews, Gemini for exploration, Cursor for edits.
> Your best prompting strategies live in one of them.
> The others have no idea.

No need for a long section — just enough to make the developer nod.

---

### 3. What's in the Kit

**Goal:** Show the full value surface without overwhelming.

A clean 4-card or 4-column grid:

| Piece | Description |
|---|---|
| **Skills** | Reusable expertise modules that shape how agents think — debugging, DX, motion, business analysis, and more |
| **Workflows** | Slash-command playbooks for repeatable tasks — code review, PR descriptions, landing pages, TypeScript checks |
| **MCP Registry** | One source of truth for MCP server configs. Sync script resolves API keys and writes to every agent |
| **Sync Scripts** | Three commands to distribute everything — rules, workflows, and MCPs — across every agent on your machine |

Consider a subtle animation: each card reveals on scroll-entry with a stagger.

---

### 4. Skills Gallery

**Goal:** Make the skill library browsable and desirable.

A filterable or scrollable list of skills with their one-line descriptions. Each card could expand or link to the skill file on GitHub.

Possible filter categories: `spec-shaping`, `code quality`, `frontend`, `support`, `discovery`

Highlight the **spec-driven flow** as a named concept: brainstorm → analyze → interview → context → elicitation. Show how the skills connect as a chain, not just a list.

---

### 5. Quick Start

**Goal:** Eliminate the "how do I even start?" friction.

Two paths, clearly separated:

**Just the skills — 30 seconds:**
```bash
npx skills add https://github.com/logbookfordevs/ai-field-kit
```
Interactive picker, no clone needed.

**Full setup — rules, workflows, and MCPs:**
Three sequential commands with a brief explanation for each.

Make the code blocks copyable. Consider a tab switcher: "Skills only" / "Full kit".

---

### 6. Agents Supported

**Goal:** Build instant trust for developers using specific tools.

A compatibility matrix — visually clean, not a wall of text:

| Agent | Rules | Workflows | MCP |
|---|---|---|---|
| Gemini CLI / Antigravity | ✅ | ✅ | ✅ |
| Codex | ✅ | ✅ | ✅ |
| KiloCode | ✅ | ✅ | — |
| Claude | ✅ | — | ✅ |
| Cursor | — | ✅ | — |

Small note: "More agents planned" if true.

---

### 7. Social Proof / In Practice

**Goal:** Show it's used in real development, not just shipped and forgotten.

Options (depending on what's available):
- GitHub stars + recent commit frequency (live badges)
- A short testimonial or quote from someone who uses it daily
- A real example: "Here's a code review I ran using `/afk-interactive-code-review`" with a screenshot or terminal recording
- CHANGELOG entries as a signal of active maintenance: "Last updated: [date]"

---

### 8. The Skill vs. Workflow Rubric (Optional — Deeper Dive)

**Goal:** Speak to developers who want to contribute or extend the kit.

A condensed version of the rubric from the README:
- Skill = reusable expertise / teaches how to think
- Workflow = named operating procedure / fixed sequence

Could be a toggleable section or collapsed by default. Signals that this is an opinionated, well-thought-out system.

---

### 9. Support the Work

**Goal:** Low-friction, non-pushy ask.

- Ko-fi and Buy Me a Coffee links
- Keep it light — one small section, not a fundraising pitch
- Copy tone: "If this kit saves you an hour a week, consider buying me a coffee."

---

### 10. Footer

- Link to Logbook for Devs main site
- GitHub repo
- CHANGELOG
- "A tool from Logbook for Devs — Charting the technical seas, one commit at a time."

---

## Calls to Action (CTA Map)

| CTA | Placement | Action |
|---|---|---|
| **Get the Kit** | Hero (primary) | GitHub repo |
| **Copy install command** | Hero + Quick Start | Clipboard copy of `npx skills add ...` |
| **See the skills** | Hero (secondary) | Anchor scroll to Skills Gallery |
| **Browse on GitHub** | Skills cards | Opens skill file in repo |
| **Full setup guide** | Quick Start | Expands or scrolls to 3-command flow |
| **Buy me a coffee** | Support section + footer | Ko-fi link |
| **Open a PR** | Contributing note | GitHub repo contribution guide |

---

## Visual Direction

### Aesthetic Preset Recommendation

Given the project's own `/afk-cinematic-landing-page-builder` workflow and its **Preset C — Brutalist Signal** or **Preset B — Midnight Luxe** presets, a few directions make sense:

**Option A — Brutalist Signal (recommended as primary)**
- Palette: Paper `#E8E4DD`, Signal Red `#E63B2E`, Off-white `#F5F3EE`, Black `#111111`
- Typography: "Space Grotesk" + "DM Serif Display" Italic + `"Space Mono"` for code
- Identity: control room, raw precision, pure information density
- Rationale: matches the "no fluff" tone of the kit perfectly; code-heavy content looks at home in this aesthetic

**Option B — Midnight Luxe (alternative)**
- For a more premium editorial feel that positions the kit as a serious professional tool

### Motion Direction

Since the project includes an `afk-animated-driven-frontend` skill, the landing page is a natural showcase of those principles:

- Mode: **cinematic-clarity** — guided flow, subtle direction, editorial polish
- No movement for movement's sake; motion communicates state and hierarchy
- Terminal animations for the install commands (typewriter effect)
- Staggered card entrances on scroll (GSAP, `stagger: 0.15`)
- A scroll-driven visualization showing config flowing from the repo → agent icons

### Layout Principles

- Wide type, generous spacing — developer aesthetic, not SaaS-generic
- Code blocks as first-class visual elements, not afterthoughts
- Dark/light toggle optional; default should reflect the brand aesthetic
- Mobile-friendly but desktop-primary (the audience is at their machine)

---

## Content Gaps to Resolve Before Building

- [ ] Does a live site already exist for Logbook for Devs? If so, what's the relationship between the main site and this page?
- [ ] GitHub stats to display (stars, forks, last commit)? Pull live via GitHub API or use static badges?
- [ ] Any video or terminal recording assets available for the hero/demo section?
- [ ] Testimonials or real usage quotes available?
- [ ] Is there a preferred domain/path for this page? (e.g., `ai-field-kit.logbookfordevs.com` or a subpath?)
- [ ] Should the page link to `logbookfordevs.com` as the main hub, or stand alone?
- [ ] Skills CLI (`npx skills add`) — is `skills.sh` stable enough to feature prominently as the primary install path?

---

## Next Steps

1. Resolve content gaps above
2. Choose aesthetic preset (A or B)
3. Write final copy for hero, empathy hook, and CTA labels
4. Build with `/afk-cinematic-landing-page-builder` workflow or a standalone React/HTML build
5. Review with `afk-advanced-elicitation` skill before shipping

---

*Document created by Claude / Cowork — April 2026*
