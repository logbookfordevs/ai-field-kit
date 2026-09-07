import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { runCliWithRuntime } from "./cli.js";
import { localManifestDir } from "./manifest.js";
import type { Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  selected: "",
  choices: [] as Array<{ name?: string; value?: string; description?: string }>,
}));

vi.mock("@inquirer/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@inquirer/prompts")>();
  return {
    ...actual,
    select: vi.fn(async ({ message, choices }: {
      message: string;
      choices?: Array<{ name?: string; value?: string; description?: string }>;
    }) => {
      if (message !== "Choose a catalog source") return "global";
      promptState.choices = choices ?? [];
      return promptState.selected;
    }),
  };
});

test("runCli resolves a bare source flag through saved source preferences", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-source-picker-home-"));
  const sourceDir = mkdtempSync(join(tmpdir(), "afk-source-picker-catalog-"));
  const catalogDir = join(sourceDir, "afk", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(join(catalogDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [{
      id: "favorite-skill",
      label: "Favorite Skill",
      source: "acme/favorite-skill",
      args: [],
      default: false,
    }],
  }, null, 2)}\n`);

  const manifestDir = localManifestDir(homeDir);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "presets.json"), `${JSON.stringify({
    version: 1,
    defaultsSource: "acme/default-kit",
    favoriteSources: [sourceDir],
    presets: [],
  }, null, 2)}\n`);
  promptState.selected = sourceDir;

  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => ({ code: 0 }),
  };
  const code = await runCliWithRuntime(
    ["show", "skills", "--source"],
    { HOME: homeDir },
    runtime,
    { stdin: true, stdout: true },
  );

  assert.equal(code, 0, output.join("\n"));
  assert.ok(output.join("\n").includes("Favorite Skill"));
  assert.deepEqual(promptState.choices.map((choice) => choice.value), [
    "acme/default-kit",
    sourceDir,
    "__other_source__",
  ]);
});
