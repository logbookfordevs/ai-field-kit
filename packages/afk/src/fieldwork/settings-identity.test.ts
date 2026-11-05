import { mkdtemp, readFile, rm } from "node:fs/promises";
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

describe("saving settings", () => {
  it("refuses to overwrite a configuration with a blank one that has a new identity", async () => {
    const { home, store } = await fixture();
    const before = await readFile(store.path, "utf8");

    await expect(new SettingsStore(home).save(emptySettings())).rejects.toThrow(/different AFK configuration/);
    expect(await readFile(store.path, "utf8")).toBe(before);
  });
});
