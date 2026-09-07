import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "vitest";
import { runRefresh } from "./refresh.js";
import type { CliOptions, Runtime } from "./types.js";

test("runRefresh requires two confirmations before applying an override", async () => {
  const confirmations: string[] = [];
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  };
  const options = refreshOptions({ overrideRefresh: true });

  const code = await runRefresh(runtime, options, async (message) => {
    confirmations.push(message);
    return confirmations.length === 1;
  });

  assert.equal(code, 0);
  assert.equal(confirmations.length, 2);
  assert.ok(output.some((message) => message.includes("cancelled")));
  assert.ok(!output.some((message) => message.includes("Local catalog refreshed")));
});

test("runRefresh dry-run previews an override without confirmation", async () => {
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  };
  const options = refreshOptions({ overrideRefresh: true, dryRun: true });

  const code = await runRefresh(runtime, options, async () => {
    throw new Error("dry-run must not prompt");
  });

  assert.equal(code, 0);
  assert.ok(output.some((message) => message.includes("Local Catalog")));
});

test("runRefresh applies an override after two affirmative confirmations", async () => {
  let confirmationCount = 0;
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: () => undefined,
    },
    spawn: async () => ({ code: 0 }),
  };

  const code = await runRefresh(runtime, refreshOptions({ overrideRefresh: true }), async () => {
    confirmationCount += 1;
    return true;
  });

  assert.equal(code, 0);
  assert.equal(confirmationCount, 2);
  assert.ok(output.some((message) => message.includes("Local catalog refreshed")));
});

function refreshOptions(overrides: Partial<CliOptions>): CliOptions {
  const homeDir = mkdtempSync(`${tmpdir()}/afk-refresh-`);
  return {
    homeDir,
    repoDir: process.cwd(),
    cwd: process.cwd(),
    rulesRef: "main",
    rulesSource: "local",
    empty: true,
    refreshDefaults: true,
    defaultsSource: "",
    defaultsSourceExplicit: false,
    defaultSourceUpdate: "",
    manifestLocal: false,
    dryRun: false,
    selectedManifestCategories: ["rules"],
    ...overrides,
  } as CliOptions;
}
