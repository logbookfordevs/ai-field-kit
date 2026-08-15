import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { planCatalogImport, planCatalogImportStatus, planSkillCatalogRecovery, runCatalogImport, runCatalogImportStatus } from "./catalog-import.js";
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

test("planCatalogImport imports disabled skills as start-disabled catalog entries", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-disabled-"));
  writeDisabledInstalledSkill(homeDir, "disabled-skill", "---\nname: Disabled Skill\n---\n");
  writeSkillLock(homeDir, {
    "disabled-skill": {
      source: "acme/skills",
      sourceType: "github",
    },
  });

  const plan = planCatalogImport({ homeDir, cwd: mkdtempSync(join(tmpdir(), "afk-project-")), dryRun: false, manifestLocal: false });

  assert.deepEqual(plan.imported.map((item) => ({ id: item.id, startDisabled: item.startDisabled })), [
    { id: "disabled-skill", startDisabled: true },
  ]);
});

test("planSkillCatalogRecovery resolves a renamed installed folder by the official folder hash", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-recovery-hash-"));
  writeDisabledInstalledSkill(homeDir, "stitch-remotion", "---\nname: Stitch Remotion\n---\n");
  writeSkillLock(homeDir, {
    remotion: {
      source: "google-labs-code/stitch-skills",
      skillPath: "skills/remotion/SKILL.md",
      skillFolderHash: "c8c04f1b9a096c88f9956954c2749645c88fe9acc917b355264526a15255bcb2",
    },
  });

  const plan = planSkillCatalogRecovery({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: false,
    manifestLocal: false,
  }, ["stitch-remotion"]);

  assert.deepEqual(plan.recovered.map((item) => ({ id: item.id, args: item.args, source: item.source })), [{
    id: "stitch-remotion",
    args: ["--skill", "remotion"],
    source: "google-labs-code/stitch-skills",
  }]);
});

test("planSkillCatalogRecovery resolves a declared upstream alias without name inference", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-recovery-declared-alias-"));
  writeDisabledInstalledSkill(homeDir, "stitch-video", "---\nname: Stitch Video\n---\n");
  writeSkillLock(homeDir, {
    remotion: { source: "google-labs-code/stitch-skills", skillPath: "skills/remotion/SKILL.md" },
  });

  const plan = planSkillCatalogRecovery({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: false,
    manifestLocal: false,
  }, ["stitch-video"], { "stitch-video": "remotion" });

  assert.deepEqual(plan.recovered.map((item) => ({ id: item.id, args: item.args })), [{
    id: "stitch-video",
    args: ["--skill", "remotion"],
  }]);
});

test("planSkillCatalogRecovery gives a declared alias precedence over a competing exact lock key", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-recovery-alias-precedence-"));
  writeDisabledInstalledSkill(homeDir, "stitch-remotion", "---\nname: Stitch Remotion\n---\n");
  writeSkillLock(homeDir, {
    "stitch-remotion": { source: "acme/wrong" },
    remotion: { source: "google-labs-code/stitch-skills" },
  });

  const plan = planSkillCatalogRecovery({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: false,
    manifestLocal: false,
  }, ["stitch-remotion"], { "stitch-remotion": "remotion" });

  assert.deepEqual(plan.recovered.map((item) => ({ source: item.source, args: item.args })), [{
    source: "google-labs-code/stitch-skills",
    args: ["--skill", "remotion"],
  }]);
});

test("planSkillCatalogRecovery fails closed when a declared alias has no lock entry", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-recovery-alias-missing-"));
  writeDisabledInstalledSkill(homeDir, "react-components", "---\nname: react:components\n---\n");
  writeSkillLock(homeDir, {
    "react:components": { source: "acme/inferred" },
  });

  const plan = planSkillCatalogRecovery({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: false,
    manifestLocal: false,
  }, ["react-components"], { "react-components": "missing-upstream-id" });

  assert.deepEqual(plan.recovered, []);
});

test("planSkillCatalogRecovery does not infer suffix aliases without declared metadata", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-recovery-ambiguous-"));
  writeDisabledInstalledSkill(homeDir, "stitch-remotion", "---\nname: Stitch Remotion\n---\n");
  writeSkillLock(homeDir, {
    remotion: { source: "acme/one", skillPath: "skills/remotion/SKILL.md" },
    video: { source: "acme/two", skillPath: "skills/remotion/SKILL.md" },
  });

  const plan = planSkillCatalogRecovery({
    homeDir,
    cwd: mkdtempSync(join(tmpdir(), "afk-project-")),
    dryRun: false,
    manifestLocal: false,
  }, ["stitch-remotion"]);

  assert.deepEqual(plan.recovered, []);
  assert.equal(plan.operation, undefined);
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

test("planCatalogImportStatus compares installed active and disabled skills with catalog entries", () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-status-"));
  const catalogDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(join(catalogDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "installed-active",
        label: "Installed Active",
        source: "acme/kit",
        args: ["--skill", "installed-active"],
        default: true,
      },
      {
        id: "installed-disabled",
        label: "Installed Disabled",
        source: "acme/kit",
        args: ["--skill", "installed-disabled"],
        default: true,
      },
      {
        id: "catalog-only",
        label: "Catalog Only",
        source: "acme/kit",
        args: ["--skill", "catalog-only"],
        default: true,
      },
    ],
  }, null, 2)}\n`);
  writeInstalledSkill(homeDir, "installed-active", "---\nname: Installed Active\n---\n");
  writeDisabledInstalledSkill(homeDir, "installed-disabled", "---\nname: Installed Disabled\n---\n");
  writeInstalledSkill(homeDir, "not-imported", "---\nname: Not Imported\n---\n");

  const status = planCatalogImportStatus({ homeDir, cwd: mkdtempSync(join(tmpdir(), "afk-project-")), dryRun: false, manifestLocal: false });

  assert.deepEqual(status.installed, ["installed-active", "installed-disabled", "not-imported"]);
  assert.deepEqual(status.cataloged, ["catalog-only", "installed-active", "installed-disabled"]);
  assert.deepEqual(status.notImported, ["not-imported"]);
  assert.deepEqual(status.catalogOnly, ["catalog-only"]);
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

test("runCatalogImportStatus renders status counts", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-catalog-import-status-render-"));
  const catalogDir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(join(catalogDir, "skills.json"), `${JSON.stringify({
    version: 1,
    defaultSource: "",
    items: [
      {
        id: "catalog-only",
        label: "Catalog Only",
        source: "acme/kit",
        args: ["--skill", "catalog-only"],
        default: true,
      },
    ],
  }, null, 2)}\n`);
  writeInstalledSkill(homeDir, "not-imported", "---\nname: Not Imported\n---\n");
  const output: string[] = [];

  const code = await runCatalogImportStatus(captureRuntime(output), cliOptions({ homeDir }));
  const text = output.join("\n");

  assert.equal(code, 0);
  assert.ok(text.includes("◆ Catalog Skills Status"));
  assert.ok(text.includes("Not imported yet"));
  assert.ok(text.includes("• not-imported"));
  assert.ok(text.includes("Catalog only"));
  assert.ok(text.includes("• catalog-only"));
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
    skillAddProfileOnlyIds: [],
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

function writeDisabledInstalledSkill(root: string, id: string, skillMd: string): void {
  const skillDir = join(root, ".agents", "skills", ".disabled", id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), skillMd);
}

function writeSkillLock(root: string, skills: Record<string, { source?: string; sourceType?: string; skillPath?: string; skillFolderHash?: string }>): void {
  const agentsDir = join(root, ".agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, ".skill-lock.json"), `${JSON.stringify({ version: 3, skills }, null, 2)}\n`);
}
