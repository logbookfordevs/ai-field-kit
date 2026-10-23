# AFK app refinement

Approved scope: resolve the 2026-10-03 app critique, starting with conflict clarity.
Preserve the local app's paper palette, fonts, storage behavior, and activation rules.
Website work is outside this pass.

| Task | Command | Outcome | State |
|---|---|---|---|
| 1 | `impeccable clarify` | Explain conflict choices before differences; show effective invocation and reduce jargon. | Complete |
| 2 | `impeccable harden` | Preserve deliberate conflict decisions, reviewed snapshots, backups, and recoverable errors. | Complete |
| 3 | `impeccable shape` | Distinct repository/local profile modes, searchable members, retained selection. | Complete |
| 4 | `impeccable adapt` | Compact persistent narrow-screen navigation and reachable task controls. | Complete |
| 5 | `impeccable distill` | Remove repeated metadata; disclose storage and advanced transfer options. | Complete |
| 6 | `impeccable layout` | Improve ledger density, grouping, and responsive dialogs. | Complete |
| 7 | `impeccable typeset` | Keep existing faces; simplify roles and remove tiny uppercase scaffold text. | Complete |
| 8 | `impeccable polish` | One combined inspection, one repair batch if needed, focused checks. | Complete |
| 9 | `impeccable onboard` + `writing-for-humans` | After the fixes pass, add a dismissible first-access Welcome with useful next steps. | Complete |

Conflict UI and read-only skill metadata can run independently. The parent owns
the app shell, profile picker, density, typography, and integration. Real agent
files and skills remain untouched during verification; temporary fixtures exercise
the flows. A task is complete only after its relevant behavior and rendered states
are confirmed.

Critique source: `.impeccable/critique/2026-10-03T21-02-34Z__packages-afk-web.md`.

## Verification and delivery

The combined inspection covered all six sections at desktop 1440×1000 and mobile
390×844. The repair/confirmation pass retained the paper ledger and fonts. Mobile
page headings moved from approximately y=286 to y=85; first profile activation,
skill availability and rule editing controls are now within the initial viewport.
All measured page widths fit. This is bounded UI verification, not accessibility
certification or a study of human comprehension.

Confirmed functional behavior:

- Filtering by skill name or description retains selected members. Local and
  repository radio selections agree with the displayed source; a real Skills CLI
  discovery from a temporary source returned descriptions, and the chosen member
  was saved disabled.
- Failed profile save retains the name and selection with an inline error.
- Project invocation overrides leave native Global metadata unchanged. Clearing an
  override reconnects actual Global inheritance; per-agent differences are shown.
- Conflict consequences precede the comparison. Stale destination review blocks
  replacement; fresh review preserves surrounding text and creates a backup.
- Delayed overwrite success/failure leaves a newer tool form intact in browser
  verification. Eight regression cases run the shipped rules script and cover
  adoption and replacement, successful and failed responses, dismissed reviews,
  and newer forms. Adoption browser verification remains unclaimed.
- Welcome can be dismissed with Escape, stays dismissed after reload, and reopens
  from About AFK. Its actions enter real profile/rule workflows without implicit
  installation or sync. Dismissal is stored in settings; API tests confirm it
  survives a server port change and concurrent profile saves.
- Empty inventory offers Profiles without an update control. Settings offers ZIP
  first and discloses JSON-only transfer. Optional source agent selection is also
  collapsed; global Tools has no project scope.

Checks: typecheck, lint, build, standalone/inline JavaScript syntax, all 76
regressions and the installer pass. `git diff --check` passes. Package file
inclusion was confirmed with a script-free dry run; the normal
prepack hook could not verify the pinned pnpm registry identity in this environment
(`ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE`). No package-manager/security bypass
or release was attempted. The build itself passed separately.

The single manual detector pass reported two intentional advisory patterns (paper
palette and temporary dialog elevation) plus two size mismatches. The key hint is
now 13px and the mobile brand uses the documented 26px step. No extra detector pass
was run. The design documents and sidecar match the finished interface.

Evidence: `.impeccable/review/app-refinement/`.
The final reviewer cleared both required repairs: delayed conflict responses and
corrected local-mode picker captures. No regressions were identified in the repair
batch; the verdict covers the scored fixes, rather than certifying the whole app.
The critique archive is preserved. Its storage helper reports no active snapshot
(`latest` exits 2); closing the retained snapshot also exits 2 without a mutation.
Temporary fixture servers, files, and the dedicated browser session are cleaned up.
All work is local and uncommitted. Website, real agent rules and real skill state
were outside this pass; verification used temporary files.
