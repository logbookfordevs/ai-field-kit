import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "./cli.js";

test("runCli prints general help for top-level help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Guided setup router for AI Field Kit."));
  assert.ok(output.join("\n").includes("afk setup [options]"));
  assert.ok(output.join("\n").includes('Run "afk <command> --help"'));
});

test("runCli prints contextual setup help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["setup", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK setup"));
  assert.ok(output.join("\n").includes("--defaults-source <github-source>"));
  assert.ok(!output.join("\n").includes("afk mcps install [options]"));
});

test("runCli prints contextual area help", async () => {
  const output: string[] = [];
  const code = await withConsole(output, () => runCli(["mcps", "install", "--help"]));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("AFK MCPs install"));
  assert.ok(output.join("\n").includes("Delegate selected MCP recommendations to add-mcp."));
  assert.ok(!output.join("\n").includes("AFK skills install"));
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
