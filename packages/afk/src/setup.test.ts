import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { builtInDefaultsSource, localManifestDir } from "./manifest.js";
import { runArea, runSetup } from "./setup.js";
import { skillCatalogPath } from "./skills/catalog.js";
import type { SetupSelection } from "./interactive.js";
import type { CliOptions, Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  selection: undefined as SetupSelection | undefined,
  defaultsSource: "local",
  rememberedSources: [] as string[],
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
    selectDefaultsSource: vi.fn(async (rememberedSource: string) => {
      promptState.rememberedSources.push(rememberedSource);
      return promptState.defaultsSource;
    }),
  };
});

test("runSetup keeps prompted rule targets out of plugin defaults", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.selection = {
    areas: ["rules", "plugins"],
    agents: ["codex"],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    pluginIds: ["rtk"],
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
    pluginIds: [],
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
    pluginIds: [],
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

  const code = await runArea("rules", fakeRuntime(output), { ...defaultOptions(homeDir, repoDir), yes: true, defaultsSource: "local", defaultsSourceExplicit: true });
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

  const code = await runArea("mcps", fakeRuntime(output), { ...defaultOptions(homeDir, repoDir), yes: true, verbose: true, defaultsSource: "local", defaultsSourceExplicit: true });
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("add-mcp"));
  assert.ok(text.includes("-a codex"));
});

test("runSetup prepares manifests only once before running selected areas", async () => {
  const homeDir = localHomeWithManifests();
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.defaultsSource = "local";
  promptState.selection = {
    areas: ["rules", "plugins"],
    agents: ["codex"],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    pluginIds: ["rtk"],
    hookIds: [],
  };

  const code = await runSetup(fakeRuntime(output), defaultOptions(homeDir, repoDir));
  const localManifestHeadings = output.filter((line) => line.includes("Local Catalog"));

  assert.equal(code, 0);
  assert.equal(localManifestHeadings.length, 1);
});

test("runArea skills adds selected setup skills to AFK skill catalog after install", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "alpha",
          label: "Alpha",
          source: "example/skills",
          args: ["--skill", "alpha"],
          default: false,
        },
        {
          id: "beta",
          label: "Beta",
          source: "example/skills",
          args: ["--skill", "beta"],
          default: false,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const output: string[] = [];
  const spawned: Array<{ command: string; args: string[] }> = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (command, args) => {
      spawned.push({ command, args });
      return { code: 0 };
    },
  };

  const code = await runArea("skills", runtime, {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    setupManifestsPrepared: true,
    selectedSkillIds: ["beta"],
    selectedSkillAgentIds: ["claude-code"],
    defaultsSource: "local",
    defaultsSourceExplicit: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["skills", "add", "example/skills", "--global", "--yes", "--skill", "beta", "--agent", "claude-code"],
  }]);
  const catalog = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    skills: Array<{ folder: string; scope: string }>;
  };
  assert.deepEqual(catalog.skills, [{ folder: "beta", scope: "uncategorized" }]);
});

test("runSetup skips the source prompt when a default source is saved", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "acme/saved-kit", presets: [] },
  });
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.rememberedSources = [];
  promptState.selection = {
    areas: [],
    agents: [],
    hookAgents: [],
    setupScope: "global",
    skillIds: [],
    skillAgents: [],
    mcpIds: [],
    pluginIds: [],
    hookIds: [],
  };

  const options = {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    rulesSource: "github" as const,
  };
  const code = await runSetup(fakeRuntime(output), options);
  const presets = JSON.parse(readFileSync(join(localManifestDir(homeDir), "presets.json"), "utf8")) as { defaultsSource: string };

  assert.equal(code, 0);
  assert.deepEqual(promptState.rememberedSources, []);
  assert.equal(presets.defaultsSource, "acme/saved-kit");
});

test("runArea prompts for a source only on first-run interactive setup areas", async () => {
  const areas = ["rules", "skills", "mcps", "plugins", "hooks"] as const;

  for (const area of areas) {
    const homeDir = localHomeWithManifests();
    const repoDir = localRepoWithRules();
    const output: string[] = [];

    promptState.defaultsSource = "local";
    promptState.rememberedSources = [];

    const code = await runArea(area, fakeRuntime(output), {
      ...defaultOptions(homeDir, repoDir),
      agents: ["codex"],
      selectedSkillIds: area === "skills" ? ["afk-note"] : [],
      selectedMcpIds: area === "mcps" ? ["stitch"] : [],
      selectedPluginIds: area === "plugins" ? ["rtk"] : [],
      selectedHookIds: area === "hooks" ? ["afk-typescript-typecheck-stop-check"] : [],
    });

    assert.equal(code, 0);
    assert.deepEqual(promptState.rememberedSources, [builtInDefaultsSource], area);
  }
});

test("runArea uses explicit source manifests without writing cache before installing selected skills", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "remote-skill",
          label: "Stale Skill",
          source: "stale/source",
          args: ["--skill", "stale-skill"],
          default: false,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const sourceDir = localDefaultsSource({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "remote-skill",
          label: "Remote Skill",
          source: "remote/source",
          args: ["--skill", "remote-skill"],
          default: false,
        },
      ],
    },
  });
  const output: string[] = [];
  const commands: Array<{ command: string; args: string[] }> = [];

  const code = await runArea("skills", {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (command, args) => {
      commands.push({ command, args });
      return { code: 0 };
    },
  }, {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    rulesSource: "github",
    defaultsSource: sourceDir,
    defaultsSourceExplicit: true,
    selectedSkillIds: ["remote-skill"],
  });

  assert.equal(code, 0);
  assert.equal(commands[0]?.command, "npx");
  assert.deepEqual(commands[0]?.args, ["skills", "add", "remote/source", "--global", "--yes", "--skill", "remote-skill"]);
  assert.ok(!output.join("\n").includes("Local catalog prepared"));
  const cached = readFileSync(join(localManifestDir(homeDir), "skills.json"), "utf8");
  assert.ok(cached.includes("stale/source"));
  assert.ok(!cached.includes("remote/source"));
});

test("runArea dry-run uses explicit source manifests without cache writes", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "remote-skill",
          label: "Stale Skill",
          source: "stale/source",
          args: ["--skill", "stale-skill"],
          default: false,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const sourceDir = localDefaultsSource({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "remote-skill",
          label: "Remote Skill",
          source: "remote/source",
          args: ["--skill", "remote-skill"],
          default: false,
        },
      ],
    },
  });
  const output: string[] = [];

  const code = await runArea("skills", fakeRuntime(output), {
    ...defaultOptions(homeDir, repoDir),
    rulesSource: "github",
    defaultsSource: sourceDir,
    defaultsSourceExplicit: true,
    selectedSkillIds: ["remote-skill"],
  });
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("$ npx skills add remote/source --global --yes --skill remote-skill"));
  assert.ok(!text.includes("stale/source"));
});

test("runSetup with --yes uses a saved default source without prompting", async () => {
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: localDefaultsSource(), presets: [] },
  });
  const repoDir = localRepoWithRules();
  const output: string[] = [];

  promptState.rememberedSources = [];
  const code = await runSetup(fakeRuntime(output), {
    ...defaultOptions(homeDir, repoDir),
    yes: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(promptState.rememberedSources, []);
  assert.ok(!output.join("\n").includes("RTK / init"));
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
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
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
    "plugins.json": {
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

  for (const [name, content] of Object.entries({ ...manifests, ...overrides })) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }

  return homeDir;
}

function localDefaultsSource(overrides: Record<string, unknown> = {}): string {
  const sourceDir = mkdtempSync(join(tmpdir(), "afk-default-source-"));
  const manifestDir = join(sourceDir, "afk", "catalog");
  mkdirSync(manifestDir, { recursive: true });

  const manifests: Record<string, unknown> = {
    "skills.json": { version: 1, defaultSource: "", items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "github", url: "" },
    "plugins.json": { version: 1, items: [] },
    "hooks.json": { version: 1, items: [] },
    ...overrides,
  };

  for (const [name, content] of Object.entries(manifests)) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }

  return sourceDir;
}

function localRepoWithRules(): string {
  const repoDir = mkdtempSync(join(tmpdir(), "afk-setup-repo-"));
  mkdirSync(join(repoDir, "rules"), { recursive: true });
  writeFileSync(join(repoDir, "rules", "AGENTS.md"), "# AFK rules\n");
  return repoDir;
}
