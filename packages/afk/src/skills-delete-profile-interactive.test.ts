import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, vi } from "vitest";
import { runSkillsCommand } from "./skills/commands.js";
import type { CliOptions, Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  choices: [] as Array<{ checked?: boolean; group?: string; value: { folder: string } }>,
}));

vi.mock("./searchable-checkbox.js", () => ({
  searchableCheckbox: vi.fn(async ({ choices }: { choices: Array<{ checked?: boolean; group?: string; value: { folder: string } }> }) => {
    promptState.choices = choices;
    return choices.filter((choice) => choice.value.folder === "alpha").map((choice) => choice.value);
  }),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  search: vi.fn(),
}));

test("delete --profile lets users choose a subset with every installed profile skill selected initially", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-profile-picker-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(homeDir, "alpha", "Alpha");
  writeSkill(homeDir, "beta", "Beta");
  const profilesPath = join(homeDir, ".agents", "afk", "catalog", "profiles.json");
  mkdirSync(dirname(profilesPath), { recursive: true });
  writeFileSync(profilesPath, JSON.stringify({
    version: 1,
    mode: "context",
    alwaysOn: [],
    items: [{ id: "video", name: "Video", skills: ["alpha", "beta"] }],
  }));

  const code = await runSkillsCommand(["skills", "delete", "video"], outputRuntime(output), {
    ...baseOptions(root),
    dryRun: true,
    skillsDeleteByProfile: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(
    promptState.choices.map((choice) => [choice.value.folder, choice.checked]),
    [["alpha", true], ["beta", true]],
  );
  const text = output.join("\n");
  assert.ok(text.includes("alpha"));
  assert.ok(!text.includes("beta"));
});

test("delete picker groups enabled and disabled skills under clear labels", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-picker-groups-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(homeDir, "alpha", "Alpha");
  writeSkill(homeDir, "beta", "Beta", true);

  const code = await runSkillsCommand(["skills", "delete"], outputRuntime(output), {
    ...baseOptions(root),
    dryRun: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(
    promptState.choices.map((choice) => ({ folder: choice.value.folder, group: choice.group })),
    [
      { folder: "alpha", group: "Enabled skills" },
      { folder: "beta", group: "Disabled skills" },
    ],
  );
});

function writeSkill(homeDir: string, id: string, name: string, disabled = false): void {
  const path = join(homeDir, ".agents", "skills", ...(disabled ? [".disabled"] : []), id, "SKILL.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\nname: ${name}\n---\n`);
}

function outputRuntime(output: string[]): Runtime {
  return {
    io: {
      stdout: (value) => output.push(value),
      stderr: (value) => output.push(value),
    },
    spawn: async () => ({ code: 0 }),
  };
}

function baseOptions(root: string): CliOptions {
  return {
    agents: [], setupScope: "global", scopeExplicit: false, dryRun: false, verbose: false, yes: false,
    allSkills: false, selectedSkillIds: [], selectedSkillAgentIds: [], skillAddArgs: [], skillAddProfileIds: [],
    skillAddProfileOnlyIds: [], skillAddStartDisabled: false, selectedMcpIds: [], selectedToolIds: [],
    selectedHookIds: [], rulesRef: "main", rulesSource: "manifest", initOnly: false, empty: false,
    refreshDefaults: false, defaultsSource: "", defaultsSourceExplicit: false, defaultSourceUpdate: "",
    manifestLocal: false, manifestConfigureLocal: false, manifestConfigureFromCurrent: false,
    manifestShowReact: false, manifestShowVisualize: false, skillsListScope: "all", skillsListStorage: undefined,
    skillsInvocation: undefined, skillsUpdateScope: "global", skillsUpdateAll: false,
    skillsUpdateByProfile: false, skillsDeleteCatalogOnly: false, skillsDeleteByProfile: false,
    skillsAgent: undefined, skillsJson: false, skillsCategory: "", skillsTag: "", skillsUncategorized: false,
    skillOpenApp: "finder", skillOpenTarget: "file", skillCategorizationMode: undefined,
    skillCategorizationRunner: "codex-exec", skillCategorizationInstruction: "", selectedManifestCategories: [],
    homeDir: join(root, "home"), repoDir: root, cwd: join(root, "project"),
  };
}
