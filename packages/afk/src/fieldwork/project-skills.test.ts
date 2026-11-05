import { afterEach, expect, it } from "vitest";
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { installSkills } from "./skill-install.js";
import { updateSkills } from "./skill-update.js";
import { deleteSkill, previewDeletion } from "./deletion.js";
import { migrateProject } from "./project-skills.js";
import { FieldworkOperations } from "./operations.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });

const body = (name: string, text = "Instructions", extra = ""): string => `---\nname: ${name}\ndescription: Fixture ${name}\n${extra}---\n${text}\n`;

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-project-test-")); homes.push(home);
  const store = new SettingsStore(home); await store.initialize();
  const settings = await store.read();
  const project = join(home, "project"); await mkdir(project);
  settings.projects.push({ name: "Studio", path: project });
  await store.save(settings);
  const root = join(project, ".agents/skills");
  const write = async (path: string, name: string, text?: string, extra?: string): Promise<string> => {
    await mkdir(path, { recursive: true }); await writeFile(join(path, "SKILL.md"), body(name, text, extra)); return path;
  };
  return { home, store, settings, project, root, write, library: new SkillLibrary(store) };
}

it("lists only the skills the project keeps in its own folders", async () => {
  const f = await fixture();
  await f.write(join(f.root, "own"), "own");
  await f.write(join(f.root, ".disabled/parked"), "parked");
  const shared = await f.write(join(f.home, ".agents/skills/.disabled/library"), "library");
  await symlink(shared, join(f.root, "library"), "dir");
  const entries = await f.library.inventory(await f.store.read(), "Studio");
  expect(entries.map(entry => ({ name: entry.name, available: entry.available, shared: entry.shared, owners: entry.owners }))).toEqual([
    { name: "own", available: true, shared: false, owners: [] },
  ]);
});

it("changes Manual/Automatic in the skill's own files and leaves nothing else behind", async () => {
  const f = await fixture();
  const own = await f.write(join(f.root, "own"), "own");
  await setInvocation(f.store, f.settings, "own", "Studio", "Manual only");
  expect(await readFile(join(own, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
  const [entry] = await f.library.inventory(await f.store.read(), "Studio");
  expect(entry?.invocation).toMatchObject({ claude: "Manual only", codex: "Manual only" });
  expect((await lstat(own)).isDirectory()).toBe(true);
  expect(await readdir(f.root)).toEqual(["own"]);
  expect((await readdir(own)).filter(name => name.startsWith(".afk-"))).toEqual([]);
});

it("returns to the author's file when the choice is reset, without an AFK backup", async () => {
  const f = await fixture();
  const own = await f.write(join(f.root, "own"), "own", "disable-model-invocation: false\n");
  await setInvocation(f.store, f.settings, "own", "Studio", "Manual only");
  await setInvocation(f.store, f.settings, "own", "Studio", "");
  const text = await readFile(join(own, "SKILL.md"), "utf8");
  expect(text).not.toContain("disable-model-invocation: true");
  expect(await readdir(own)).not.toContain(".afk-invocation-original.json");
  expect((await f.store.read()).preferences["Studio|own"]).toBeUndefined();
});

it("installs through the runner in the project folder and writes nothing outside the project's skill folders", async () => {
  const f = await fixture();
  const calls: { cwd: string; args: string[] }[] = [];
  const result = await installSkills(f.store, await f.store.read(), [{ source: "owner/repo", skills: ["wizard"] }], "Studio", "universal", "Test", () => {}, undefined, async (cwd, _env, args) => {
    calls.push({ cwd, args });
    await f.write(join(cwd, ".agents/skills/wizard"), "wizard");
    return 0;
  });
  expect(result.code).toBe(0);
  expect(calls).toEqual([{ cwd: f.project, args: ["owner/repo", "--skill", "wizard", "--agent", "universal", "--yes"] }]);
  expect((await f.library.inventory(await f.store.read(), "Studio")).map(entry => entry.name)).toEqual(["wizard"]);
  expect(await readdir(f.root)).toEqual(["wizard"]);
});

it("reapplies the saved Manual/Automatic choice after a project install", async () => {
  const f = await fixture();
  await f.write(join(f.root, "wizard"), "wizard");
  await setInvocation(f.store, f.settings, "wizard", "Studio", "Manual only");
  await installSkills(f.store, await f.store.read(), [{ source: "owner/repo", skills: ["wizard"] }], "Studio", "universal", "Test", () => {}, undefined, async cwd => {
    await f.write(join(cwd, ".agents/skills/wizard"), "wizard", "Reinstalled");
    return 0;
  });
  expect(await readFile(join(f.root, "wizard/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
});

it("updates the project's skill in place and keeps the saved choice", async () => {
  const f = await fixture();
  await f.write(join(f.root, "sample"), "sample", "old");
  await writeFile(join(f.project, "skills-lock.json"), JSON.stringify({ version: 1, skills: { sample: { source: "owner/repo" } } }));
  await setInvocation(f.store, f.settings, "sample", "Studio", "Manual only");
  const result = await updateSkills(f.store, await f.store.read(), "Studio", () => {}, async cwd => {
    await writeFile(join(cwd, ".agents/skills/sample/SKILL.md"), body("sample", "new"));
    return 0;
  });
  expect(result).toMatchObject({ code: 0, updated: 1 });
  const text = await readFile(join(f.root, "sample/SKILL.md"), "utf8");
  expect(text).toContain("new");
  expect(text).toContain("disable-model-invocation: true");
  expect(await readdir(f.root)).toEqual(["sample"]);
});

it("deletes a project skill with the agent-folder links Skills CLI made for it and its lock entry", async () => {
  const f = await fixture();
  await f.write(join(f.root, "sample"), "sample");
  await f.write(join(f.root, "keep"), "keep");
  await mkdir(join(f.project, ".claude/skills"), { recursive: true });
  await symlink("../../.agents/skills/sample", join(f.project, ".claude/skills/sample"));
  await symlink("../../.agents/skills/keep", join(f.project, ".claude/skills/keep"));
  await writeFile(join(f.project, "skills-lock.json"), JSON.stringify({ version: 1, skills: { sample: { source: "a/b" }, keep: { source: "c/d" } } }));
  const settings = await f.store.read();
  const preview = await previewDeletion(f.store, settings, "sample", "Studio");
  await deleteSkill(f.store, settings, "sample", "Studio", preview, true);
  expect(await exists(join(f.root, "sample"))).toBe(false);
  expect(await exists(join(f.project, ".claude/skills/sample"))).toBe(false);
  expect(await exists(join(f.root, "keep/SKILL.md"))).toBe(true);
  expect(await readlink(join(f.project, ".claude/skills/keep"))).toBe("../../.agents/skills/keep");
  expect(JSON.parse(await readFile(join(f.project, "skills-lock.json"), "utf8")).skills).toEqual({ keep: { source: "c/d" } });
});

it("does not turn project skills or packs on and off", async () => {
  const f = await fixture();
  await f.write(join(f.root, "own"), "own");
  f.settings.profiles.push({ id: "video", name: "Video", source: "Local skill selection", skills: ["own"], enabled: [], ready: true });
  await f.store.save(f.settings);
  await expect(f.library.activate(f.settings, "video", "Studio", true)).rejects.toThrow("Global");
  const ops = new FieldworkOperations(f.store);
  try {
    await expect(ops.run("activation", { id: "video", scope: "Studio", enabled: true })).rejects.toThrow("Global");
    await expect(ops.run("skill/toggle", { name: "own", scope: "Studio" })).rejects.toThrow("project");
    await expect(ops.run("skill/availability", { name: "own", scope: "Studio", enabled: false })).rejects.toThrow("project");
  } finally { await ops.close(); }
  expect(await readdir(f.root)).toEqual(["own"]);
});

it("migrates a project's off and on skills back to their own folders and removes .disabled", async () => {
  const f = await fixture();
  const on = await f.write(join(f.root, ".disabled/on"), "on", "Original on");
  await symlink(on, join(f.root, "on"), "dir");
  await f.write(join(f.root, ".disabled/off"), "off", "Original off");
  await mkdir(join(f.project, ".claude/skills"), { recursive: true });
  await symlink(on, join(f.project, ".claude/skills/on"), "dir");
  f.settings.independentSkills.Studio = ["on"];
  f.settings.managedLinks[join(f.project, ".claude/skills/on")] = on;
  await f.store.save(f.settings);
  const result = await migrateProject(f.store, await f.store.read(), "Studio");
  expect(result.migrated).toBe(true);
  expect(await exists(join(f.root, ".disabled"))).toBe(false);
  expect((await lstat(join(f.root, "on"))).isDirectory()).toBe(true);
  expect(await readFile(join(f.root, "on/SKILL.md"), "utf8")).toContain("Original on");
  expect(await readFile(join(f.root, "off/SKILL.md"), "utf8")).toContain("Original off");
  expect(await exists(join(f.project, ".claude/skills/on"))).toBe(false);
  const after = await f.store.read();
  expect(after.independentSkills.Studio ?? []).toEqual([]);
  expect(Object.keys(after.managedLinks)).toEqual([]);
});

it("migrates .afk-overrides by restoring the original files, then reapplies the saved choice", async () => {
  const f = await fixture();
  const original = await f.write(join(f.root, ".disabled/edited"), "edited", "Original");
  const override = await f.write(join(f.root, ".afk-overrides/edited"), "edited", "Original", "disable-model-invocation: true\n");
  await writeFile(join(override, ".afk-invocation-original.json"), JSON.stringify({ skill: body("edited", "Original"), metadata: null }));
  await symlink(override, join(f.root, "edited"), "dir");
  f.settings.preferences["Studio|edited"] = "Manual only";
  f.settings.independentSkills.Studio = ["edited"];
  await f.store.save(f.settings);
  await migrateProject(f.store, await f.store.read(), "Studio");
  expect(await exists(join(f.root, ".afk-overrides"))).toBe(false);
  expect(await exists(original)).toBe(false);
  expect((await lstat(join(f.root, "edited"))).isDirectory()).toBe(true);
  expect(await readdir(join(f.root, "edited"))).not.toContain(".afk-invocation-original.json");
  const [entry] = await f.library.inventory(await f.store.read(), "Studio");
  expect(entry?.invocation).toMatchObject({ claude: "Manual only" });
});

it("turns off existing pack activations in a project and removes only AFK's links and copies", async () => {
  const f = await fixture();
  const library = await f.write(join(f.home, ".agents/skills/.disabled/review"), "review", "Library");
  const override = await f.write(join(f.root, ".afk-overrides/review"), "review", "Library", "disable-model-invocation: true\n");
  await symlink(override, join(f.root, "review"), "dir");
  await mkdir(join(f.project, ".claude/skills"), { recursive: true });
  await symlink(library, join(f.project, ".claude/skills/review"), "dir");
  await f.write(join(f.root, "own"), "own");
  f.settings.profiles.push({ id: "writing", name: "Writing", source: "owner/repo", skills: ["review"], enabled: ["Studio", "Global"], ready: true });
  f.settings.managedLinks[join(f.root, "review")] = override;
  f.settings.managedLinks[join(f.project, ".claude/skills/review")] = library;
  f.settings.preferences["Studio|review"] = "Manual only";
  await f.store.save(f.settings);
  await migrateProject(f.store, await f.store.read(), "Studio");
  const after = await f.store.read();
  expect(after.profiles[0]?.enabled).toEqual(["Global"]);
  expect(after.preferences["Studio|review"]).toBeUndefined();
  expect(Object.keys(after.managedLinks)).toEqual([]);
  expect(await readdir(f.root)).toEqual(["own"]);
  expect(await exists(join(f.project, ".claude/skills/review"))).toBe(false);
  expect(await readFile(join(library, "SKILL.md"), "utf8")).toContain("Library");
});

it("does nothing to a project that has no legacy files, and is safe to run twice", async () => {
  const f = await fixture();
  await f.write(join(f.root, "own"), "own");
  expect((await migrateProject(f.store, await f.store.read(), "Studio")).migrated).toBe(false);
  await f.write(join(f.root, ".disabled/off"), "off");
  expect((await migrateProject(f.store, await f.store.read(), "Studio")).migrated).toBe(true);
  expect((await migrateProject(f.store, await f.store.read(), "Studio")).migrated).toBe(false);
  expect((await readdir(f.root)).sort()).toEqual(["off", "own"]);
});

it("keeps a parked skill that would collide with a real folder and reports it", async () => {
  const f = await fixture();
  await f.write(join(f.root, "twin"), "twin", "Live");
  await f.write(join(f.root, ".disabled/twin"), "twin", "Parked");
  const result = await migrateProject(f.store, await f.store.read(), "Studio");
  expect(result.kept).toEqual(["twin"]);
  expect(await readFile(join(f.root, "twin/SKILL.md"), "utf8")).toContain("Live");
  expect(await readFile(join(f.root, ".disabled/twin/SKILL.md"), "utf8")).toContain("Parked");
});

it("migrates every present project the first time the app answers, before it lists skills", async () => {
  const f = await fixture();
  await f.write(join(f.root, ".disabled/off"), "off");
  const ops = new FieldworkOperations(f.store);
  try {
    const state = await ops.run("state") as { inventories: Record<string, { name: string }[]> };
    expect(state.inventories.Studio?.map(entry => entry.name)).toEqual(["off"]);
    expect(await exists(join(f.root, ".disabled"))).toBe(false);
  } finally { await ops.close(); }
});

it("keeps edits made after an earlier Manual/Automatic change and resets only the two invocation fields", async () => {
  const f = await fixture();
  const own = await f.write(join(f.root, "own"), "own", "Original");
  await mkdir(join(own, "agents"));
  await writeFile(join(own, "agents/openai.yaml"), "interface:\n  display_name: Original\n");
  await writeFile(join(own, ".afk-invocation-original.json"), JSON.stringify({ skill: body("own", "Original"), metadata: "interface:\n  display_name: Original\n" }));
  await writeFile(join(own, "SKILL.md"), body("own", "UNIQUE PROJECT EDIT", "disable-model-invocation: true\n"));
  await writeFile(join(own, "agents/openai.yaml"), "interface:\n  display_name: Edited later\npolicy:\n  allow_implicit_invocation: false\n");
  f.settings.preferences["Studio|own"] = "Manual only";
  await f.store.save(f.settings);

  await migrateProject(f.store, await f.store.read(), "Studio");

  const skill = await readFile(join(own, "SKILL.md"), "utf8");
  expect(skill).toContain("UNIQUE PROJECT EDIT");
  expect(skill).toContain("disable-model-invocation: true");
  expect(await readFile(join(own, "agents/openai.yaml"), "utf8")).toContain("display_name: Edited later");
  expect(await exists(join(own, ".afk-invocation-original.json"))).toBe(false);
});

it("keeps the invocation backup when saving the migrated settings fails, so a retry can finish", async () => {
  const f = await fixture();
  const own = await f.write(join(f.root, "own"), "own", "Original");
  await writeFile(join(own, ".afk-invocation-original.json"), JSON.stringify({ skill: body("own", "Original"), metadata: null }));
  await writeFile(join(own, "SKILL.md"), body("own", "Edited", "disable-model-invocation: true\n"));
  const save = f.store.save.bind(f.store);
  f.store.save = async () => { throw new Error("disk full"); };

  await expect(migrateProject(f.store, await f.store.read(), "Studio")).rejects.toThrow(/disk full/);
  expect(await exists(join(own, ".afk-invocation-original.json"))).toBe(true);
  expect(await readFile(join(own, "SKILL.md"), "utf8")).toContain("Edited");

  f.store.save = save;
  await migrateProject(f.store, await f.store.read(), "Studio");
  expect(await readFile(join(own, "SKILL.md"), "utf8")).toBe(body("own", "Edited"));
  expect(await exists(join(own, ".afk-invocation-original.json"))).toBe(false);
});

it("moves an AFK copy the user edited to a dated recovery folder instead of deleting it", async () => {
  const f = await fixture();
  await f.write(join(f.home, ".agents/skills/.disabled/review"), "review", "Library");
  const override = await f.write(join(f.root, ".afk-overrides/review"), "review", "MY OVERRIDE EDIT", "disable-model-invocation: true\n");
  await symlink(override, join(f.root, "review"), "dir");
  f.settings.managedLinks[join(f.root, "review")] = override;
  await f.store.save(f.settings);

  const result = await migrateProject(f.store, await f.store.read(), "Studio");

  expect(result.movedAside).toHaveLength(1);
  expect(result.movedAside[0]).toMatchObject({ name: "review", from: override });
  expect(result.movedAside[0]!.to.startsWith(join(f.home, ".afk/restore-aside/"))).toBe(true);
  expect(await readFile(join(result.movedAside[0]!.to, "SKILL.md"), "utf8")).toContain("MY OVERRIDE EDIT");
  expect(await exists(join(f.root, ".afk-overrides"))).toBe(false);
});
