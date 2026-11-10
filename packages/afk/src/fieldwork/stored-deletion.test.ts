import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "./command-runner.js";
import { Library, machineRoot } from "./library.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";

let home: string;
let library: Library;
let store: SettingsStore;
let operations: FieldworkOperations;

const quiet = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t" };

async function git(...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd: library.root, env: { ...process.env, ...quiet, HOME: home } });
  if (result.code !== 0) throw new Error(result.output);
  return result.output.trim();
}

const commits = async (): Promise<string[]> => (await git("log", "--format=%s")).split("\n").filter(Boolean);
const skillText = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody.\n`;

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function storeInLibrary(name: string): Promise<void> {
  await library.change(`Add ${name}`, async () => {
    await mkdir(library.skillPath(name), { recursive: true });
    await writeFile(join(library.skillPath(name), "SKILL.md"), skillText(name));
    await library.writeRecord(name, { source: "owner/repo", invocation: "Manual only" });
  });
  await library.link(name);
}

async function storeOnMachine(name: string): Promise<void> {
  await mkdir(join(machineRoot(home), name), { recursive: true });
  await writeFile(join(machineRoot(home), name, "SKILL.md"), skillText(name));
  await library.link(name);
}

async function deleteSelected(names: string[]): Promise<{ completed: number; failed: number; items: { name: string; ok: boolean; error?: string }[] }> {
  const payload = { names, scope: "Global" };
  const expected = await operations.run("skills/delete-preview", payload);
  return await operations.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: true }) as never;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-stored-delete-"));
  library = new Library(home);
  await library.create("Start the library", async () => undefined);
  store = new SettingsStore(home);
  await store.initialize();
  const settings = emptySettings();
  settings.kit = { core: [{ source: "owner/repo", skills: ["kami", "lumi"] }] };
  settings.machineOnly = ["mine"];
  settings.preferences = { "Global|kami": "Manual only" };
  settings.independentSkills = { Global: ["kami", "lumi", "mine"] };
  await store.save(settings);
  operations = new FieldworkOperations(store);
});

afterEach(async () => {
  await operations.close();
  await rm(home, { recursive: true, force: true });
});

describe("deleting stored Global skills", () => {
  it("removes a library skill, its record, its links and its Core entry in one commit", async () => {
    await storeInLibrary("kami");
    await storeInLibrary("lumi");
    const before = await commits();

    const result = await deleteSelected(["kami"]);

    expect(result).toMatchObject({ completed: 1, failed: 0 });
    expect(await present(library.skillPath("kami"))).toBe(false);
    expect(await present(join(library.root, ".afk/skills/kami.json"))).toBe(false);
    expect(await present(join(home, ".agents/skills/kami"))).toBe(false);
    expect(await present(join(home, ".claude/skills/kami"))).toBe(false);
    expect(await present(library.skillPath("lumi"))).toBe(true);
    expect(await present(join(home, ".agents/skills/lumi"))).toBe(true);
    const settings = await store.read();
    expect(settings.kit?.core.flatMap(entry => entry.skills)).toEqual(["lumi"]);
    expect(settings.preferences["Global|kami"]).toBeUndefined();
    expect((await commits()).length).toBe(before.length + 1);
    expect((await commits())[0]).toBe("Delete kami");
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("deletes several selected skills together, library and this-machine ones", async () => {
    await storeInLibrary("kami");
    await storeInLibrary("lumi");
    await storeOnMachine("mine");

    const result = await deleteSelected(["kami", "lumi", "mine"]);

    expect(result).toMatchObject({ completed: 3, failed: 0 });
    expect(await present(join(machineRoot(home), "mine"))).toBe(false);
    expect(await present(join(home, ".agents/skills/mine"))).toBe(false);
    expect((await store.read()).machineOnly).toEqual([]);
    expect(await library.names()).toEqual([]);
  });

  it("keeps a skill that a turned-on pack uses, and reports it as blocked", async () => {
    await storeInLibrary("kami");
    const settings = await store.read();
    settings.profiles.push({ id: "p", name: "Pack", source: "owner/repo", skills: ["kami"], enabled: ["Global"], ready: true });
    await store.save(settings);

    const result = await deleteSelected(["kami"]);

    expect(result).toMatchObject({ completed: 0, failed: 1 });
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toContain("Body.");
  });

  it("refuses to delete after the skill changed since the review", async () => {
    await storeInLibrary("kami");
    const payload = { names: ["kami"], scope: "Global" };
    const expected = await operations.run("skills/delete-preview", payload);
    await library.change("Edit kami", () => writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami") + "More.\n"));

    await expect(operations.run("skills/bulk", { ...payload, action: "delete", expected, confirmed: true })).rejects.toThrow(/Review and confirm/);
    expect(await present(library.skillPath("kami"))).toBe(true);
  });
});
