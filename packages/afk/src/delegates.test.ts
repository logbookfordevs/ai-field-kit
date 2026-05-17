import assert from "node:assert/strict";
import test from "node:test";
import { buildMcpCommands, buildSkillCommands, buildUtilityCommands, runDelegateCommands, type DelegateCommand } from "./delegates.js";
import type { CliOptions, Runtime } from "./types.js";

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
  rulesRef: "main",
  rulesSource: "local",
  initOnly: false,
  empty: false,
  refreshDefaults: false,
  defaultsSource: "",
  homeDir: "/tmp/home",
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

test("buildSkillCommands adds a Claude target only when Claude is selected", () => {
  const commands = buildSkillCommands({ ...options, agents: ["codex", "claude"] });
  assert.equal(commands.length, 2);
  assert.ok(commands[1]?.args.includes("--agent"));
  assert.ok(commands[1]?.args.includes("claude-code"));
});

test("buildSkillCommands adds Claude target for default all-agent selection", () => {
  const commands = buildSkillCommands({ ...options, agents: [] });
  assert.equal(commands.length, 2);
  assert.ok(commands[1]?.args.includes("claude-code"));
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

test("buildUtilityCommands adds RTK init commands for selected agents", () => {
  const commands = buildUtilityCommands({ ...options, agents: ["claude", "codex", "gemini", "opencode"], selectedUtilIds: ["rtk"] });

  assert.deepEqual(
    commands.map((command) => [command.command, command.args]),
    [
      ["sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"]],
      ["rtk", ["init", "--global"]],
      ["rtk", ["init", "--codex"]],
      ["rtk", ["init", "--global", "--gemini"]],
      ["rtk", ["init", "--global", "--opencode"]],
    ],
  );
  assert.equal(commands[2]?.cwd, "/tmp/home/.codex");
});

test("buildUtilityCommands runs RTK init locally for project scope", () => {
  const commands = buildUtilityCommands({ ...options, setupScope: "project", agents: ["claude", "codex", "gemini", "opencode"], selectedUtilIds: ["rtk"] });

  assert.deepEqual(
    commands.map((command) => [command.command, command.args]),
    [
      ["sh", ["-c", "curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh"]],
      ["rtk", ["init"]],
      ["rtk", ["init", "--codex"]],
      ["rtk", ["init", "--gemini"]],
      ["rtk", ["init", "--opencode"]],
    ],
  );
  assert.equal(commands[2]?.cwd, undefined);
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
