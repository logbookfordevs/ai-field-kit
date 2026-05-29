import assert from "node:assert/strict";
import { test } from "vitest";
import { renderBanner, renderSetupOutro } from "./brand.js";

test("renderBanner shows the larger AFK identity", () => {
  const banner = renderBanner();

  assert.ok(banner.includes("AI FIELD KIT"));
  assert.ok(banner.includes("setup router for agentic dev work"));
  assert.ok(banner.includes("/ ____/ //_"));
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
