import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { localManifestDir } from "./manifest.js";
import { runArea, runSetup } from "./setup.js";
import type { SetupSelection } from "./interactive.js";
import type { CliOptions, Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  selection: undefined as SetupSelection | undefined,
}));

vi.mock("./interactive.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./interactive.js")>();
  return {
    ...actual,
    selectSetup: vi.fn(async () => {
      if (!promptState.selection) {
        throw new Error("Missing mocked setup selection");
      }

      return promptState.selection;
    }),
  };
});

test("runSetup keeps prompted rule targets out of utility defaults", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.selection = {
    areas: ["rules", "utils"],
    agents: ["codex"],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: ["rtk"],
    hookIds: [],
  };

  const code = await runSetup(fakeRuntime(output), defaultOptions(homeDir, repoDir));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("- Rules targets: codex"));
  assert.ok(text.includes("/.codex/AGENTS.md"));
  assert.ok(!text.includes("/.gemini/GEMINI.md"));
  assert.ok(text.includes("RTK / init Antigravity"));
  assert.ok(text.includes("RTK / init Claude Code"));
  assert.ok(text.includes("RTK / init Codex"));
  assert.ok(text.includes("RTK / init OpenCode"));
});

test("runSetup labels detected targets in the setup summary", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.selection = {
    areas: ["rules"],
    agents: ["codex"],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    utilIds: [],
    hookIds: [],
    agentSource: "detected",
  };

  const code = await runSetup(fakeRuntime(output), defaultOptions(homeDir, repoDir));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("- Detected rules targets: codex"));
});

test("runSetup explains selected MCPs without targets", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.selection = {
    areas: ["mcps"],
    agents: [],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: ["stitch"],
    utilIds: [],
    hookIds: [],
  };

  const code = await runSetup(fakeRuntime(output), defaultOptions(homeDir, repoDir));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("MCPs"));
  assert.ok(text.includes("No MCP targets selected. Skipping MCP install."));
});

test("runArea yes mode detects rule targets before syncing", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");

  const code = await runArea("rules", fakeRuntime(output), { ...defaultOptions(homeDir, repoDir), yes: true });
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("/.codex/AGENTS.md"));
  assert.ok(!text.includes("/.gemini/GEMINI.md"));
});

test("runArea yes mode detects MCP targets before delegating", async () => {
  const homeDir = localHomeWithManifests({
    "mcps.json": {
      version: 1,
      items: [
        {
          id: "stitch",
          label: "Stitch MCP",
          source: "https://stitch.googleapis.com/mcp",
          args: ["--name", "stitchmcp"],
          default: true,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const output: string[] = [];
  mkdirSync(join(homeDir, ".codex"), { recursive: true });
  writeFileSync(join(homeDir, ".codex", "config.toml"), "");

  const code = await runArea("mcps", fakeRuntime(output), { ...defaultOptions(homeDir, repoDir), yes: true, verbose: true });
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("add-mcp"));
  assert.ok(text.includes("-a codex"));
});

function fakeRuntime(output: string[]): Runtime {
  return {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      throw new Error("Dry-run setup should not spawn commands");
    },
  };
}

function defaultOptions(homeDir: string, repoDir: string): CliOptions {
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
    repoDir,
    cwd: "/tmp/project",
  };
}

function localHomeWithManifests(overrides: Record<string, unknown> = {}): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-setup-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });

  const manifests: Record<string, unknown> = {
    "skills.json": { version: 1, defaultSource: "", items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "local", url: "rules/AGENTS.md" },
    "utils.json": {
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
    },
    "hooks.json": { version: 1, items: [] },
    ...overrides,
  };

  for (const [name, content] of Object.entries(manifests)) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }

  return homeDir;
}

function localRepoWithRules(): string {
  const repoDir = mkdtempSync(join(tmpdir(), "afk-setup-repo-"));
  mkdirSync(join(repoDir, "rules"), { recursive: true });
  writeFileSync(join(repoDir, "rules", "AGENTS.md"), "# AFK rules\n");
  return repoDir;
}
