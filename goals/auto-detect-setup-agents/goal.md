# Auto-detect AFK setup agent targets

AFK setup should reduce repeated agent-selection prompts by detecting compatible installed agent targets and using those targets by default. The change should keep setup behavior visible, preserve explicit `--agent` overrides, keep utilities independent from agent targeting, and put custom target paths in a separate local AFK config surface rather than `presets.json`.

Use `facts.md` as the shared understanding of the desired behavior.

Use `plan.md` as the execution plan.

Done when the accepted facts are implemented, automated verification passes for the selected facts, setup dry-run/summary output clearly shows detected targets, and TypeScript validation passes with `npx tsc --noEmit` for the AFK package.
