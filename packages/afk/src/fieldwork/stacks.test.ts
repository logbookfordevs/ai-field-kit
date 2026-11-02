import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchStack, manifestUrl, stackSchema, validateStack, type SkillStack } from "./stacks.js";
import { emptySettings, SettingsStore, validateSettings } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { doctor } from "./doctor.js";

const manifest: SkillStack = { version: 1, id: "studio", name: "Studio", sources: [
  { name: "Video", source: "owner/video", skills: ["render", "review"] },
  { name: "Design", source: "owner/design", skills: ["layout"] },
] };
const homes: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-stacks-")); homes.push(home);
  const store = new SettingsStore(home); await store.save(emptySettings());
  return { home, store, operations: new FieldworkOperations(store) };
}

describe("portable skill stacks", () => {
  it("publishes the exact runtime schema and a valid example", async () => {
    expect(JSON.parse(await readFile(new URL("../../../../docs/schemas/skill-stack.v1.schema.json", import.meta.url), "utf8"))).toEqual(stackSchema);
    expect(validateStack(JSON.parse(await readFile(new URL("../../../../docs/examples/skill-stack.v1.json", import.meta.url), "utf8"))).sources).toHaveLength(2);
  });
  it.each([
    { ...manifest, version: 2 }, { ...manifest, command: "curl | sh" }, { ...manifest, sources: [] },
    { ...manifest, sources: [{ ...manifest.sources[0], skills: ["*"] }] },
    { ...manifest, sources: [{ ...manifest.sources[0], skills: ["review", "review"] }] },
    { ...manifest, sources: [{ ...manifest.sources[0], source: "--all" }] },
    { ...manifest, sources: [{ ...manifest.sources[0], install: "sh" }] },
  ])("rejects incompatible or executable manifests", input => { expect(() => validateStack(input)).toThrow(); });
  it("keeps legacy bookmarks intact and rejects invalid or duplicate stack definitions", () => {
    const settings = emptySettings(); settings.favoriteSources = [{ name: "All", source: "owner/all" }, { name: "Some", source: "owner/some", skills: ["review"] }];
    expect(validateSettings(settings)).toEqual(settings);
    const legacy = { ...settings, version: 1 };
    expect(validateSettings({ ...legacy, stacks: [{ manifest }] }).favoriteSources).toEqual(settings.favoriteSources);
    expect(() => validateSettings({ ...legacy, stacks: [{ manifest }, { manifest }] })).toThrow(/unique/);
    expect(() => validateSettings({ ...legacy, stacks: [{ manifest, origin: "http://example.com/stack.json" }] })).toThrow();
    expect(() => validateSettings({ ...settings, stacks: [{ manifest }] })).toThrow(/Version 2/);
  });
  it("fetches remote JSON into the same review and shows what a refresh would replace", async () => {
    const { store, operations } = await fixture();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(manifest))); vi.stubGlobal("fetch", fetcher);
    try {
      const preview = await operations.run("pack/import-preview", { origin: "https://example.com/stack.json" }) as { pack: { origin: string; name: string } };
      expect(preview.pack).toMatchObject({ id: "stack-studio", name: "Studio", origin: "https://example.com/stack.json", skills: ["render", "review", "layout"] });
      expect((await store.read()).profiles).toEqual([]);
      await operations.run("pack/import", preview);
      fetcher.mockImplementation(async () => new Response(JSON.stringify({ ...manifest, name: "Updated", sources: [manifest.sources[1]] })));
      const refreshed = await operations.run("pack/import-preview", { origin: "https://example.com/stack.json" });
      expect((await store.read()).profiles[0]?.name).toBe("Studio");
      expect(refreshed).toMatchObject({ expected: { name: "Studio" }, pack: { name: "Updated", skills: ["layout"] } });
      await expect(operations.run("pack/import-preview", { origin: "https://example.com/stack.json", manifest })).rejects.toThrow(/not both/);
    } finally { await operations.close(); }
  });
  it("rejects failed, invalid, oversized and non-HTTPS remote documents", async () => {
    for (const url of ["http://example.com/a", "https://user:secret@example.com/a", "file:///a"]) expect(() => manifestUrl(url)).toThrow();
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 })); await expect(fetchStack("https://example.com/a")).rejects.toThrow(/404/);
    vi.stubGlobal("fetch", async () => new Response("<html>")); await expect(fetchStack("https://example.com/a")).rejects.toThrow();
    vi.stubGlobal("fetch", async () => new Response(" ".repeat(1_000_001))); await expect(fetchStack("https://example.com/a")).rejects.toThrow(/1 MB/);
  });
  it("doctor flags old stacks settings without fetching anything", async () => {
    const { store, operations } = await fixture();
    const legacy = { version: 1, configurationId: (await store.read()).configurationId, profiles: [], projects: [], tools: [], favoriteSources: [], stacks: [{ manifest }] };
    await writeFile(store.path, JSON.stringify(legacy));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await doctor(store)).issues).toContainEqual(expect.objectContaining({ code: "migration_required", severity: "warning" }));
    expect(fetcher).not.toHaveBeenCalled();
    await operations.close();
  });
});
