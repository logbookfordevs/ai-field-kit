import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, vi } from "vitest";
import type { CliOptions, Runtime } from "./types.js";
import { skillCatalogPath, type SkillRecord } from "./skills/catalog.js";

const promptState = vi.hoisted(() => ({ changes: true }));

vi.mock("./skills/invocation-policy-editor.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    promptInvocationPolicyChanges: async ({ records }: { records: SkillRecord[] }) => promptState.changes
      ? [
        { record: records.find(({ folder }) => folder === "alpha")!, allowInvocation: true },
        { record: records.find(({ folder }) => folder === "beta")!, allowInvocation: false },
      ]
      : [],
  };
});

const { runSkillsCommand } = await import("./skills/commands.js");

test("bare skills invocation applies every drafted policy change", async () => {
  promptState.changes = true;
  const root = mkdtempSync(join(tmpdir(), "afk-skill-invocation-batch-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeCatalog(homeDir);
  writeSkill(homeDir, "alpha", false);
  writeSkill(homeDir, "beta", true);

  const code = await runSkillsCommand(
    ["skills", "invocation"],
    outputRuntime(output),
    baseOptions(root),
  );

  assert.equal(code, 0);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "alpha", "SKILL.md"), "utf8"), /disable-model-invocation: false/);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "beta", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  const catalog = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    items: Array<{ id: string; autoInvocation: boolean }>;
  };
  assert.deepEqual(catalog.items.map(({ id, autoInvocation }) => ({ id, autoInvocation })), [
    { id: "alpha", autoInvocation: true },
    { id: "beta", autoInvocation: false },
  ]);
  assert.ok(output.join("\n").includes("Updated 2 skills"));
});

test("bare skills invocation discards the draft without validating the catalog", async () => {
  promptState.changes = false;
  const root = mkdtempSync(join(tmpdir(), "afk-skill-invocation-cancel-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeCatalog(homeDir);
  writeSkill(homeDir, "alpha", false);
  writeSkill(homeDir, "beta", true);
  const catalogBefore = "{ invalid catalog\n";
  writeFileSync(skillCatalogPath(homeDir), catalogBefore);

  const code = await runSkillsCommand(
    ["skills", "invocation"],
    outputRuntime(output),
    baseOptions(root),
  );

  assert.equal(code, 0);
  assert.equal(readFileSync(skillCatalogPath(homeDir), "utf8"), catalogBefore);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "alpha", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "beta", "SKILL.md"), "utf8"), /disable-model-invocation: false/);
  assert.ok(output.join("\n").includes("No invocation policy changes selected"));
});

function writeCatalog(homeDir: string): void {
  const path = skillCatalogPath(homeDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      { id: "alpha", label: "Alpha", source: "owner/skills", args: ["--skill", "alpha"], default: false, autoInvocation: false },
      { id: "beta", label: "Beta", source: "owner/skills", args: ["--skill", "beta"], default: false, autoInvocation: true },
    ],
  }, null, 2)}\n`);
}

function writeSkill(homeDir: string, folder: string, allowInvocation: boolean): void {
  const skillRoot = join(homeDir, ".agents", "skills", folder);
  mkdirSync(join(skillRoot, "agents"), { recursive: true });
  writeFileSync(join(skillRoot, "SKILL.md"), [
    "---",
    `name: ${folder}`,
    `description: ${folder} description`,
    `disable-model-invocation: ${allowInvocation ? "false" : "true"}`,
    "---",
    "",
    `# ${folder}`,
    "",
  ].join("\n"));
  writeFileSync(join(skillRoot, "agents", "openai.yaml"), `policy:\n  allow_implicit_invocation: ${allowInvocation ? "true" : "false"}\n`);
}

function outputRuntime(output: string[]): Runtime {
  return {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      throw new Error("spawn should not run");
    },
  };
}

function baseOptions(root: string): CliOptions {
  return {
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
    skillsUpdateScope: "global",
    skillsUpdateAll: false,
    skillsUpdateByProfile: false,
    skillsDeleteCatalogOnly: false,
    skillsDeleteByProfile: false,
    skillsJson: false,
    skillsCategory: "",
    skillsTag: "",
    skillsUncategorized: false,
    skillOpenApp: "finder",
    skillOpenTarget: "file",
    skillCategorizationRunner: "codex-exec",
    selectedManifestCategories: [],
    homeDir: join(root, "home"),
    repoDir: root,
    cwd: join(root, "project"),
  };
}
