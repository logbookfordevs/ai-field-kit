import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptySettings, SettingsStore } from "./settings.js";

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-snapshots-")); folders.push(home);
  const store = new SettingsStore(home);
  const settings = emptySettings();
  settings.favoriteSources = [{ name: "Studio", source: "owner/studio" }];
  await store.save(settings);
  return { home, store, settings };
}

describe("settings snapshots", () => {
  it("snapshots the previous file before a save replaces it, and restores it", async () => {
    const { store, settings } = await fixture();
    const original = await readFile(store.path, "utf8");
    settings.favoriteSources.push({ name: "Motion", source: "owner/motion" });
    await store.save(settings);

    const [snapshot] = await store.backups();
    expect(snapshot).toMatchObject({ sources: 1, configurationId: settings.configurationId });

    await store.restoreBackup(snapshot!.name);
    expect(await readFile(store.path, "utf8")).toBe(original);
    expect((await store.read()).favoriteSources).toHaveLength(1);
    expect((await store.backups()).some(backup => backup.sources === 2)).toBe(true);
  });

  it("does not snapshot when a save changes nothing", async () => {
    const { store, settings } = await fixture();
    await store.save(settings); await store.save(settings);
    expect(await store.backups()).toEqual([]);
  });

  it("refuses to overwrite a configuration with a blank one that has a new identity", async () => {
    const { home, store } = await fixture();
    const before = await readFile(store.path, "utf8");

    await expect(new SettingsStore(home).save(emptySettings())).rejects.toThrow(/different AFK configuration/);
    expect(await readFile(store.path, "utf8")).toBe(before);
  });

  it("allows a deliberate replacement and snapshots what it replaced", async () => {
    const { home, store } = await fixture();
    const before = await readFile(store.path, "utf8");

    await new SettingsStore(home).save(emptySettings(), { replace: true });
    const snapshots = await store.backups();
    expect(snapshots).toHaveLength(1);
    expect(await readFile(join(store.backupFolder, snapshots[0]!.name), "utf8")).toBe(before);
  });

  it("keeps only the most recent snapshots", async () => {
    const { store, settings } = await fixture();
    for (let index = 0; index < 25; index++) {
      settings.favoriteSources = [{ name: `Source ${index}`, source: `owner/source-${index}` }];
      await store.save(settings);
    }
    expect(await readdir(store.backupFolder)).toHaveLength(20);
  });

  it("rejects restore names that point outside the backup folder", async () => {
    const { store } = await fixture();
    await expect(store.restoreBackup("../settings.json")).rejects.toThrow(/backup name/);
    await expect(store.restoreBackup("settings-missing.json")).rejects.toThrow(/no longer exists/);
  });
});
