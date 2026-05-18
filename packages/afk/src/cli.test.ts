import assert from "node:assert/strict";
import test from "node:test";
import { isPromptExit, runCli } from "./cli.js";

test("runCli prints general help for top-level help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes("afk setup mcps install [options]"));
  assert.ok(output.join("\n").includes('Run "afk <command> --help"'));
});

test("runCli prints contextual setup help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup"));
  assert.ok(output.join("\n").includes("--defaults-source <github-source>"));
  assert.ok(!output.join("\n").includes("afk setup mcps install [options]"));
});

test("runCli prints contextual area help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "mcps", "install", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup MCPs install"));
  assert.ok(output.join("\n").includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(!output.join("\n").includes("AFK setup skills install"));
});

test("runCli prints contextual manifest configure help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["manifests", "configure", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK manifests configure"));
  assert.ok(output.join("\n").includes("afk manifests configure --local"));
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
