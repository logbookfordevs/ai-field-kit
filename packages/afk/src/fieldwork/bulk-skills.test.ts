import { afterEach, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptySettings, SettingsStore } from "./settings.js";
import { FieldworkOperations } from "./operations.js";
import { SkillLibrary } from "./skills.js";

const homes: string[] = [], operations: FieldworkOperations[] = [];
afterEach(async () => { await Promise.all(operations.splice(0).map(operation => operation.close())); await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true }))); });
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "afk-bulk-")); homes.push(home);
  const store = new SettingsStore(home), settings = emptySettings();
  for (const name of ["alpha", "beta"]) {
    const folder = join(home, ".agents/skills/.disabled", name);
    await mkdir(folder, { recursive: true }); await writeFile(join(folder, "SKILL.md"), `---\nname: ${name}\ndescription: Test\n---\nInstructions`);
  }
  await store.save(settings);
  const api = new FieldworkOperations(store); operations.push(api);
  return { home, store, settings, api, library: new SkillLibrary(store) };
}
it("enables, changes invocation and disables selected skills", async () => {
  const { store, api, library } = await fixture();
  const payload = { names: ["alpha", "beta"], scope: "Global" };
  expect(await api.run("skills/bulk", { ...payload, action: "enable" })).toMatchObject({ completed: 2, failed: 0 });
  expect(await api.run("skills/bulk", { ...payload, action: "invocation", mode: "Manual only" })).toMatchObject({ completed: 2, failed: 0 });
  const entries = await library.inventory(await store.read(), "Global");
  expect(entries.every(entry => entry.available && entry.invocation.claude === "Manual only" && entry.invocation.codex === "Manual only")).toBe(true);
  expect(await api.run("skills/bulk", { ...payload, action: "disable" })).toMatchObject({ completed: 2, failed: 0 });
  expect((await library.inventory(await store.read(), "Global")).every(entry => !entry.available)).toBe(true);
});
it("reports partial results while preserving a profile-owned skill", async () => {
  const { store, settings, api, library } = await fixture();
  settings.profiles.push({ id: "owned", name: "Owned", source: "Local skill selection", skills: ["alpha"], enabled: [], ready: true });
  await library.activate(settings, "owned", "Global", true);
  await api.run("skills/bulk", { names: ["beta"], scope: "Global", action: "enable" });
  const result = await api.run("skills/bulk", { names: ["alpha", "beta"], scope: "Global", action: "disable" });
  expect(result).toMatchObject({ completed: 1, failed: 1, items: [{ name: "alpha", ok: false }, { name: "beta", ok: true }] });
  const inventory = await library.inventory(await store.read(), "Global");
  expect(inventory.find(entry => entry.name === "alpha")?.available).toBe(true);
  expect(inventory.find(entry => entry.name === "beta")?.available).toBe(false);
});
it("requires a fresh batch review and explicit deletion confirmation before any files change", async () => {
  const { home, api } = await fixture();
  const payload = { names: ["alpha", "beta"], scope: "Global" };
  const expected = await api.run("skills/delete-preview", payload);
  await expect(api.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: false })).rejects.toThrow("Review and confirm");
  await writeFile(join(home, ".agents/skills/.disabled/beta/SKILL.md"), "Changed");
  await expect(api.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: true })).rejects.toThrow("Review and confirm");
  expect(await readFile(join(home, ".agents/skills/.disabled/alpha/SKILL.md"), "utf8")).toContain("Instructions");
});
it("deletes eligible reviewed skills and reports blocked profile members", async () => {
  const { home, store, settings, api } = await fixture();
  settings.profiles.push({ id: "owned", name: "Owned", source: "Local skill selection", skills: ["alpha"], enabled: ["Global"], ready: true }); await store.save(settings);
  const payload = { names: ["alpha", "beta"], scope: "Global" };
  const expected = await api.run("skills/delete-preview", payload);
  const result = await api.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: true });
  expect(result).toMatchObject({ completed: 1, failed: 1, items: [{ name: "alpha", ok: false }, { name: "beta", ok: true }] });
  await expect(readFile(join(home, ".agents/skills/.disabled/beta/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(join(home, ".agents/skills/.disabled/alpha/SKILL.md"), "utf8")).toContain("Instructions");
});
it("deletes a batch through shared Claude storage without removing the folder link", async () => {
  const { home, api } = await fixture();
  await mkdir(join(home, ".claude")); await symlink(join(home, ".agents/skills"), join(home, ".claude/skills"));
  const payload = { names: ["alpha", "beta"], scope: "Global" };
  const expected = await api.run("skills/delete-preview", payload);
  expect(await api.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: true })).toMatchObject({ completed: 2, failed: 0 });
  await expect(readFile(join(home, ".claude/skills/.disabled/alpha/SKILL.md"))).rejects.toMatchObject({ code: "ENOENT" });
});
it("rejects duplicate selections and unsupported invocation modes before mutating", async () => {
  const { store, api, library } = await fixture();
  await expect(api.run("skills/bulk", { names: ["alpha", "alpha"], scope: "Global", action: "enable" })).rejects.toThrow("unique");
  await expect(api.run("skills/bulk", { names: ["alpha"], scope: "Global", action: "invocation", mode: "surprise" })).rejects.toThrow("supported invocation");
  expect((await library.inventory(await store.read(), "Global")).every(entry => !entry.available)).toBe(true);
});
