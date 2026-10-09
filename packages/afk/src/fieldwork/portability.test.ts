import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SettingsStore, emptySettings, validateSettings, type Settings } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { compareSavedSkills, reviewSnapshot, restoreSavedSkills, type SnapshotReview, type RestoreProgress } from "./saved-skills.js";
import { exportBundle, applyBundle } from "./bundle.js";
import type { InstallRunner } from "./skill-install.js";

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
async function snapshot(f: Awaited<ReturnType<typeof fixture>>) {
  const preview = await f.ops.run("skills/snapshot-preview", { scope: "Global" });
  await f.ops.run("skills/snapshot-save", { preview });
  return (await f.store.read()).savedSkills![0]!;
}
const runner: InstallRunner = async (_cwd, env, args) => {
  const name = args[args.indexOf("--skill") + 1]!;
  expect(args.filter(argument => argument === "--skill")).toHaveLength(1);
  await skill(env.HOME!, name);
  await writeFile(join(env.HOME!, ".agents/.skill-lock.json"), JSON.stringify({ skills: { [name]: { source: args[0] } } }));
  return 0;
};

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

it("rejects stale snapshot reviews and makes removal of missing saved items explicit", async () => {
  const f = await fixture(); await skill(f.home, "review"); await skill(f.home, "motion", true);
  await setInvocation(f.store, f.settings, "motion", "Global", "Manual only");
  const saved = await snapshot(f);
  expect(saved.skills.find(item => item.name === "motion")).toMatchObject({ available: false, invocation: "Manual only" });
  await rm(join(f.home, ".agents/skills/review"), { recursive: true });
  const preview = await f.ops.run("skills/snapshot-preview", { scope: "Global" }) as SnapshotReview;
  expect(preview.removed).toEqual(["review"]);
  expect((await f.store.read()).savedSkills![0]!.skills).toHaveLength(2);
  await skill(f.home, "extra");
  await expect(f.ops.run("skills/snapshot-save", { preview })).rejects.toThrow(/changed/);
});

it("includes saved snapshots in ZIP imports while profiles remain inactive", async () => {
  const f = await fixture(), other = await fixture(); await skill(f.home, "review"); await snapshot(f);
  const bundle = await exportBundle(f.store); await applyBundle(other.store, bundle.base64, []);
  expect((await other.store.read()).savedSkills).toEqual((await f.store.read()).savedSkills);
  expect(await new SkillLibrary(other.store).inventory(await other.store.read(), "Global")).toEqual([]);
});

it("restores only selected skills, reapplies manual invocation and disabled state, and leaves profiles disabled", async () => {
  const f = await fixture();
  f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: [{ name: "review", source: "owner/repo", available: false, invocation: "Manual only" }, { name: "other", source: "owner/repo", available: true, invocation: "" }] }];
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "owner/repo", skills: ["review", "other"], enabled: [], ready: false }); await f.store.save(f.settings);
  const result = await restoreSavedSkills(f.store, "Global", ["review"], f.settings.savedSkills[0]!, () => {}, undefined, runner);
  expect(result.items).toEqual([{ name: "review", phase: "Done", ok: true }]);
  const settings = await f.store.read();
  expect((await new SkillLibrary(f.store).inventory(settings, "Global"))[0]).toMatchObject({ name: "review", available: false, invocation: { claude: "Manual only", codex: "Manual only" } });
  expect(settings.profiles[0]?.enabled).toEqual([]);
  expect(settings.preferences["Global|review"]).toBe("Manual only");
});

it("keeps completed items after failure, reports progress, and retries the failed item only", async () => {
  const f = await fixture(); f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: ["one", "two"].map(name => ({ name, source: "owner/repo", available: true, invocation: "" })) }]; await f.store.save(f.settings);
  const progress: RestoreProgress[] = [], calls: string[] = [];
  const first = await restoreSavedSkills(f.store, "Global", ["one", "two"], f.settings.savedSkills[0]!, update => progress.push(update), undefined, async (...args) => { const name = args[2][args[2].indexOf("--skill") + 1]!; calls.push(name); return name === "two" ? 1 : runner(...args); });
  expect(first.items.map(item => item.ok)).toEqual([true, false]);
  expect(progress.some(update => update.items[0]?.phase === "Applying availability")).toBe(true);
  const retry = await restoreSavedSkills(f.store, "Global", ["two"], f.settings.savedSkills[0]!, () => {}, undefined, runner);
  expect(retry.items[0]?.ok).toBe(true); expect(calls).toEqual(["one", "two"]);
  expect((await new SkillLibrary(f.store).inventory(await f.store.read(), "Global")).map(entry => entry.name)).toEqual(["one", "two"]);
});

it("preserves conflicting copies and reports local-only skills without installing", async () => {
  const f = await fixture(), path = await skill(f.home, "review");
  f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: [{ name: "review", source: "owner/repo", available: false, invocation: "Manual only" }, { name: "private", available: true, invocation: "" }] }]; await f.store.save(f.settings);
  const before = await readFile(join(path, "SKILL.md"), "utf8");
  const comparison = await compareSavedSkills(f.store, f.settings, "Global"); expect(comparison.map(item => item.status)).toEqual(["conflict", "local"]);
  const install = vi.fn(runner); const result = await restoreSavedSkills(f.store, "Global", ["review", "private"], f.settings.savedSkills[0]!, () => {}, undefined, install);
  expect(install).not.toHaveBeenCalled(); expect(result.items.every(item => item.ok === false)).toBe(true); expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe(before);
});

it("does not recreate missing project folders and allows removing an inactive project without deleting files", async () => {
  const f = await fixture(); f.settings.projects = [{ name: "Missing", path: join(f.home, "not-here") }]; await f.store.save(f.settings);
  const state = await f.ops.run("state") as { projectStatuses: Record<string, string> }; expect(state.projectStatuses.Missing).toBe("missing");
  await expect(f.ops.run("skills/snapshot-preview", { scope: "Missing" })).rejects.toThrow(/existing project/);
  await f.ops.run("project/remove", { name: "Missing" }); expect((await f.store.read()).projects).toEqual([]);
  await expect(readFile(join(f.home, "not-here"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects malformed snapshots and accepts portable definitions without machine fields", () => {
  const settings = emptySettings(); expect(validateSettings({ ...settings, profiles: [{ id: "writing", name: "Writing", source: "owner/repo", skills: ["review"] }], managedLinks: undefined, independentSkills: undefined }).profiles[0]).toMatchObject({ enabled: [], ready: false });
  expect(() => validateSettings({ ...settings, savedSkills: [{ scope: "Missing", savedAt: "bad", skills: [] }] })).toThrow(/snapshot/);
});

it("preserves shared edits made while an installation is running", async () => {
  const f = await fixture();
  f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: [{ name: "review", source: "owner/repo", available: false, invocation: "Manual only" }] }];
  await f.store.save(f.settings);
  const result = await restoreSavedSkills(f.store, "Global", ["review"], f.settings.savedSkills[0]!, () => {}, undefined, async (...args) => {
    await runner(...args);
    const current = await f.store.read(); current.tools.push({ id: 1, name: "Shared edit", install: "echo example", update: "" });
    current.savedSkills![0]!.skills[0]!.invocation = "Automatic allowed";
    await f.store.save(current); return 0;
  });
  expect(result.items[0]).toMatchObject({ ok: false, error: expect.stringContaining("changed") });
  const current = await f.store.read();
  expect(current.tools[0]?.name).toBe("Shared edit");
  expect(current.savedSkills![0]!.skills[0]!.invocation).toBe("Automatic allowed");
  expect(current.preferences["Global|review"]).toBeUndefined();
});

it("keeps verified source provenance through a project invocation override", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  await writeFile(join(f.home, ".agents/.skill-lock.json"), JSON.stringify({ skills: { review: { source: "owner/repo" } } }));
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: [], ready: true }];
  await new SkillLibrary(f.store).activate(f.settings, "writing", "P", true);
  await setInvocation(f.store, f.settings, "review", "P", "Manual only");
  expect((await reviewSnapshot(f.store, await f.store.read(), "P")).skills[0]).toMatchObject({ source: "owner/repo", invocation: "Manual only" });
});

it("prefers provenance on the actual copy over a stale installer lock", async () => {
  const f = await fixture(); const path = await skill(f.home, "review");
  await writeFile(join(path, ".afk-source.json"), JSON.stringify({ source: "new/repo" }));
  await writeFile(join(f.home, ".agents/.skill-lock.json"), JSON.stringify({ skills: { review: { source: "old/repo" } } }));
  expect((await reviewSnapshot(f.store, f.settings, "Global")).skills[0]?.source).toBe("new/repo");
});

it("allows disabling an orphaned project skill and removing its project definition", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: [], ready: true }];
  await new SkillLibrary(f.store).activate(f.settings, "writing", "P", true);
  const portable = JSON.parse(await readFile(f.store.path, "utf8")) as Settings; portable.profiles = [];
  await writeFile(f.store.path, JSON.stringify(portable));
  await new SkillLibrary(f.store).toggle(await f.store.read(), "review", "P");
  await f.ops.run("project/remove", { name: "P" });
  expect((await f.store.read()).projects).toEqual([]);
  expect(await readFile(join(project, ".agents/skills/.disabled/review/SKILL.md"), "utf8")).toContain("name: review");
});

it("does not carry project activation to a changed project folder", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: [], ready: true }];
  await new SkillLibrary(f.store).activate(f.settings, "writing", "P", true);
  const portable = JSON.parse(await readFile(f.store.path, "utf8")) as Settings; portable.projects[0]!.path = join(f.home, "elsewhere");
  await writeFile(f.store.path, JSON.stringify(portable));
  expect((await f.store.read()).profiles[0]?.enabled).toEqual([]);
});

it("restores Default by removing an AFK override and restoring the original native policy", async () => {
  const f = await fixture(); const path = await skill(f.home, "review");
  await writeFile(join(path, "SKILL.md"), "---\nname: review\ndescription: Example\ndisable-model-invocation: true\n---\nInstructions\n");
  await setInvocation(f.store, f.settings, "review", "Global", "Automatic allowed");
  f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: [{ name: "review", available: true, invocation: "" }] }]; await f.store.save(f.settings);
  const result = await restoreSavedSkills(f.store, "Global", ["review"], f.settings.savedSkills[0]!, () => {});
  expect(result.items[0]?.ok).toBe(true);
  const current = await f.store.read(); expect(current.preferences["Global|review"]).toBeUndefined();
  expect((await new SkillLibrary(f.store).inventory(current, "Global"))[0]?.invocation.claude).toBe("Manual only");
});

it("stops remaining items when restoration is cancelled", async () => {
  const f = await fixture(); f.settings.savedSkills = [{ scope: "Global", savedAt: new Date().toISOString(), skills: ["one", "two"].map(name => ({ name, source: "owner/repo", available: true, invocation: "" })) }]; await f.store.save(f.settings);
  const controller = new AbortController(), install = vi.fn(async (...args: Parameters<InstallRunner>) => { await runner(...args); controller.abort(); return 0; });
  const result = await restoreSavedSkills(f.store, "Global", ["one", "two"], f.settings.savedSkills[0]!, () => {}, controller.signal, install);
  expect(install).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ pending: false, cancelled: true });
  expect(result.items[1]).toMatchObject({ name: "two", phase: "Not started", ok: false });
});

it("removes a missing project with stale local activation without recreating its folders", async () => {
  const f = await fixture(); await skill(f.home, "review", true);
  const project = join(f.home, "project"); await mkdir(project);
  f.settings.projects = [{ name: "P", path: project }];
  f.settings.profiles = [{ id: "writing", name: "Writing", source: "Local skill selection", skills: ["review"], enabled: [], ready: true }];
  await new SkillLibrary(f.store).activate(f.settings, "writing", "P", true);
  await rm(project, { recursive: true });
  await f.ops.run("project/remove", { name: "P" });
  const current = await f.store.read(); expect(current.projects).toEqual([]); expect(current.profiles[0]?.enabled).toEqual([]);
  expect(Object.keys(current.managedLinks).some(path => path.startsWith(project + "/"))).toBe(false);
  await expect(readFile(join(project, ".agents/skills/review/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
});
