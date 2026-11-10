import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { doctor } from "./doctor.js";
import { applyLibraryInit, planLibraryInit } from "./library-init.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { runCommand } from "./command-runner.js";
import { SourcePreparation } from "./preparation.js";
import { installSkills, type InstallRunner } from "./skill-install.js";

let home: string;
let store: SettingsStore;
let agents: string;
let claude: string;

const skill = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody of ${name}.\n`;

const pack = { id: "profile-review", name: "Review", source: "owner/review", skills: ["gamma"], enabled: ["Global"], ready: true };
const offPack = { id: "profile-docs", name: "Docs", source: "owner/docs", skills: ["delta"], enabled: [], ready: true };

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function write(path: string, name: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), skill(name));
}

async function git(...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd: join(home, ".afk/library"), env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" } });
  return result.output.trim();
}

async function commits(): Promise<string[]> {
  return (await git("log", "--format=%s")).split("\n").filter(Boolean);
}

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-storage-"));
  store = new SettingsStore(home);
  await store.initialize();
  agents = join(home, ".agents/skills");
  claude = join(home, ".claude/skills");
  await write(join(agents, "alpha"), "alpha");
  await write(join(agents, ".disabled/gamma"), "gamma");
  await write(join(agents, ".disabled/delta"), "delta");
  await write(join(agents, ".disabled/old"), "old");
  await write(join(agents, ".disabled/tooled"), "tooled");
  await write(join(agents, "mine"), "mine");
  await write(join(agents, "loose"), "loose");
  await mkdir(claude, { recursive: true });
  await symlink(join(agents, ".disabled/gamma"), join(agents, "gamma"), "dir");
  await symlink(join(agents, ".disabled/gamma"), join(claude, "gamma"), "dir");
  await writeFile(join(home, ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: { alpha: { source: "owner/repo" }, loose: { source: "owner/loose" } } }));
  await mkdir(join(home, ".afk"), { recursive: true });
  await writeFile(join(home, ".afk/AGENTS.md"), "# Rules\n");
  const settings = emptySettings();
  settings.kit = { core: [{ source: "owner/repo", skills: ["alpha"] }] };
  settings.profiles = [structuredClone(pack), structuredClone(offPack)];
  settings.tools = [{ id: 1, name: "Tool", install: "echo install", update: "echo update", provides: ["tooled"] }];
  settings.favoriteSources = [{ name: "later", source: "owner/later" }];
  settings.machineOnly = ["mine"];
  settings.managedLinks = { [join(agents, "gamma")]: join(agents, ".disabled/gamma"), [join(claude, "gamma")]: join(agents, ".disabled/gamma") };
  settings.preferences = { "Global|gamma": "Manual only" };
  await store.save(settings);
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("library init for packs, machine-only skills and .disabled", () => {
  it("moves pack skills into the pack cache and the rest of .disabled into machine storage", async () => {
    const plan = await planLibraryInit(store);
    expect(plan.packSkills.map(entry => entry.name)).toEqual(["delta", "gamma"]);
    expect(plan.machineSkills.map(entry => entry.name)).toEqual(["mine", "old"]);

    await applyLibraryInit(store);

    expect(await present(join(agents, ".disabled"))).toBe(false);
    expect(await readFile(join(home, ".afk/packs-cache/gamma/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readFile(join(home, ".afk/packs-cache/delta/SKILL.md"), "utf8")).toBe(skill("delta"));
    expect(await readFile(join(home, ".afk/machine/old/SKILL.md"), "utf8")).toBe(skill("old"));
    expect(await readFile(join(home, ".afk/off/tooled/SKILL.md"), "utf8")).toBe(skill("tooled"));
    expect(await readlink(join(agents, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readlink(join(claude, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await present(join(agents, "delta"))).toBe(false);
    expect(await readlink(join(agents, "mine"))).toBe(join(home, ".afk/machine/mine"));
    expect(await present(join(agents, "old"))).toBe(false);
    expect((await lstat(join(agents, "loose"))).isDirectory()).toBe(true);

    const settings = await store.read();
    expect(settings.profiles.find(profile => profile.id === pack.id)?.enabled).toEqual(["Global"]);
    expect(settings.machineOnly.sort()).toEqual(["mine", "old"]);
  });

  it("moves each pack and machine skill once when the Claude folder links to the shared folder", async () => {
    await rm(claude, { recursive: true });
    await symlink("../.agents/skills", claude, "dir");
    const settings = await store.read();
    settings.managedLinks = { [join(agents, "gamma")]: join(agents, ".disabled/gamma") };
    await store.save(settings);

    await applyLibraryInit(store);

    expect(await readlink(join(agents, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readlink(join(agents, "mine"))).toBe(join(home, ".afk/machine/mine"));
    expect(await readFile(join(home, ".afk/packs-cache/gamma/SKILL.md"), "utf8")).toContain("Body of gamma.");
  });
});

describe("packs after library init", () => {
  beforeEach(async () => { await applyLibraryInit(store); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("turns a pack off by removing only its links and on again from the cache", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("activation", { id: pack.id, scope: "Global", enabled: false });

    expect(await present(join(agents, "gamma"))).toBe(false);
    expect(await present(join(claude, "gamma"))).toBe(false);
    expect(await present(join(home, ".afk/packs-cache/gamma/SKILL.md"))).toBe(true);
    expect(await readlink(join(agents, "mine"))).toBe(join(home, ".afk/machine/mine"));
    expect(await readlink(join(agents, "alpha"))).toBe(join(home, ".afk/library/skills/alpha"));

    await operations.run("activation", { id: pack.id, scope: "Global", enabled: true });
    expect(await readlink(join(agents, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readlink(join(claude, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    await operations.close();
  });

  it("links a pack into every enabled agent folder and removes those links when it turns off", async () => {
    const operations = new FieldworkOperations(store);
    const cursor = join(home, ".cursor/skills");
    await operations.run("agent-folders/disable", { path: "~/.claude/skills" });
    await operations.run("agent-folders/enable", { path: "~/.cursor/skills" });
    expect(await readlink(join(cursor, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readlink(join(cursor, "mine"))).toBe(join(home, ".afk/machine/mine"));

    await operations.run("activation", { id: pack.id, scope: "Global", enabled: false });
    expect(await present(join(cursor, "gamma"))).toBe(false);
    expect(await present(join(claude, "gamma"))).toBe(false);

    await operations.run("activation", { id: pack.id, scope: "Global", enabled: true });
    expect(await readlink(join(cursor, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readlink(join(agents, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await present(join(claude, "gamma"))).toBe(false);
    await operations.close();
  });

  it("checks a pack's exposure in the enabled agent folders, not a fixed Claude Code folder", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("agent-folders/disable", { path: "~/.claude/skills" });
    await operations.close();

    const exposure = (await doctor(store)).issues.filter(issue => issue.code.startsWith("skill_exposure"));
    expect(exposure).toEqual([]);
  });

  it("prepares a missing pack skill into the cache, never .disabled", async () => {
    const staged = await mkdtemp(join(tmpdir(), "afk-staged-"));
    await write(join(staged, "epsilon"), "epsilon");
    vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(staged);
    const operations = new FieldworkOperations(store);
    await operations.run("pack/save", { id: "profile-new", name: "New", source: "owner/new", skills: ["epsilon"] });
    await operations.run("activation", { id: "profile-new", scope: "Global", enabled: true });

    expect(await readlink(join(agents, "epsilon"))).toBe(join(home, ".afk/packs-cache/epsilon"));
    expect(await present(join(agents, ".disabled/epsilon"))).toBe(false);
    await operations.close();
    await rm(staged, { recursive: true, force: true });
  });
});

describe("portable settings in the library", () => {
  let before: string;
  beforeEach(async () => {
    before = await readFile(join(home, ".afk/settings.json"), "utf8");
    await applyLibraryInit(store);
  });

  it("writes one file per pack, tool and bookmark, keeping pack definitions byte-identical", async () => {
    const library = join(home, ".afk/library/.afk");
    const { enabled: _enabled, ready: _ready, ...definition } = pack;
    expect(await readFile(join(library, `packs/${pack.id}.json`), "utf8")).toBe(`${JSON.stringify(definition, null, 2)}\n`);
    expect(await json(join(library, "tools/1.json"))).toEqual({ id: 1, name: "Tool", install: "echo install", update: "echo update", provides: ["tooled"] });
    expect(await json(join(library, "bookmarks/owner-later.json"))).toEqual({ name: "later", source: "owner/later" });
    expect(await json(join(library, "skills/gamma.json"))).toEqual({ source: "owner/review", invocation: "Manual only" });
    expect(await commits()).toHaveLength(1);
    expect(await readFile(join(home, ".afk/settings.json"), "utf8")).toBe(before);
  });

  it("commits each pack, tool, bookmark, Core list and invocation change once and stops writing settings.json", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("pack/save", { id: "profile-new", name: "New", source: "owner/new", skills: ["gamma"] });
    const settings = await store.read();
    settings.tools.push({ id: 2, name: "Other", install: "echo other", update: "" });
    await operations.run("settings", { settings });
    const next = await store.read();
    next.favoriteSources = [];
    await operations.run("settings", { settings: next });
    await operations.run("kit/drop", { name: "alpha" });
    await operations.run("invocation", { name: "gamma", scope: "Global", mode: "Automatic allowed" });
    await operations.close();

    const library = join(home, ".afk/library/.afk");
    expect(await present(join(library, "packs/profile-new.json"))).toBe(true);
    expect(await json(join(library, "tools/2.json"))).toMatchObject({ name: "Other" });
    expect(await present(join(library, "bookmarks/owner-later.json"))).toBe(false);
    expect(await json(join(library, "settings.json"))).toMatchObject({ core: [] });
    expect(await json(join(library, "skills/gamma.json"))).toMatchObject({ invocation: "Automatic allowed" });
    expect(await commits()).toEqual([
      "Set gamma to Automatic allowed",
      "Move alpha to this machine",
      "Update Core list",
      "Remove bookmark later",
      "Add tool Other",
      "Add pack New",
      expect.stringMatching(/^Start library/),
    ]);
    expect(await git("status", "--porcelain")).toBe("");
    expect(await readFile(join(home, ".afk/settings.json"), "utf8")).toBe(before);
    expect((await store.read()).preferences["Global|gamma"]).toBe("Automatic allowed");
  });
});

describe("Agent rules in the library", () => {
  beforeEach(async () => { await applyLibraryInit(store); });

  it("reads and saves rules in the library's rules folder as one commit", async () => {
    const operations = new FieldworkOperations(store);
    await writeFile(join(home, ".afk/AGENTS.md"), "# Stale copy\n");
    const state = await operations.run("rules/state") as { files: { path: string; content: string }[] };
    expect(state.files.find(file => file.path === "AGENTS.md")?.content).toBe("# Rules\n");

    await operations.run("rules/save", { files: [{ path: "AGENTS.md", content: "# New rules\n" }, { path: "references/extra.md", content: "Extra.\n" }] });
    await operations.close();

    expect(await readFile(join(home, ".afk/library/rules/AGENTS.md"), "utf8")).toBe("# New rules\n");
    expect(await readFile(join(home, ".afk/library/rules/references/extra.md"), "utf8")).toBe("Extra.\n");
    expect(await readFile(join(home, ".afk/AGENTS.md"), "utf8")).toBe("# Stale copy\n");
    expect(await commits()).toEqual(["Save Agent rules", expect.stringMatching(/^Start library/)]);
  });
});

describe("moving a stored skill to another place", () => {
  beforeEach(async () => { await applyLibraryInit(store); });

  it("moves a This machine only skill's files into the library when it joins Core, so it is backed up", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("skill/adopt", { name: "loose", to: "machine" });

    await operations.run("kit/add", { names: ["loose"], to: "core" });
    await operations.close();

    const stored = join(home, ".afk/library/skills/loose");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("loose"));
    expect(await present(join(stored, ".afk-source.json"))).toBe(false);
    expect(await present(join(home, ".afk/machine/loose"))).toBe(false);
    expect(await readlink(join(agents, "loose"))).toBe(stored);
    expect(await json(join(home, ".afk/library/.afk/skills/loose.json"))).toMatchObject({ source: "owner/loose" });
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("moves a pack skill's files into the library when it joins Core, and keeps it in the pack", async () => {
    expect(await present(join(home, ".afk/packs-cache/gamma/SKILL.md"))).toBe(true);
    const operations = new FieldworkOperations(store);

    await operations.run("kit/add", { names: ["gamma"], to: "core", source: "owner/review" });
    await operations.close();

    const text = await readFile(join(home, ".afk/library/skills/gamma/SKILL.md"), "utf8");
    expect(text).toContain("Body of gamma.");
    expect(text).toContain("disable-model-invocation: true");
    expect(await present(join(home, ".afk/packs-cache/gamma"))).toBe(false);
    expect((await store.read()).profiles.find(item => item.id === pack.id)?.skills).toContain("gamma");
  });

  it("moves a skill dropped from Core out of the library, so it waits in To review and is no longer backed up", async () => {
    const operations = new FieldworkOperations(store);

    await operations.run("kit/drop", { name: "alpha", from: "core" });
    const state = await operations.run("state") as { kit: { undecided: { name: string }[] }; inventories: { Global: { name: string; storage?: string }[] } };
    await operations.close();

    expect(await present(join(home, ".afk/library/skills/alpha"))).toBe(false);
    expect(await present(join(home, ".afk/machine/alpha/SKILL.md"))).toBe(true);
    expect(await readlink(join(agents, "alpha"))).toBe(join(home, ".afk/machine/alpha"));
    expect(state.inventories.Global.find(entry => entry.name === "alpha")?.storage).toBe("machine");
    expect(state.kit.undecided.map(item => item.name)).toContain("alpha");
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("tidies up a skill dropped from Core before its files followed, when it is dropped again", async () => {
    const settings = await store.read();
    settings.kit = { core: [] };
    await store.save(settings);
    expect(await present(join(home, ".afk/library/skills/alpha"))).toBe(true);
    const operations = new FieldworkOperations(store);

    await operations.run("kit/drop", { name: "alpha", from: "core" });
    await operations.close();

    expect(await present(join(home, ".afk/library/skills/alpha"))).toBe(false);
    expect(await present(join(home, ".afk/machine/alpha/SKILL.md"))).toBe(true);
  });

  it("moves a This machine only skill from a repository into the pack cache when it joins a pack", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("skill/adopt", { name: "loose", to: "machine" });

    await operations.run("kit/add", { names: ["loose"], to: pack.id });
    await operations.close();

    expect(await present(join(home, ".afk/packs-cache/loose/SKILL.md"))).toBe(true);
    expect(await present(join(home, ".afk/machine/loose"))).toBe(false);
    expect(await present(join(home, ".afk/library/skills/loose"))).toBe(false);
  });
});

describe("skills installed outside AFK", () => {
  beforeEach(async () => {
    await write(join(claude, "loose"), "loose");
    await applyLibraryInit(store);
  });

  it("adds an outside skill to the library as a stored copy plus links in one commit", async () => {
    const operations = new FieldworkOperations(store);
    expect((await operations.run("kit/state") as { undecided: { name: string }[] }).undecided.map(entry => entry.name)).toEqual(["loose"]);

    await operations.run("skill/adopt", { name: "loose", to: "library" });
    await operations.close();

    const stored = join(home, ".afk/library/skills/loose");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("loose"));
    expect(await readlink(join(agents, "loose"))).toBe(stored);
    expect(await readlink(join(claude, "loose"))).toBe(stored);
    expect(await json(join(home, ".afk/library/.afk/skills/loose.json"))).toEqual({ source: "owner/loose", invocation: "" });
    expect((await store.read()).kit?.core).toContainEqual({ source: "owner/loose", skills: ["loose"] });
    expect(await commits()).toEqual(["Add loose to the library", expect.stringMatching(/^Start library/)]);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("adopts an outside skill when an agent folder is a link to the shared folder", async () => {
    await rm(claude, { recursive: true, force: true });
    await symlink(agents, claude, "dir");
    await write(join(agents, "twin"), "twin");
    const operations = new FieldworkOperations(store);

    await operations.run("skill/adopt", { name: "twin", to: "library" });
    await operations.close();

    const stored = join(home, ".afk/library/skills/twin");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("twin"));
    expect(await readlink(join(agents, "twin"))).toBe(stored);
    expect(await readlink(claude)).toBe(agents);
  });

  it("adds an outside skill with no repository to Core as an uploaded skill", async () => {
    await write(join(agents, "handmade"), "handmade");
    const operations = new FieldworkOperations(store);

    await operations.run("skill/adopt", { name: "handmade", to: "library" });
    const kit = await operations.run("kit/state") as { core: { name: string; source: string }[]; undecided: { name: string }[] };
    await operations.close();

    expect(kit.undecided.map(entry => entry.name)).not.toContain("handmade");
    expect(kit.core).toContainEqual(expect.objectContaining({ name: "handmade", source: "Uploaded skill" }));
    expect(await readlink(join(agents, "handmade"))).toBe(join(home, ".afk/library/skills/handmade"));
  });

  it("records an outside skill installed from a local folder the way Core lists it: as uploaded, with no source", async () => {
    await write(join(agents, "local-made"), "local-made");
    const lock = join(home, ".agents/.skill-lock.json");
    const locked = await json(lock) as { skills: Record<string, unknown> };
    locked.skills["local-made"] = { source: "/Users/ana/skills/local-made", skillFolderHash: "abc" };
    await writeFile(lock, JSON.stringify(locked));
    const operations = new FieldworkOperations(store);

    await operations.run("skill/adopt", { name: "local-made", to: "library" });
    await operations.close();

    expect(await json(join(home, ".afk/library/.afk/skills/local-made.json"))).toEqual({ invocation: "" });
    expect((await store.read()).kit?.core).toContainEqual({ source: "Uploaded skill", skills: ["local-made"] });
  });

  it("tells the Skills page where each Global skill is stored", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("skill/adopt", { name: "loose", to: "library" });
    const state = await operations.run("state") as { inventories: { Global: { name: string; storage?: string }[] } };
    await operations.close();

    const storage = Object.fromEntries(state.inventories.Global.map(entry => [entry.name, entry.storage ?? "none"]));
    expect(storage).toMatchObject({ alpha: "library", loose: "library", gamma: "pack", mine: "machine", old: "machine", tooled: "none" });
  });

  it("keeps an outside skill on this machine and can bookmark its source", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("skill/adopt", { name: "loose", to: "machine", bookmark: true });
    await operations.close();

    const stored = join(home, ".afk/machine/loose");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("loose"));
    expect(await readlink(join(agents, "loose"))).toBe(stored);
    expect(await readlink(join(claude, "loose"))).toBe(stored);
    const settings = await store.read();
    expect(settings.machineOnly).toContain("loose");
    expect(settings.favoriteSources).toContainEqual(expect.objectContaining({ source: "owner/loose" }));
    expect(await present(join(home, ".afk/library/skills/loose"))).toBe(false);
  });
});

describe("reinstalling a stored skill", () => {
  beforeEach(async () => {
    const settings = await store.read();
    settings.preferences["Global|alpha"] = "Manual only";
    await store.save(settings);
    await applyLibraryInit(store);
  });

  const reinstall = (names: string[]): InstallRunner => async (_cwd, env, _args) => {
    for (const name of names) {
      const live = join(String(env.HOME), ".agents/skills", name);
      await rm(live, { recursive: true, force: true });
      await mkdir(live, { recursive: true });
      await writeFile(join(live, "SKILL.md"), `${skill(name)}Version 2.\n`);
    }
    await writeFile(join(String(env.HOME), ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: { alpha: { source: "owner/repo", skillPath: "skills/alpha/SKILL.md", skillFolderHash: "v2" } } }));
    return 0;
  };

  it("replaces the stored copy and keeps the links instead of creating a second copy", async () => {
    const result = await installSkills(store, await store.read(), [{ source: "owner/repo", skills: ["alpha", "gamma"] }], "Global", "universal", "Reinstall", () => {}, undefined, reinstall(["alpha", "gamma"]));
    expect(result.code).toBe(0);

    const library = join(home, ".afk/library/skills/alpha");
    expect(await readlink(join(agents, "alpha"))).toBe(library);
    expect(await readFile(join(library, "SKILL.md"), "utf8")).toContain("Version 2.");
    expect(await readFile(join(library, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await json(join(home, ".afk/library/.afk/skills/alpha.json"))).toMatchObject({ revision: "v2" });
    expect(await readlink(join(agents, "gamma"))).toBe(join(home, ".afk/packs-cache/gamma"));
    expect(await readFile(join(home, ".afk/packs-cache/gamma/SKILL.md"), "utf8")).toContain("Version 2.");
    expect(await readdir(agents).then(names => names.filter(name => name.startsWith(".afk")))).toEqual([]);
    expect(await commits()).toEqual(["Reinstall alpha", expect.stringMatching(/^Start library/)]);
    expect(await git("status", "--porcelain")).toBe("");
  });
});
