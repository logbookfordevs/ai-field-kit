import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSetupSelection } from "./interactive.js";

test("normalizeSetupSelection removes item areas when every item is unselected", () => {
  const selection = normalizeSetupSelection({
    areas: ["rules", "skills", "mcps"],
    agents: ["codex"],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: [],
    hookIds: [],
  });

  assert.deepEqual(selection.areas, ["rules"]);
});

test("normalizeSetupSelection keeps item areas when at least one item is selected", () => {
  const selection = normalizeSetupSelection({
    areas: ["skills", "mcps", "utils"],
    agents: [],
    hookAgents: [],
    setupScope: "project",
    skillIds: ["afk-note"],
    skillAgents: ["kiro-cli"],
    mcpIds: ["stitch"],
    utilIds: ["rtk"],
    hookIds: [],
  });

  assert.deepEqual(selection.areas, ["skills", "mcps", "utils"]);
  assert.deepEqual(selection.skillAgents, ["kiro-cli"]);
});

test("normalizeSetupSelection keeps hooks when at least one hook is selected", () => {
  const selection = normalizeSetupSelection({
    areas: ["hooks"],
    agents: ["codex"],
    hookAgents: ["codex"],
    setupScope: "project",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: [],
    hookIds: ["afk-execution-tracking-stop-check"],
  });

  assert.deepEqual(selection.areas, ["hooks"]);
});

test("normalizeSetupSelection removes hooks when every hook target is unselected", () => {
  const selection = normalizeSetupSelection({
    areas: ["hooks"],
    agents: [],
    hookAgents: [],
    setupScope: "project",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: [],
    hookIds: ["afk-execution-tracking-stop-check"],
  });

  assert.deepEqual(selection.areas, []);
});

test("normalizeSetupSelection filters hook-only Cursor from general agents", () => {
  const selection = normalizeSetupSelection({
    areas: ["hooks"],
    agents: ["cursor-local"],
    hookAgents: ["cursor-local"],
    setupScope: "project",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: [],
    hookIds: ["afk-execution-tracking-stop-check"],
  });

  assert.deepEqual(selection.agents, ["cursor-local"]);
  assert.deepEqual(selection.hookAgents, ["cursor-local"]);
});
