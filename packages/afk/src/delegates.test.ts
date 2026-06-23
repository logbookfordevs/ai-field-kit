import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { buildMcpCommands, buildSkillCommands, buildPluginCommands, runDelegateCommands, type DelegateCommand } from "./delegates.js";
import { localManifestDir } from "./manifest.js";
import type { CliOptions, Runtime } from "./types.js";

const defaultHomeDir = localHomeWithManifests({
  "skills.json": {
    version: 1,
    defaultSource: "https://github.com/logbookfordevs/ai-field-kit",
    items: [
      {
        id: "afk-note",
        label: "AFK / Note",
        source: "https://github.com/logbookfordevs/ai-field-kit",
        args: ["--skill", "afk-note", "--global"],
        default: true,
        autoInvocation: true,
      },
    ],
  },
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
  "plugins.json": {
    version: 1,
    items: [
      {
        id: "plannotator",
        label: "Plannotator",
        description: "Review and annotate plans before implementation.",
        install: { command: "bash", args: ["-c", "curl -fsSL https://plannotator.ai/install.sh | bash -s -- --no-extras --model-invocable none"] },
        default: true,
      },
      {
        id: "sample-plugin",
        label: "Sample Plugin",
        description: "Sample plugin install.",
        install: { command: "sh", args: ["-c", "install-sample-plugin"] },
        default: true,
      },
    ],
  },
});

const options: CliOptions = {
  agents: ["codex"],
  setupScope: "global",
  scopeExplicit: true,
  dryRun: true,
  verbose: false,
  yes: true,
  allSkills: false,
  selectedSkillIds: [],
  selectedSkillAgentIds: [],
    skillAddArgs: [],
  skillAddProfileIds: [],
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
  homeDir: defaultHomeDir,
  repoDir: "/tmp/repo",
  cwd: "/tmp/project",
};

test("buildSkillCommands uses the official skills CLI", () => {
  const commands = buildSkillCommands(options);
  assert.equal(commands[0]?.command, "npx");
  assert.deepEqual(commands[0]?.args.slice(0, 3), ["skills", "add", "https://github.com/logbookfordevs/ai-field-kit"]);
  assert.ok(commands[0]?.args.includes("--global"));
  assert.ok(commands[0]?.args.includes("--yes"));
  assert.ok(commands[0]?.args.includes("--skill"));
  assert.ok(commands[0]?.args.includes("afk-note"));
  assert.ok(!commands[0]?.args.includes("--copy"));
});

test("buildSkillCommands omits global scope for project installs", () => {
  const commands = buildSkillCommands({ ...options, setupScope: "project" });
  assert.ok(!commands[0]?.args.includes("--global"));
  assert.ok(commands[0]?.args.includes("--yes"));
});

test("buildSkillCommands omits skill filter for whole-source skill entries", () => {
  const homeDir = localHomeWithManifest("skills.json", {
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "whole-source",
        label: "Whole Source",
        source: "https://github.com/example/skill-pack",
        args: [],
        default: true,
      },
    ],
  });
  const commands = buildSkillCommands({ ...options, homeDir, selectedSkillIds: ["whole-source"] });

  assert.ok(commands.some((command) => (
    command.args.includes("https://github.com/example/skill-pack") &&
    !command.args.includes("--skill")
  )));
});

test("buildSkillCommands all installs default and non-default skills", () => {
  const homeDir = localHomeWithManifest("skills.json", {
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "afk-default",
        label: "AFK / Default",
        source: "https://github.com/example/afk",
        args: ["--skill", "afk-default", "--global"],
        default: true,
      },
      {
        id: "afk-spline",
        label: "AFK / Spline",
        source: "https://github.com/example/afk",
        args: ["--skill", "afk-spline", "--global"],
        default: false,
      },
      {
        id: "external-helper",
        label: "External / Helper",
        source: "https://github.com/example/external",
        args: ["--skill", "external-helper", "--global"],
        default: false,
      },
    ],
  });

  const commands = buildSkillCommands({ ...options, homeDir, allSkills: true });
  const text = commands.map((command) => command.args.join(" ")).join("\n");

  assert.ok(text.includes("afk-default"));
  assert.ok(text.includes("afk-spline"));
  assert.ok(text.includes("external-helper"));
});

test("buildSkillCommands does not add a duplicate Claude-only install", () => {
  const commands = buildSkillCommands({ ...options, agents: ["codex", "claude"] });
  assert.equal(commands.length, 1);
  assert.ok(!commands[0]?.args.includes("--agent"));
  assert.ok(!commands[0]?.args.includes("claude-code"));
});

test("buildSkillCommands relies on the skills CLI default symlink fanout", () => {
  const commands = buildSkillCommands({ ...options, agents: [] });
  assert.equal(commands.length, 1);
  assert.ok(commands[0]?.args.includes("--yes"));
  assert.ok(!commands[0]?.args.includes("--copy"));
  assert.ok(!commands[0]?.args.includes("--agent"));
});

test("buildSkillCommands passes additional skill agents to the skills CLI", () => {
  const commands = buildSkillCommands({ ...options, selectedSkillAgentIds: ["claude-code", "kiro-cli", "kilo", "pi", "droid"] });

  assert.deepEqual(
    commands[0]?.args.filter((arg, index, args) => arg === "--agent" || args[index - 1] === "--agent"),
    ["--agent", "claude-code", "--agent", "kiro-cli", "--agent", "kilo", "--agent", "pi", "--agent", "droid"],
  );
});

test("buildMcpCommands uses add-mcp with mapped agents", () => {
  const commands = buildMcpCommands(options);
  const first = commands[0];
  assert.equal(first?.command, "npx");
  assert.equal(first?.args[0], "add-mcp");
  assert.ok(first?.args.includes("-g"));
  assert.ok(first?.args.includes("-a"));
  assert.ok(first?.args.includes("codex"));
  assert.ok(first?.args.includes("-y"));
});

test("buildMcpCommands omits global scope for project installs", () => {
  const commands = buildMcpCommands({ ...options, setupScope: "project" });
  assert.ok(!commands[0]?.args.includes("-g"));
  assert.ok(commands[0]?.args.includes("-a"));
  assert.ok(commands[0]?.args.includes("codex"));
});

test("buildMcpCommands skips upstream confirmation after AFK MCP selection", () => {
  const commands = buildMcpCommands({
    ...options,
    yes: false,
    selectedMcpIds: ["stitch"],
  });

  assert.ok(commands[0]?.args.includes("-y"));
});

test("buildMcpCommands skips guided MCP installs when no AFK targets were selected", () => {
  const commands = buildMcpCommands({
    ...options,
    agents: [],
    yes: false,
    selectedMcpIds: ["stitch"],
  });

  assert.deepEqual(commands, []);
});

test("buildMcpCommands does not expand yes mode to broad default agents", () => {
  const commands = buildMcpCommands({
    ...options,
    agents: [],
    yes: true,
  });

  assert.deepEqual(commands, []);
});

test("buildPluginCommands installs selected plugins", () => {
  const commands = buildPluginCommands({ ...options, selectedPluginIds: ["plannotator"] });
  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.command, "bash");
  assert.deepEqual(commands[0]?.args, ["-c", "curl -fsSL https://plannotator.ai/install.sh | bash -s -- --no-extras --model-invocable none"]);
});

test("buildMcpCommands maps Antigravity to the add-mcp antigravity target", () => {
  const commands = buildMcpCommands({ ...options, agents: ["antigravity"] });
  assert.ok(commands[0]?.args.includes("-a"));
  assert.ok(commands[0]?.args.includes("antigravity"));
  assert.ok(!commands[0]?.args.includes("gemini-cli"));
});

test("buildMcpCommands skips project-scoped Antigravity installs", () => {
  const commands = buildMcpCommands({ ...options, agents: ["antigravity"], setupScope: "project" });
  assert.deepEqual(commands, []);
});

test("buildPluginCommands supports generic post-install commands", () => {
  const homeDir = localHomeWithManifest("plugins.json", {
    version: 1,
    items: [
      {
        id: "custom-postinstall",
        label: "Custom Plugin",
        description: "Custom plugin.",
        install: { command: "sh", args: ["-c", "install-custom"] },
        postInstall: { command: "sh", args: ["-c", "custom init"] },
        default: true,
      },
    ],
  });
  const commands = buildPluginCommands({ ...options, homeDir, selectedPluginIds: ["custom-postinstall"] });

  assert.deepEqual(
    commands.map((command) => [command.label, command.command, command.args]),
    [
      ["Custom Plugin / install", "sh", ["-c", "install-custom"]],
      ["Custom Plugin / post-install", "sh", ["-c", "custom init"]],
    ],
  );
});

test("runDelegateCommands fails fast by default", async () => {
  const calls: string[] = [];
  const runtime = fakeRuntime(calls, [7, 0]);
  const code = await runDelegateCommands(runtime, sampleCommands(), { ...options, dryRun: false });

  assert.equal(code, 7);
  assert.deepEqual(calls, ["First"]);
});

test("runDelegateCommands hides delegated command details by default", async () => {
  const output: string[] = [];
  const spawnBehaviors: boolean[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (_command, _args, _cwd, behavior) => {
      spawnBehaviors.push(Boolean(behavior?.verbose));
      return { code: 0 };
    },
  };

  const code = await runDelegateCommands(runtime, [sampleCommands()[0] as DelegateCommand], {
    ...options,
    dryRun: false,
    verbose: false,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawnBehaviors, [false]);
  assert.deepEqual(output, ["- First: preparing...", "- First: ready"]);
});

test("runDelegateCommands shows delegated command details in verbose mode", async () => {
  const output: string[] = [];
  const spawnBehaviors: boolean[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (_command, _args, _cwd, behavior) => {
      spawnBehaviors.push(Boolean(behavior?.verbose));
      return { code: 0 };
    },
  };

  const code = await runDelegateCommands(runtime, [sampleCommands()[0] as DelegateCommand], {
    ...options,
    dryRun: false,
    verbose: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawnBehaviors, [true]);
  assert.ok(output.includes("\nFirst"));
  assert.ok(output.some((message) => message.startsWith("$ first")));
  assert.ok(!output.some((message) => message.includes("preparing...")));
});

test("runDelegateCommands can continue after failures", async () => {
  const calls: string[] = [];
  const warnings: string[] = [];
  const runtime = fakeRuntime(calls, [7, 0], warnings);
  const code = await runDelegateCommands(runtime, sampleCommands(), {
    ...options,
    dryRun: false,
    continueOnError: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(calls, ["First", "Second"]);
  assert.ok(warnings.some((message) => message.includes("First failed")));
});

function sampleCommands(): DelegateCommand[] {
  return [
    { label: "First", command: "first", args: [] },
    { label: "Second", command: "second", args: [] },
  ];
}

function fakeRuntime(calls: string[], codes: number[], warnings: string[] = []): Runtime {
  return {
    io: {
      stdout: () => undefined,
      stderr: (message) => warnings.push(message),
    },
    spawn: async (command) => {
      calls.push(command === "first" ? "First" : "Second");
      return { code: codes.shift() ?? 0 };
    },
  };
}

function localHomeWithManifest(name: string, content: unknown): string {
  return localHomeWithManifests({ [name]: content });
}

function localHomeWithManifests(manifests: Record<string, unknown>): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-delegates-"));
  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  for (const [name, content] of Object.entries(manifests)) {
    writeFileSync(join(manifestDir, name), `${JSON.stringify(content, null, 2)}\n`);
  }
  return homeDir;
}
