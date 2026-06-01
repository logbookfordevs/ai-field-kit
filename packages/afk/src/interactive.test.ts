import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { normalizeSetupSelection, selectSetup, selectUtilsInstall } from "./interactive.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions } from "./types.js";

const promptState = vi.hoisted(() => ({
  checkboxMessages: [] as string[],
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async ({ message }: { message: string }) => {
    promptState.checkboxMessages.push(message);
    if (message === "Choose what AFK should prepare") {
      return ["utils"];
    }

    if (message === "Choose utilities to install") {
      return ["rtk"];
    }

    return [];
  }),
  select: vi.fn(async () => "global"),
}));

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

test("selectSetup does not ask for agent targets when only utilities are selected", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectSetup(defaultOptions(localHomeWithUtilityManifest()));

  assert.deepEqual(selection.areas, ["utils"]);
  assert.deepEqual(selection.utilIds, ["rtk"]);
  assert.deepEqual(selection.agents, []);
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectUtilsInstall does not ask for agent targets when installing RTK", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectUtilsInstall(defaultOptions(localHomeWithUtilityManifest()));

  assert.deepEqual(selection.utilIds, ["rtk"]);
  assert.deepEqual(selection.agents, []);
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

function defaultOptions(homeDir: string): CliOptions {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: true,
    dryRun: true,
    yes: false,
    includeExternal: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    selectedMcpIds: [],
    selectedUtilIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "local",
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    selectedManifestCategories: [],
    homeDir,
    repoDir: "/tmp/repo",
    cwd: "/tmp/project",
  };
}

function localHomeWithUtilityManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "utils.json"),
    `${JSON.stringify({
      version: 1,
      items: [
        {
          id: "rtk",
          label: "RTK",
          description: "Compress noisy command output for coding agents.",
          install: { command: "sh", args: ["-c", "install-rtk"] },
          postInstall: "rtk-init",
          default: true,
        },
      ],
    }, null, 2)}\n`,
  );
  return homeDir;
}
