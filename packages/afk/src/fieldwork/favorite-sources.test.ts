import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore, validateSettings } from "./settings.js";

const homes: string[] = [];
afterEach(async () => {
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })));
});

describe("favorite source selections", () => {
  it("preserves legacy all-skill bookmarks without requiring a migration", () => {
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "Toolkit", source: "owner/toolkit" }];
    expect(validateSettings(settings).favoriteSources).toEqual(settings.favoriteSources);
  });

  it("persists both selected and all-skill bookmarks without preparing profiles or skills", async () => {
    const home = await mkdtemp(join(tmpdir(), "afk-source-selection-"));
    homes.push(home);
    const settings = emptySettings();
    settings.favoriteSources = [
      { name: "Selected", source: "owner/toolkit", skills: ["review", "video"] },
      { name: "All", source: "owner/other" },
    ];
    const store = new SettingsStore(home);
    await store.save(settings);
    expect(await store.read()).toEqual(settings);
    expect((await store.read()).profiles).toEqual([]);
  });

  it.each([
    [], ["*"], ["review", "review"], ["--all"], ["../review"], ["review\nvideo"], [1], "review", null,
  ].map(skills => ({ skills })))("rejects invalid selections instead of treating them as all skills: $skills", ({ skills }) => {
    const settings = { ...emptySettings(), favoriteSources: [{ name: "Toolkit", source: "owner/toolkit", skills }] };
    expect(() => validateSettings(settings)).toThrow();
  });

  it("keeps an optional manual description and rejects empty, oversized or control-character text", () => {
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "Toolkit", source: "owner/toolkit", description: "Daily review helpers" }];
    expect(validateSettings(settings).favoriteSources[0]?.description).toBe("Daily review helpers");
    for (const description of ["", "   ", "a".repeat(281), "line\nbreak", 42]) {
      expect(() => validateSettings({ ...emptySettings(), favoriteSources: [{ name: "Toolkit", source: "owner/toolkit", description }] })).toThrow();
    }
  });
});
