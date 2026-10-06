import { afterEach, describe, expect, it } from "vitest";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { doctor } from "./doctor.js";
import { RULES_END, RULES_START } from "./rules.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { settingsSchema } from "./settings-schema.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });

async function fixture(): Promise<SettingsStore> {
  const home = await mkdtemp(join(tmpdir(), "afk-doctor-"));
  homes.push(home);
  return new SettingsStore(home);
}

async function file(path: string, content = "skill instructions"): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

describe("read-only doctor", () => {
  it("reports a missing file without initializing, creating folders or following a settings pointer", async () => {
    const store = await fixture();
    const path = store.path;
    const before = await readdir(store.home);
    const report = await doctor(store);
    expect(report).toMatchObject({ ok: true, settingsPath: path, issues: [{ severity: "warning", code: "settings_missing", path }] });
    expect(await readdir(store.home)).toEqual(before);
    expect(store.path).toBe(path);
    await file(store.pointer, JSON.stringify({ path: join(store.home, "other.json") }));
    expect((await doctor(store)).settingsPath).toBe(path);
    await expect(lstat(join(store.home, "other.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["{ broken", "settings_invalid_json"],
    [JSON.stringify({ version: 99 }), "settings_invalid"],
    [JSON.stringify({ ...emptySettings(), profiles: [{ id: "x", name: "X", source: "Global", skills: ["review"], ready: true, enabled: ["Unknown"] }] }), "settings_invalid"],
  ])("diagnoses invalid settings without rewriting them", async (content, code) => {
    const store = await fixture();
    await file(store.path, content);
    const before = await lstat(store.path);
    const report = await doctor(store);
    expect(report).toMatchObject({ ok: false, issues: [{ severity: "error", code, path: store.path }] });
    expect(await readFile(store.path, "utf8")).toBe(content);
    expect((await lstat(store.path)).mtimeMs).toBe(before.mtimeMs);
  });

  it("accepts prepared profiles and active exposures, including unrecorded user-owned skill folders", async () => {
    const store = await fixture();
    const settings = emptySettings();
    const project = join(store.home, "work");
    const prepared = join(store.home, ".agents/skills/.disabled/review");
    await file(join(prepared, "SKILL.md"));
    settings.projects = [{ name: "Work", path: project }];
    settings.profiles = [{ id: "reviewers", name: "Reviewers", source: "Global", skills: ["review"], ready: true, enabled: ["Work"] }];
    const exposed = join(project, ".agents/skills/review");
    await mkdir(dirname(exposed), { recursive: true });
    await symlink(prepared, exposed);
    settings.managedLinks[exposed] = prepared;
    await file(join(project, ".claude/skills/review/SKILL.md"), "user-owned instructions");
    await store.save(settings);
    const before = await readFile(store.path, "utf8");
    expect(await doctor(store)).toMatchObject({ ok: true, issues: [], checked: { profiles: 1, projects: 1, managedLinks: 1, rulesDestinations: 0 } });
    expect(await readFile(store.path, "utf8")).toBe(before);
    expect(await readFile(join(project, ".claude/skills/review/SKILL.md"), "utf8")).toBe("user-owned instructions");
  });

  it("reports missing prepared members and missing active exposures", async () => {
    const store = await fixture();
    const settings = emptySettings();
    settings.profiles = [{ id: "reviewers", name: "Reviewers", source: "Global", skills: ["review"], ready: true, enabled: ["Global"] }];
    await store.save(settings);
    const report = await doctor(store);
    expect(report.ok).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(["profile_skill_missing", "skill_exposure_missing", "skill_exposure_missing"]);
    await expect(lstat(join(store.home, ".agents"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("leaves intentionally unprepared inactive profiles alone and warns about absent project folders", async () => {
    const store = await fixture();
    const settings = emptySettings();
    settings.profiles = [{ id: "reviewers", name: "Reviewers", source: "Global", skills: ["review"], ready: false, enabled: [] }];
    settings.projects = [{ name: "Work", path: join(store.home, "absent") }];
    await store.save(settings);
    expect(await doctor(store)).toMatchObject({ ok: true, issues: [{ severity: "warning", code: "project_missing" }] });
  });

  it("checks independent exposure and diagnoses a stale project scope without throwing", async () => {
    const store = await fixture();
    const settings = emptySettings();
    settings.independentSkills = { Global: ["review"], Removed: ["review"] };
    await store.save(settings);
    const report = await doctor(store);
    expect(report.ok).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(["skill_exposure_missing", "skill_exposure_missing", "skill_scope_missing"]);
  });

  it("reports stale receipts and dangling links while preserving replaced entries", async () => {
    const store = await fixture();
    const settings = emptySettings();
    const absent = join(store.home, "absent");
    const replaced = join(store.home, "replaced");
    const changed = join(store.home, "changed");
    const dangling = join(store.home, "dangling");
    await file(replaced, "user content");
    await symlink("new-target", changed);
    await symlink("missing-target", dangling);
    settings.managedLinks = {
      [absent]: join(store.home, "old-target"), [replaced]: join(store.home, "old-target"),
      [changed]: join(store.home, "old-target"), [dangling]: join(store.home, "missing-target"),
    };
    await store.save(settings);
    const report = await doctor(store);
    expect(report.ok).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(["managed_link_missing", "managed_link_replaced", "managed_link_target_mismatch", "managed_link_target_missing"]);
    expect(await readFile(replaced, "utf8")).toBe("user content");
    expect((await lstat(changed)).isSymbolicLink()).toBe(true);
    expect((await lstat(dangling)).isSymbolicLink()).toBe(true);
    expect(await store.read()).toEqual(settings);
  });

  it("checks canonical references and destination conflicts without syncing or adopting", async () => {
    const store = await fixture();
    const settings = emptySettings();
    const target = join(store.home, "destination/AGENTS.md");
    settings.agentRules = { destinations: [{ id: "custom", name: "Custom", kind: "custom", path: target }], receipts: {} };
    await store.save(settings);
    await file(join(dirname(store.path), "AGENTS.md"), "Read {{missing.md}}.");
    await file(target, `${RULES_START}\nuser-owned region\n${RULES_END}`);
    const original = await readFile(target, "utf8");
    const report = await doctor(store);
    expect(report.ok).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(["rules_invalid", "rules_destination_conflict"]);
    expect(report.checked.rulesDestinations).toBe(1);
    expect(await readFile(target, "utf8")).toBe(original);
    expect((await store.read()).agentRules?.receipts).toEqual({});
    await expect(lstat(join(dirname(target), "afk-rules"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("recognizes valid rules and references with a destination ready for first sync", async () => {
    const store = await fixture();
    const settings = emptySettings();
    settings.agentRules = { destinations: [{ id: "custom", name: "Custom", kind: "custom", path: join(store.home, "dest/AGENTS.md") }], receipts: {} };
    await store.save(settings);
    await file(join(dirname(store.path), "AGENTS.md"), "Read {{guide.md}}.");
    await file(join(dirname(store.path), "references/guide.md"), "Reference content");
    expect(await doctor(store)).toMatchObject({ ok: true, issues: [], checked: { rulesDestinations: 1 } });
    await expect(lstat(join(store.home, "dest"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("settings editor schema", () => {
  it("serializes as a versioned schema and marks local ownership state read-only", () => {
    const schema = JSON.parse(JSON.stringify(settingsSchema)) as typeof settingsSchema;
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.properties.version.const).toBe(1);
    expect(schema.required).toContain("favoriteSources");
    expect(schema.properties.profiles.readOnly).toBe(true);
    expect(schema.properties.managedLinks.readOnly).toBe(true);
    expect(schema.properties.agentRules.properties.receipts.readOnly).toBe(true);
    expect(schema.properties.favoriteSources.items.properties.skills).toMatchObject({ minItems: 1, uniqueItems: true });
  });

  it("describes structural string constraints without rejecting valid multiline commands", () => {
    const properties = settingsSchema.properties;
    expect(new RegExp(properties.tools.items.properties.install.pattern).test("echo first\necho second")).toBe(true);
    expect(new RegExp(properties.tools.items.properties.install.pattern).test("echo first\n\0echo second")).toBe(false);
    expect(new RegExp(properties.favoriteSources.items.properties.name.pattern).test("bad\nname")).toBe(false);
  });
});
