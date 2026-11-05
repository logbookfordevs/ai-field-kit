import { afterEach, expect, it } from "vitest";
import { lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SettingsStore } from "./settings.js";
import { DuplicateCopyError, SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { installSkills } from "./skill-install.js";
import { resolveDuplicate } from "./duplicates.js";
import { doctor } from "./doctor.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });

const skill = (body: string): string => `---\nname: sketch\ndescription: Draw things\n---\n${body}\n`;

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-duplicate-test-")); homes.push(home);
  const store = new SettingsStore(home); await store.initialize();
  const settings = await store.read();
  const project = join(home, "project"); await mkdir(project);
  settings.projects.push({ name: "Studio", path: project });
  settings.profiles.push({ id: "video", name: "Video", source: "owner/tools", skills: ["sketch"], enabled: [], ready: true });
  await store.save(settings);
  const root = join(home, ".agents/skills"), live = join(root, "sketch"), stored = join(root, ".disabled/sketch");
  await mkdir(stored, { recursive: true });
  await writeFile(join(stored, "SKILL.md"), skill("Old instructions"));
  await writeFile(join(stored, ".afk-source.json"), JSON.stringify({ source: "owner/tools" }));
  const library = new SkillLibrary(store);
  const install = async (body: string): Promise<void> => { await mkdir(live, { recursive: true }); await writeFile(join(live, "SKILL.md"), skill(body)); };
  return { home, store, settings, project, root, live, stored, library, install };
}

it("keeps a fresh installation over the stored copy and reapplies the saved invocation", async () => {
  const f = await fixture();
  await setInvocation(f.store, f.settings, "sketch", "Global", "Manual only");
  const result = await installSkills(f.store, await f.store.read(), [{ source: "owner/tools", skills: ["sketch"] }], "Global", "universal", "Test", () => {}, undefined, async () => { await f.install("New instructions"); return 0; });
  expect(result.code).toBe(0);
  expect(result.output).toContain("Replaced the older stored copy of sketch");
  expect((await lstat(f.live)).isSymbolicLink()).toBe(true);
  expect(await readFile(join(f.stored, "SKILL.md"), "utf8")).toContain("New instructions");
  expect(await readFile(join(f.stored, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
  expect((await readdir(join(f.root, ".disabled"))).filter(name => name.startsWith(".afk-replaced"))).toEqual([]);
  const [entry] = await f.library.inventory(await f.store.read(), "Global");
  expect(entry).toMatchObject({ available: true, invocation: { claude: "Manual only" } });
  expect(entry?.duplicate).toBeUndefined();
});

it("asks before turning off a skill whose stored copy differs, and changes nothing", async () => {
  const f = await fixture(); await f.install("New instructions");
  await expect(f.library.toggle(f.settings, "sketch", "Global")).rejects.toBeInstanceOf(DuplicateCopyError);
  expect(await readFile(join(f.live, "SKILL.md"), "utf8")).toContain("New instructions");
  expect(await readFile(join(f.stored, "SKILL.md"), "utf8")).toContain("Old instructions");
  expect((await f.library.inventory(f.settings, "Global"))[0]?.duplicate).toEqual({ identical: false });
  expect((await doctor(f.store)).issues.map(issue => issue.code)).toContain("skill_duplicate_copy");
});

it("turns off a skill whose stored copy matches apart from AFK invocation edits", async () => {
  const f = await fixture();
  await setInvocation(f.store, f.settings, "sketch", "Global", "Manual only");
  await f.install("Old instructions");
  await f.library.toggle(f.settings, "sketch", "Global");
  await expect(lstat(f.live)).rejects.toThrow();
  expect(await readFile(join(f.stored, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
  expect((await f.library.inventory(f.settings, "Global"))[0]).toMatchObject({ available: false, stored: true });
});

it("keeps the stored copy on request and deletes the installed one", async () => {
  const f = await fixture(); await f.install("New instructions");
  await resolveDuplicate(f.store, f.settings, "sketch", "Global", "stored");
  expect(await readlink(f.live)).toBe(f.stored);
  expect(await readFile(join(f.live, "SKILL.md"), "utf8")).toContain("Old instructions");
  await f.library.toggle(f.settings, "sketch", "Global");
  expect((await f.library.inventory(f.settings, "Global"))[0]).toMatchObject({ available: false });
});

it("turns a pack on over an identical installed copy, and asks when the copies differ", async () => {
  const f = await fixture(); await f.install("New instructions");
  await expect(f.library.activate(f.settings, "video", "Global", true)).rejects.toBeInstanceOf(DuplicateCopyError);
  await resolveDuplicate(f.store, f.settings, "sketch", "Global", "installed");
  await f.library.activate(f.settings, "video", "Global", true);
  expect((await f.store.read()).profiles[0]?.enabled).toEqual(["Global"]);
  expect(await readFile(join(f.live, "SKILL.md"), "utf8")).toContain("New instructions");
});

it("leaves an installed skill alone when nothing is stored under its name", async () => {
  const f = await fixture(); await rm(f.stored, { recursive: true }); await f.install("Only copy");
  await installSkills(f.store, f.settings, [{ source: "owner/tools", skills: ["sketch"] }], "Global", "universal", "Test", () => {}, undefined, async () => 0);
  expect((await lstat(f.live)).isDirectory()).toBe(true);
});
