import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { startFieldwork } from "./server.js";
import { fixtureWeb } from "./web.test-helper.js";
import { FieldworkOperations } from "./operations.js";

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-test-")); folders.push(home);
  const store = new SettingsStore(home);
  const settings = emptySettings();
  const project = join(home, "project"); await mkdir(project);
  settings.projects.push({ name: "Demo", path: project });
  settings.profiles.push({ id: "video", name: "Video", source: "Local skill selection", skills: ["render"], enabled: [], ready: true });
  const stored = join(home, ".agents/skills/.disabled/render"); await mkdir(stored, { recursive: true });
  await writeFile(join(stored, "SKILL.md"), "---\nname: render\ndescription: Render videos\n---\nRender instruction\n");
  await store.save(settings);
  return { home, store, settings, project, stored, library: new SkillLibrary(store) };
}

describe("Fieldwork skill availability", () => {
  it("ignores metadata files and broken links in skill discovery folders", async () => {
    const { home, library, settings } = await fixture();
    const root = join(home, ".agents/skills");
    await writeFile(join(root, "skills.json"), "{}");
    await symlink(join(home, "missing-skill"), join(root, "missing"));
    const inventory = await library.inventory(settings, "Global");
    expect(inventory.map(entry => entry.name)).toEqual(["render"]);
  });

  it("reads groups without activating them and keeps packs out of projects", async () => {
    const { library, settings, store, project, stored } = await fixture();
    expect(await library.readGroup(settings, "video")).toContain("Render instruction");
    expect((await library.inventory(settings, "Demo"))).toEqual([]);
    await expect(library.activate(settings, "video", "Demo", true)).rejects.toThrow("Global");
    expect((await store.read()).profiles[0]?.enabled).toEqual([]);
    await expect(readlink(join(project, ".agents/skills/render"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toContain("Render instruction");
  });

  it("retains overlapping profiles and works for global disable", async () => {
    const { library, settings } = await fixture();
    settings.profiles.push({ ...settings.profiles[0]!, id: "second", name: "Second", enabled: [] });
    await library.activate(settings, "video", "Global", true);
    await library.activate(settings, "second", "Global", true);
    await library.activate(settings, "video", "Global", false);
    expect((await library.inventory(settings, "Global")).some(s => s.available)).toBe(true);
    await library.activate(settings, "second", "Global", false);
    expect((await library.inventory(settings, "Global")).every(s => !s.available)).toBe(true);
  });

  it("preserves an independent activation when its profile is disabled", async () => {
    const { library, settings } = await fixture();
    await library.toggle(settings, "render", "Global");
    await library.activate(settings, "video", "Global", true);
    await library.activate(settings, "video", "Global", false);
    expect((await library.inventory(settings, "Global"))[0]?.available).toBe(true);
  });

  it("applies Global invocation to the available copy when a stale stored copy shares its name", async () => {
    const { library, store, settings, home, stored } = await fixture();
    const live = join(home, ".agents/skills/render"); await mkdir(live);
    await writeFile(join(live, "SKILL.md"), "---\nname: render\ndescription: Reinstalled\n---\nNew instruction\n");
    const staleCopy = await readFile(join(stored, "SKILL.md"), "utf8");
    await setInvocation(store, settings, "render", "Global", "Manual only");
    expect(await readFile(join(live, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(staleCopy);
    const [entry] = await library.inventory(settings, "Global");
    expect(entry?.invocation).toMatchObject({ claude: "Manual only", codex: "Manual only" });
  });

});

describe("Fieldwork local server", () => {
  it("only shuts down for an authorized exit request and preserves settings", async () => {
    const { home, store } = await fixture();
    const before = await store.read();
    const app = await startFieldwork(store, 0, { web: await fixtureWeb(home) });
    try {
      const rejected = await fetch(`${app.url}/api/exit`, { method: "POST" });
      expect(rejected.status).toBe(403);
      const html = await (await fetch(app.url)).text();
      const token = /window.afkToken="([a-f0-9]+)"/.exec(html)?.[1];
      const exited = await fetch(`${app.url}/api/exit`, { method: "POST", headers: { "x-afk-token": token!, "Content-Type": "application/json" }, body: "{}" });
      expect(await exited.json()).toEqual({ ok: true });
      await app.close();
      await expect(fetch(app.url)).rejects.toThrow();
      expect(await store.read()).toEqual(before);
    } finally { await app.close(); }
  });

  it("requires the current app token for filesystem and command APIs", async () => {
    const { home, store } = await fixture();
    const app = await startFieldwork(store, 0, { web: await fixtureWeb(home) });
    try {
      const result = await fetch(`${app.url}/api/state`);
      expect(result.status).toBe(403);
      const html = await (await fetch(app.url)).text();
      const token = /window.afkToken="([a-f0-9]+)"/.exec(html)?.[1];
      expect(token).toBeTruthy();
      const state = await fetch(`${app.url}/api/state`, { headers: { "x-afk-token": token! } });
      expect(state.status).toBe(200);
    } finally { await app.close(); }
  });
});

describe("Fieldwork nested skills", () => {
  it("lists skills inside subfolders separately from the managed inventory", async () => {
    const { home, library, settings } = await fixture();
    const root = join(home, ".agents/skills");
    const synced = join(root, "synced/account/research"); await mkdir(synced, { recursive: true });
    await writeFile(join(synced, "SKILL.md"), "---\nname: research\ndescription: Research topics\n---\nResearch\n");
    await mkdir(join(root, "top/references/inner"), { recursive: true });
    await writeFile(join(root, "top/SKILL.md"), "Top"); await writeFile(join(root, "top/references/inner/SKILL.md"), "Inner");
    await mkdir(join(root, ".disabled/render/extra/hidden"), { recursive: true });
    await writeFile(join(root, ".disabled/render/extra/hidden/SKILL.md"), "Hidden");
    await symlink(join(root, "synced"), join(root, "alias"));

    expect((await library.inventory(settings, "Global")).map(entry => entry.name)).toEqual(["render", "top"]);
    expect(await library.nested(settings, "Global")).toEqual([
      { name: "research", folder: "synced/account", path: synced, description: "Research topics", invocation: { claude: "Automatic allowed", codex: "Automatic allowed" } },
    ]);
    expect(await library.nested(settings, "Demo")).toEqual([]);
  });

  it("reads a nested skill only when its folder is named", async () => {
    const { home, store } = await fixture();
    const nested = join(home, ".agents/skills/synced/account/render"); await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "SKILL.md"), "Nested instruction");
    const operations = new FieldworkOperations(store);

    expect(await operations.run("skill/read", { name: "render", scope: "Global", folder: "synced/account" })).toMatchObject({ path: nested, content: "Nested instruction" });
    expect(await operations.run("skill/read", { name: "render", scope: "Global" })).toMatchObject({ content: expect.stringContaining("Render instruction") });
    expect((await operations.run("state", {}) as { nestedInventories: Record<string, { name: string }[]> }).nestedInventories.Global?.map(entry => entry.name)).toEqual(["render"]);
  });
});
