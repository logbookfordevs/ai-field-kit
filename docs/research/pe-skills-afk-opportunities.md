# PE Skills and AFK: composition opportunities

Research snapshot: 2026-09-16. Recommendation, not an implementation decision.

## Subsequent discussion: agreed direction and requirements for the spec

The discussion after this audit broadened the objective to an AFK capability redesign inspired by PE's architecture. The selective pilots below are early tests of that larger replacement, not the limit of its scope. This section records requirements; it does not constitute an approved implementation spec or authorize a cutover.

- **Parallel development:** keep the current system canonical and usable while the replacement develops in an isolated experimental tree. Exact folder naming remains open. Exclude experimental content from ordinary discovery, installation, and publication; explicitly select it for testing. Carry relevant current-system changes forward so the replacement does not become stale.
- **Complete coverage:** account for every current catalog capability, including externally sourced skills. Map retained behavior into independent capabilities, incorporated references, shared methods, tools, or explicitly agreed retirements. Capability composition means using another independent capability; source composition means incorporating and maintaining selected source material. Preserve these relationships separately.
- **User migration:** provide a user-runnable migration tool (codemod/CLI migration) with the eventual canonical switch. It must handle old-to-new skill mappings and obsolete installations, including externally sourced skills previously managed through AFK, rather than leaving users to clean them up manually. Design ownership detection, preview, local-edit handling, recovery, and repeatability in the later spec; do not assume every old-named skill on a user's machine is disposable.
- **Discovery inputs:** use Compass and its crossroads as existing distilled evidence about task distinctions and routing. Use current catalog categorization as another input, not as the predetermined future capability taxonomy. AFK already delegates categorization to the Codex CLI; `skills.json` supports top-level `scopes` and per-item `catalog.scope` / `catalog.tags`. See `packages/afk/src/skills/categorization.ts`. Existing coverage is incomplete and should not constrain discovery.
- **Enrichment sequencing:** organize current capabilities first, with selected PE material considered where it adds value. Capture previously rejected or overlapping sources and the contribution desired from each. Defer incorporation unless a candidate exposes a requirement the architecture must accommodate now.
- **Provenance and integrity from the start:** record the exact upstream repository, source path, and commit for incorporated material, along with content checksums and the local destination. Distinguish unchanged copies, patched copies, derived material, and AFK-authored material. Preserve patch/derivation records, relevant notices, and conflict rulings. For material received through another composition, distinguish original authorship from intermediate adaptations. Support multiple sources per derived artifact.
- **Future synchronization:** retain enough structured provenance to build a watcher later. A watcher should detect upstream drift and present reviewable changes in an issue or proposed update; human review determines whether the change fits AFK's adaptations and rulings. Update accepted pins/checksums only with an accepted source update. Integrity checks detect unexpected content changes; they do not establish semantic correctness or prove that upstream changes are improvements. The maintenance record should be machine-readable; comments may point to it but should not be the sole synchronization mechanism.

Terminology for the later spec: **provenance** identifies origin and derivation; **version pinning** identifies the selected source revision; **integrity** checks expected content; **upstream drift detection** identifies changes relative to the selected revision. PE implements concrete examples with `upstream`, `upstream_path`, `pinned_sha`, `sha256`, classifications, and ruling references in its [manifest](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/foundry/MANIFEST.json).

## Judgment

There is a real opportunity here. The strongest part is making upstream material maintainable and giving each task one clear owner. Installing the whole PE collection beside AFK would mostly increase overlap. AFK should test a small composition fork and selectively borrow evidence-producing workflows before expanding its default catalog.

PE is an opinionated product-design and engineering workflow. AFK is a composable, multi-harness setup layer with optional workflows. Seven PE entry points and 52 AFK catalog entries are not equivalent scopes, and their counts do not establish relative efficiency.

My recommended order:

1. Pilot a composed prototype skill using AFK's existing sources, preserving rough versus polished and existing-app versus standalone distinctions.
2. Pilot PE's verification contract and renderer behind AFK-compatible tooling and artifact conventions.
3. Offer behavior documentation as an optional specialist if real use justifies it.
4. Consider motion consolidation only after the prototype pilot demonstrates better routing.
5. Keep Impeccable, AFK's tracked implementation, and its two-axis code review as their current owners.

Do not make all five changes together. The first pilot should answer whether composition actually saves choices and context without losing fidelity.

## Evidence and limits

AFK repository: `b6e59b95578a41222b010badc309bf36d816b3ad`. PE source: `0642a58496d4dfa1de9688a82c29dfa34d24370a`, downloaded from [backnotprop/product-engineering](https://github.com/backnotprop/product-engineering/tree/0642a58496d4dfa1de9688a82c29dfa34d24370a).

The audit covers all six PE work skills and its router, the reference architecture, and the foundry/watch scripts. The companion [source audit](pe-skills-source-audit.md) records deeper evidence and limitations. AFK comparisons use its current catalog, profiles, relevant authored skills and code; external AFK skills were inspected in the installed `/Users/leonardo/.agents/skills/` snapshot. Those installed bodies are not asserted to be today's upstream HEAD. The Astra article is the complete user-supplied attachment, not an independently authenticated attribution or model benchmark.

No task-quality, latency, or token-consumption benchmark was performed. Word counts describe files, not actual context loaded or billed tokens. No catalog, installed skills, profiles, or workflow policy was changed.

## What the methodology actually buys

PE separates the user-facing skill from the material it consumes. A task routes through an authored spine; selected upstream files provide craft or method; a maintained policy resolves disagreements. Provenance records pin source commits and classify copied, patched, and derived material. The watcher detects upstream changes and opens issues; maintainers still decide whether and how to adopt them. See the [foundry](https://github.com/backnotprop/product-engineering/tree/0642a58496d4dfa1de9688a82c29dfa34d24370a/foundry), [ledger](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/foundry/LEDGER.md), and [Emil receipts](https://peskills.dev/people/emil-kowalski/).

These are three separate benefits:

- **Selection:** fewer overlapping names and triggers at the point of use.
- **Coherence:** a documented owner chooses what applies when upstream instructions disagree.
- **Maintenance:** source changes can be traced, inspected, and selectively adopted.

None follows automatically from putting Markdown in a references folder. A verbatim skill body still contains commands, dependencies, gates, and assumptions. Moving it does not turn it into passive advice. The root must explain which parts remain binding, resolve its links and old skill names, and load only the material necessary for the selected task.

The editorial choices also deserve scrutiny. PE's build rules select exact press scaling, default spring behavior, easing, and submit-button policy. Those are the kit's preferences, not universally correct results established by a hash or by several authors agreeing. AFK should preserve the decision and its rationale without elevating a useful default above the product's own behavior and accessibility requirements. See [pe-build](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-build/SKILL.md).

The independent source audit matched all 94 present hash-bearing manifest entries to their recorded hashes. That is useful integrity evidence, with no claim that current upstream bytes or patch replay were independently verified. It also found residual integration problems: an unmapped `interface-review` handoff, a `scenarios.md` link whose shipped target is `stress-scenarios.md`, and a case-sensitive `PICKER.md` link to a lowercase file. Review calls into build references, and brand work calls into design; partial installs need those dependencies. These are concrete reasons to normalize runtime references before copying the composition pattern. See the [source audit](pe-skills-source-audit.md) for pinned evidence.

## Every PE skill: catalog decision

| PE entry | Distinct value | AFK overlap | Recommendation |
|---|---|---|---|
| `pe-design` | One entry for context, briefs, direction, HTML artifacts, variants, onboarding; captures approval with artifact and state | Impeccable, design grill, prototype, HTML specialists, to-spec | Borrow its ownership and approval-record ideas. Do not add raw beside all existing design owners. |
| `pe-build` | Production UI modes for craft, motion, accessibility and hardening, with reconciled source material | Impeccable, animate, shadcn; afk-implement owns tracking rather than UI craft | Do not add as another default builder. Select individual references only when they fill demonstrated gaps. |
| `pe-review` | Interface review across changes, screens, motion, accessibility, hostile states and approved-design fidelity | Impeccable critique/audit, review-animations, AFK code review | Borrow fidelity and stress methods conditionally. Do not replace Standards/Spec review with a UI-quality verdict. |
| `pe-verify` | Code/browser/mixed checks, explicit skipped/not-run states, stable JSON and generated report with evidence | Normal tests/browser QA; implementation evidence and review guides | Strongest selective-fork candidate. Make optional, and require a requested verification report or reusable QA run. |
| `pe-product-description` | Outside-in account of an existing product, source revision, shared vocabulary, verification and defect triage | to-spec, domain-modeling, research, human-facing writing | Strongest distinct optional catalog candidate. Raw for its exact dedicated-repository workflow; adapt for AFK-local feature documentation. |
| `pe-brand-assets` | Brand-constrained SVG assets and raster exports, including consumption-specific SVG rules | Image generation and some Impeccable asset work; neither is exactly this contract | Optional specialist for repeated brand-asset work. Adapt sibling dependencies and inferred-brand handling before treating as independent. |
| `product-engineering` | Routes by deliverable, then executes the selected PE skill | Compass plus named AFK workflows | Do not add as an automatic peer to Compass/Impeccable. Useful only as the front door to an explicitly selected PE alternative. |

Primary skill bodies: [design](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-design/SKILL.md), [build](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-build/SKILL.md), [review](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-review/SKILL.md), [verify](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-verify/SKILL.md), [product description](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-product-description/SKILL.md), [brand assets](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/pe-brand-assets/SKILL.md), [router](https://github.com/backnotprop/product-engineering/blob/0642a58496d4dfa1de9688a82c29dfa34d24370a/skills/product-engineering/SKILL.md).

Raw adoption is reasonable when a user deliberately wants PE's whole workflow and accepts its conventions. That would be a separate optional profile or install choice with an explicit owner for a task. It would not be a strategy for reducing AFK's catalog, and merely adding a profile does not necessarily hide other installed skills.

## What AFK already gets right

The [catalog](../../packages/afk/catalog/skills.json) has 52 items: 25 default selections, 33 manual and 19 automatic invocation policies. These are catalog facts, not the actual host's active inventory. Profiles can install packages beyond those catalog entries; the current host also exposes unrelated plugins and skills.

AFK already has:

- Roles and composition dependencies. `expandComposedSkillIds` expands dependencies for setup. This helps installation; it does not reconcile the child skills' instructions. See [manifest.ts](../../packages/afk/src/manifest.ts).
- A deliberately manual [Compass](../../skills/afk-compass/SKILL.md), with [frontend crossroads](../../skills/afk-compass/references/frontend-crossroads.md) explaining the actual decision boundaries.
- Selective profile loading through [afk-profile-use](../../skills/afk-profile-use/SKILL.md), and focus-profile mechanisms in [profiles.ts](../../packages/afk/src/skills/profiles.ts). The [profile catalog](../../packages/afk/catalog/profiles.json) also preserves a small alwaysOn set; this does not mean their complete bodies are always injected.
- A [design commitment](../../skills/afk-design-grill/SKILL.md) capturing the approved reference, must-preserve details, shell, mount point, viewports, states, and deviations.
- [Tracked implementation](../../skills/afk-implement/SKILL.md) with one authoritative record and [two-axis code review](../../skills/afk-code-review/SKILL.md).
- Impeccable as one installed router with many commands, references, runtime behavior and agents. Replacing it with a few copied craft references would discard capabilities, not merely eliminate metadata.

This is why a wholesale reorganization is premature. AFK already follows much of the progressive-disclosure approach. The missing layer is primarily a reproducible way to own selected adaptations and their semantic conflicts.

## Concrete composition candidates

### 1. Prototype: the best first pilot

Create an experimental AFK-owned prototype entry with three questions deciding what it loads:

1. What uncertainty should the prototype settle: logic/state, structure, or visual/flow fidelity?
2. Does the real application shell, data density, or mount point materially affect the answer?
3. What exactly may the resulting artifact approve?

Sources and ownership:

| Source | Keep | Do not import indiscriminately |
|---|---|---|
| Matt's `prototype` | Question-first experiment; logic/state free play; real-app variant exploration | Rough/no-polish rules in a fidelity-approval task; automatic implementation/capture actions outside the authorized experiment |
| Effective HTML `html-wireframe` | Structural alternatives, realistic content, intentionally low fidelity | A mandatory standalone HTML shell for real-app exploration |
| Effective HTML `html-prototype` | Bounded credible interaction, responsive states and fidelity | A full interaction checklist for a tiny logic experiment |
| PE `pe-design` | Mode routing and stable approval identity/state | Mandatory `.product/` storage or unrelated context-generation tooling |
| AFK design grill | Fixed shell and visual commitment across handoffs | Re-running an interview when the user has already selected the design |

A mode should select one main method. It should not load all three upstream skill bodies and ask the model to improvise a reconciliation. Keep broad `design-artifact` available for other HTML deliverables; this pilot does not justify absorbing its entire catalog role.

The current [crossroads](../../skills/afk-compass/references/frontend-crossroads.md) already contains most of the decision logic. That makes this a packaging and ownership experiment grounded in existing AFK decisions.

Compatibility matters: Wayfinder composes `prototype`; Compass and profiles name the HTML specialists; external installations can depend on those IDs. Preserve aliases or update callers explicitly. If all old entry points remain discoverable alongside a new one, the pilot has added a skill rather than reduced selection cost.

### 2. Verification: add a stronger output, not another generic testing instruction

An optional `afk-verify` could borrow PE's schema and renderer while using existing AFK/browser tools. Its distinguishing promise would be a reusable, inspectable verification record.

Keep: named checks, source revision and target, execution versus source-inspection evidence, pass/fail/flag/skipped/not-run distinctions, expected versus observed behavior, and a reusable report renderer. Persist useful results under the project's chosen convention rather than silently creating a second record system.

Adapt: Playwright-specific capture, default recording/checkpoint ceremony, fixed viewport assumptions, global memory writes, `.product/` routing, and the PE-specific build handoff. Evidence should match the claim: a source trace is not a browser execution, and a schema-valid report is not proof that its checks ran.

Integrate it as evidence for `afk-implement` when acceptance needs it. Do not automatically run it after every small change, duplicate already adequate checks, or make it a substitute for technical or design judgment. A standalone requested verification remains read-only; implementation may consume failures and continue authorized fixes.

### 3. Behavior documentation: preserve a distinct job

`afk-to-spec` describes intended work. PE product description records existing behavior. Keep those meanings distinct even if they share a glossary, templates, or verification references.

An AFK adaptation would retain observable states, interrupts, defaults, a source revision, uncertainty, verification coverage, and suspected-defect triage. It would allow one bounded feature under existing docs instead of requiring a new repository and full-product documentation infrastructure.

Drop size targets such as a 150–200-line small-feature document. Use coverage requirements instead. Separate **documented from source**, **observed in a run**, and **accepted by a human**; the raw skill's broad human-verification requirement should not obscure strong automated evidence for a CLI. Keep human judgment where it is actually needed.

### 4. Motion: a plausible second consolidation

One optional motion specialist could own build, review and direct-manipulation modes, using `animate`, `review-animations`, and `apple-design` as selected references. PE provides an example of distributing those sources across task owners; AFK can choose a domain owner instead if that routes better.

Leave Impeccable responsible for a surface's motion direction and the cinematic AFK workflow responsible for its deliberately collaborative production process. Do not combine the generic text-animation catalog automatically; it is a distinct selection resource. Course material must remain a separately supplied local dependency where redistribution is not allowed.

### 5. Review: share evidence without flattening verdicts

PE's fidelity and hostile-state lenses can complement AFK's reviews. AFK's Standards and Spec axes must remain separate; UI quality, behavior verification, code conventions and fulfillment of intent answer different questions.

Moving the short verdicts wrapper into a mode of AFK code review could remove a name, but the review-only versus verify-findings boundary is deliberate. This is a lower-priority simplification than prototype routing. A two-line manual shortcut can be cheaper and more predictable than another mode in an already large root.

## Astra and prompt debt

The supplied article supports narrow triggers, progressive disclosure, less procedural scaffolding, context-sensitive document reads, and explicit completion boundaries. It does not establish that every shorter skill is better, that source attribution improves model quality, or that Astra never benefits from deterministic checks.

Concrete findings in today's files:

- `afk-to-spec` requests a LONG, extremely extensive list of stories and a user seam check even though its task is synthesis without an interview. Replace quantity incentives with coverage of material behavior; ask only for an unresolved consequential seam. [Source](../../skills/afk-to-spec/SKILL.md).
- `afk-implement` carries valuable recovery and acceptance invariants, but its root also repeats them in a long operating loop. Move detailed record and gate procedures behind conditional references while keeping the actual completion and authority rules explicit. Preserve its intentionally chosen final acceptance boundary. [Source](../../skills/afk-implement/SKILL.md).
- Installed `source-driven-development` broadly activates for framework correctness and asks the user about several routine choices. Installed `doubt-driven-development` requires recurring adversarial cycles and a cross-model offer. Their main risk is activation breadth and procedural cost, not merely separate names. Narrow them to requested/source-sensitive work and consequential uncertainty before considering a merge.
- Installed Impeccable's description is broad and approximately 900 characters including the YAML key; it is already consolidated. Another all-purpose design router would compete with it. Preserve its maintained functionality; use a traceable adapter only if description/routing changes demonstrate benefit.
- PE's six work skills plus router total 6,798 whitespace-delimited words in their root files in this snapshot. Its body organization is useful, but seven names is not evidence of seven tiny prompts. Some modes also load several substantial references.

The article is provided at `/Users/leonardo/.codex/attachments/4fc7157f-1262-4242-89aa-16315b5cd126/pasted-text.txt`. Installed external skill evidence is under `/Users/leonardo/.agents/skills/{source-driven-development,doubt-driven-development,impeccable}/SKILL.md`; inspect fresh upstream versions before implementing adaptations.

Do not start another blanket AGENTS.md cleanup because a new kit exists. The supplied AFK rules already include conditional reads, proportionate testing, and permission distinctions. The remaining changes should address demonstrated task failures.

## A small maintainable provenance system

For one pilot, keep a short authored root, selected references, one source manifest, necessary upstream license/notice material, and a small decision ledger. Each carried file needs upstream repository/path/commit, local path, classification, integrity hash, and an associated patch or derivation note where appropriate. Record the reason for each material conflict ruling and the condition that would reopen it.

Use deterministic checks for file discovery, local link resolution, source hashes, patch replay, schema compatibility, referenced-skill availability, and installation/runtime behavior. Do not write tests pinning authored prose, headings or wording; AFK explicitly rejects those tests.

A watcher should compare selected inputs, deduplicate notices, and produce reviewable drift information. It should not silently update installed runtime instructions. Start manually if there are only a few sources; automate once the update burden exists. Legal suitability must be checked against each selected file's license and notices, not inferred from the aggregate repository label.

## Proving or rejecting the idea

Compare current AFK routing, current skills with tighter routing only, and the composed prototype on a small fixed task set:

- Existing-app settings variants where the shell must stay intact.
- A logic/state experiment with no visual-identity question.
- A polished standalone flow with loading, error and recovery states.
- Implementation from an already-approved screenshot, with no new exploration.
- A small motion change and a motion review, to detect accidental cross-activation.
- A typo or minor copy change, to detect unwanted process escalation.

Run comparable tasks on Astra and the other model/harness combinations AFK actually supports. Record selected owner, files loaded, instruction bytes/tokens when measurable, user clarification count, completion boundary, lost requirements, unexpected tool calls, time/cost, and human judgment of the result. Do not mix successful routing with successful implementation in one score.

Keep the composition only if it preserves or improves outcomes while reducing wrong routing or unnecessary context. If narrower descriptions and existing Compass references solve the problem with less maintenance, keep the present skills. If gains are limited to one host/model, offer an optional profile rather than rewriting the portable default.

Two three-to-one consolidations would remove four logical catalog entry points if the old entries truly leave the catalog. Two new specialists would add two back. This arithmetic is illustrative, not a target or a promised token saving. The goal is fewer competing owners and better evidence, not the smallest number on the website.

## AFK catalog disposition, all 52 entries

This family-level inventory ensures the recommendation considers AFK's broader scope rather than treating every skill as a UI skill. It is a disposition map, not a claim of equally deep body audit for every external skill.

| Entries | Disposition |
|---|---|
| `afk-cli`, `afk-profile-use`, `afk-create-agent` | Keep setup/configuration roles. PE does not replace them. |
| `afk-compass` | Keep manual AFK routing; update routes only after an accepted pilot. |
| `afk-architect`, `orchestrator`, `afk-ask` | Keep distinct session coordination, cross-runtime coordination, and advisor roles. |
| `afk-to-spec`, `afk-to-tickets`, `afk-implement`, `wayfinder` | Keep planning/execution meanings; simplify conditional loading where warranted. |
| `afk-code-grill`, `afk-design-grill`, `grilling`, `grill-me`, `grill-with-docs` | Keep intentional interview choices; do not import PE's design gates over them. Tiny manual wrappers are not the first optimization target. |
| `afk-code-review`, `afk-code-review-verdicts`, `afk-static-review` | Keep technical review boundaries; optionally share verification/fidelity evidence. |
| `impeccable`, `shadcn`, `afk-animated-driven-frontend` | Keep design/runtime, component-system, and cinematic workflow ownership. |
| `prototype`, `html-wireframe`, `html-prototype` | First composition pilot. |
| `design-artifact` | Retain broader HTML purpose; selectively reference craft only when appropriate. |
| `animate`, `review-animations`, `apple-design` | Potential later motion consolidation. |
| `animate-text` | Keep optional specialized resource unless evidence favors integrating it. |
| `tdd`, `diagnosing-bugs`, `code-simplification`, `codebase-design`, `domain-modeling`, `truss-evaluation` | Different methods/judgments; no PE-driven merger justified. |
| `research`, `source-driven-development`, `doubt-driven-development` | Narrow expensive activation; retain research versus implementation verification versus adversarial review distinctions. |
| `writing-for-agents`, `writing-for-humans` | Keep different audiences and document contracts. |
| `plannotator-guide`, `show-me` | Keep specialized presentation/tool integration. A generated QA report has a different purpose. |
| `bro`, `facts`, `readback`, `recap`, `clean-room`, `handoff` | Keep optional small communication/context tools; combine only if discoverability proves troublesome. |
| `wizard`, `to-questionnaire`, `teach` | Keep distinct human-only setup, external decisions, and learning workflows. |

The most useful thing to copy is the responsibility to curate: one owner decides how good sources fit together and leaves a receipt. AFK already has much of the routing foundation; the pilot should test the missing maintenance and composition layer, not replace the system wholesale.
