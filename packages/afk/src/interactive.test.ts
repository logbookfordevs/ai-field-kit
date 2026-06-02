import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { normalizeSetupSelection, selectMcpsInstall, selectRulesSync, selectSetup, selectUtilsInstall } from "./interactive.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions } from "./types.js";

const promptState = vi.hoisted(() => ({
  checkboxMessages: [] as string[],
  setupAreas: ["utils"] as string[],
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

test("selectRulesSync uses detected targets without asking", async () => {
  promptState.checkboxMessages = [];
  const homeDir = localHomeWithUtilityManifest();
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");

  const selection = await selectRulesSync(defaultOptions(homeDir));

  assert.deepEqual(selection.agents, ["codex"]);
  assert.equal(selection.agentSource, "detected");
  assert.ok(!promptState.checkboxMessages.includes("Choose agents for rules"));
});

test("selectMcpsInstall asks for MCP-specific agent targets", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectMcpsInstall(defaultOptions(localHomeWithMcpManifest()));

  assert.deepEqual(selection.agents, ["codex"]);
  assert.deepEqual(selection.mcpIds, ["stitch"]);
  assert.ok(promptState.checkboxMessages.includes("Choose agents for MCPs"));
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectMcpsInstall uses detected targets without asking for agents", async () => {
  promptState.checkboxMessages = [];
  const homeDir = localHomeWithMcpManifest();
  mkdirSync(join(homeDir, ".config", "opencode"), { recursive: true });
  writeFileSync(join(homeDir, ".config", "opencode", "opencode.json"), "{}\n");

  const selection = await selectMcpsInstall(defaultOptions(homeDir));

  assert.deepEqual(selection.agents, ["opencode"]);
  assert.deepEqual(selection.mcpIds, ["stitch"]);
  assert.equal(selection.agentSource, "detected");
  assert.ok(!promptState.checkboxMessages.includes("Choose agents for MCPs"));
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

test("selectSetup uses detected rule and MCP targets without repeating agent prompts", async () => {
  promptState.checkboxMessages = [];
  promptState.setupAreas = ["rules", "mcps"];
  const homeDir = localHomeWithMcpManifest();
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "AGENTS.md"), "# Codex\n");

  const selection = await selectSetup(defaultOptions(homeDir));

  assert.deepEqual(selection.areas, ["rules", "mcps"]);
  assert.deepEqual(selection.agents, ["codex"]);
  assert.equal(selection.agentSource, "detected");
  assert.ok(!promptState.checkboxMessages.includes("Choose agents for rules and MCPs"));
});

test("selectSetup yes mode uses detected targets", async () => {
  promptState.checkboxMessages = [];
  const homeDir = localHomeWithAllManifests();
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");
  const selection = await selectSetup({ ...defaultOptions(homeDir), yes: true });

  assert.deepEqual(selection.agents, ["codex"]);
  assert.deepEqual(selection.hookAgents, ["codex"]);
  assert.equal(selection.agentSource, "detected");
  assert.equal(selection.hookAgentSource, "detected");
  assert.ok(!promptState.checkboxMessages.includes("Choose agents for rules and MCPs"));
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

function localHomeWithAllManifests(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  const manifests: Record<string, unknown> = {
    "skills.json": { version: 1, defaultSource: "", items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "local", url: "rules/AGENTS.md" },
    "utils.json": { version: 1, items: [] },
    "hooks.json": {
      version: 1,
      items: [
        {
          id: "afk-execution-tracking-stop-check",
          label: "AFK execution tracking stop check",
          description: "Check active AFK tracking before stopping.",
          source: "hooks/afk-execution-tracking-stop-check.js",
          command: "node",
          args: ["${HOOK_FILE}"],
          events: ["stop"],
          agents: ["codex", "claude", "cursor-local"],
          default: true,
        },
      ],
    },
  };

  for (const [name, content] of Object.entries(manifests)) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }

  return homeDir;
}
