import assert from "node:assert/strict";
import { test } from "vitest";
import { renderArchitectOutro, renderBanner, renderSetupOutro } from "./brand.js";
import { updateCommand } from "./update-check.js";

test("renderBanner shows the larger AFK identity", () => {
  const banner = renderBanner();

  assert.ok(banner.includes("AI FIELD KIT"));
  assert.ok(banner.includes("setup router for agentic dev work"));
  assert.ok(banner.includes("/ ____/ //_"));
});

test("renderBanner shows an available update without hiding the AFK identity", () => {
  const banner = renderBanner({
    updateNotice: {
      currentVersion: "0.5.2",
      latestVersion: "0.5.3",
      command: updateCommand,
    },
  });

  assert.ok(banner.includes("AI FIELD KIT"));
  assert.ok(banner.includes("Update available"));
  assert.ok(banner.includes("afk 0.5.2 -> 0.5.3"));
  assert.ok(banner.includes(updateCommand));
});

test("renderBanner can remind setup users to refresh manifests", () => {
  const banner = renderBanner({ showRefreshHint: true });

  assert.ok(banner.includes("afk refresh"));
  assert.ok(banner.includes("local catalog"));
});

test("renderSetupOutro closes setup with AFK-owned context", () => {
  const outro = renderSetupOutro({
    dryRun: true,
    failed: false,
    scopeLabel: "This project only (/tmp/project)",
    areas: ["Rules", "Skills"],
  });

  assert.ok(outro.includes("AFK dry run complete"));
  assert.ok(outro.includes("No files changed."));
  assert.ok(outro.includes("Scope: This project only (/tmp/project)"));
  assert.ok(outro.includes("Areas: Rules, Skills"));
});

test("renderArchitectOutro celebrates a provisioned skill and crew", () => {
  const outro = renderArchitectOutro({
    dryRun: false,
    failed: false,
    scopeLabel: "Global field kit",
    harnesses: ["Codex"],
    skill: { label: "AFK Architect", path: "/home/leo/.agents/skills/afk-architect" },
    crew: [
      { label: "Cartographer", path: "/home/leo/.codex/agents/afk-cartographer.toml" },
      { label: "Builder", path: "/home/leo/.codex/agents/afk-builder.toml" },
      { label: "Pathfinder", path: "/home/leo/.codex/agents/afk-pathfinder.toml" },
    ],
  });

  assert.ok(outro.includes("Preset"));
  assert.ok(outro.includes("- Harnesses: Codex"));
  assert.ok(outro.includes("◆ Skill"));
  assert.ok(outro.includes("✓ AFK Architect"));
  assert.ok(outro.includes("Shared skill → /home/leo/.agents/skills/afk-architect"));
  assert.ok(outro.includes("◆ Crew"));
  assert.ok(outro.includes("✓ Cartographer → /home/leo/.codex/agents/afk-cartographer.toml"));
  assert.ok(outro.includes("✓ Builder → /home/leo/.codex/agents/afk-builder.toml"));
  assert.ok(outro.includes("✓ Pathfinder → /home/leo/.codex/agents/afk-pathfinder.toml"));
  assert.ok(outro.includes("1 skill and 3 Custom Agents provisioned for Codex."));
  assert.ok(outro.includes("☠"));
});
