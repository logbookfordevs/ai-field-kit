import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { startFieldwork } from "./server.js";

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

  it("reads groups without activation and routes a shared copy to a project", async () => {
    const { library, settings, store, project, stored } = await fixture();
    expect(await library.readGroup(settings, "video")).toContain("Render instruction");
    expect((await library.inventory(settings, "Demo"))).toEqual([]);
    await library.activate(settings, "video", "Demo", true);
    expect(await readlink(join(project, ".agents/skills/render"))).toBe(stored);
    expect((await store.read()).profiles[0]?.enabled).toEqual(["Demo"]);
    await library.activate(settings, "video", "Demo", false);
    expect(await library.inventory(settings, "Demo")).toEqual([]);
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

  it("preserves preexisting user links and rejects colliding files", async () => {
    const { library, settings, project, stored } = await fixture();
    const root = join(project, ".agents/skills"); await mkdir(root, { recursive: true });
    await symlink(stored, join(root, "render"));
    await library.activate(settings, "video", "Demo", true);
    await library.activate(settings, "video", "Demo", false);
    expect(await readlink(join(root, "render"))).toBe(stored);
    await rm(join(root, "render")); await mkdir(join(root, "render"));
    await writeFile(join(root, "render/SKILL.md"), "User content");
    await expect(library.activate(settings, "video", "Demo", true)).rejects.toThrow("already exists");
    expect(await readFile(join(root, "render/SKILL.md"), "utf8")).toBe("User content");
  });

  it("isolates project invocation metadata and keeps disable working", async () => {
    const { library, store, settings, stored, project } = await fixture();
    await library.activate(settings, "video", "Demo", true);
    const original = await readFile(join(stored, "SKILL.md"), "utf8");
    await setInvocation(store, settings, "render", "Demo", "Manual only");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(original);
    expect(await readFile(join(project, ".agents/skills/render/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    await library.activate(settings, "video", "Demo", false);
    expect((await library.inventory(settings, "Demo"))).toEqual([]);
  });
  it("keeps project exposure valid when a global individual skill is disabled", async () => {
    const { library, settings, store, home, stored, project } = await fixture();
    const active = join(home, ".agents/skills/render");
    const { rename } = await import("node:fs/promises");
    await rename(stored, active);
    await library.activate(settings, "video", "Demo", true);
    await library.toggle(settings, "render", "Global");
    expect(await readlink(join(project, ".agents/skills/render"))).toBe(stored);
    expect((await store.read()).profiles[0]?.enabled).toEqual(["Demo"]);
    expect((await library.inventory(settings, "Global"))).toHaveLength(1);
    await library.toggle(settings, "render", "Global");
    expect((await library.inventory(settings, "Global"))).toHaveLength(1);
    expect((await library.inventory(settings, "Global"))[0]?.available).toBe(true);
  });

  it("preserves an independent activation when its profile is disabled", async () => {
    const { library, settings } = await fixture();
    await library.toggle(settings, "render", "Global");
    await library.activate(settings, "video", "Global", true);
    await library.activate(settings, "video", "Global", false);
    expect((await library.inventory(settings, "Global"))[0]?.available).toBe(true);
  });

  it("lets project invocation change repeatedly without touching the shared copy", async () => {
    const { library, store, settings, stored, project } = await fixture();
    await library.activate(settings, "video", "Demo", true);
    await setInvocation(store, settings, "render", "Demo", "Manual only");
    await setInvocation(store, settings, "render", "Demo", "Automatic allowed");
    await setInvocation(store, settings, "render", "Demo", "");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).not.toContain("disable-model-invocation");
    expect(await readFile(join(project, ".claude/skills/render/SKILL.md"), "utf8")).not.toContain("disable-model-invocation");
    await setInvocation(store, settings, "render", "Global", "Manual only");
    expect(await readFile(join(project, ".agents/skills/render/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    await library.activate(settings, "video", "Demo", false);
    await library.activate(settings, "video", "Demo", true);
    expect((await library.inventory(settings, "Demo"))).toHaveLength(1);
  });

});

describe("Fieldwork local server", () => {
  it("only shuts down for an authorized exit request and preserves settings", async () => {
    const { store } = await fixture();
    const before = await store.read();
    const app = await startFieldwork(store);
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
    const { store } = await fixture();
    const app = await startFieldwork(store);
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
