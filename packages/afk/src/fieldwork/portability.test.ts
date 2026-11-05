import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore, emptySettings, validateSettings, type Settings } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { SkillLibrary } from "./skills.js";

const homes: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-portability-")); homes.push(home);
  const store = new SettingsStore(home), settings = emptySettings();
  await store.save(settings);
  return { home, store, settings, ops: new FieldworkOperations(store) };
}
async function skill(home: string, name: string, disabled = false) {
  const path = join(home, ".agents/skills", disabled ? ".disabled" : "", name);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), `---\nname: ${name}\ndescription: Example\n---\nInstructions\n`);
  return path;
}
it("stores activation locally and preserves it across restarts while direct folder reuse starts inactive", async () => {
  const first = await fixture(), second = await fixture();
  await skill(first.home, "review", true);
  first.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  await new SkillLibrary(first.store).activate(first.settings, "writing", "Global", true);
  const file = JSON.parse(await readFile(first.store.path, "utf8")) as Settings;
  expect(file.profiles[0]).not.toHaveProperty("enabled");
  expect(file.profiles[0]).not.toHaveProperty("ready");
  expect(file).not.toHaveProperty("managedLinks");
  expect((await new SettingsStore(first.home).read()).profiles[0]).toMatchObject({ enabled: ["Global"], ready: true });
  await writeFile(second.store.path, JSON.stringify(file));
  expect((await second.store.read()).profiles[0]).toMatchObject({ enabled: [], ready: false });
  expect((await second.store.read()).managedLinks).toEqual({});
});

it("keeps local state separate for each configuration", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  await new SkillLibrary(f.store).activate(f.settings, "writing", "Global", true);
  expect((await f.store.read()).profiles[0]?.enabled).toEqual(["Global"]);
  const other = new SettingsStore(f.home, join(f.home, "another/settings.json"));
  const definitions = emptySettings(); definitions.profiles = [{ ...f.settings.profiles[0]!, enabled: [], ready: false }]; await other.save(definitions);
  expect((await other.read()).profiles[0]?.enabled).toEqual([]);
});

it("migrates verified legacy links without claiming nonexistent activation on a different machine", async () => {
  const f = await fixture(); const stored = await skill(f.home, "review", true);
  const active = join(f.home, ".agents/skills/review"); await symlink(stored, active);
  const legacy = emptySettings(); legacy.profiles.push({ id: "writing", name: "Writing", source: "owner/repo", skills: ["review"], enabled: ["Global"], ready: true }); legacy.managedLinks[active] = stored;
  await writeFile(f.store.path, JSON.stringify(legacy));
  const migrated = await f.store.read(); expect(migrated.profiles[0]?.enabled).toEqual(["Global"]);
  const other = await fixture(); await writeFile(other.store.path, JSON.stringify(legacy));
  expect((await other.store.read()).profiles[0]).toMatchObject({ enabled: [], ready: false });
});

it("does not recreate missing project folders and allows removing an inactive project without deleting files", async () => {
  const f = await fixture(); f.settings.projects = [{ name: "Missing", path: join(f.home, "not-here") }]; await f.store.save(f.settings);
  const state = await f.ops.run("state") as { projectStatuses: Record<string, string> }; expect(state.projectStatuses.Missing).toBe("missing");
  await f.ops.run("project/remove", { name: "Missing" }); expect((await f.store.read()).projects).toEqual([]);
  await expect(readFile(join(f.home, "not-here"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("does not carry an older project pack activation to a changed project folder", async () => {
  const f = await fixture();
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: ["P"], ready: true }];
  await f.store.save(f.settings);
  const portable = JSON.parse(await readFile(f.store.path, "utf8")) as Settings; portable.projects[0]!.path = join(f.home, "elsewhere");
  await writeFile(f.store.path, JSON.stringify(portable));
  expect((await f.store.read()).profiles[0]?.enabled).toEqual([]);
});

it("removes a missing project with stale local activation without recreating its folders", async () => {
  const f = await fixture();
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: ["P"], ready: true }];
  f.settings.managedLinks[join(project, ".agents/skills/review")] = join(f.home, ".agents/skills/.disabled/review");
  await f.store.save(f.settings);
  await rm(project, { recursive: true });
  await f.ops.run("project/remove", { name: "P" });
  const current = await f.store.read(); expect(current.projects).toEqual([]); expect(current.profiles[0]?.enabled).toEqual([]);
  expect(Object.keys(current.managedLinks).some(path => path.startsWith(project + "/"))).toBe(false);
  await expect(readFile(join(project, ".agents/skills/review/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects malformed old snapshots and accepts portable definitions without machine fields", () => {
  const settings = emptySettings(); expect(validateSettings({ ...settings, profiles: [{ id: "writing", name: "Writing", source: "owner/repo", skills: ["review"] }], managedLinks: undefined, independentSkills: undefined }).profiles[0]).toMatchObject({ enabled: [], ready: false });
  expect(() => validateSettings({ ...settings, version: 1, savedSkills: [{ scope: "Missing", savedAt: "bad", skills: [] }] })).toThrow(/snapshot/);
  expect(() => validateSettings({ ...settings, savedSkills: [] })).toThrow(/Version 2/);
});

it("prefers provenance on the actual copy over a stale installer lock", async () => {
  const f = await fixture(); const path = await skill(f.home, "review");
  await writeFile(join(path, ".afk-source.json"), JSON.stringify({ source: "new/repo" }));
  await writeFile(join(f.home, ".agents/.skill-lock.json"), JSON.stringify({ skills: { review: { source: "old/repo" } } }));
  expect((await new SkillLibrary(f.store).inventory(f.settings, "Global"))[0]?.source).toBe("new/repo");
});

it("keeps loading settings from a folder chosen before the library, so that setup can still move into a library", async () => {
  const f = await fixture();
  const chosen = join(f.home, "Drive/AFK/settings.json");
  await mkdir(join(f.home, "Drive/AFK"), { recursive: true });
  const settings = emptySettings(); settings.kit = { core: [{ source: "owner/repo", skills: ["review"] }] };
  await new SettingsStore(f.home, chosen).save(settings);
  await writeFile(f.store.pointer, JSON.stringify({ path: chosen }));

  const restarted = new SettingsStore(f.home); await restarted.initialize();

  expect(restarted.path).toBe(chosen);
  expect((await restarted.read()).kit?.core).toEqual([{ source: "owner/repo", skills: ["review"] }]);
});
