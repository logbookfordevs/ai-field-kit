import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { migrateCatalogReferences, migratedCatalogSource, readRememberedDefaultsSource, loadSkillManifest, ensureLocalManifests } from "./manifest.js";

test("legacy built-in references migrate without changing custom sources, pins, or policy", () => {
  const original = JSON.stringify({
    defaultsSource: "logbookfordevs/ai-field-kit",
    favoriteSources: ["https://github.com/logbookfordevs/ai-field-kit", "acme/custom"],
    items: [
      { id: "keep", source: "https://github.com/logbookfordevs/ai-field-kit", default: false, invocation: "manual" },
      { id: "custom", source: "https://github.com/logbookfordevs/ai-field-kit-extra" },
      { source: "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/abc123/rules/AGENTS.md" },
      { source: "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit/main/rules/AGENTS.md" },
    ],
  });
  const migrated = migrateCatalogReferences(original);
  const result = JSON.parse(migrated);
  assert.equal(result.defaultsSource, "logbookfordevs/logbook-atlas");
  assert.deepEqual(result.favoriteSources, ["https://github.com/logbookfordevs/logbook-atlas", "acme/custom"]);
  assert.equal(result.items[0].default, false);
  assert.equal(result.items[0].invocation, "manual");
  assert.equal(result.items[1].source, "https://github.com/logbookfordevs/ai-field-kit-extra");
  assert.match(result.items[2].source, /ai-field-kit\/abc123/);
  assert.match(result.items[3].source, /logbook-atlas\/main\/rules/);
  assert.equal(migrateCatalogReferences(migrated), migrated);
  assert.equal(migratedCatalogSource("/work/ai-field-kit"), "/work/ai-field-kit");
  assert.equal(migratedCatalogSource("https://github.com/logbookfordevs/ai-field-kit/tree/main/packages/afk/catalog"), "https://github.com/logbookfordevs/logbook-atlas/tree/main/afk/catalog");
});

test("cached legacy sources work immediately and migrate through planned writes without fetching", async () => {
  const homeDir = mkdtempSync(join(tmpdir(), "afk-migrate-"));
  const dir = join(homeDir, ".agents", "afk", "catalog");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "presets.json"), JSON.stringify({ version: 1, defaultsSource: "logbookfordevs/ai-field-kit", presets: [] }));
  writeFileSync(join(dir, "skills.json"), JSON.stringify({ version: 1, defaultSource: "logbookfordevs/ai-field-kit", items: [{ id: "customized", label: "Mine", source: "https://github.com/logbookfordevs/ai-field-kit", args: ["--skill", "afk-cli"], default: false }] }));
  assert.equal(readRememberedDefaultsSource({ homeDir, manifestLocal: false }), "logbookfordevs/logbook-atlas");
  assert.equal(loadSkillManifest({ homeDir }).items[0]?.source, "https://github.com/logbookfordevs/logbook-atlas");
  const operations = await ensureLocalManifests({ homeDir, manifestLocal: false, empty: false, defaultsSource: "", refreshDefaults: false, dryRun: false, repoDir: "/unused", rulesSource: "github", rulesRef: "main", selectedManifestCategories: ["skills", "presets"] });
  assert.equal(operations.filter(op => op.type === "write").length, 2);
});


test("skill updates migrate only selected legacy lock entries and preserve a backup", async () => {
  const { migrateLegacySkillLock } = await import("./skills/update.js");
  const home = mkdtempSync(join(tmpdir(), "afk-lock-migration-"));
  mkdirSync(join(home, ".agents"));
  const path = join(home, ".agents", ".skill-lock.json");
  const original = JSON.stringify({ version: 3, skills: {
    selected: { source: "logbookfordevs/ai-field-kit", sourceUrl: "https://github.com/logbookfordevs/ai-field-kit.git", sourceType: "github", skillFolderHash: "retain", skillPath: "skills/selected/SKILL.md" },
    other: { source: "acme/skills", sourceType: "github" },
    unselected: { source: "logbookfordevs/ai-field-kit", sourceType: "github" },
  } });
  writeFileSync(path, original);
  const command = { label: "Test", command: "npx", args: [], cwd: home, scope: "global" as const, skillNames: ["selected"] };
  migrateLegacySkillLock(home, command);
  const result = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(result.skills.selected.source, "logbookfordevs/logbook-atlas");
  assert.equal(result.skills.selected.sourceUrl, "https://github.com/logbookfordevs/logbook-atlas");
  assert.equal(result.skills.selected.skillFolderHash, "retain");
  assert.equal(result.skills.other.source, "acme/skills");
  assert.equal(result.skills.unselected.source, "logbookfordevs/ai-field-kit");
  migrateLegacySkillLock(home, command);
  assert.equal(readFileSync(`${path}.before-atlas`, "utf8"), original);
});

test("renamed catalog sources migrate to Atlas while preserving pinned references", () => {
  assert.equal(migratedCatalogSource("logbookfordevs/ai-field-kit-catalog"), "logbookfordevs/logbook-atlas");
  assert.equal(migratedCatalogSource("https://github.com/logbookfordevs/ai-field-kit-catalog.git"), "https://github.com/logbookfordevs/logbook-atlas");
  assert.equal(migratedCatalogSource("https://github.com/logbookfordevs/ai-field-kit-catalog/tree/main/afk/catalog"), "https://github.com/logbookfordevs/logbook-atlas/tree/main/afk/catalog");
  assert.equal(migratedCatalogSource("https://raw.githubusercontent.com/logbookfordevs/ai-field-kit-catalog/main/rules/AGENTS.md"), "https://raw.githubusercontent.com/logbookfordevs/logbook-atlas/main/rules/AGENTS.md");
  const pinned = "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit-catalog/abc123/rules/AGENTS.md";
  assert.equal(migratedCatalogSource(pinned), pinned);
});
