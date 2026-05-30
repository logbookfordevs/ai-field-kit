import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  afkSkillsTaxonomyFileName,
  filterSkillRecords,
  loadSkillCatalog,
  moveGlobalSkill,
  normalizeSkillDescription,
  parseSkillFile,
  renameCodexSkillMetadata,
  renameGlobalSkill,
  trashGlobalSkill,
  trashGlobalSkills,
  updateOpenAiMetadataDisplayName,
  type SkillRecord,
} from "./skills/catalog.js";
import { buildCodexCategorizationCommand, runCodexCategorization } from "./skills/categorization.js";
import { buildSkillOpenCommand, filterSkillChoices, formatLockedSkillChoice, runSkillsCommand } from "./skills/commands.js";
import { renderSkillChoice, renderSkillTrashBatch } from "./skills/render.js";
import { buildSkillUpgradeCommands, loadLockedSkills } from "./skills/upgrade.js";
import type { Runtime } from "./types.js";

test("parseSkillFile reads frontmatter name and description", () => {
  const metadata = parseSkillFile("---\nname: demo\ndescription: Demo skill\n---\n\n# Demo\n", "fallback");

  assert.equal(metadata.name, "demo");
  assert.equal(metadata.description, "Demo skill");
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
  writeFileSync(join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName), JSON.stringify({
    version: 1,
    scopes: [{ id: "docs", label: "Docs" }],
    skills: [{ folder: "z-active", name: "Alpha Active", scope: "docs", tags: ["docs"], platforms: ["generic"] }],
  }));

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "all", agent: undefined });

  assert.deepEqual(snapshot.records.map((record) => record.folder), [
    "z-active",
    "a-disabled",
    "codex-skill",
    "claude-skill",
  ]);
  assert.equal(snapshot.records[0]?.name, "Alpha Active");
  assert.equal(snapshot.records[0]?.category, "Docs");
  assert.equal(snapshot.records[2]?.readOnly, true);
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

test("loadSkillCatalog lists read-only installed agent roots with --scope agent", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-installed-agent-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "codex-global", "Codex Global");
  writeSkill(join(homeDir, ".gemini", "skills"), "gemini-global", "Gemini Global");
  writeSkill(join(homeDir, ".agents", "skills"), "shared-global", "Shared Global");
  writeSkill(join(cwd, ".codex", "skills"), "codex-project", "Codex Project");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "agent", agent: undefined });

  assert.deepEqual(snapshot.records.map((record) => record.folder), ["codex-global", "gemini-global"]);
  assert.deepEqual(snapshot.records.map((record) => record.rootKind), ["agent-library", "agent-library"]);
  assert.equal(snapshot.records.every((record) => record.readOnly), true);
});

test("loadSkillCatalog filters installed agent roots by agent", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-installed-agent-filter-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".codex", "skills"), "codex-global", "Codex Global");
  writeSkill(join(homeDir, ".gemini", "skills"), "gemini-global", "Gemini Global");

  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "agent", agent: "gemini" });

  assert.deepEqual(snapshot.records.map((record) => record.folder), ["gemini-global"]);
});

test("filterSkillChoices searches folders, names, categories, tags, and roots", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-filter-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "doc-helper", "Doc Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "review-helper", "Review Helper");
  writeFileSync(join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName), JSON.stringify({
    version: 1,
    scopes: [
      { id: "docs", label: "Docs" },
      { id: "review", label: "Review" },
    ],
    skills: [
      { folder: "doc-helper", name: "Doc Helper", scope: "docs", tags: ["writing"] },
      { folder: "review-helper", name: "Review Helper", scope: "review", tags: ["critique"] },
    ],
  }));
  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(filterSkillChoices(snapshot.records, "writing").map((record) => record.folder), ["doc-helper"]);
  assert.deepEqual(filterSkillChoices(snapshot.records, "review helper").map((record) => record.folder), ["review-helper"]);
});

test("filterSkillRecords filters by category, tag, platform, and uncategorized", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skills-list-filters-"));
  const homeDir = join(root, "home");
  const cwd = join(root, "project");
  writeSkill(join(homeDir, ".agents", "skills"), "doc-helper", "Doc Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "review-helper", "Review Helper");
  writeSkill(join(homeDir, ".agents", "skills"), "plain-helper", "Plain Helper");
  writeFileSync(join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName), JSON.stringify({
    version: 1,
    scopes: [
      { id: "docs", label: "Docs" },
      { id: "review", label: "Review" },
    ],
    skills: [
      { folder: "doc-helper", name: "Doc Helper", scope: "docs", tags: ["writing"], platforms: ["generic"] },
      { folder: "review-helper", name: "Review Helper", scope: "review", tags: ["critique"], platforms: ["codex"] },
    ],
  }));
  const snapshot = loadSkillCatalog({ homeDir, cwd, scope: "global", agent: undefined });

  assert.deepEqual(filterSkillRecords(snapshot.records, { category: "Docs" }).map((record) => record.folder), ["doc-helper"]);
  assert.deepEqual(filterSkillRecords(snapshot.records, { tag: "critique" }).map((record) => record.folder), ["review-helper"]);
  assert.deepEqual(filterSkillRecords(snapshot.records, { platform: "generic" }).map((record) => record.folder), ["doc-helper"]);
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

test("trashGlobalSkill supports dry-run and moves active skills to Trash", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-trash-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");

  trashGlobalSkill({ homeDir, folder: "demo", dryRun: true, platform: "darwin" });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), true);
  assert.equal(existsSync(join(homeDir, ".Trash", "demo")), false);

  trashGlobalSkill({ homeDir, folder: "demo", dryRun: false, platform: "darwin" });
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "demo")), false);
  assert.equal(existsSync(join(homeDir, ".Trash", "demo")), true);
});

test("trashGlobalSkills supports dry-run and moves multiple skills to Trash", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-trash-many-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "alpha", "Alpha");
  writeSkill(join(homeDir, ".agents", "skills"), "beta", "Beta");

  const preview = trashGlobalSkills({ homeDir, folders: ["alpha", "beta"], dryRun: true, platform: "darwin" });
  assert.deepEqual(preview.map((item) => item.folder), ["alpha", "beta"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), true);
  assert.equal(existsSync(join(homeDir, ".Trash", "alpha")), false);

  const moved = trashGlobalSkills({ homeDir, folders: ["alpha", "beta"], dryRun: false, platform: "darwin" });
  assert.deepEqual(moved.map((item) => item.folder), ["alpha", "beta"]);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "alpha")), false);
  assert.equal(existsSync(join(homeDir, ".agents", "skills", "beta")), false);
  assert.equal(existsSync(join(homeDir, ".Trash", "alpha")), true);
  assert.equal(existsSync(join(homeDir, ".Trash", "beta")), true);
});

test("trashGlobalSkill rejects unsupported platforms", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-trash-platform-"));
  const homeDir = join(root, "home");
  writeSkill(join(homeDir, ".agents", "skills"), "demo", "Demo");

  assert.throws(
    () => trashGlobalSkill({ homeDir, folder: "demo", dryRun: false, platform: "linux" }),
    /macOS only/,
  );
});

test("renderSkillTrashBatch summarizes multiple selected skills", () => {
  assert.equal(renderSkillTrashBatch({
    dryRun: true,
    items: [
      { folder: "alpha", movement: "/skills/alpha -> ~/.Trash/alpha" },
      { folder: "beta", movement: "/skills/beta -> ~/.Trash/beta" },
    ],
  }), [
    "◆ Trash Preview",
    "Would move 2 skills to Trash",
    "• alpha /skills/alpha -> ~/.Trash/alpha",
    "• beta /skills/beta -> ~/.Trash/beta",
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
    platforms: [],
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
    platforms: [],
  }), "Demo Skill [demo] Global Library · active · managed · Docs");

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
    platforms: [],
  }), "Disabled Demo [disabled-demo] Global Library / Disabled · disabled · managed");
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

test("renameGlobalSkill updates existing afk-skills entry", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-rename-"));
  const homeDir = join(root, "home");
  const path = join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName);
  mkdirSync(join(homeDir, ".agents", "skills"), { recursive: true });
  writeFileSync(path, JSON.stringify({
    version: 1,
    scopes: [{ id: "docs", label: "Docs" }],
    skills: [{ folder: "demo", name: "Demo", scope: "docs" }],
  }));

  renameGlobalSkill({ homeDir, folder: "demo", displayName: "Better Demo", dryRun: false });

  const next = JSON.parse(readFileSync(path, "utf8")) as { skills: Array<{ folder: string; name: string }> };
  assert.equal(next.skills[0]?.name, "Better Demo");
});

test("renameGlobalSkill adds missing entries to uncategorized scope", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-rename-new-"));
  const homeDir = join(root, "home");
  const path = join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName);
  mkdirSync(join(homeDir, ".agents", "skills"), { recursive: true });
  writeFileSync(path, JSON.stringify({ version: 1, scopes: [], skills: [] }));

  renameGlobalSkill({ homeDir, folder: "demo", displayName: "Demo", dryRun: false });

  const next = JSON.parse(readFileSync(path, "utf8")) as {
    scopes: Array<{ id: string }>;
    skills: Array<{ folder: string; scope: string }>;
  };
  assert.equal(next.skills[0]?.scope, "uncategorized");
  assert.ok(next.scopes.some((scope) => scope.id === "uncategorized"));
});

test("renameGlobalSkill requires an existing valid afk-skills file", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-rename-missing-"));
  const homeDir = join(root, "home");

  assert.throws(
    () => renameGlobalSkill({ homeDir, folder: "demo", displayName: "Demo", dryRun: false }),
    /Run afk skills categorize first/,
  );
});

test("updateOpenAiMetadataDisplayName updates existing interface display name", () => {
  const next = updateOpenAiMetadataDisplayName(
    [
      "interface:",
      "  display_name: \"Old Name\"",
      "  short_description: \"Short\"",
      "policy:",
      "  allow_implicit_invocation: true",
      "",
    ].join("\n"),
    "New Name",
  );

  assert.equal(next, [
    "interface:",
    "  display_name: \"New Name\"",
    "  short_description: \"Short\"",
    "policy:",
    "  allow_implicit_invocation: true",
    "",
  ].join("\n"));
});

test("updateOpenAiMetadataDisplayName creates interface display name when missing", () => {
  assert.equal(updateOpenAiMetadataDisplayName("", "New Name"), "interface:\n  display_name: \"New Name\"\n");
  assert.equal(
    updateOpenAiMetadataDisplayName("policy:\n  allow_implicit_invocation: true\n", "New Name"),
    "interface:\n  display_name: \"New Name\"\npolicy:\n  allow_implicit_invocation: true\n",
  );
});

test("renameCodexSkillMetadata writes agents openai yaml", () => {
  const root = mkdtempSync(join(tmpdir(), "afk-skill-codex-metadata-"));
  const skillRoot = join(root, "skills");
  writeSkill(skillRoot, "demo", "Demo");
  const record = skillRecord({ folder: "demo", rootPath: skillRoot });

  const path = renameCodexSkillMetadata({ record, displayName: "Better Demo", dryRun: false });

  assert.equal(path, join(skillRoot, "demo", "agents", "openai.yaml"));
  assert.equal(readFileSync(path, "utf8"), "interface:\n  display_name: \"Better Demo\"\n");
});

test("buildCodexCategorizationCommand targets afk-skills.json with codex exec", () => {
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
  assert.ok(built.prompt.includes(afkSkillsTaxonomyFileName));
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

function writeSkill(root: string, folder: string, name: string): void {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(join(root, folder, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} description\n---\n\n# ${name}\n`);
}

function writeGlobalSkillLock(homeDir: string, skills: Record<string, object>): void {
  mkdirSync(join(homeDir, ".agents"), { recursive: true });
  writeFileSync(join(homeDir, ".agents", ".skill-lock.json"), JSON.stringify({ version: 3, skills }));
}

function writeProjectSkillLock(cwd: string, skills: Record<string, object>): void {
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, "skills-lock.json"), JSON.stringify({ version: 1, skills }));
}

function baseOptions(root: string) {
  return {
    agents: [],
    setupScope: "global" as const,
    scopeExplicit: false,
    dryRun: false,
    yes: false,
    includeExternal: false,
    selectedSkillIds: [],
    selectedSkillAgentIds: [],
    selectedMcpIds: [],
    selectedUtilIds: [],
    selectedHookIds: [],
    rulesRef: "main",
    rulesSource: "manifest" as const,
    initOnly: false,
    empty: false,
    refreshDefaults: false,
    defaultsSource: "",
    manifestLocal: false,
    manifestConfigureLocal: false,
    manifestConfigureFromCurrent: false,
    skillsListScope: "all" as const,
    skillsUpgradeScope: "global" as const,
    skillsUpgradeAll: false,
    skillsAgent: undefined,
    skillsJson: false,
    skillsCategory: "",
    skillsTag: "",
    skillsPlatform: "",
    skillsUncategorized: false,
    skillOpenApp: "finder" as const,
    skillOpenTarget: "file" as const,
    skillAgentMetadata: undefined,
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
    platforms: [],
  };
}
