import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { planCatalogImport, runCatalogImport } from "./catalog-import.js";
import type { CliOptions, Runtime } from "./types.js";

test("planCatalogImport imports installed skills with lock metadata into global catalog", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-"));
  writeInstalledSkill(homeDir, "afk-code-grill", [
    "---",
    "name: AFK Code Grill",
    "disable-model-invocation: true",
    "---",
    "",
    "# AFK Code Grill",
  ].join("\n"));
  writeSkillLock(homeDir, {
    "afk-code-grill": {
      source: "logbookfordevs/ai-field-kit",
      sourceType: "github",
    },
  });

  const plan = planCatalogImport({ homeDir, cwd: mkdtempSync(join(tmpdir(), "afk-project-")), dryRun: false, manifestLocal: false });
  const write = plan.operations.find((operation) => operation.type === "write");

  assert.equal(plan.imported.length, 1);
  assert.equal(plan.imported[0]?.id, "afk-code-grill");
  assert.equal(plan.imported[0]?.source, "logbookfordevs/ai-field-kit");
  assert.deepEqual(plan.imported[0]?.args, ["--skill", "afk-code-grill"]);
  assert.equal(plan.imported[0]?.default, false);
  assert.equal(plan.imported[0]?.autoInvocation, false);
  assert.equal(plan.imported[0]?.role, "utility");
  assert.equal(plan.imported[0]?.imported, true);
  assert.equal(write?.path, join(homeDir, ".agents", "afk", "catalog", "skills.json"));
});

test("planCatalogImport skips installed skills without lock metadata", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-"));
  writeInstalledSkill(homeDir, "local-only", "---\nname: Local Only\n---\n");
  writeSkillLock(homeDir, {});

  const plan = planCatalogImport({ homeDir, cwd: mkdtempSync(join(tmpdir(), "afk-project-")), dryRun: false, manifestLocal: false });

  assert.deepEqual(plan.imported, []);
  assert.deepEqual(plan.skippedNoLock, ["local-only"]);
  assert.deepEqual(plan.operations, []);
});

test("planCatalogImport local mode reads project skills and lock when present", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-home-"));
  const cwd = mkdtempSync(join(tmpdir(), "afk-catalog-import-project-"));
  writeInstalledSkill(homeDir, "home-skill", "---\nname: Home Skill\n---\n");
  writeSkillLock(homeDir, { "home-skill": { source: "acme/home-kit" } });
  writeInstalledSkill(cwd, "project-skill", "---\nname: Project Skill\n---\n");
  writeSkillLock(cwd, { "project-skill": { source: "acme/project-kit" } });

  const plan = planCatalogImport({ homeDir, cwd, dryRun: false, manifestLocal: true });

  assert.deepEqual(plan.imported.map((item) => item.id), ["project-skill"]);
  assert.equal(plan.imported[0]?.source, "acme/project-kit");
  assert.equal(plan.targetCatalogPath, join(cwd, "afk", "catalog", "skills.json"));
});

test("planCatalogImport local mode falls back to home skills and lock", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-home-"));
  const cwd = mkdtempSync(join(tmpdir(), "afk-catalog-import-project-"));
  writeInstalledSkill(homeDir, "home-skill", "---\nname: Home Skill\n---\n");
  writeSkillLock(homeDir, { "home-skill": { source: "acme/home-kit" } });

  const plan = planCatalogImport({ homeDir, cwd, dryRun: false, manifestLocal: true });

  assert.deepEqual(plan.imported.map((item) => item.id), ["home-skill"]);
  assert.equal(plan.imported[0]?.source, "acme/home-kit");
  assert.equal(plan.sourceSkillsDir, join(homeDir, ".agents", "skills"));
  assert.equal(plan.sourceLockPath, join(homeDir, ".agents", ".skill-lock.json"));
  assert.equal(plan.targetCatalogPath, join(cwd, "afk", "catalog", "skills.json"));
});

test("planCatalogImport does not duplicate existing catalog skills", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-"));
  const catalogDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(join(catalogDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "acme/default-kit",
    items: [
      {
        id: "existing-skill",
        label: "Existing Skill",
        source: "acme/kit",
        args: ["--skill", "existing-skill"],
        default: true,
      },
    ],
  }, null, 2)}\n`);
  writeInstalledSkill(homeDir, "existing-skill", "---\nname: Existing Skill\n---\n");
  writeSkillLock(homeDir, { "existing-skill": { source: "acme/kit" } });

  const plan = planCatalogImport({ homeDir, cwd: mkdtempSync(join(tmpdir(), "afk-project-")), dryRun: false, manifestLocal: false });

  assert.deepEqual(plan.imported, []);
  assert.deepEqual(plan.skippedExisting, ["existing-skill"]);
  assert.equal(JSON.parse(readFileSync(join(catalogDir, "skills.json"), "utf8")).defaultSource, "acme/default-kit");
});

test("runCatalogImport renders a branded, scannable summary", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-"));
  writeInstalledSkill(homeDir, "afk-code-grill", "---\nname: AFK Code Grill\n---\n");
  writeInstalledSkill(homeDir, "local-only", "---\nname: Local Only\n---\n");
  writeSkillLock(homeDir, {
    "afk-code-grill": {
      source: "logbookfordevs/ai-field-kit",
    },
  });
  const output: string[] = [];

  const code = await runCatalogImport(captureRuntime(output), cliOptions({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: true,
  }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("◆ Catalog Import"));
  assert.ok(text.includes("◆ Import Preview"));
  assert.ok(text.includes("◆ Import Summary"));
  assert.ok(text.includes("Imported"));
  assert.ok(text.includes("• afk-code-grill"));
  assert.ok(text.includes("Missing lock metadata"));
  assert.ok(text.includes("• local-only"));
});

function captureRuntime(output: string[]): Runtime {
  return {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => ({ code: 0 }),
  };
}

function cliOptions(overrides: Partial<CliOptions>): CliOptions {
  return {
    agents: [],
    setupScope: "global",
    scopeExplicit: true,
    dryRun: false,
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    skillAddArgs: [],
    skillAddProfileIds: [],
    skillAddStartDisabled: false,
    selectedMcpIds: [],
    selectedPluginIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "local",
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
    selectedManifestCategories: [],
    homeDir: mkdtempSync(join(tmpdir(), "afk-catalog-import-home-")),
    repoDir: process.cwd(),
    cwd: mkdtempSync(join(tmpdir(), "afk-catalog-import-project-")),
    ...overrides,
  };
}

function writeInstalledSkill(root: string, id: string, skillMd: string): void {
  const skillDir = join(root, ".agents", "skills", id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), skillMd);
}

function writeSkillLock(root: string, skills: Record<string, { source?: string; sourceType?: string }>): void {
  const agentsDir = join(root, ".agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, ".skill-lock.json"), `${JSON.stringify({ version: 3, skills }, null, 2)}\n`);
}
