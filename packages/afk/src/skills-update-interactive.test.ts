import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { localManifestDir } from "./manifest.js";
import { runSkillsCommand } from "./skills/commands.js";
import type { Runtime } from "./types.js";

const promptState = vi.hoisted(() => ({
  choices: [] as Array<{ value: string; group?: string }>,
}));

vi.mock("./searchable-checkbox.js", () => ({
  searchableCheckbox: vi.fn(async ({ choices }: { choices: Array<{ value: string; group?: string }> }) => {
    promptState.choices = choices;
    return [];
  }),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  search: vi.fn(),
}));

test("afk skills update picker lists only cataloged locked skills", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-update-catalog-picker-"));
  const homeDir = join(root, "home");
  mkdirSync(join(homeDir, ".agents"), { recursive: true });
  writeFileSync(join(homeDir, ".agents", ".skill-lock.json"), JSON.stringify({
    version: 3,
    skills: {
      cataloged: {
        source: "owner/cataloged",
        sourceType: "github",
        skillPath: "skills/cataloged/SKILL.md",
      },
      "disabled-cataloged": {
        source: "owner/disabled-cataloged",
        sourceType: "github",
        skillPath: "skills/disabled-cataloged/SKILL.md",
      },
      foreign: {
        source: "owner/foreign",
        sourceType: "github",
        skillPath: "skills/foreign/SKILL.md",
      },
    },
  }));
  mkdirSync(join(homeDir, ".agents", "skills", "cataloged"), { recursive: true });
  mkdirSync(join(homeDir, ".agents", "skills", ".disabled", "disabled-cataloged"), { recursive: true });
  mkdirSync(localManifestDir(homeDir), { recursive: true });
  writeFileSync(join(localManifestDir(homeDir), "skills.json"), JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "cataloged",
        label: "Cataloged",
        source: "https://github.com/owner/cataloged",
        args: ["--skill", "cataloged"],
        default: true,
      },
      {
        id: "disabled-cataloged",
        label: "Disabled Cataloged",
        source: "https://github.com/owner/disabled-cataloged",
        args: ["--skill", "disabled-cataloged"],
        default: false,
      },
    ],
  }));
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async () => {
      throw new Error("spawn should not run without a selection");
    },
  };
  vi.spyOn(console, "log").mockImplementation(() => undefined);

  await runSkillsCommand(["skills", "update"], runtime, {
    agents: [],
    setupScope: "global",
    scopeExplicit: false,
    dryRun: false,
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddProfileOnlyIds: [],
    skillAddStartDisabled: false,
    selectedMcpIds: [],
    selectedToolIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest",
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
    skillsListScope: "all",
    skillsListStorage: undefined,
    skillsListAutoInvocation: undefined,
    skillsUpdateScope: "global",
    skillsUpdateAll: false,
    skillsUpdateByProfile: false,
    skillsDeleteCatalogOnly: false,
    skillsDeleteByProfile: false,
    skillsAgent: undefined,
    skillsJson: false,
    skillsCategory: "",
    skillsTag: "",
    skillsUncategorized: false,
    skillOpenApp: "finder",
    skillOpenTarget: "file",
    skillCategorizationMode: undefined,
    skillCategorizationRunner: "codex-exec",
    skillCategorizationInstruction: "",
    selectedManifestCategories: [],
    homeDir,
    repoDir: root,
    cwd: join(root, "project"),
  });

  assert.deepEqual(promptState.choices.map((choice) => ({ value: choice.value, group: choice.group })), [
    { value: "cataloged", group: "Enabled skills" },
    { value: "disabled-cataloged", group: "Disabled skills" },
  ]);
});
