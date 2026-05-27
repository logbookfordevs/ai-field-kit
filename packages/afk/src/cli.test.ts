import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isPromptExit, runCli } from "./cli.js";

test("runCli prints package version for version flags", async () => {
  const output: string[] = [];
  const expectedVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
  const code = await withConsole(output, () => runCli(["--version"]));

  assert.equal(code, 0);
  assert.equal(output.join("\n"), `afk ${expectedVersion}`);

  output.length = 0;
  const shortCode = await withConsole(output, () => runCli(["-v"]));
  assert.equal(shortCode, 0);
  assert.equal(output.join("\n"), `afk ${expectedVersion}`);
});

test("runCli prints general help for top-level help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes("afk setup refresh [options]"));
  assert.ok(output.join("\n").includes("afk setup mcps [options]"));
  assert.ok(output.join("\n").includes("afk setup hooks [options]"));
  assert.ok(!output.join("\n").includes("afk setup mcps install [options]"));
  assert.ok(output.join("\n").includes("afk --version"));
  assert.ok(output.join("\n").includes('Run "afk <command> --help"'));
});

test("runCli prints contextual setup refresh help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "refresh", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup refresh"));
  assert.ok(output.join("\n").includes("afk setup refresh --local"));
  assert.ok(output.join("\n").includes("Refresh ./afk/manifests"));
  assert.ok(!output.join("\n").includes("--refresh-defaults"));
});

test("runCli rejects the removed refresh-defaults flag", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--refresh-defaults"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Unknown option: --refresh-defaults"));
});

test("runCli prints contextual setup help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup"));
  assert.ok(text.includes("Subcommands:"));
  assert.ok(text.includes("afk setup refresh"));
  assert.ok(text.includes("afk setup mcps"));
  assert.ok(text.includes("afk setup hooks"));
  assert.ok(!text.includes("afk setup mcps install"));
  assert.ok(text.includes("--defaults-source <source>"));
  assert.ok(text.includes("afk setup refresh --defaults-source your-org/dev-kit"));
  assert.ok(!text.includes("--refresh-defaults"));
});

test("runCli prints contextual area help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "mcps", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup MCPs"));
  assert.ok(text.includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(text.includes("--yes, -y                         Accept defaults and skip prompts"));
  assert.ok(text.includes("--agent <agent>                   Limit agent targets; repeatable"));
  assert.ok(text.includes("--defaults-source <source>        Use and remember a custom remote or local defaults source"));
  assert.ok(!text.includes("AFK setup skills"));
});

test("runCli keeps old area command forms as aliases", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "mcps", "install", "--help"]));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("AFK setup MCPs"));
  assert.ok(text.includes("Usage:\n  afk setup mcps [options]"));
});

test("runCli prints contextual hooks help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "hooks", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup hooks"));
  assert.ok(output.join("\n").includes("Merge selected AFK lifecycle hooks"));
  assert.ok(!output.join("\n").includes("AFK setup skills"));
});

test("runCli prints contextual manifest configure help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "configure", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK manifests configure"));
  assert.ok(output.join("\n").includes("afk manifests configure --local"));
  assert.ok(!output.join("\n").includes("AFK setup\n"));
});

test("runCli prints contextual skills help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "list", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK skills list"));
  assert.ok(output.join("\n").includes("--scope global|project|agent|all"));
  assert.ok(output.join("\n").includes("--category <id-or-label>"));
  assert.ok(!output.join("\n").includes("AFK setup skills install"));
});

test("runCli prints contextual skills open help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "open", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK skills open"));
  assert.ok(output.join("\n").includes("--app finder|code|cursor|zed|agy"));
});

test("runCli validates skills open app", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "open", "demo", "--app", "vim"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --app value: vim"));
});

test("runCli validates skills agent metadata", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "rename", "demo", "Demo", "--agent-metadata", "claude"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --agent-metadata value: claude"));
});

test("runCli validates skills categorize runner", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["skills", "categorize", "--runner", "sdk"]));

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Invalid --runner value: sdk"));
});

test("runCli prints contextual manifest show help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "show", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK manifests show"));
  assert.ok(output.join("\n").includes("--local"));
  assert.ok(output.join("\n").includes("--rules"));
  assert.ok(output.join("\n").includes("--hooks"));
  assert.ok(!output.join("\n").includes("AFK setup\n"));
});

test("isPromptExit detects Inquirer Ctrl-C exits", () => {
  const error = new Error("User force closed the prompt with SIGINT");
  error.name = "ExitPromptError";

  assert.equal(isPromptExit(error), true);
  assert.equal(isPromptExit(new Error("Different failure")), false);
});

async function withConsole(output: string[], fn: () => Promise<number>): Promise<number> {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (message?: unknown) => {
    output.push(String(message));
  };
  console.error = (message?: unknown) => {
    output.push(String(message));
  };

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
