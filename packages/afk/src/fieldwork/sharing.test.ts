import { afterEach, expect, it } from "vitest";
import { lstat, mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { sharingState, setSharing } from "./sharing.js";
import { SkillLibrary } from "./skills.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-sharing-")); homes.push(home);
  const store = new SettingsStore(home), settings = emptySettings();
  settings.projects.push({ name: "Demo", path: join(home, "project") });
  await mkdir(join(home, "project")); await store.save(settings);
  return { home, store, settings, library: new SkillLibrary(store) };
}
it.each(["Global", "Demo"])("creates missing folders and disconnects without deleting skills in %s", async scope => {
  const { store, settings } = await fixture();
  const before = await sharingState(store, settings, scope);
  expect(before.status).toBe("missing");
  await setSharing(store, settings, scope, true, before);
  const connected = await sharingState(store, settings, scope);
  expect(connected.status).toBe("connected");
  expect(await readlink(connected.destination)).toBe(connected.source);
  await writeFile(join(connected.source, "keep.txt"), "Keep");
  await setSharing(store, settings, scope, false, connected);
  await expect(lstat(connected.destination)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(connected.source, "keep.txt"), "utf8")).toBe("Keep");
});
it("recognizes an existing relative folder link", async () => {
  const { home, store, settings } = await fixture();
  await mkdir(join(home, ".agents/skills"), { recursive: true }); await mkdir(join(home, ".claude"));
  await symlink("../.agents/skills", join(home, ".claude/skills"));
  const state = await sharingState(store, settings, "Global");
  expect(state.status).toBe("connected");
  await setSharing(store, settings, "Global", false, state);
  await expect(readlink(state.destination)).rejects.toMatchObject({ code: "ENOENT" });
});
it("preserves populated Claude folders and unrelated links", async () => {
  const { home, store, settings } = await fixture();
  const folder = join(home, ".claude/skills"); await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "keep.txt"), "Keep");
  const state = await sharingState(store, settings, "Global");
  expect(state.status).toBe("conflict");
  await expect(setSharing(store, settings, "Global", true, state)).rejects.toThrow("contains files");
  expect(await readFile(join(folder, "keep.txt"), "utf8")).toBe("Keep");
  await rm(folder, { recursive: true }); await symlink(join(home, "other"), folder);
  const link = await sharingState(store, settings, "Global");
  await expect(setSharing(store, settings, "Global", false, link)).rejects.toThrow("somewhere else");
  expect(await readlink(folder)).toBe(join(home, "other"));
});
it("replaces an empty folder but rejects a stale review when files arrive", async () => {
  const { home, store, settings } = await fixture();
  const folder = join(home, ".claude/skills"); await mkdir(folder, { recursive: true });
  const state = await sharingState(store, settings, "Global");
  expect(state.status).toBe("empty");
  await writeFile(join(folder, "new.txt"), "New");
  await expect(setSharing(store, settings, "Global", true, state)).rejects.toThrow("changed since review");
  await rm(join(folder, "new.txt"));
  await setSharing(store, settings, "Global", true, await sharingState(store, settings, "Global"));
  expect((await sharingState(store, settings, "Global")).status).toBe("connected");
});
it.each(["Global", "Demo"])("supports individual and profile activation through the shared folder in %s", async scope => {
  const { home, store, settings, library } = await fixture();
  await setSharing(store, settings, scope, true, await sharingState(store, settings, scope));
  const root = library.root(settings, scope), stored = join(root, ".disabled/render");
  await mkdir(stored, { recursive: true }); await writeFile(join(stored, "SKILL.md"), "Instructions");
  await library.toggle(settings, "render", scope);
  expect((await library.inventory(settings, scope))[0]?.available).toBe(true);
  await library.toggle(settings, "render", scope);
  expect((await library.inventory(settings, scope))[0]?.available).toBe(false);
  const global = join(home, ".agents/skills/.disabled/video"); await mkdir(global, { recursive: true }); await writeFile(join(global, "SKILL.md"), "Video instructions");
  settings.profiles.push({ id: "video", name: "Video", source: "Local skill selection", skills: ["video"], ready: true, enabled: [] });
  await library.activate(settings, "video", scope, true);
  expect(await readFile(join(root, "../../.claude/skills/video/SKILL.md"), "utf8")).toBe("Video instructions");
  await library.activate(settings, "video", scope, false);
  await expect(lstat(join(root, "video"))).rejects.toMatchObject({ code: "ENOENT" });
  expect((await sharingState(store, settings, scope)).status).toBe("connected");
});
