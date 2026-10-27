import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptySettings, SettingsStore } from "./settings.js";

const folders: string[] = [];

afterEach(async () => {
  await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe("settings file briefly missing during a sync", () => {
  it("keeps the saved configuration instead of reading blank defaults", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-sync-gap-")); folders.push(home);
    const store = new SettingsStore(home);
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "Studio", source: "owner/studio" }];
    await store.save(settings);

    const parked = store.path + ".parked";
    await rename(store.path, parked);
    setTimeout(() => { void rename(parked, store.path); }, 150);

    const read = await store.read();
    expect(read.favoriteSources).toEqual([{ name: "Studio", source: "owner/studio" }]);
    expect(read.configurationId).toBe(settings.configurationId);
  });

  it("still starts blank when no settings file exists", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-first-run-")); folders.push(home);
    expect((await new SettingsStore(home).read()).favoriteSources).toEqual([]);
  });
});
