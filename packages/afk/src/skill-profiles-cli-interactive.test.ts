import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, vi } from "vitest";
import { runCli } from "./cli.js";

const promptState = vi.hoisted(() => ({
  choices: [] as string[][],
}));

vi.mock("@inquirer/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@inquirer/prompts")>();
  return {
    ...actual,
    search: vi.fn(async (config: { source: (term?: string) => Promise<Array<{ value: { id: string } }>> }) => {
      const choices = await config.source();
      promptState.choices.push(choices.map((choice) => choice.value.id));
      return choices[0]?.value;
    }),
  };
});

test("afk profiles is a shortcut for runtime skill profile commands", async () => {
  const homeDir = profileHome(["video"]);
  const output: string[] = [];

  const code = await withConsole(output, () => runCli(["profiles", "status"], { HOME: homeDir }));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("video"));
});

test("interactive profile enable hides profiles that are already enabled", async () => {
  const homeDir = profileHome(["video"]);
  const output: string[] = [];
  promptState.choices.length = 0;

  const code = await withConsole(output, () => runCli(["profiles", "enable", "--dry-run"], { HOME: homeDir }));

  assert.equal(code, 0);
  assert.deepEqual(promptState.choices, [["review"]]);
});

test("interactive profile disable only offers enabled profiles", async () => {
  const homeDir = profileHome(["video"]);
  const output: string[] = [];
  promptState.choices.length = 0;

  const code = await withConsole(output, () => runCli(["profiles", "disable", "--dry-run"], { HOME: homeDir }));

  assert.equal(code, 0);
  assert.deepEqual(promptState.choices, [["video"]]);
});

test("interactive profile menus explain when no state change is available", async () => {
  const allEnabledHome = profileHome(["video", "review"]);
  const noneEnabledHome = profileHome([]);
  const output: string[] = [];

  const enableCode = await withConsole(output, () => runCli(["profiles", "enable"], { HOME: allEnabledHome }));
  assert.equal(enableCode, 0);
  assert.ok(output.join("\n").includes("All skill profiles are already enabled."));

  output.length = 0;
  const disableCode = await withConsole(output, () => runCli(["profiles", "disable"], { HOME: noneEnabledHome }));
  assert.equal(disableCode, 0);
  assert.ok(output.join("\n").includes("No skill profiles are enabled."));
});

function profileHome(enabledProfileIds: string[]): string {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-profile-cli-"));
  writeJson(join(homeDir, ".agents", "afk", "catalog", "profiles.json"), {
    version: 2,
    mode: "context",
    alwaysOn: [],
    items: [
      { id: "video", name: "Video", catalogSkills: [], packages: [] },
      { id: "review", name: "Review", catalogSkills: [], packages: [] },
    ],
  });
  writeJson(join(homeDir, ".agents", "afk", "state", "skill-profiles.json"), {
    version: 2,
    activations: enabledProfileIds.map((profileId) => ({ profileId, mode: "additive" })),
    profileMovedSkills: [],
    preExistingDisabledSkills: [],
  });
  return homeDir;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function withConsole(output: string[], run: () => Promise<number>): Promise<number> {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => output.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => output.push(args.map(String).join(" "));
  try {
    return await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}
