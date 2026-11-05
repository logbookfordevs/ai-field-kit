import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore, emptySettings, validateSettings, type Settings } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { exportBundle, applyBundle } from "./bundle.js";

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

it("keeps local state separate for configurations and carries it when relocating the same configuration", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  await new SkillLibrary(f.store).activate(f.settings, "writing", "Global", true);
  const destination = join(f.home, "shared/settings.json"); await f.store.relocate(destination);
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

it("migrates an old ZIP on import: stacks become packs and everything stays off", async () => {
  const f = await fixture(), other = await fixture();
  await writeFile(f.store.path, JSON.stringify({ version: 1, profiles: [], projects: [], tools: [], favoriteSources: [], configurationId: f.settings.configurationId,
    stacks: [{ manifest: { version: 1, id: "old", name: "Old", sources: [{ name: "One", source: "owner/one", skills: ["review"] }] } }] }));
  const bundle = await exportBundle(f.store);
  await applyBundle(other.store, bundle.base64, []);
  const imported = await other.store.read();
  expect(imported.version).toBe(2);
  expect(imported.profiles[0]).toMatchObject({ id: "stack-old", name: "Old", skills: ["review"], enabled: [], ready: false });
  expect(await new SkillLibrary(other.store).inventory(imported, "Global")).toEqual([]);
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

it("loads an existing copy of the current configuration without disabling active skills", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  const library = new SkillLibrary(f.store);
  await library.activate(f.settings, "writing", "Global", true);
  const folder = join(f.home, "existing"); await mkdir(folder);
  await writeFile(join(folder, "settings.json"), await readFile(f.store.path));
  await f.ops.run("workspace", { mode: "select", folder });
  expect((await f.store.read()).profiles[0]?.enabled).toEqual(["Global"]);
  const restarted = new SettingsStore(f.home); await restarted.initialize();
  expect(restarted.path).toBe(join(folder, "settings.json"));
  await new SkillLibrary(restarted).activate(await restarted.read(), "writing", "Global", false);
  expect((await restarted.read()).profiles[0]?.enabled).toEqual([]);
  await expect(readFile(join(f.home, ".agents/skills/review/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("preserves the current location and activation when an existing configuration differs", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  await new SkillLibrary(f.store).activate(f.settings, "writing", "Global", true);
  const original = f.store.path;
  const folder = join(f.home, "existing"); await mkdir(folder);
  const changed = JSON.parse(await readFile(original, "utf8")) as Settings;
  changed.profiles = [];
  await writeFile(join(folder, "settings.json"), JSON.stringify(changed));
  await expect(f.ops.run("workspace", { mode: "select", folder })).rejects.toThrow("different configuration");
  expect(f.store.path).toBe(original);
  expect((await f.store.read()).profiles[0]?.enabled).toEqual(["Global"]);
  changed.configurationId = "different";
  await writeFile(join(folder, "settings.json"), JSON.stringify(changed));
  await expect(f.store.selectFolder(folder)).rejects.toThrow("different configuration");
  await expect(f.store.selectFolder(join(f.home, ".afk"))).resolves.toBeUndefined();
});

it("moves active configuration into an existing AFK folder with a recoverable destination backup", async () => {
  const f = await fixture(); const stored = await skill(f.home, "review", true);
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], ready: true, enabled: [] });
  await new SkillLibrary(f.store).activate(f.settings, "writing", "Global", true);
  const original = f.store.path;
  await writeFile(join(f.home, ".afk/AGENTS.md"), "Current rules");
  const folder = join(f.home, "existing"); await mkdir(join(folder, "references"), { recursive: true });
  await writeFile(join(folder, "settings.json"), "Previous settings");
  await writeFile(join(folder, "AGENTS.md"), "Previous rules");
  await writeFile(join(folder, "references/old.md"), "Previous reference");
  await writeFile(join(folder, "unrelated.txt"), "Keep me");
  const result = await f.ops.run("workspace", { mode: "move", folder }) as { backup?: string };
  expect((await f.store.read()).profiles[0]?.enabled).toEqual(["Global"]);
  expect(await readFile(join(folder, "AGENTS.md"), "utf8")).toBe("Current rules");
  expect(await readFile(join(result.backup!, "settings.json"), "utf8")).toBe("Previous settings");
  expect(await readFile(join(result.backup!, "AGENTS.md"), "utf8")).toBe("Previous rules");
  expect(await readFile(join(result.backup!, "references/old.md"), "utf8")).toBe("Previous reference");
  expect(await readFile(join(folder, "references/old.md"), "utf8")).toBe("Previous reference");
  expect(await readFile(join(folder, "unrelated.txt"), "utf8")).toBe("Keep me");
  expect(await readFile(join(stored, "SKILL.md"), "utf8")).toContain("name: review");
  expect(await readFile(original, "utf8")).toContain('"version"');
  await new SkillLibrary(f.store).activate(await f.store.read(), "writing", "Global", false);
  expect((await f.store.read()).profiles[0]?.enabled).toEqual([]);
});

it("restores destination AFK files if relocation fails after backing them up", async () => {
  const f = await fixture(); const original = f.store.path;
  await symlink(join(f.home, "missing"), join(f.home, ".afk/AGENTS.md"));
  const folder = join(f.home, "existing"); await mkdir(folder);
  await writeFile(join(folder, "settings.json"), "Previous settings");
  await writeFile(join(folder, "AGENTS.md"), "Previous rules");
  await expect(f.ops.run("workspace", { mode: "move", folder })).rejects.toThrow("symbolic links");
  expect(f.store.path).toBe(original);
  expect(await readFile(join(folder, "settings.json"), "utf8")).toBe("Previous settings");
  expect(await readFile(join(folder, "AGENTS.md"), "utf8")).toBe("Previous rules");
});

it("prefers incoming files in conflicts while retaining unique references", async () => {
  const f = await fixture();
  f.settings.tools = [{ id: 1, name: "Incoming tool", install: "echo incoming", update: "" }];
  await f.store.save(f.settings);
  const original = f.store.path;
  const incoming = join(f.home, ".afk");
  const folder = join(f.home, "destination");
  for (const root of [incoming, folder]) await mkdir(join(root, "references/nested"), { recursive: true });
  const existing = new SettingsStore(f.home, join(folder, "settings.json"));
  const settings = emptySettings(); settings.tools = [{ id: 2, name: "Existing tool", install: "echo existing", update: "" }];
  await existing.save(settings);
  await writeFile(join(incoming, "AGENTS.md"), "Incoming rules");
  await writeFile(join(folder, "AGENTS.md"), "Existing rules");
  await writeFile(join(incoming, "references/nested/shared.md"), "Incoming reference");
  await writeFile(join(folder, "references/nested/shared.md"), "Existing reference");
  await writeFile(join(incoming, "references/incoming.md"), "Incoming only");
  await writeFile(join(folder, "references/existing.md"), "Existing only");
  const result = await f.ops.run("workspace", { mode: "move", folder }) as { backup?: string };
  expect((await f.store.read()).tools[0]?.name).toBe("Incoming tool");
  expect((await f.store.read()).configurationId).toBe(f.settings.configurationId);
  expect(await readFile(join(folder, "AGENTS.md"), "utf8")).toBe("Incoming rules");
  expect(await readFile(join(folder, "references/nested/shared.md"), "utf8")).toBe("Incoming reference");
  expect(await readFile(join(folder, "references/incoming.md"), "utf8")).toBe("Incoming only");
  expect(await readFile(join(folder, "references/existing.md"), "utf8")).toBe("Existing only");
  expect(await readFile(join(result.backup!, "AGENTS.md"), "utf8")).toBe("Existing rules");
  expect(await readFile(original, "utf8")).toContain("Incoming tool");
});

it("restores nested destination references when updating the location pointer fails", async () => {
  const f = await fixture(); const original = f.store.path;
  const folder = join(f.home, "destination");
  await mkdir(join(f.home, ".afk/references/new"), { recursive: true });
  await writeFile(join(f.home, ".afk/references/new/incoming.md"), "Incoming");
  await mkdir(join(folder, "references/old"), { recursive: true });
  await writeFile(join(folder, "settings.json"), "Original destination");
  await writeFile(join(folder, "references/old/existing.md"), "Existing");
  await mkdir(f.store.pointer);
  await expect(f.ops.run("workspace", { mode: "move", folder })).rejects.toThrow();
  expect(f.store.path).toBe(original);
  expect(await readFile(join(folder, "settings.json"), "utf8")).toBe("Original destination");
  expect(await readFile(join(folder, "references/old/existing.md"), "utf8")).toBe("Existing");
  await expect(readFile(join(folder, "references/new/incoming.md"))).rejects.toMatchObject({ code: "ENOENT" });
});
