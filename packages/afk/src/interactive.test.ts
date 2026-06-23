import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { normalizeSetupSelection, selectDefaultsSource, selectMcpsInstall, selectRulesSync, selectSetup, selectPluginsInstall, selectSkillsInstall } from "./interactive.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions } from "./types.js";

const promptState = vi.hoisted(() => ({
  checkboxMessages: [] as string[],
  checkboxChoices: {} as Record<string, Array<{ name?: string; value?: string; checked?: boolean; description?: string }>>,
  checkboxResponses: {} as Record<string, string[]>,
  setupAreas: ["plugins"] as string[],
  inputCalls: [] as Array<{ default: string | undefined; required: boolean | undefined; validateResult: true | string }>,
}));

vi.mock("@inquirer/prompts", () => ({
  checkbox: vi.fn(async ({ message, choices }: { message: string; choices?: Array<{ name?: string; value?: string; checked?: boolean; description?: string }> }) => {
    promptState.checkboxMessages.push(message);
    promptState.checkboxChoices[message] = choices ?? [];
    if (message in promptState.checkboxResponses) {
      return promptState.checkboxResponses[message];
    }

    if (message === "Choose what AFK should prepare") {
      return promptState.setupAreas;
    }

    if (message === "Choose agents for rules" || message === "Choose agents for MCPs" || message === "Choose agents for rules and MCPs") {
      return ["codex"];
    }

    if (message === "Choose MCPs to install") {
      return ["stitch"];
    }

    if (message === "Choose plugins to install") {
      return ["sample-plugin"];
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
    pluginIds: [],
    hookIds: [],
  });

  assert.deepEqual(selection.areas, ["rules"]);
});

test("normalizeSetupSelection keeps item areas when at least one item is selected", () => {
  const selection = normalizeSetupSelection({
    areas: ["skills", "mcps", "plugins"],
    agents: [],
    hookAgents: [],
    setupScope: "project",
    skillIds: ["afk-note"],
    skillAgents: ["kiro-cli"],
    mcpIds: ["stitch"],
    pluginIds: ["sample-plugin"],
    hookIds: [],
  });

  assert.deepEqual(selection.areas, ["skills", "mcps", "plugins"]);
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
    pluginIds: [],
    hookIds: ["afk-typescript-typecheck-stop-check"],
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
    pluginIds: [],
    hookIds: ["afk-typescript-typecheck-stop-check"],
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
    pluginIds: [],
    hookIds: ["afk-typescript-typecheck-stop-check"],
  });

  assert.deepEqual(selection.agents, ["cursor-local"]);
  assert.deepEqual(selection.hookAgents, ["cursor-local"]);
});

test("selectSetup does not ask for agent targets when only plugins are selected", async () => {
  promptState.checkboxMessages = [];
  promptState.setupAreas = ["plugins"];
  const selection = await selectSetup(defaultOptions(localHomeWithPluginManifest()));

  assert.deepEqual(selection.areas, ["plugins"]);
  assert.deepEqual(selection.pluginIds, ["sample-plugin"]);
  assert.deepEqual(selection.agents, []);
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectPluginsInstall does not ask for agent targets when installing plugins", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectPluginsInstall(defaultOptions(localHomeWithPluginManifest()));

  assert.deepEqual(selection.pluginIds, ["sample-plugin"]);
  assert.deepEqual(selection.agents, []);
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectPluginsInstall returns no plugins when the catalog has no plugin choices", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectPluginsInstall(defaultOptions(localHomeWithEmptyPluginManifest()));

  assert.deepEqual(selection.pluginIds, []);
  assert.deepEqual(selection.agents, []);
  assert.ok(!promptState.checkboxMessages.includes("Choose plugins to install"));
});

test("selectRulesSync asks for rules-specific agent targets", async () => {
  promptState.checkboxMessages = [];
  const selection = await selectRulesSync(defaultOptions(localHomeWithPluginManifest()));

  assert.deepEqual(selection.agents, ["codex"]);
  assert.ok(promptState.checkboxMessages.includes("Choose agents for rules"));
  assert.ok(!promptState.checkboxMessages.includes("Choose agent targets"));
});

test("selectRulesSync uses detected targets without asking", async () => {
  promptState.checkboxMessages = [];
  const homeDir = localHomeWithPluginManifest();
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
  assert.deepEqual(selection.skillIds, ["afk-default"]);
  assert.equal(selection.agentSource, "detected");
  assert.equal(selection.hookAgentSource, "detected");
  assert.ok(!promptState.checkboxMessages.includes("Choose agents for rules and MCPs"));
});

test("selectSetup yes mode includes all skills when requested", async () => {
  const homeDir = localHomeWithAllManifests();
  const selection = await selectSetup({ ...defaultOptions(homeDir), yes: true, allSkills: true });

  assert.deepEqual(selection.skillIds, ["afk-default", "afk-spline", "external-helper"]);
});

test("selectSetup guided mode includes all skills when requested", async () => {
  promptState.checkboxMessages = [];
  promptState.checkboxResponses = {};
  promptState.setupAreas = ["skills"];
  const homeDir = localHomeWithAllManifests();
  const selection = await selectSetup({ ...defaultOptions(homeDir), allSkills: true });

  assert.deepEqual(selection.skillIds, ["afk-default", "afk-spline", "external-helper"]);
  assert.ok(!promptState.checkboxMessages.includes("Choose skills to install"));
});

test("selectSkillsInstall presents composed skills for selected wrappers", async () => {
  promptState.checkboxMessages = [];
  promptState.checkboxChoices = {};
  promptState.checkboxResponses = {
    "Choose skills to install": ["afk-code-grill"],
    "Choose composed skills to include": ["grilling", "truss-evaluation"],
  };
  const homeDir = localHomeWithComposedSkillManifest();
  const selection = await selectSkillsInstall(defaultOptions(homeDir));

  assert.deepEqual(selection.skillIds, ["afk-code-grill", "grilling", "truss-evaluation"]);
  assert.ok(promptState.checkboxMessages.includes("Choose composed skills to include"));
  assert.deepEqual(
    promptState.checkboxChoices["Choose composed skills to include"]?.map((choice) => [choice.value, choice.checked]),
    [["grilling", true], ["truss-evaluation", true]],
  );
  assert.match(
    promptState.checkboxChoices["Choose composed skills to include"]?.find((choice) => choice.value === "grilling")?.description ?? "",
    /Composed by AFK - Code Grill \(wrapper\)/,
  );
  assert.match(
    promptState.checkboxChoices["Choose skills to install"]?.find((choice) => choice.value === "afk-code-grill")?.description ?? "",
    /role: wrapper · auto-invocation: off/,
  );
  assert.match(
    promptState.checkboxChoices["Choose composed skills to include"]?.find((choice) => choice.value === "grilling")?.description ?? "",
    /role: primitive · auto-invocation: on/,
  );
});

test("selectSetup yes mode includes composed skills for default wrappers", async () => {
  promptState.checkboxMessages = [];
  promptState.checkboxResponses = {};
  const homeDir = localHomeWithComposedSkillManifest();
  const selection = await selectSetup({ ...defaultOptions(homeDir), yes: true });

  assert.deepEqual(selection.skillIds, ["afk-code-grill", "grilling", "truss-evaluation"]);
});

test("selectSkillsInstall keeps the skill list flat", async () => {
  promptState.checkboxMessages = [];
  promptState.checkboxChoices = {};
  promptState.checkboxResponses = {
    "Choose skills to install": [],
  };
  const homeDir = localHomeWithRepeatedComposedChildrenManifest();
  await selectSkillsInstall(defaultOptions(homeDir));

  const names = promptState.checkboxChoices["Choose skills to install"]?.map((choice) => choice.name) ?? [];
  assert.ok(!names.some((name) => name?.includes("->")));
  assert.equal(names.filter((name) => name === "Grilling").length, 1);
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
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    startDisabledSkills: false,
    selectedMcpIds: [],
    selectedPluginIds: [],
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
    manifestShowReact: false,
    manifestShowVisualize: false,
    selectedManifestCategories: [],
    homeDir,
    repoDir: "/tmp/repo",
    cwd: "/tmp/project",
  };
}

function localHomeWithPluginManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "plugins.json"),
    `${JSON.stringify({
      version: 1,
      items: [
        {
          id: "sample-plugin",
          label: "Sample Plugin",
          description: "Sample plugin install.",
          install: { command: "sh", args: ["-c", "install-sample-plugin"] },
          default: true,
        },
      ],
    }, null, 2)}\n`,
  );
  return homeDir;
}

function localHomeWithEmptyPluginManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "plugins.json"), `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`);
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
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "afk-default",
          label: "AFK - Default",
          source: "https://github.com/example/afk",
          args: ["--skill", "afk-default", "--global"],
          default: true,
        },
        {
          id: "afk-spline",
          label: "AFK - Spline",
          source: "https://github.com/example/afk",
          args: ["--skill", "afk-spline", "--global"],
          default: false,
        },
        {
          id: "external-helper",
          label: "Helper",
          source: "https://github.com/example/external",
          args: ["--skill", "external-helper", "--global"],
          default: false,
        },
      ],
    },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "local", url: "rules/AGENTS.md" },
    "plugins.json": { version: 1, items: [] },
    "hooks.json": {
      version: 1,
      items: [
        {
          id: "afk-typescript-typecheck-stop-check",
          label: "AFK TypeScript typecheck stop check",
          description: "Run TypeScript typecheck before stopping.",
          source: "hooks/afk-typescript-typecheck-stop-check.js",
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

function localHomeWithComposedSkillManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "skills.json"),
    `${JSON.stringify({
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "afk-code-grill",
          label: "AFK - Code Grill",
          source: "https://github.com/example/afk",
          args: ["--skill", "afk-code-grill", "--global"],
          default: true,
          autoInvocation: false,
          role: "wrapper",
          composes: ["grilling", "truss-evaluation"],
        },
        {
          id: "grilling",
          label: "Grilling",
          source: "https://github.com/example/external",
          args: ["--skill", "grilling", "--global"],
          default: false,
          autoInvocation: true,
          role: "primitive",
          composes: [],
        },
        {
          id: "truss-evaluation",
          label: "Truss Evaluation",
          source: "https://github.com/example/truss",
          args: ["--skill", "truss-evaluation", "--global"],
          default: false,
          autoInvocation: true,
          role: "primitive",
          composes: [],
        },
      ],
    }, null, 2)}\n`,
  );
  writeFileSync(join(manifestDir, "mcps.json"), `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "plugins.json"), `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "hooks.json"), `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "rules.json"), `${JSON.stringify({ version: 1, source: "local", url: "rules/AGENTS.md" }, null, 2)}\n`);
  writeFileSync(join(manifestDir, "presets.json"), `${JSON.stringify({ version: 1, defaultsSource: "", presets: [] }, null, 2)}\n`);
  return homeDir;
}

function localHomeWithRepeatedComposedChildrenManifest(): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-interactive-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(
    join(manifestDir, "skills.json"),
    `${JSON.stringify({
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "grill-me",
          label: "Grill Me",
          source: "https://github.com/example/external",
          args: ["--skill", "grill-me", "--global"],
          default: false,
          autoInvocation: false,
          role: "wrapper",
          composes: ["grilling"],
        },
        {
          id: "grill-with-docs",
          label: "Grill With Docs",
          source: "https://github.com/example/external",
          args: ["--skill", "grill-with-docs", "--global"],
          default: false,
          autoInvocation: false,
          role: "wrapper",
          composes: ["grilling", "domain-modeling"],
        },
        {
          id: "grilling",
          label: "Grilling",
          source: "https://github.com/example/external",
          args: ["--skill", "grilling", "--global"],
          default: false,
          autoInvocation: true,
          role: "primitive",
          composes: [],
        },
        {
          id: "domain-modeling",
          label: "Domain Modeling",
          source: "https://github.com/example/external",
          args: ["--skill", "domain-modeling", "--global"],
          default: false,
          autoInvocation: true,
          role: "primitive",
          composes: [],
        },
      ],
    }, null, 2)}\n`,
  );
  return homeDir;
}
