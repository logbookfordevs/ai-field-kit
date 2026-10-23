import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { deleteSkill, previewDeletion } from "./deletion.js";

const homes: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(homes.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-delete-")); homes.push(home);
  const store = new SettingsStore(home), settings = emptySettings();
  const path = join(home, ".agents/skills/.disabled/render");
  await mkdir(join(path, "references"), { recursive: true });
  await writeFile(join(path, "SKILL.md"), "Render instructions");
  await writeFile(join(path, "references/help.md"), "Supporting file");
  await store.save(settings);
  return { home, store, settings, path };
}
it("permanently removes the reviewed folder, references and invocation preference", async () => {
  const { store, settings, path } = await fixture();
  settings.preferences["Global|render"] = "Manual only";
  const preview = await previewDeletion(store, settings, "render", "Global");
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readFile(join(path, "references/help.md"))).rejects.toMatchObject({ code: "ENOENT" });
  expect((await store.read()).preferences["Global|render"]).toBeUndefined();
});
it("requires explicit confirmation and a fresh review", async () => {
  const { store, settings, path } = await fixture();
  const preview = await previewDeletion(store, settings, "render", "Global");
  await expect(deleteSkill(store, settings, "render", "Global", preview, false)).rejects.toThrow("Confirm permanent deletion");
  await writeFile(join(path, "references/help.md"), "New content");
  await expect(deleteSkill(store, settings, "render", "Global", preview, true)).rejects.toThrow("changed since review");
  expect(await readFile(join(path, "references/help.md"), "utf8")).toBe("New content");
});
it("allows deleting disabled profile members while retaining the definition", async () => {
  const { store, settings } = await fixture();
  settings.profiles.push({ id: "video", name: "Video", source: "Local skill selection", skills: ["render"], enabled: [], ready: true });
  const preview = await previewDeletion(store, settings, "render", "Global");
  await deleteSkill(store, settings, "render", "Global", preview, true);
  expect((await store.read()).profiles[0]).toMatchObject({ skills: ["render"], ready: false });


});
it("protects unowned project links and refuses deleting shared storage through a link", async () => {
  const { store, settings, path, home } = await fixture();
  const project = join(home, "project");
  settings.projects.push({ name: "Demo", path: project });
  await mkdir(join(project, ".agents/skills/.disabled"), { recursive: true });
  await symlink(path, join(project, ".agents/skills/.disabled/another-name"));
  await expect(previewDeletion(store, settings, "render", "Global")).rejects.toThrow("Another entry");
  await symlink(path, join(project, ".agents/skills/.disabled/render"));
  await expect(previewDeletion(store, settings, "render", "Global")).rejects.toThrow("Another entry");
  await expect(previewDeletion(store, settings, "render", "Demo")).rejects.toThrow("shared storage");
});
it("restores stored files if saving settings fails", async () => {
  const { store, settings, path } = await fixture();
  const preview = await previewDeletion(store, settings, "render", "Global");
  vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Disk full"));
  await expect(deleteSkill(store, settings, "render", "Global", preview, true)).rejects.toThrow("Disk full");
  expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe("Render instructions");
});

it("inspects the active inventory copy when an older disabled copy also exists", async () => {
  const { store, home, path } = await fixture();
  const active = join(home, ".agents/skills/render");
  await mkdir(active);
  await writeFile(join(active, "SKILL.md"), "Current active instructions");
  const operations = new FieldworkOperations(store);
  try {
    expect(await operations.run("skill/read", { name: "render", scope: "Global" })).toMatchObject({ path: active, content: "Current active instructions" });
    await rm(active, { recursive: true });
    expect(await operations.run("skill/read", { name: "render", scope: "Global" })).toMatchObject({ path, content: "Render instructions" });
  } finally { await operations.close(); }
});

it("deletes an available physical copy without deleting an older disabled copy", async () => {
  const { store, settings, home, path } = await fixture();
  const active = join(home, ".agents/skills/render");
  await mkdir(active); await writeFile(join(active, "SKILL.md"), "Active version");
  const preview = await previewDeletion(store, settings, "render", "Global");
  expect(preview).toMatchObject({ available: true, links: [], retainedCopies: [await realpath(path)] });
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readFile(join(active, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe("Render instructions");
});
it("deletes stored files and owned active links in one confirmed action", async () => {
  const { store, settings, home, path } = await fixture();
  const active = join(home, ".agents/skills/render"), alias = join(home, ".claude/skills/render");
  await mkdir(join(home, ".claude/skills"), { recursive: true });
  await symlink(path, active); await symlink(path, alias);
  settings.independentSkills.Global = ["render"];
  settings.managedLinks[alias] = path;
  const preview = await previewDeletion(store, settings, "render", "Global");
  expect(preview.links.map(link => link.path)).toEqual([active, alias]);
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readlink(active)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readlink(alias)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(join(path, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  expect((await store.read()).managedLinks).toEqual({});
  expect((await store.read()).independentSkills.Global).toEqual([]);
});
it("rolls back both availability links and storage when settings cannot be saved", async () => {
  const { store, settings, home, path } = await fixture();
  const active = join(home, ".agents/skills/render");
  await symlink(path, active); settings.independentSkills.Global = ["render"];
  const preview = await previewDeletion(store, settings, "render", "Global");
  vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Disk full"));
  await expect(deleteSkill(store, settings, "render", "Global", preview, true)).rejects.toThrow("Disk full");
  expect(await readlink(active)).toBe(path);
  expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe("Render instructions");
});


it("recognizes a Claude skills directory linked to canonical Global storage", async () => {
  const { store, settings, home, path } = await fixture();
  const active = join(home, ".agents/skills/render");
  await rename(path, active);
  await mkdir(join(home, ".claude"), { recursive: true });
  await symlink(join(home, ".agents/skills"), join(home, ".claude/skills"));
  settings.managedLinks[join(home, ".claude/skills/render")] = active;
  const preview = await previewDeletion(store, settings, "render", "Global");
  expect(preview.claudeSharesStorage).toBe(true);
  expect(preview.links).toEqual([]);
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readFile(join(home, ".claude/skills/render/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readlink(join(home, ".claude/skills"))).toBe(join(home, ".agents/skills"));
  expect((await store.read()).managedLinks).toEqual({});
});
it("removes a matching unowned Claude symlink as part of reviewed Global deletion", async () => {
  const { store, settings, home, path } = await fixture();
  const alias = join(home, ".claude/skills/render");
  await mkdir(join(home, ".claude/skills"), { recursive: true });
  await symlink(path, alias);
  const preview = await previewDeletion(store, settings, "render", "Global");
  expect(preview.links.map(link => link.path)).toEqual([alias]);
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readlink(alias)).rejects.toMatchObject({ code: "ENOENT" });
});
it("deletes a separate Claude copy after review and rejects changes to that copy", async () => {
  const { store, settings, home, path } = await fixture();
  const copy = join(home, ".claude/skills/render");
  await mkdir(copy, { recursive: true }); await writeFile(join(copy, "SKILL.md"), "Different Claude instructions");
  const preview = await previewDeletion(store, settings, "render", "Global");
  expect(preview.copies.map(entry => entry.path)).toEqual([await realpath(copy)]);
  await writeFile(join(copy, "SKILL.md"), "Edited since review");
  await expect(deleteSkill(store, settings, "render", "Global", preview, true)).rejects.toThrow("changed since review");
  const current = await previewDeletion(store, settings, "render", "Global");
  await deleteSkill(store, settings, "render", "Global", current, true);
  await expect(readFile(join(copy, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(readFile(join(path, "SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
});
it("removes a Claude symlink without deleting its unrelated target", async () => {
  const { store, settings, home } = await fixture();
  const external = join(home, "external"); await mkdir(external); await writeFile(join(external, "SKILL.md"), "Keep me");
  const alias = join(home, ".claude/skills/render"); await mkdir(join(home, ".claude/skills"), { recursive: true }); await symlink(external, alias);
  const preview = await previewDeletion(store, settings, "render", "Global");
  await deleteSkill(store, settings, "render", "Global", preview, true);
  await expect(readlink(alias)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(external, "SKILL.md"), "utf8")).toBe("Keep me");
});
it("protects project links into the separate Claude copy", async () => {
  const { store, settings, home } = await fixture();
  const copy = join(home, ".claude/skills/render"), project = join(home, "project");
  await mkdir(copy, { recursive: true }); await writeFile(join(copy, "SKILL.md"), "Claude instructions");
  settings.projects.push({ name: "Demo", path: project });
  await mkdir(join(project, ".agents/skills"), { recursive: true }); await symlink(copy, join(project, ".agents/skills/other"));
  await expect(previewDeletion(store, settings, "render", "Global")).rejects.toThrow("Another entry");
});
it("restores a separate Claude copy along with canonical storage on save failure", async () => {
  const { store, settings, home, path } = await fixture();
  const copy = join(home, ".claude/skills/render"); await mkdir(copy, { recursive: true }); await writeFile(join(copy, "SKILL.md"), "Claude instructions");
  const preview = await previewDeletion(store, settings, "render", "Global");
  vi.spyOn(store, "save").mockRejectedValueOnce(new Error("Disk full"));
  await expect(deleteSkill(store, settings, "render", "Global", preview, true)).rejects.toThrow("Disk full");
  expect(await readFile(join(copy, "SKILL.md"), "utf8")).toBe("Claude instructions");
  expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe("Render instructions");
});

it("protects members when any profile scope is enabled", async () => {
  const { store, settings } = await fixture();
  settings.profiles.push({ id: "video", name: "Video", source: "owner/video", skills: ["render"], enabled: ["Global"], ready: true });
  await expect(previewDeletion(store, settings, "render", "Global")).rejects.toThrow("Disable these profiles");
});
it("restores a deleted repository profile member before activation", async () => {
  const { store, settings, home, path } = await fixture();
  settings.profiles.push({ id: "video", name: "Video", source: "owner/video", skills: ["render"], enabled: [], ready: true });
  await store.save(settings);
  await deleteSkill(store, settings, "render", "Global", await previewDeletion(store, settings, "render", "Global"), true);
  const prepared = join(home, "prepared");await mkdir(join(prepared, "render"), { recursive: true });
  await writeFile(join(prepared, "render/SKILL.md"), "Restored source instructions");
  const fetch = vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(prepared);
  const api = new FieldworkOperations(store);
  try {
    await api.run("activation", { id: "video", scope: "Global", enabled: true });
    expect(fetch).toHaveBeenCalledWith("owner/video");
    expect(await readFile(join(path, "SKILL.md"), "utf8")).toBe("Restored source instructions");
    expect((await store.read()).profiles[0]).toMatchObject({ ready: true, enabled: ["Global"] });
  } finally { await api.close(); }
});
it("explains missing local-only members without activating the profile", async () => {
  const { store, settings } = await fixture();
  settings.profiles.push({ id: "video", name: "Video", source: "Local skill selection", skills: ["render"], enabled: [], ready: true });
  await store.save(settings);
  await deleteSkill(store, settings, "render", "Global", await previewDeletion(store, settings, "render", "Global"), true);
  const api = new FieldworkOperations(store);
  try {
    await expect(api.run("activation", { id: "video", scope: "Global", enabled: true })).rejects.toThrow("no repository source");
    expect((await store.read()).profiles[0]?.enabled).toEqual([]);
  } finally { await api.close(); }
});
