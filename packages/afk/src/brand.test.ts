import assert from "node:assert/strict";
import { test } from "vitest";
import { renderBanner, renderSetupOutro } from "./brand.js";
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

  assert.ok(banner.includes("afk setup refresh"));
  assert.ok(banner.includes("local manifests"));
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
