import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "vitest";
import {
  filterSkillRecords,
  legacySkillCatalogPath,
  loadSkillCatalog,
  moveSkillRecord,
  moveGlobalSkill,
  normalizeSkillDescription,
  parseSkillFile,
  parseOpenAiImplicitInvocation,
  skillCatalogFileName,
  skillCatalogPath,
  syncSkillCatalogFromManifest,
  deleteSkillRecords,
  deleteGlobalSkill,
  deleteGlobalSkills,
  type SkillRecord,
} from "./skills/catalog.js";
import { buildCodexCategorizationCommand, runCodexCategorization } from "./skills/categorization.js";
import { buildSkillOpenCommand, filterManifestSkillRecords, filterSkillChoices, formatLockedSkillChoice, runSkillsCommand } from "./skills/commands.js";
import {
  disableSkillProfile,
  enableSkillProfile,
  loadSkillProfileState,
  skillProfilePaths,
  type SkillProfileCatalog,
} from "./skills/profiles.js";
import { renderSkillChoice, renderSkillDetails, renderSkillDeleteBatch } from "./skills/render.js";
import { buildSkillUpgradeCommands, loadLockedSkills } from "./skills/upgrade.js";
import type { Runtime } from "./types.js";
import { localManifestDir, projectManifestDir, type SkillManifest } from "./manifest.js";

test("parseSkillFile reads frontmatter name and description", () => {
  const metadata = parseSkillFile("---\nname: demo\ndescription: Demo skill\n---\n\n# Demo\n", "fallback");

  assert.equal(metadata.name, "demo");
  assert.equal(metadata.description, "Demo skill");
});

test("parseSkillFile reads disable-model-invocation frontmatter", () => {
  assert.equal(parseSkillFile("---\nname: demo\ndisable-model-invocation: true\n---\n\n# Demo\n", "fallback").disableModelInvocation, true);
  assert.equal(parseSkillFile("---\nname: demo\ndisable-model-invocation: false\n---\n\n# Demo\n", "fallback").disableModelInvocation, false);
});

test("parseOpenAiImplicitInvocation reads allow_implicit_invocation", () => {
  assert.equal(parseOpenAiImplicitInvocation("policy:\n  allow_implicit_invocation: true\n"), true);
  assert.equal(parseOpenAiImplicitInvocation("policy:\n  allow_implicit_invocation: false\n"), false);
  assert.equal(parseOpenAiImplicitInvocation("interface:\n  display_name: Demo\n"), undefined);
});

test("parseSkillFile folds YAML block scalar descriptions", () => {
  const metadata = parseSkillFile(
    [
      "---",
      "name: compound",
      "description: >",
      "  Analyze plan archives to extract denial patterns, feedback",
      "  taxonomy, evolution over time, and prompt improvements.",
      "---",
      "",
      "# Compound",
    ].join("\n"),
    "fallback",
  );

  assert.equal(metadata.name, "compound");
  assert.equal(
    metadata.description,
    "Analyze plan archives to extract denial patterns, feedback taxonomy, evolution over time, and prompt improvements.",
  );
});

test("parseSkillFile folds YAML block scalar descriptions with chomping markers", () => {
  const metadata = parseSkillFile(
    [
      "---",
      "name: notion-cli",
      "description: >-",
      "  Use the Notion CLI (`ntn`) to interact with the Notion API, manage workers,",
      "  and upload files.",
      "---",
      "",
      "# Notion CLI",
    ].join("\n"),
    "fallback",
  );

  assert.equal(
    metadata.description,
    "Use the Notion CLI (`ntn`) to interact with the Notion API, manage workers, and upload files.",
  );
});

test("normalizeSkillDescription removes leaked YAML block scalar markers", () => {
  assert.equal(normalizeSkillDescription(">-"), undefined);
  assert.equal(normalizeSkillDescription("|+"), undefined);
  assert.equal(normalizeSkillDescription(" Real description "), "Real description");
});

test("parseSkillFile falls back to first body paragraph without frontmatter", () => {
  const metadata = parseSkillFile("# Demo\n\nUse this skill for demos.\n\nMore details.", "fallback");

  assert.equal(metadata.name, undefined);
  assert.equal(metadata.description, "Use this skill for demos.");
});

test("parseSkillFile skips standalone blockquote markers in body fallback", () => {
  const metadata = parseSkillFile("# Demo\n\n>\n\nUse this skill for demos.", "fallback");

  assert.equal(metadata.description, "Use this skill for demos.");
});

test("loadSkillCatalog orders global active, global disabled, then project roots", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-list-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "z-active", "Z Active");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "a-disabled", "A Disabled");
  writeSkill(join(cwd, ".codex", "skills"), "codex-skill", "Codex Skill");
  writeSkill(join(cwd, ".claude", "skills"), "claude-skill", "Claude Skill");
  writeSkillCatalog(homeDir, {
    version: 1,
    scopes: [{ id: "docs", label: "Docs" }],
    skills: [{ folder: "z-active", name: "Alpha Active", scope: "docs", tags: ["docs"] }],
  });

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "all", agent: undefined });

  assert.deepEqual(snapshot.records.map((record) => record.folder), [
    "z-active",
    "a-disabled",
    "codex-skill",
    "claude-skill",
  ]);
  assert.equal(snapshot.records[0]?.name, "Z Active");
  assert.equal(snapshot.records[0]?.category, "Docs");
  assert.equal(snapshot.records[2]?.readOnly, false);
});

test("loadSkillCatalog filters project roots by agent", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-agent-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(cwd, ".codex", "skills"), "codex-skill", "Codex Skill");
  writeSkill(join(cwd, ".claude", "skills"), "claude-skill", "Claude Skill");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "project", agent: "codex" });

  assert.deepEqual(snapshot.records.map((record) => record.folder), ["codex-skill"]);
});

test("loadSkillCatalog includes installed agent roots with --scope global", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-installed-agent-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "codex-global", "Codex Global");
  writeSkill(join(homeDir, ".gemini", "skills"), "gemini-global", "Gemini Global");
  writeSkill(join(homeDir, ".agents", "skills"), "shared-global", "Shared Global");
  writeSkill(join(cwd, ".codex", "skills"), "codex-project", "Codex Project");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(snapshot.records.map((record) => record.folder), ["shared-global", "codex-global", "gemini-global"]);
  assert.deepEqual(snapshot.records.map((record) => record.rootKind), ["global-library", "agent-library", "agent-library"]);
  assert.deepEqual(snapshot.records.map((record) => record.readOnly), [false, false, false]);
});

test("loadSkillCatalog filters installed agent roots with --scope global --agent", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-installed-agent-filter-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "shared-global", "Shared Global");
  writeSkill(join(homeDir, ".codex", "skills"), "codex-global", "Codex Global");
  writeSkill(join(homeDir, ".gemini", "skills"), "gemini-global", "Gemini Global");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: "gemini" });

  assert.deepEqual(snapshot.records.map((record) => record.folder), ["gemini-global"]);
});

test("loadSkillCatalog includes disabled installed agent roots with --scope global --agent", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-installed-agent-disabled-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "active-codex", "Active Codex");
  writeSkill(join(homeDir, ".codex", "skills", ".disabled"), "disabled-codex", "Disabled Codex");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: "codex" });

  assert.deepEqual(snapshot.records.map((record) => [record.folder, record.storage]), [
    ["active-codex", "active"],
    ["disabled-codex", "disabled"],
  ]);
});

test("loadSkillCatalog resolves auto invocation states from SKILL and OpenAI metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-auto-invocation-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "default-skill", "Default Skill");
  writeSkill(join(homeDir, ".agents", "skills"), "manual-skill", "Manual Skill", { disableModelInvocation: true });
  writeSkill(join(homeDir, ".agents", "skills"), "auto-skill", "Auto Skill", { openAiImplicitInvocation: true });
  writeSkill(join(homeDir, ".agents", "skills"), "mixed-skill", "Mixed Skill", {
    disableModelInvocation: true,
    openAiImplicitInvocation: true,
  });

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });
  const byFolder = new Map(snapshot.records.map((record) => [record.folder, record]));

  assert.equal(byFolder.get("default-skill")?.autoInvocation, "default");
  assert.equal(byFolder.get("manual-skill")?.autoInvocation, "disabled");
  assert.deepEqual(byFolder.get("manual-skill")?.autoInvocationDetails, ["SKILL.md disables"]);
  assert.equal(byFolder.get("auto-skill")?.autoInvocation, "enabled");
  assert.deepEqual(byFolder.get("auto-skill")?.autoInvocationDetails, ["agents/openai.yaml enables"]);
  assert.equal(byFolder.get("mixed-skill")?.autoInvocation, "mixed");
  assert.deepEqual(byFolder.get("mixed-skill")?.autoInvocationDetails, ["SKILL.md disables", "agents/openai.yaml enables"]);
});

test("filterSkillChoices searches folders, names, categories, tags, and roots", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-filter-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "doc-helper", "Doc Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "review-helper", "Review Helper");
  writeSkillCatalog(homeDir, {
    version: 1,
    scopes: [
      { id: "docs", label: "Docs" },
      { id: "review", label: "Review" },
    ],
    skills: [
      { folder: "doc-helper", name: "Doc Helper", scope: "docs", tags: ["writing"] },
      { folder: "review-helper", name: "Review Helper", scope: "review", tags: ["critique"] },
    ],
  });
  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(filterSkillChoices(snapshot.records, "writing").map((record) => record.folder), ["doc-helper"]);
  assert.deepEqual(filterSkillChoices(snapshot.records, "review helper").map((record) => record.folder), ["review-helper"]);
});

test("filterSkillRecords filters by category, tag, and uncategorized", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-list-filters-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "doc-helper", "Doc Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "review-helper", "Review Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "plain-helper", "Plain Helper");
  writeSkillCatalog(homeDir, {
    version: 1,
    scopes: [
      { id: "docs", label: "Docs" },
      { id: "review", label: "Review" },
    ],
    skills: [
      { folder: "doc-helper", name: "Doc Helper", scope: "docs", tags: ["writing"] },
      { folder: "review-helper", name: "Review Helper", scope: "review", tags: ["critique"] },
    ],
  });
  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(filterSkillRecords(snapshot.records, { category: "Docs" }).map((record) => record.folder), ["doc-helper"]);
  assert.deepEqual(filterSkillRecords(snapshot.records, { tag: "critique" }).map((record) => record.folder), ["review-helper"]);
  assert.deepEqual(filterSkillRecords(snapshot.records, { uncategorized: true }).map((record) => record.folder), ["plain-helper"]);
});

test("moveGlobalSkill supports dry-run and active to disabled moves", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-disable-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");

  moveGlobalSkill({ homeDir, folder: "demo", enabled: false, dryRun: true });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "demo")), false);

  moveGlobalSkill({ homeDir, folder: "demo", enabled: false, dryRun: false });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "demo")), true);
});

test("moveGlobalSkill rejects destination collisions", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-collision-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "demo", "Demo disabled");

  assert.throws(
    () => moveGlobalSkill({ homeDir, folder: "demo", enabled: false, dryRun: false }),
    /destination already exists/,
  );
});

test("moveSkillRecord disables and enables agent-specific global skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-agent-skill-disable-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "demo", "Demo");

  const active = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: "codex" }).records[0];
  assert.ok(active);
  moveSkillRecord({ record: active, enabled: false, dryRun: false });
  assert.equal(existsSync(join(homeDir, ".codex", "skills", "demo")), false);
  assert.equal(existsSync(join(homeDir, ".codex", "skills", ".disabled", "demo")), true);

  const disabled = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: "codex" }).records[0];
  assert.ok(disabled);
  moveSkillRecord({ record: disabled, enabled: true, dryRun: false });
  assert.equal(existsSync(join(homeDir, ".codex", "skills", "demo")), true);
  assert.equal(existsSync(join(homeDir, ".codex", "skills", ".disabled", "demo")), false);
});

test("deleteGlobalSkill supports dry-run and permanently deletes active skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");

  deleteGlobalSkill({ homeDir, folder: "demo", dryRun: true });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), true);

  deleteGlobalSkill({ homeDir, folder: "demo", dryRun: false });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), false);
});

test("deleteGlobalSkills supports dry-run and permanently deletes multiple skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-many-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");

  const preview = deleteGlobalSkills({ homeDir, folders: ["alpha", "beta"], dryRun: true });
  assert.deepEqual(preview.map((item) => item.folder), ["alpha", "beta"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), true);

  const moved = deleteGlobalSkills({ homeDir, folders: ["alpha", "beta"], dryRun: false });
  assert.deepEqual(moved.map((item) => item.folder), ["alpha", "beta"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "beta")), false);
});

test("deleteGlobalSkills removes imported skills from the AFK catalog only", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-catalog-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  writeSkillCatalog(homeDir, {
    version: 1,
    defaultSource: "",
    scopes: [],
    items: [
      {
        id: "alpha",
        label: "Alpha",
        source: "acme/skills",
        args: ["--skill", "alpha"],
        default: false,
        imported: true,
      },
      {
        id: "beta",
        label: "Beta",
        source: "logbookfordevs/ai-field-kit",
        args: ["--skill", "beta"],
        default: true,
        imported: false,
      },
    ],
  });

  deleteGlobalSkills({ homeDir, folders: ["alpha", "beta"], dryRun: false });

  const written = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    items: Array<{ id: string; imported?: boolean }>;
  };
  assert.deepEqual(written.items.map((item) => ({ id: item.id, imported: item.imported })), [
    { id: "beta", imported: false },
  ]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "beta")), false);
});

test("skillProfilePaths resolves global and local profile files", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-profile-paths-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");

  assert.deepEqual(skillProfilePaths({ homeDir, cwd, local: false }), {
    catalogPath: join(localManifestDir(homeDir), "profiles.json"),
    statePath: join(homeDir, ".agents", "afk", "state", "skill-profiles.json"),
    skillsRoot: join(homeDir, ".agents", "skills"),
    disabledRoot: join(homeDir, ".agents", "skills", ".disabled"),
  });
  assert.deepEqual(skillProfilePaths({ homeDir, cwd, local: true }), {
    catalogPath: join(projectManifestDir(cwd), "profiles.json"),
    statePath: join(cwd, "afk", "state", "skill-profiles.json"),
    skillsRoot: join(homeDir, ".agents", "skills"),
    disabledRoot: join(homeDir, ".agents", "skills", ".disabled"),
  });
});

test("enableSkillProfile disables non-profile skills and preserves pre-disabled skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-profile-enable-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  writeSkill(join(homeDir, ".agents", "skills"), "compass", "Compass");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "old", "Old");
  writeSkillProfiles(homeDir, {
    version: 1,
    alwaysOn: ["compass"],
    items: [{ id: "engineering", name: "Engineering", skills: ["alpha"] }],
  });

  const enabled = enableSkillProfile({ homeDir, cwd, local: false }, "engineering", false);

  assert.deepEqual(enabled.state.enabledProfileIds, ["engineering"]);
  assert.deepEqual(enabled.state.profileMovedSkills, ["beta"]);
  assert.deepEqual(enabled.state.preExistingDisabledSkills, ["old"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "compass")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "beta")), true);

  const disabled = disableSkillProfile({ homeDir, cwd, local: false }, "engineering", false);
  assert.deepEqual(disabled.state.enabledProfileIds, []);
  assert.deepEqual(disabled.state.profileMovedSkills, []);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "beta")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "old")), true);
});

test("enableSkillProfile temporarily enables pre-disabled skills kept by a profile", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-profile-pre-disabled-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills", ".disabled"), "old", "Old");
  writeSkillProfiles(homeDir, {
    version: 1,
    alwaysOn: [],
    items: [{ id: "legacy", name: "Legacy", skills: ["old"] }],
  });

  const enabled = enableSkillProfile({ homeDir, cwd, local: false }, "legacy", false);

  assert.deepEqual(enabled.state.enabledProfileIds, ["legacy"]);
  assert.deepEqual(enabled.state.profileMovedSkills, ["alpha"]);
  assert.deepEqual(enabled.state.preExistingDisabledSkills, ["old"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "old")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "old")), false);

  const disabled = disableSkillProfile({ homeDir, cwd, local: false }, "legacy", false);
  assert.deepEqual(disabled.state.enabledProfileIds, []);
  assert.deepEqual(disabled.state.profileMovedSkills, []);
  assert.deepEqual(loadSkillProfileState({ homeDir, cwd, local: false }).preExistingDisabledSkills, ["old"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "old")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), true);
});

test("multiple enabled profiles keep the union of profile skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-profile-union-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  writeSkill(join(homeDir, ".agents", "skills"), "gamma", "Gamma");
  writeSkillProfiles(homeDir, {
    version: 1,
    alwaysOn: [],
    items: [
      { id: "front", name: "Front", skills: ["alpha"] },
      { id: "qa", name: "QA", skills: ["beta"] },
    ],
  });

  enableSkillProfile({ homeDir, cwd, local: false }, "front", false);
  const enabled = enableSkillProfile({ homeDir, cwd, local: false }, "qa", false);

  assert.deepEqual(enabled.state.enabledProfileIds, ["front", "qa"]);
  assert.deepEqual(enabled.state.profileMovedSkills, ["gamma"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "beta")), true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "gamma")), true);
});

test("runSkillsCommand profiles create writes profile catalog", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-profile-command-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  const output: string[] = [];

  const code = await runSkillsCommand(["skills", "profiles", "create", "engineering"], outputRuntime(output), {
    ...baseOptions(root),
    skillProfileName: "Engineering",
    skillProfileSkills: ["alpha"],
    skillProfileAlwaysOn: ["afk-compass"],
  });

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Profile Create Complete"));
  const catalog = JSON.parse(readFileSync(join(localManifestDir(homeDir), "profiles.json"), "utf8")) as SkillProfileCatalog;
  assert.deepEqual(catalog.alwaysOn, ["afk-compass"]);
  assert.deepEqual(catalog.items, [{ id: "engineering", name: "Engineering", skills: ["alpha"] }]);
});

test("runSkillsCommand add delegates to skills add and imports installed skills into catalog", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-add-command-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  const spawned: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (command, args, cwd) => {
      spawned.push({ command, args, ...(cwd ? { cwd } : {}) });
      writeSkill(join(homeDir, ".agents", "skills"), "demo-skill", "Demo Skill");
      writeGlobalSkillLock(homeDir, {
        "demo-skill": { source: "owner/skills", sourceType: "github" },
      });
      return { code: 0 };
    },
  };

  const code = await runSkillsCommand(["skills", "add", "owner/skills"], runtime, {
    ...baseOptions(root),
    skillAddArgs: ["--skill", "demo-skill", "--global", "--yes"],
    skillAddStartDisabled: false,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["skills", "add", "owner/skills", "--skill", "demo-skill", "--global", "--yes"],
    cwd: join(root, "project"),
  }]);
  const catalog = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as SkillManifest;
  assert.deepEqual(catalog.scopes?.map((scope) => scope.id), ["uncategorized"]);
  assert.deepEqual(catalog.items.map((item) => ({
    id: item.id,
    imported: item.imported,
    scope: item.catalog?.scope,
  })), [{
    id: "demo-skill",
    imported: true,
    scope: "uncategorized",
  }]);
  assert.ok(output.join("\n").includes("Skill Catalog"));
});

test("runSkillsCommand add handles start-disabled as an AFK flag", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-add-start-disabled-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  const spawned: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async (command, args, cwd) => {
      spawned.push({ command, args, ...(cwd ? { cwd } : {}) });
      writeSkill(join(homeDir, ".agents", "skills"), "demo-skill", "Demo Skill");
      writeGlobalSkillLock(homeDir, {
        "demo-skill": { source: "owner/skills", sourceType: "github" },
      });
      return { code: 0 };
    },
  };

  const code = await runSkillsCommand(["skills", "add", "owner/skills"], runtime, {
    ...baseOptions(root),
    skillAddArgs: ["--skill", "demo-skill", "--global", "--yes"],
    skillAddStartDisabled: true,
  });

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["skills", "add", "owner/skills", "--skill", "demo-skill", "--global", "--yes"],
    cwd: join(root, "project"),
  }]);
  const catalog = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as SkillManifest;
  assert.equal(catalog.items[0]?.startDisabled, true);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo-skill")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", ".disabled", "demo-skill")), true);
  assert.ok(output.join("\n").includes("Storage"));
});

test("deleteSkillRecords permanently deletes agent-specific skills", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-agent-skill-delete-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "demo", "Global Demo");
  writeSkill(join(cwd, ".codex", "skills"), "demo", "Project Demo");
  const records = loadSkillCatalog({ homeDir, cwd, scope: "all", agent: "codex" }).records;

  const moved = deleteSkillRecords({ homeDir, records, dryRun: false });

  assert.deepEqual(moved.map((item) => item.folder), ["demo", "demo"]);
  assert.equal(existsSync(join(homeDir, ".codex", "skills", "demo")), false);
  assert.equal(existsSync(join(cwd, ".codex", "skills", "demo")), false);
});

test("filterManifestSkillRecords keeps only global skills from AFK skills manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-manifest-filter-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  writeSkillManifest(homeDir, ["alpha"]);
  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(filterManifestSkillRecords(snapshot.records, { homeDir }).map((record) => record.folder), ["alpha"]);
});

test("runSkillsCommand delete --manifest-only rejects explicit skills outside AFK manifest", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-delete-manifest-explicit-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");
  writeSkillManifest(homeDir, ["alpha"]);

  const code = await runSkillsCommand(["skills", "delete", "beta"], outputRuntime(output), {
    ...baseOptions(root),
    dryRun: true,
    skillsDeleteManifestOnly: true,
  });

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("Skill not found in skills.json manifest: beta"));
});

test("runSkillsCommand deletes agent-specific global skills with --agent", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-agent-skill-delete-command-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(join(homeDir, ".claude", "skills"), "frontend-design", "Frontend Design");

  const code = await runSkillsCommand(["skills", "delete", "frontend-design"], outputRuntime(output), {
    ...baseOptions(root),
    dryRun: true,
    skillsAgent: "claude",
  });

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Delete Preview"));
  assert.ok(output.join("\n").includes(".claude/skills/frontend-design"));
});

test("runSkillsCommand disables agent-specific global skills with --agent", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-agent-skill-disable-command-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(join(homeDir, ".codex", "skills"), "demo", "Demo");

  const code = await runSkillsCommand(["skills", "disable", "demo"], outputRuntime(output), {
    ...baseOptions(root),
    skillsAgent: "codex",
  });

  assert.equal(code, 0);
  assert.equal(existsSync(join(homeDir, ".codex", "skills", "demo")), false);
  assert.equal(existsSync(join(homeDir, ".codex", "skills", ".disabled", "demo")), true);
});

test("runSkillsCommand disables auto invocation metadata for one skill", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-invocation-disable-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo", {
    disableModelInvocation: false,
    openAiImplicitInvocation: true,
  });

  const code = await runSkillsCommand(["skills", "invocation", "disable", "demo"], outputRuntime(output), baseOptions(root));

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Auto Invocation Complete"));
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "demo", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "demo", "agents", "openai.yaml"), "utf8"), /allow_implicit_invocation: false/);
});

test("runSkillsCommand previews auto invocation enable without writing metadata", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-invocation-enable-dry-"));
  const homeDir = join(root, "home");
  const output: string[] = [];
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo", {
    disableModelInvocation: true,
    openAiImplicitInvocation: false,
  });

  const code = await runSkillsCommand(["skills", "invocation", "enable", "demo"], outputRuntime(output), {
    ...baseOptions(root),
    dryRun: true,
  });

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Auto Invocation Preview"));
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "demo", "SKILL.md"), "utf8"), /disable-model-invocation: true/);
  assert.match(readFileSync(join(homeDir, ".agents", "skills", "demo", "agents", "openai.yaml"), "utf8"), /allow_implicit_invocation: false/);
});

test("runSkillsCommand enables agent-specific project skills with --scope project --agent", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-agent-skill-enable-command-"));
  const cwd = join(root, "project");
  const output: string[] = [];
  writeSkill(join(cwd, ".claude", "skills", ".disabled"), "demo", "Demo");

  const code = await runSkillsCommand(["skills", "enable", "demo"], outputRuntime(output), {
    ...baseOptions(root),
    scopeExplicit: true,
    skillsListScope: "project",
    skillsAgent: "claude",
  });

  assert.equal(code, 0);
  assert.equal(existsSync(join(cwd, ".claude", "skills", "demo")), true);
  assert.equal(existsSync(join(cwd, ".claude", "skills", ".disabled", "demo")), false);
});

test("renderSkillDeleteBatch summarizes multiple selected skills", () => {
  assert.equal(renderSkillDeleteBatch({
    dryRun: true,
    items: [
      { folder: "alpha", movement: "/skills/alpha -> (deleted)" },
      { folder: "beta", movement: "/skills/beta -> (deleted)" },
    ],
  }), [
    "◆ Delete Preview",
    "Would permanently delete 2 skills",
    "• alpha /skills/alpha -> (deleted)",
    "• beta /skills/beta -> (deleted)",
  ].join("\n"));
});

test("buildSkillOpenCommand targets files, folders, and supported apps", () => {
  const record: SkillRecord = {
    folder: "demo",
    name: "Demo",
    originalName: "Demo",
    description: "Demo description",
    rootLabel: "Global Library",
    rootPath: "/tmp/skills",
    skillFilePath: "/tmp/skills/demo/SKILL.md",
    storage: "active",
    rootKind: "global-library",
    readOnly: false,
    agent: undefined,
    category: undefined,
    categoryId: undefined,
    tags: [],
    autoInvocation: "default",
    autoInvocationSources: [],
    autoInvocationDetails: [],
  };

  assert.deepEqual(buildSkillOpenCommand(record, { app: "finder", target: "file" }), {
    command: "open",
    args: ["/tmp/skills/demo/SKILL.md"],
    targetPath: "/tmp/skills/demo/SKILL.md",
  });
  assert.deepEqual(buildSkillOpenCommand(record, { app: "cursor", target: "folder" }), {
    command: "cursor",
    args: ["/tmp/skills/demo"],
    targetPath: "/tmp/skills/demo",
  });
});

test("renderSkillChoice separates core picker fields", () => {
  assert.equal(renderSkillChoice({
    folder: "demo",
    name: "Demo Skill",
    originalName: "Demo Skill",
    description: "Demo description",
    rootLabel: "Global Library",
    rootPath: "/tmp/skills",
    skillFilePath: "/tmp/skills/demo/SKILL.md",
    storage: "active",
    rootKind: "global-library",
    readOnly: false,
    agent: undefined,
    category: "Docs",
    categoryId: "docs",
    tags: [],
    autoInvocation: "enabled",
    autoInvocationSources: ["SKILL.md"],
    autoInvocationDetails: ["SKILL.md enables"],
  }), "Demo Skill [demo] Global Library · active · managed · auto · Docs");

  assert.equal(renderSkillChoice({
    folder: "disabled-demo",
    name: "Disabled Demo",
    originalName: "Disabled Demo",
    description: "Demo description",
    rootLabel: "Global Library / Disabled",
    rootPath: "/tmp/skills/.disabled",
    skillFilePath: "/tmp/skills/.disabled/disabled-demo/SKILL.md",
    storage: "disabled",
    rootKind: "global-library",
    readOnly: false,
    agent: undefined,
    category: undefined,
    categoryId: undefined,
    tags: [],
    autoInvocation: "disabled",
    autoInvocationSources: ["agents/openai.yaml"],
    autoInvocationDetails: ["agents/openai.yaml disables"],
  }), "Disabled Demo [disabled-demo] Global Library / Disabled · disabled · managed · manual");
});

test("renderSkillDetails shows mixed auto invocation diagnostics", () => {
  const output = renderSkillDetails({
    folder: "mixed-demo",
    name: "Mixed Demo",
    originalName: "Mixed Demo",
    description: "Demo description",
    rootLabel: "Global Library",
    rootPath: "/tmp/skills",
    skillFilePath: "/tmp/skills/mixed-demo/SKILL.md",
    storage: "active",
    rootKind: "global-library",
    readOnly: false,
    agent: undefined,
    category: undefined,
    categoryId: undefined,
    tags: [],
    autoInvocation: "mixed",
    autoInvocationSources: ["SKILL.md", "agents/openai.yaml"],
    autoInvocationDetails: ["SKILL.md disables", "agents/openai.yaml enables"],
  });

  assert.ok(output.includes("Auto       mixed"));
  assert.ok(output.includes("Auto source SKILL.md disables, agents/openai.yaml enables"));
});

test("loadLockedSkills reads global and project tracked skills by scope", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-upgrade-locks-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeGlobalSkillLock(homeDir, {
    "global-skill": {
      source: "owner/global",
      sourceType: "github",
      skillPath: "skills/global-skill/SKILL.md",
      skillFolderHash: "abc",
      updatedAt: "2026-05-27T00:00:00.000Z",
    },
  });
  writeProjectSkillLock(cwd, {
    "project-skill": {
      source: "owner/project",
      sourceType: "github",
      skillPath: "skills/project-skill/SKILL.md",
    },
    "local-skill": {
      source: "../local",
      sourceType: "local",
      skillPath: "SKILL.md",
    },
  });

  assert.deepEqual(loadLockedSkills({ homeDir, cwd, scope: "global" }).map((record) => record.name), ["global-skill"]);
  assert.deepEqual(loadLockedSkills({ homeDir, cwd, scope: "project" }).map((record) => record.name), ["project-skill"]);
  assert.deepEqual(loadLockedSkills({ homeDir, cwd, scope: "all" }).map((record) => record.name), ["global-skill", "project-skill"]);
});

test("buildSkillUpgradeCommands delegates through npx skills update", () => {
  assert.deepEqual(buildSkillUpgradeCommands({
    cwd: "/tmp/project",
    scope: "global",
    skills: ["frontend-design", "web-design-guidelines"],
    yes: true,
  }), [{
    label: "Global skills",
    command: "npx",
    args: ["--yes", "skills", "update", "frontend-design", "web-design-guidelines", "-g", "-y"],
    cwd: "/tmp/project",
    scope: "global",
  }]);

  assert.deepEqual(buildSkillUpgradeCommands({
    cwd: "/tmp/project",
    scope: "all",
    skills: [],
    yes: false,
  }).map((command) => command.args), [
    ["--yes", "skills", "update", "-g"],
    ["--yes", "skills", "update", "-p"],
  ]);
});

test("formatLockedSkillChoice separates name scope and source", () => {
  assert.equal(formatLockedSkillChoice({
    name: "afk-note",
    scope: "global",
    source: "logbookfordevs/ai-field-kit",
    sourceType: "github",
    skillPath: "skills/afk-note/SKILL.md",
    updatedAt: undefined,
  }), "afk-note [global] logbookfordevs/ai-field-kit");
});

test("runSkillsCommand upgrade --all skips upstream when no tracked skills exist", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-upgrade-empty-"));
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      throw new Error("spawn should not run without tracked skills");
    },
  };

  const code = await runSkillsCommand(["skills", "upgrade"], runtime, {
    ...baseOptions(root),
    skillsUpgradeAll: true,
  });

  assert.equal(code, 1);
  assert.ok(output.join("\n").includes("No global tracked skills found."));
});

test("runSkillsCommand upgrade explicit names invokes global update by default", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-upgrade-run-"));
  writeGlobalSkillLock(join(root, "home"), {
    demo: {
      source: "owner/demo",
      sourceType: "github",
      skillPath: "skills/demo/SKILL.md",
      skillFolderHash: "abc",
    },
  });
  const spawned: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const runtime: Runtime = {
    io: {
      stdout: () => undefined,
      stderr: () => undefined,
    },
    spawn: async (command, args, cwd) => {
      spawned.push(cwd ? { command, args, cwd } : { command, args });
      return { code: 0 };
    },
  };

  const code = await runSkillsCommand(["skills", "upgrade", "demo"], runtime, baseOptions(root));

  assert.equal(code, 0);
  assert.deepEqual(spawned, [{
    command: "npx",
    args: ["--yes", "skills", "update", "demo", "-g"],
    cwd: join(root, "project"),
  }]);
});

test("syncSkillCatalogFromManifest adds setup skills to canonical catalog", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-catalog-sync-"));
  const homeDir = join(root, "home");
  writeSkillManifest(homeDir, ["alpha", "beta"]);

  const result = syncSkillCatalogFromManifest({
    homeDir,
    selectedSkillIds: ["beta"],
    allSkills: false,
    dryRun: false,
  });

  assert.equal(result.path, skillCatalogPath(homeDir));
  assert.deepEqual(result.added, ["beta"]);
  const written = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    scopes: Array<{ id: string }>;
    items: Array<{ id: string; imported?: boolean; catalog?: { scope?: string } }>;
  };
  assert.ok(written.scopes.some((scope) => scope.id === "uncategorized"));
  assert.deepEqual(
    written.items.map((item) => ({ id: item.id, imported: item.imported, scope: item.catalog?.scope })),
    [
      { id: "alpha", imported: undefined, scope: undefined },
      { id: "beta", imported: true, scope: "uncategorized" },
    ],
  );
});

test("syncSkillCatalogFromManifest preserves existing legacy catalog entries and writes canonical catalog", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-catalog-sync-legacy-"));
  const homeDir = join(root, "home");
  writeSkillManifest(homeDir, ["alpha", "beta"]);
  writeSkillCatalog(homeDir, {
    version: 1,
    scopes: [{ id: "docs", label: "Docs" }],
    skills: [{ folder: "alpha", name: "Alpha", scope: "docs" }],
  }, { legacy: true });

  const result = syncSkillCatalogFromManifest({
    homeDir,
    selectedSkillIds: [],
    allSkills: true,
    dryRun: false,
  });

  assert.deepEqual(result.added, ["beta"]);
  const written = JSON.parse(readFileSync(skillCatalogPath(homeDir), "utf8")) as {
    scopes: Array<{ id: string }>;
    items: Array<{ id: string; label: string; catalog?: { scope?: string } }>;
  };
  assert.deepEqual(written.items.map((skill) => skill.id), ["alpha", "beta"]);
  assert.equal(written.items[0]?.label, "alpha");
  assert.equal(written.items[0]?.catalog?.scope, "docs");
  assert.equal(written.items[1]?.catalog?.scope, "uncategorized");
  assert.ok(written.scopes.some((scope) => scope.id === "docs"));
  assert.ok(written.scopes.some((scope) => scope.id === "uncategorized"));
});

test("buildCodexCategorizationCommand targets skills.json with codex exec", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-categorize-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");

  const built = buildCodexCategorizationCommand({
    homeDir,
    cwd,
    mode: "append-missing",
    instruction: "Prefer docs categories.",
  });

  assert.equal(built.command, "codex");
  assert.deepEqual(built.args.slice(0, 7), [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--color",
    "never",
    "--ephemeral",
  ]);
  assert.equal(built.cwd, join(homeDir, ".agents", "afk", "catalog"));
  assert.ok(built.args.includes(join(homeDir, ".agents", "afk", "catalog")));
  assert.ok(built.args.includes(join(homeDir, ".agents", "skills")));
  assert.ok(built.prompt.includes(skillCatalogFileName));
  assert.ok(built.prompt.includes("~/.agents/afk/catalog/skills.json"));
  assert.ok(built.prompt.includes("Prefer docs categories."));
});

test("runCodexCategorization dry-run does not spawn codex", async () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-categorize-dry-"));
  const output: string[] = [];
  const runtime: Runtime = {
    io: {
      stdout: (message) => output.push(message),
      stderr: (message) => output.push(message),
    },
    spawn: async () => {
      throw new Error("spawn should not run during dry-run");
    },
  };

  const code = await runCodexCategorization(runtime, {
    homeDir: join(root, "home"),
    cwd: join(root, "project"),
    dryRun: true,
    mode: undefined,
    instruction: undefined,
  });

  assert.equal(code, 0);
  assert.ok(output.join("\n").includes("Prompt Preview"));
});

function writeSkill(root: string, folder: string, name: string, options: {
  disableModelInvocation?: boolean;
  openAiImplicitInvocation?: boolean;
} = {}): void {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "SKILL.md"), [
    "---",
    `name: ${name}`,
    `description: ${name} description`,
    ...(options.disableModelInvocation === undefined ? [] : [`disable-model-invocation: ${options.disableModelInvocation ? "true" : "false"}`]),
    "---",
    "",
    `# ${name}`,
    "",
  ].join("\n"));
  if (options.openAiImplicitInvocation !== undefined) {
    mkdirSync(join(root, folder, "agents"), { recursive: true });
    writeFileSync(
      join(root, folder, "agents", "openai.yaml"),
      `policy:\n  allow_implicit_invocation: ${options.openAiImplicitInvocation ? "true" : "false"}\n`,
    );
  }
}

function writeSkillCatalog(homeDir: string, content: unknown, options: { legacy?: boolean } = {}): void {
  const path = options.legacy ? legacySkillCatalogPath(homeDir) : skillCatalogPath(homeDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(options.legacy ? content : skillManifestFixture(content), null, 2)}\n`);
}

function writeSkillProfiles(homeDir: string, content: SkillProfileCatalog): void {
  const path = join(localManifestDir(homeDir), "profiles.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(content, null, 2)}\n`);
}

function skillManifestFixture(content: unknown): unknown {
  if (!content || typeof content !== "object" || !("skills" in content)) {
    return content;
  }

  const definition = content as {
    version?: number;
    scopes?: Array<{ id: string; label: string; description?: string }>;
    skills?: Array<{ folder: string; name?: string; scope: string; tags?: string[] }>;
  };

  return {
    version: definition.version ?? 1,
    defaultSource: "",
    scopes: definition.scopes ?? [],
    items: (definition.skills ?? []).map((skill) => ({
      id: skill.folder,
      label: skill.name ?? skill.folder,
      source: "",
      args: ["--skill", skill.folder],
      default: false,
      autoInvocation: true,
      role: "utility",
      catalog: {
        scope: skill.scope,
        ...(skill.tags ? { tags: skill.tags } : {}),
      },
    })),
  };
}

function writeGlobalSkillLock(homeDir: string, skills: Record<string, object>): void {
  mkdirSync(join(homeDir, ".agents"), { recursive: true });
  writeFileSync(join(homeDir, ".agents", ".skill-lock.json"), JSON.stringify({ version: 3, skills }));
}

function writeProjectSkillLock(cwd: string, skills: Record<string, object>): void {
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, "skills-lock.json"), JSON.stringify({ version: 1, skills }));
}

function writeSkillManifest(homeDir: string, ids: string[]): void {
  mkdirSync(localManifestDir(homeDir), { recursive: true });
  writeFileSync(join(localManifestDir(homeDir), "skills.json"), JSON.stringify({
    version: 1,
    defaultSource: "",
    items: ids.map((id) => ({
      id,
      label: id,
      source: "https://github.com/example/skills",
      args: ["--skill", id],
      default: true,
    })),
  }));
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

function baseOptions(root: string) {
  return {
    agents: [],
    setupScope: "global" as const,
    scopeExplicit: false,
    dryRun: false,
    verbose: false,
    yes: false,
    allSkills: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    skillAddArgs: [],
    skillAddStartDisabled: false,
    selectedMcpIds: [],
    selectedPluginIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest" as const,
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
    skillsListScope: "all" as const,
    skillsUpgradeScope: "global" as const,
    skillsUpgradeAll: false,
    skillsDeleteManifestOnly: false,
    skillsAgent: undefined,
    skillsJson: false,
    skillsCategory: "",
    skillsTag: "",
    skillsUncategorized: false,
    skillOpenApp: "finder" as const,
    skillOpenTarget: "file" as const,
    skillCategorizationMode: undefined,
    skillCategorizationRunner: "codex-exec" as const,
    skillCategorizationInstruction: "",
    selectedManifestCategories: [],
    homeDir: join(root, "home"),
    repoDir: root,
    cwd: join(root, "project"),
  };
}

function skillRecord(input: { folder: string; rootPath: string }): SkillRecord {
  return {
    folder: input.folder,
    name: input.folder,
    originalName: input.folder,
    description: "Demo description",
    rootLabel: "Codex",
    rootPath: input.rootPath,
    skillFilePath: join(input.rootPath, input.folder, "SKILL.md"),
    storage: "active",
    rootKind: "agent-library",
    readOnly: true,
    agent: "codex",
    category: undefined,
    categoryId: undefined,
    tags: [],
    autoInvocation: "default",
    autoInvocationSources: [],
    autoInvocationDetails: [],
  };
}
