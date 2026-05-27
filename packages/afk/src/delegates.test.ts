import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildMcpCommands, buildSkillCommands, buildUtilityCommands, runDelegateCommands, type DelegateCommand } from "./delegates.js";
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
  "utils.json": {
    version: 1,
    items: [
      {
        id: "plannotator",
        label: "Plannotator",
        description: "Review and annotate plans before implementation.",
        install: { command: "bash", args: ["-c", "curl -fsSL https://plannotator.ai/install.sh | bash"] },
        default: true,
      },
      {
        id: "rtk",
        label: "RTK",
        description: "Compress noisy command output for coding agents.",
        install: { command: "sh", args: ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"] },
        postInstall: "rtk-init",
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
  yes: true,
  includeExternal: false,
  selectedSkillIds: [],
  selectedMcpIds: [],
  selectedUtilIds: [],
  selectedHookIds: [],
  rulesRef: "main",
  rulesSource: "local",
  initOnly: false,
  empty: false,
  refreshDefaults: false,
    manifestLocal: false,
  defaultsSource: "",
  manifestConfigureLocal: false,
  manifestConfigureFromCurrent: false,
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

test("buildUtilityCommands installs selected utilities", () => {
  const commands = buildUtilityCommands({ ...options, selectedUtilIds: ["plannotator"] });
  assert.equal(commands.length, 1);
  assert.equal(commands[0]?.command, "bash");
  assert.deepEqual(commands[0]?.args, ["-c", "curl -fsSL https://plannotator.ai/install.sh | bash"]);
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

test("buildUtilityCommands adds RTK init commands for selected agents", () => {
  const commands = buildUtilityCommands({ ...options, agents: ["antigravity", "claude", "codex", "opencode"], selectedUtilIds: ["rtk"] });

  assert.deepEqual(
    commands.map((command) => [command.command, command.args]),
    [
      ["sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"]],
      ["rtk", ["init", "--global", "--gemini"]],
      ["rtk", ["init", "--global"]],
      ["rtk", ["init", "--codex"]],
      ["rtk", ["init", "--global", "--opencode"]],
    ],
  );
  assert.equal(commands[3]?.cwd, join(defaultHomeDir, ".codex"));
});

test("buildUtilityCommands ignores Cursor local because it is hook-only", () => {
  const commands = buildUtilityCommands({ ...options, agents: ["cursor-local"], selectedUtilIds: ["rtk"] });

  assert.deepEqual(
    commands.map((command) => [command.command, command.args]),
    [["sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"]]],
  );
});


test("buildUtilityCommands runs RTK init locally for project scope", () => {
  const commands = buildUtilityCommands({ ...options, setupScope: "project", agents: ["antigravity", "claude", "codex", "opencode"], selectedUtilIds: ["rtk"] });

  assert.deepEqual(
    commands.map((command) => [command.command, command.args]),
    [
      ["sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"]],
      ["rtk", ["init", "--agent", "antigravity"]],
      ["rtk", ["init"]],
      ["rtk", ["init", "--codex"]],
      ["rtk", ["init", "--opencode"]],
    ],
  );
  assert.equal(commands[3]?.cwd, undefined);
});

test("buildUtilityCommands supports generic post-install commands", () => {
  const homeDir = localHomeWithManifest("utils.json", {
    version: 1,
    items: [
      {
        id: "custom-postinstall",
        label: "Custom Utility",
        description: "Custom utility.",
        install: { command: "sh", args: ["-c", "install-custom"] },
        postInstall: { command: "sh", args: ["-c", "custom init"] },
        default: true,
      },
    ],
  });
  const commands = buildUtilityCommands({ ...options, homeDir, selectedUtilIds: ["custom-postinstall"] });

  assert.deepEqual(
    commands.map((command) => [command.label, command.command, command.args]),
    [
      ["Custom Utility / install", "sh", ["-c", "install-custom"]],
      ["Custom Utility / post-install", "sh", ["-c", "custom init"]],
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
