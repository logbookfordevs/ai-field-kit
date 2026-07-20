import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: "local", presets: [] },
  });
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
    pluginIds: ["sample-plugin"],
    hookIds: [],
  };

  const code = await runSetup(fakeRuntime(output), defaultOptions(homeDir, repoDir));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("- Rules targets: codex"));
  assert.ok(text.includes("/.codex/AGENTS.md"));
  assert.ok(!text.includes("/.gemini/GEMINI.md"));
  assert.ok(text.includes("Sample Plugin / install"));
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
    pluginIds: ["sample-plugin"],
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
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false,
    defaultsSource: "local",
    defaultsSourceExplicit: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["skills", "add", "example/skills", "--global", "--yes", "--skill", "beta", "--agent", "universal", "--agent", "claude-code"],
  }]);
  const catalog = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    items: Array<{ id: string; catalog?: { scope?: string } }>;
  };
  assert.deepEqual(
    catalog.items.map((item) => ({ id: item.id, scope: item.catalog?.scope })),
    [
      { id: "alpha", scope: undefined },
      { id: "beta", scope: "uncategorized" },
    ],
  );
});

test("runArea agents requires an explicit non-interactive selection", async () => {
  const homeDir = localHomeWithManifests({
    "agents.json": {
      version: 1,
      items: [{ id: "notion_assistant", label: "Notion Assistant", source: "/tmp/not-used.md" }],
    },
  });
  const output: string[] = [];

  const code = await runArea("agents", fakeRuntime(output), {
    ...defaultOptions(homeDir, localRepoWithRules()),
    agents: ["codex"],
    yes: true,
    setupManifestsPrepared: true,
    allCustomAgents: false,
    selectedCustomAgentIds: [],
  });

  assert.equal(code, 1);
  assert.ok(output.some((line) => line.includes("--custom-agent <id>, or use --all")));
});

test("runArea skills moves start-disabled skills into disabled storage after install", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "quiet-skill",
          label: "Quiet Skill",
          source: "example/skills",
          args: ["--skill", "quiet-skill"],
          default: true,
          startDisabled: true,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      const skillDir = join(homeDir, ".agents", "skills", "quiet-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "---\nname: quiet-skill\n---\n\n# Quiet\n");
      return { code: 0 };
    },
  };

  const code = await runArea("skills", runtime, {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    setupManifestsPrepared: true,
    yes: true,
    defaultsSource: "local",
    defaultsSourceExplicit: true,
  });

  assert.equal(code, 0);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "quiet-skill")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "quiet-skill")), true);
  assert.ok(output.join("\n").includes("Skill startup storage synced"));
});

test("runArea skills preserves manually disabled skills after upstream reinstall", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [
        {
          id: "quiet-skill",
          label: "Quiet Skill",
          source: "example/skills",
          args: ["--skill", "quiet-skill"],
          default: true,
          startDisabled: false,
        },
      ],
    },
  });
  const repoDir = localRepoWithRules();
  const disabledDir = join(homeDir, ".agents", "skills", ".disabled", "quiet-skill");
  mkdirSync(disabledDir, { recursive: true });
  writeFileSync(join(disabledDir, "SKILL.md"), "---\nname: quiet-skill\n---\n\n# Old Quiet\n");
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      const activeDir = join(homeDir, ".agents", "skills", "quiet-skill");
      mkdirSync(activeDir, { recursive: true });
      writeFileSync(join(activeDir, "SKILL.md"), "---\nname: quiet-skill\n---\n\n# Fresh Quiet\n");
      return { code: 0 };
    },
  };

  const code = await runArea("skills", runtime, {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    setupManifestsPrepared: true,
    yes: true,
    defaultsSource: "local",
    defaultsSourceExplicit: true,
  });

  assert.equal(code, 0);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "quiet-skill")), false);
  assert.equal(existsSync(disabledDir), true);
  assert.match(readFileSync(join(disabledDir, "SKILL.md"), "utf8"), /Fresh Quiet/);
});

test("runArea skills reconciles newly installed skills against an enabled focus profile", async () => {
  const homeDir = localHomeWithManifests({
    "skills.json": {
      version: 1,
      defaultSource: "",
      items: [{
        id: "new-skill",
        label: "New Skill",
        source: "example/skills",
        args: ["--skill", "new-skill"],
        default: true,
      }],
    },
    "profiles.json": {
      version: 1,
      mode: "strict",
      alwaysOn: [],
      items: [{ id: "video", name: "Video", skills: ["video-skill"] }],
    },
  });
  const stateDir = join(homeDir, ".agents", "afk", "state");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "skill-profiles.json"), `${JSON.stringify({
    version: 2,
    activations: [{ profileId: "video", mode: "focus" }],
    profileMovedSkills: [],
    preExistingDisabledSkills: [],
  }, null, 2)}\n`);
  const repoDir = localRepoWithRules();
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      const activeDir = join(homeDir, ".agents", "skills", "new-skill");
      mkdirSync(activeDir, { recursive: true });
      writeFileSync(join(activeDir, "SKILL.md"), "---\nname: new-skill\n---\n\n# New Skill\n");
      return { code: 0 };
    },
  };

  const code = await runArea("skills", runtime, {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    setupManifestsPrepared: true,
    yes: true,
    defaultsSource: "local",
    defaultsSourceExplicit: true,
  });

  assert.equal(code, 0);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "new-skill")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "new-skill")), true);
  const state = JSON.parse(readFileSync(join(stateDir, "skill-profiles.json"), "utf8")) as { profileMovedSkills: string[] };
  assert.deepEqual(state.profileMovedSkills, ["new-skill"]);
  assert.ok(output.join("\n").includes("Focus profile storage reconciled: disabled new-skill."));
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
  const areas = ["rules", "skills", "profiles", "mcps", "plugins", "hooks"] as const;

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
      selectedPluginIds: area === "plugins" ? ["sample-plugin"] : [],
      selectedHookIds: area === "hooks" ? ["afk-typescript-typecheck-stop-check"] : [],
    });

    assert.equal(code, 0);
    assert.deepEqual(promptState.rememberedSources, [builtInDefaultsSource], area);
  }
});

test("runArea profiles prepares the profile catalog from the saved setup source", async () => {
  const sourceDir = localDefaultsSource({
    "profiles.json": {
      version: 1,
      mode: "context",
      alwaysOn: ["afk-doc-craft"],
      items: [{ id: "context", name: "Context", skills: ["afk-doc-craft"] }],
    },
  });
  const homeDir = localHomeWithManifests({
    "presets.json": { version: 1, defaultsSource: sourceDir, presets: [] },
  });
  const repoDir = localRepoWithRules();
  const profilesPath = join(localManifestDir(homeDir), "profiles.json");
  rmSync(profilesPath);
  const output: string[] = [];

  promptState.rememberedSources = [];
  const code = await runArea("profiles", fakeRuntime(output), {
    ...defaultOptions(homeDir, repoDir),
    dryRun: false,
    rulesSource: "github",
  });
  const text = output.join("\n");
  const profiles = JSON.parse(readFileSync(profilesPath, "utf8")) as { mode?: string; alwaysOn?: string[] };

  assert.equal(code, 0);
  assert.equal(profiles.mode, "context");
  assert.deepEqual(profiles.alwaysOn, ["afk-doc-craft"]);
  assert.deepEqual(promptState.rememberedSources, []);
  assert.ok(text.includes("Profile catalog prepared."));
  assert.ok(text.includes(profilesPath));
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
  assert.deepEqual(commands[0]?.args, ["skills", "add", "remote/source", "--global", "--yes", "--skill", "remote-skill", "--agent", "universal"]);
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
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false,
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
    "profiles.json": { version: 1, mode: "strict", alwaysOn: [], items: [] },
    "agents.json": { version: 1, items: [] },
    "mcps.json": { version: 1, items: [] },
    "presets.json": { version: 1, defaultsSource: "", presets: [] },
    "rules.json": { version: 1, source: "local", url: "rules/AGENTS.md" },
    "plugins.json": {
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
    "profiles.json": { version: 1, mode: "strict", alwaysOn: [], items: [] },
    "agents.json": { version: 1, items: [] },
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
