# AFK Skill Comparison Report

Why this document exists: AFK is becoming less of a bag of favorite skills and more of a workflow with taste. That means some community skills stay as-is, some become AFK forks, and some leave the default path. This report captures the reasoning while the decisions are still warm.

The comparison is not "Matt good, Addy bad." Both skill families are strong. They just pull an agent toward different kinds of discipline.

## The Short Version

Matt Pocock's skills feel like small engineering tools you can hold in one hand. They are compact, composable, and comfortable being adapted. His README explicitly frames them as daily-use skills that are meant to be hacked on and made your own.

Addy Osmani's Agent Skills feel more like a production engineering operating system. They push gates, specs, tests, task sizing, verification, and anti-rationalization. They are good at making agents stop skipping senior-engineer discipline.

AFK wants both instincts, but not both ceremonies.

So the emerging rule is:

| Decision | AFK move |
|---|---|
| The community skill owns a useful artifact shape but AFK needs a different output contract | Fork and adapt |
| The community skill is already the right execution discipline | Replace directly |
| The community skill adds safety but makes the flow too heavy for daily use | Keep as optional or remove from the happy path |

## Two Good Toolboxes, Two Different Temperatures

Addy's skills are excellent when the agent is too eager to code. They put up rails: specify first, plan clearly, write tests, review the result, ship with evidence. That posture makes sense for large, long-lived systems where regression costs are high and process protects teams from invisible drift.

Matt's skills are excellent when the agent is too verbose, too generic, or too detached from the actual engineering surface. They push for sharper loops: grill the idea, write a spec from the context you already have, split work vertically, test behavior through public interfaces, and avoid making the workflow bigger than the work.

That difference matters for AFK because AFK is not trying to become a giant external process. It is trying to become Leonardo's engineering workflow: human-in-the-middle, ownership-preserving, compact, and practical.

## spec / Spec: Why AFK Forked Instead Of Reusing Raw

### Addy's `spec-driven-development`

Addy's spec skill is a strong gate. It treats code without a spec as guessing, then walks through specify, plan, tasks, and implement with human review between phases.

That is useful when nothing is shaped yet, or when the agent needs a hard process boundary.

The friction for AFK is that the skill tries to own too much of the lifecycle:

- spec
- plan
- tasks
- implementation gates
- project commands
- code style
- testing strategy
- always / ask-first / never boundaries

For AFK, that is both powerful and too broad. AFK already has Compass, Grill, artifact workflow, task implementation, and separate execution disciplines. Letting one imported skill own the whole middle of the workflow creates overlap.

### Matt's `to-prd`

Matt's `to-prd` is much smaller. It synthesizes the current context into a spec, asks the agent to inspect the repo, identify testing seams, and write the artifact. It does not interview by default.

That shape matched AFK better. But the raw skill assumes setup around an issue tracker and publishes the spec there. AFK needed a local-first, tracker-aware spec artifact that can normalize PM specs, preserve product intent, and add behavior, acceptance criteria, implementation decisions, and testing seams.

So AFK created `afk-to-spec`.

That was the right kind of fork: keep the small Matt shape, change the destination and artifact contract.

## Planning: From One Big Plan To Executable Packets

### Addy's `planning-and-task-breakdown`

Addy's planning skill is satisfying because it produces a clear plan: dependency graph, vertical slices, task sizing, acceptance criteria, verification, checkpoints, risks, and open questions.

The good part is obvious: it makes work feel manageable.

The mismatch is subtler: it still outputs a plan-shaped artifact. AFK discovered that the next execution layer would then have to read that plan and create tracking slices from it.

That created a two-step translation:

```text
plan file -> task implementation slices
```

Once we noticed that, the better shape became obvious:

```text
source artifact -> executable checkpoint packets
```

### Matt's `to-issues`

Matt's `to-issues` already had the right planning instinct: split a plan, spec, or spec into independently grabbable vertical slices, quiz the user on granularity and dependencies, then publish the slices.

The raw skill's center of gravity is the issue tracker. AFK's center of gravity is local checkpoint packets that can optionally be mirrored to a tracker.

So AFK created `afk-to-tasks`.

This was not a brand-new Leo skill wearing Matt's jacket. It kept the spine:

- gather context
- optionally inspect the codebase
- draft tracer-bullet vertical slices
- classify slices as `HITL` or `AFK`
- quiz the user on granularity, dependencies, and classification
- write or publish the slices

Then AFK changed the output:

```text
docs/<task-slug>/tracking/I001-short-title.md
```

No `tracking.md`. No hidden `current.json`. No duplicate source of truth. The packet is the slice, the state, and the handoff surface.

This is the cleanest example of AFK's new posture: adopt the community insight, own the operational contract.

## TDD: Replacement, Not Fork

The TDD decision was different.

AFK did not need a custom TDD artifact. It needed a better execution discipline.

Addy's `test-driven-development` is strong and serious. It says tests are proof, pushes red-green-refactor, includes the Prove-It Pattern for bugs, explains the test pyramid, prefers real implementations over mocks, and gives practical testing advice.

The issue in daily agent work is that its pressure can become too broad. In practice, an agent may interpret "prove behavior" as "test everything that moved," including incidental details like logging.

Matt's `tdd` keeps the same red-green-refactor loop, but aims it differently:

- test behavior through public interfaces
- avoid implementation-detail tests
- do one test and one implementation at a time
- do not write all tests first
- choose the behaviors that matter most
- focus on critical paths and complex logic

That is a better default for AFK. It still preserves rigor, but it reduces test noise.

So AFK replaced Addy's `test-driven-development` with Matt's `tdd`.

The decision is not "lighter testing." It is sharper testing.

## What AFK Learned

### 1. Stars and famous authors are signal, not orders

Addy and Matt both publish serious work. Their names reduce the chance that a skill is careless, but they do not decide fit.

The deciding question is not:

> Which skill is more famous?

The deciding question is:

> Which skill creates the right behavior inside AFK?

### 2. Forking can be an upgrade, not a betrayal

Matt's own README invites adaptation. That matters emotionally and technically. AFK is not stealing a shape and pretending it invented it. It is doing what good engineering tools invite: take the useful pattern, adapt it to the actual workflow, and keep the result coherent.

The forked skills are not less legitimate because they changed. They are more useful because they now fit.

### 3. Addy's skills are excellent pressure tools

Addy's skills shine when an agent needs to slow down and behave like a senior engineer:

- write the spec
- surface assumptions
- plan the dependencies
- size the tasks
- prove the behavior
- do not hand-wave verification

That is valuable. But AFK already has its own pressure surfaces. Importing all of Addy's ceremony into the happy path can make AFK feel heavier than the problem it is solving.

### 4. Matt's skills are excellent composable tools

Matt's skills fit AFK well when the desired behavior is small and sharp:

- `to-prd` becomes `afk-to-spec`
- `to-issues` becomes `afk-to-tasks`
- `tdd` replaces heavier generic TDD guidance

The common thread is compactness plus engineering taste.

### 5. AFK should not be afraid to be itself

AFK's value is not that it collects famous skills.

AFK's value is that it composes an engineering workflow Leonardo actually wants to use:

- enough human-in-the-middle to preserve ownership
- enough structure to prevent drift
- enough compactness to avoid ceremony fatigue
- enough proof discipline to ship real work
- enough local artifact control to keep product context alive

That is a real point of view.

## Current AFK Decisions

| Area | Previous default | Current AFK decision | Why |
|---|---|---|---|
| spec | Addy's `spec-driven-development` | `afk-to-spec`, adapted from Matt `to-prd` | Keep compact synthesis, add AFK local-first spec behavior |
| Planning | Addy's `planning-and-task-breakdown` / Matt raw `to-issues` as optional | `afk-to-tasks`, adapted from Matt `to-issues` | Produce executable checkpoint packets directly |
| Tracking | Core tracking index plus checkpoint files | Packet-only task implementation | Remove duplicate state and hidden markers |
| TDD | Addy's `test-driven-development` | Matt `tdd` | Keep red-green-refactor, reduce over-testing of implementation details |

## The Mental Model Going Forward

Use this when evaluating the next skill swap:

```text
Does the skill define a great method but the output is wrong for AFK?
  -> Fork it.

Does the skill already perform the right execution discipline?
  -> Replace directly.

Does the skill mostly adds ceremony AFK already owns?
  -> Keep optional or remove from the happy path.

Does the skill only feel hard to remove because of reputation?
  -> Respect the author, then judge the workflow.
```

The nicest version of AFK is not maximal. It is selective.

## Sources

- Matt Pocock Skills README: https://github.com/mattpocock/skills
- Matt `to-prd`: https://github.com/mattpocock/skills/blob/main/skills/engineering/to-prd/SKILL.md
- Matt `to-issues`: https://github.com/mattpocock/skills/blob/main/skills/engineering/to-issues/SKILL.md
- Matt `tdd`: https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md
- Addy Osmani Agent Skills: https://github.com/addyosmani/agent-skills
- Addy `spec-driven-development`: https://github.com/addyosmani/agent-skills/blob/main/skills/spec-driven-development/SKILL.md
- Addy `planning-and-task-breakdown`: https://github.com/addyosmani/agent-skills/blob/main/skills/planning-and-task-breakdown/SKILL.md
- Addy `test-driven-development`: https://github.com/addyosmani/agent-skills/blob/main/skills/test-driven-development/SKILL.md
