import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addToCore } from "./kit.js";
import { Library } from "./library.js";
import { Backup } from "./library-backup.js";
import { applyLibraryInit, startLibrary } from "./library-init.js";
import { emptySettings, SettingsStore } from "./settings.js";

let home: string;
let store: SettingsStore;

const skill = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody of ${name}.\n`;
const agents = (...path: string[]): string => join(home, ".agents/skills", ...path);

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function write(path: string, name: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), skill(name));
}

async function localState(): Promise<{ machineOnly: string[] }> {
  const settings = await store.read();
  return JSON.parse(await readFile(store.localPath(settings.configurationId!), "utf8")) as { machineOnly: string[] };
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-onboarding-"));
  store = new SettingsStore(home);
  await store.initialize();
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("machine-only marks never overlap the library", () => {
  beforeEach(async () => {
    await write(agents("alpha"), "alpha");
    await write(agents("mine"), "mine");
    const settings = emptySettings();
    settings.kit = { core: [{ source: "owner/repo", skills: ["alpha"] }] };
    settings.machineOnly = ["alpha", "mine"];
    await store.save(settings);
  });

  it("drops the mark of a Core skill when the migration moves it into the library", async () => {
    await applyLibraryInit(store);

    expect((await store.read()).machineOnly).toEqual(["mine"]);
  });

  it("cleans marks an earlier version left on library skills, and keeps the cleaned list", async () => {
    await applyLibraryInit(store);
    const settings = await store.read();
    settings.machineOnly = ["alpha", "mine", "ghost"];
    await store.save(settings);

    expect((await store.read()).machineOnly).toEqual(["mine", "ghost"]);
    expect((await localState()).machineOnly).toEqual(["mine", "ghost"]);
  });

  it("cleans marks on skills stored in the library even when they are not in Core", async () => {
    await applyLibraryInit(store);
    await new Library(home).change("Add stray", async () => { await write(new Library(home).skillPath("stray"), "stray"); });
    const settings = await store.read();
    settings.machineOnly = ["stray", "mine"];
    await store.save(settings);

    expect((await store.read()).machineOnly).toEqual(["mine"]);
  });

  it("adding a skill to Core drops its machine-only mark", () => {
    const settings = emptySettings();
    settings.machineOnly = ["fresh", "mine"];

    addToCore(settings, "fresh", "owner/repo");

    expect(settings.machineOnly).toEqual(["mine"]);
  });
});

describe("a library always exists", () => {
  it("starts an empty library silently on a machine with nothing to migrate", async () => {
    await startLibrary(store);

    const library = new Library(home);
    expect(await library.exists()).toBe(true);
    expect(await library.names()).toEqual([]);
  });

  it("leaves a machine with an existing setup to the reviewed migration", async () => {
    await write(agents("alpha"), "alpha");
    const settings = emptySettings();
    settings.kit = { core: [{ source: "owner/repo", skills: ["alpha"] }] };
    await store.save(settings);

    await startLibrary(store);

    expect(await new Library(home).exists()).toBe(false);
    expect(await present(agents("alpha"))).toBe(true);
  });

  it("treats saved packs, tools or bookmarks as a setup to migrate", async () => {
    const settings = emptySettings();
    settings.favoriteSources = [{ name: "later", source: "owner/later" }];
    await store.save(settings);

    await startLibrary(store);

    expect(await new Library(home).exists()).toBe(false);
  });

  it("does nothing when a library already exists", async () => {
    await startLibrary(store);
    const library = new Library(home);
    await library.change("Add stray", async () => { await write(library.skillPath("stray"), "stray"); });

    await startLibrary(store);

    expect(await library.names()).toEqual(["stray"]);
  });
});

describe("telling a library nobody has used from one in use", () => {
  it("reports an empty library with no backup as fresh, until a skill is added", async () => {
    await startLibrary(store);
    const backup = new Backup(new Library(home));

    expect((await backup.status()).fresh).toBe(true);

    await new Library(home).change("Add stray", async () => { await write(new Library(home).skillPath("stray"), "stray"); });

    expect((await backup.status()).fresh).toBeUndefined();
  });

  it("stays fresh after the welcome is dismissed, which is saved in the library", async () => {
    await startLibrary(store);
    const settings = await store.read();
    settings.welcomeDismissed = true;
    await store.save(settings);

    expect((await new Backup(new Library(home)).status()).fresh).toBe(true);
  });
});

describe("legacy .disabled folders after the migration", () => {
  beforeEach(async () => {
    await write(agents("alpha"), "alpha");
    await write(agents(".disabled/parked"), "parked");
    await mkdir(join(home, ".claude/skills/.disabled"), { recursive: true });
    const settings = emptySettings();
    settings.kit = { core: [{ source: "owner/repo", skills: ["alpha", "parked"] }] };
    await store.save(settings);
  });

  it("removes the empty ones, in every agent folder", async () => {
    await applyLibraryInit(store);

    expect(await present(agents(".disabled"))).toBe(false);
    expect(await present(join(home, ".claude/skills/.disabled"))).toBe(false);
  });

  it("keeps one that still holds something", async () => {
    await mkdir(join(home, ".claude/skills/.disabled/foreign"), { recursive: true });
    await writeFile(join(home, ".claude/skills/.disabled/foreign/notes.txt"), "mine");

    await applyLibraryInit(store);

    expect(await present(join(home, ".claude/skills/.disabled/foreign/notes.txt"))).toBe(true);
    expect(await present(agents(".disabled"))).toBe(false);
  });
});
