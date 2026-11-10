import { mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySettings, SettingsStore } from "./settings.js";

const folders: string[] = [];

afterEach(async () => {
  vi.useRealTimers();
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

  it("waits for the file in a new session too, on a machine that saved settings before", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-sync-gap-")); folders.push(home);
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "Studio", source: "owner/studio" }];
    await new SettingsStore(home).save(settings);
    const store = new SettingsStore(home);

    const parked = store.path + ".parked";
    await rename(store.path, parked);
    setTimeout(() => { void rename(parked, store.path); }, 150);

    expect((await store.read()).favoriteSources).toEqual([{ name: "Studio", source: "owner/studio" }]);
  });

  it("starts blank at once when this machine never saved settings", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-first-run-")); folders.push(home);
    vi.useFakeTimers({ toFake: ["setTimeout"] });

    expect((await new SettingsStore(home).read()).favoriteSources).toEqual([]);
  });
});
