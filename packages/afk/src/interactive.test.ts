import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { normalizeSetupSelection, selectDefaultsSource, selectMcpsInstall, selectRulesSync, selectSetup, selectUtilsInstall } from "./interactive.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions } from "./types.js";

const promptState = vi.hoisted(() => ({
  checkboxMessages: [] as string[],
  setupAreas: ["utils"] as string[],
  inputCalls: [] as Array<{ default: string | undefined; required: boolean | undefined; validateResult: true | string }>,
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async ({ message }: { message: string }) => {
    promptState.checkboxMessages.push(message);
    if (message === "Choose what AFK should prepare") {
      return promptState.setupAreas;
    }

    if (message === "Choose agents for rules" || message === "Choose agents for MCPs" || message === "Choose agents for rules and MCPs") {
      return ["codex"];
    }

    if (message === "Choose MCPs to install") {
      return ["stitch"];
    }

    if (message === "Choose utilities to install") {
      return ["rtk"];
    }

    return [];
  }),
  select: vi.fn(async () => "global"),
  input: vi.fn(async ({ default: defaultValue, required, validate }: { default?: string; required?: boolean; validate: (value: string) => true | string }) => {
    promptState.inputCalls.push({
      default: defaultValue,
      required,
      validateResult: validate(""),
    });
    return defaultValue ?? "acme/dev-kit";
  }),
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
  promptState.setupAreas = ["utils"];
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

test("selectRulesSync asks for rules-specific agent targets", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectRulesSync(defaultOptions(localHomeWithUtilityManifest()));

  assert.deepEqual(selection.agents, ["codex"]);
  assert.ok(promptState.checkboxMessages.includes("Choose agents for rules"));
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectMcpsInstall asks for MCP-specific agent targets", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectMcpsInstall(defaultOptions(localHomeWithMcpManifest()));

  assert.deepEqual(selection.agents, ["codex"]);
  assert.deepEqual(selection.mcpIds, ["stitch"]);
  assert.ok(promptState.checkboxMessages.includes("Choose agents for MCPs"));
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectSetup names shared rules and MCP agent targets when both areas are selected", async () => {
  promptState.checkboxMessages = [];
  promptState.setupAreas = ["rules", "mcps"];
  const selection = await selectSetup(defaultOptions(localHomeWithMcpManifest()));

  assert.deepEqual(selection.areas, ["rules", "mcps"]);
  assert.deepEqual(selection.agents, ["codex"]);
  assert.deepEqual(selection.mcpIds, ["stitch"]);
  assert.ok(promptState.checkboxMessages.includes("Choose agents for rules and MCPs"));
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectDefaultsSource pre-fills the remembered source and requires input", async () => {
  promptState.inputCalls = [];
  const source = await selectDefaultsSource("acme/saved-kit");

  assert.equal(source, "acme/saved-kit");
  assert.deepEqual(promptState.inputCalls, [
    {
      default: "acme/saved-kit",
      required: true,
      validateResult: "Enter a setup source to continue.",
    },
  ]);
});

function defaultOptions(homeDir: string): CliOptions {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: true,
    dryRun: true,
    verbose: false,
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
    defaultsSourceExplicit: false,
    defaultSourceUpdate: "",
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

function localHomeWithMcpManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "mcps.json"),
    `${JSON.stringify({
      version: 1,
      items: [
        {
          id: "stitch",
          label: "Stitch",
          source: "stitch-mcp",
          args: [],
          default: true,
        },
      ],
    }, null, 2)}\n`,
  );
  return homeDir;
}
