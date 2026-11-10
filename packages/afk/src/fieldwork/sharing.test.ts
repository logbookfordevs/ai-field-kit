import { afterEach, expect, it } from "vitest";
import { lstat, mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { sharingState, setSharing } from "./sharing.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-sharing-")); homes.push(home);
  const store = new SettingsStore(home), settings = emptySettings();
  settings.projects.push({ name: "Demo", path: join(home, "project") });
  await mkdir(join(home, "project")); await store.save(settings);
  return { home, store, settings };
}
it("creates missing folders and disconnects without deleting skills", async () => {
  const scope = "Demo";
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
  await mkdir(join(home, "project/.agents/skills"), { recursive: true }); await mkdir(join(home, "project/.claude"));
  await symlink("../.agents/skills", join(home, "project/.claude/skills"));
  const state = await sharingState(store, settings, "Demo");
  expect(state.status).toBe("connected");
  await setSharing(store, settings, "Demo", false, state);
  await expect(readlink(state.destination)).rejects.toMatchObject({ code: "ENOENT" });
});
it("preserves populated Claude folders and unrelated links", async () => {
  const { home, store, settings } = await fixture();
  const folder = join(home, "project/.claude/skills"); await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "keep.txt"), "Keep");
  const state = await sharingState(store, settings, "Demo");
  expect(state.status).toBe("conflict");
  await expect(setSharing(store, settings, "Demo", true, state)).rejects.toThrow("contains files");
  expect(await readFile(join(folder, "keep.txt"), "utf8")).toBe("Keep");
  await rm(folder, { recursive: true }); await symlink(join(home, "other"), folder);
  const link = await sharingState(store, settings, "Demo");
  await expect(setSharing(store, settings, "Demo", false, link)).rejects.toThrow("somewhere else");
  expect(await readlink(folder)).toBe(join(home, "other"));
});
it("replaces an empty folder but rejects a stale review when files arrive", async () => {
  const { home, store, settings } = await fixture();
  const folder = join(home, "project/.claude/skills"); await mkdir(folder, { recursive: true });
  const state = await sharingState(store, settings, "Demo");
  expect(state.status).toBe("empty");
  await writeFile(join(folder, "new.txt"), "New");
  await expect(setSharing(store, settings, "Demo", true, state)).rejects.toThrow("changed since review");
  await rm(join(folder, "new.txt"));
  await setSharing(store, settings, "Demo", true, await sharingState(store, settings, "Demo"));
  expect((await sharingState(store, settings, "Demo")).status).toBe("connected");
});
it("leaves Global to Agent folders", async () => {
  const { store, settings } = await fixture();
  await expect(sharingState(store, settings, "Global")).rejects.toThrow(/Agent folders/);
});
