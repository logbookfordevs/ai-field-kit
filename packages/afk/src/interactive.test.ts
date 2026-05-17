import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSetupSelection } from "./interactive.js";

test("normalizeSetupSelection removes item areas when every item is unselected", () => {
  const selection = normalizeSetupSelection({
    areas: ["rules", "skills", "mcps"],
    agents: ["codex"],
    setupScope: "global",
    skillIds: [],
    mcpIds: [],
    utilIds: [],
  });

  assert.deepEqual(selection.areas, ["rules"]);
});

test("normalizeSetupSelection keeps item areas when at least one item is selected", () => {
  const selection = normalizeSetupSelection({
    areas: ["skills", "mcps", "utils"],
    agents: [],
    setupScope: "project",
    skillIds: ["afk-note"],
    mcpIds: ["stitch"],
    utilIds: ["rtk"],
  });

  assert.deepEqual(selection.areas, ["skills", "mcps", "utils"]);
});
