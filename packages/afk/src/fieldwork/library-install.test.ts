import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./command-runner.js";
import { Library } from "./library.js";
import { applyLibraryInit } from "./library-init.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { installSkills, type InstallProgress, type InstallRunner } from "./skill-install.js";
import { updateSkills, type UpdateRunner } from "./skill-update.js";

let home: string;
let store: SettingsStore;
let agents: string;
let claude: string;

const skill = (name: string, version = "1"): string => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody of ${name}, version ${version}.\n`;

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function git(...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd: join(home, ".afk/library"), env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" } });
  return result.output.trim();
}

const commits = async (): Promise<string[]> => (await git("log", "--format=%s")).split("\n").filter(Boolean);
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"));

/** A Skills CLI that writes into whichever home it is given. */
function skillsCli(names: string[], options: { version?: string; code?: number; revision?: string } = {}): InstallRunner & { homes: string[] } {
  const runner: InstallRunner & { homes: string[] } = Object.assign(async (_cwd: string, env: NodeJS.ProcessEnv) => {
    runner.homes.push(String(env.HOME));
    const entries: Record<string, unknown> = {};
    for (const name of names) {
      const live = join(String(env.HOME), ".agents/skills", name);
      await mkdir(live, { recursive: true });
      await writeFile(join(live, "SKILL.md"), skill(name, options.version));
      entries[name] = { source: "owner/repo", skillPath: `skills/${name}/SKILL.md`, skillFolderHash: options.revision ?? "rev-1" };
    }
    await writeFile(join(String(env.HOME), ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: entries }));
    return options.code ?? 0;
  }, { homes: [] as string[] });
  return runner;
}

const install = (runner: InstallRunner, names: string[], destination?: "library" | "machine" | "pack", signal?: AbortSignal) =>
  store.read().then(settings => installSkills(store, settings, [{ source: "owner/repo", skills: names }], "Global", "universal", "Test", () => {}, signal, runner, destination ? { destination } : {}));

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-lib-install-"));
  store = new SettingsStore(home);
  await store.initialize();
  agents = join(home, ".agents/skills");
  claude = join(home, ".claude/skills");
  await mkdir(claude, { recursive: true });
  await store.save(emptySettings());
  await applyLibraryInit(store);
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("installing from a repository into storage", () => {
  it("stores one library copy, records its source, applies the saved choice, links it and commits once", async () => {
    const settings = await store.read();
    settings.preferences["Global|wizard"] = "Manual only";
    await store.save(settings);
    const before = await commits();
    const runner = skillsCli(["wizard"]);

    const result = await install(runner, ["wizard"]);

    expect(result).toMatchObject({ code: 0, pending: false });
    const stored = join(home, ".afk/library/skills/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await readlink(join(claude, "wizard"))).toBe(stored);
    expect(await json(join(home, ".afk/library/.afk/skills/wizard.json"))).toEqual({ source: "owner/repo", skillPath: "skills/wizard/SKILL.md", revision: "rev-1", invocation: "Manual only" });
    expect((await commits()).length).toBe(before.length + 1);
    expect((await commits())[0]).toContain("wizard");
    expect(await git("status", "--porcelain")).toBe("");
    expect(runner.homes[0]).not.toBe(home);
  });

  it("keeps this machine's real agent folders free of anything but the links", async () => {
    await install(skillsCli(["wizard"]), ["wizard"]);

    expect(await readdir(agents)).toEqual(["wizard"]);
    expect(await present(join(home, ".agents/.skill-lock.json"))).toBe(false);
  });

  it("stores a this-machine skill outside the repository, linked, without a commit", async () => {
    const before = await commits();

    const result = await install(skillsCli(["wizard"]), ["wizard"], "machine");

    expect(result.code).toBe(0);
    const stored = join(home, ".afk/machine/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toBe(skill("wizard"));
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await readlink(join(claude, "wizard"))).toBe(stored);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect(await commits()).toEqual(before);
  });

  it("leaves the library and agent folders unchanged when Skills CLI fails", async () => {
    const before = await commits();

    const result = await install(skillsCli(["wizard"], { code: 7 }), ["wizard"]);

    expect(result.code).toBe(7);
    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect(await present(join(agents, "wizard"))).toBe(false);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("stores nothing from earlier sources when a later one fails", async () => {
    const before = await commits();
    let calls = 0;
    const runner: InstallRunner = async (cwd, env, args, output, signal) => (++calls === 1 ? skillsCli(["first"]) : skillsCli([], { code: 1 }))(cwd, env, args, output, signal);

    const result = await store.read().then(settings => installSkills(store, settings, [{ source: "one", skills: ["first"] }, { source: "two" }], "Global", "universal", "Test", () => {}, undefined, runner));

    expect(result.code).toBe(1);
    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/first"))).toBe(false);
    expect(await present(join(agents, "first"))).toBe(false);
  });

  it("leaves everything unchanged when cancelled", async () => {
    const before = await commits(), controller = new AbortController();
    const cli = skillsCli(["wizard"]);
    const runner: InstallRunner = async (...args) => { const code = await cli(...args); controller.abort(); return code; };

    const result = await install(runner, ["wizard"], "library", controller.signal);

    expect(result).toMatchObject({ cancelled: true, code: 130 });
    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect(await present(join(agents, "wizard"))).toBe(false);
  });

  it("rolls back completely when a real folder blocks the link", async () => {
    const before = await commits();
    await mkdir(join(agents, "wizard"), { recursive: true });
    await writeFile(join(agents, "wizard/SKILL.md"), skill("wizard", "outside"));

    const result = await install(skillsCli(["wizard", "other"]), ["wizard", "other"]);

    expect(result.code).toBe(1);
    expect(result.output).toContain("already exists");
    expect(await commits()).toEqual(before);
    expect(await present(join(home, ".afk/library/skills/wizard"))).toBe(false);
    expect(await present(join(home, ".afk/library/skills/other"))).toBe(false);
    expect(await present(join(agents, "other"))).toBe(false);
    expect(await readFile(join(agents, "wizard/SKILL.md"), "utf8")).toContain("outside");
  });

  it("keeps an installed skill on when a later skill in the same install fails to link", async () => {
    await install(skillsCli(["wizard"]), ["wizard"]);
    const before = await commits();
    await mkdir(join(claude, "other"), { recursive: true });
    await writeFile(join(claude, "other/SKILL.md"), skill("other", "outside"));

    const result = await install(skillsCli(["wizard", "other"], { version: "2" }), ["wizard", "other"]);

    expect(result.code).toBe(1);
    expect(await commits()).toEqual(before);
    expect(await new Library(home).linked("wizard")).toBe(true);
    expect(await readlink(join(claude, "wizard"))).toBe(join(home, ".afk/library/skills/wizard"));
    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toContain("version 1");
    expect((await store.read()).independentSkills.Global).toEqual(["wizard"]);
  });

  it("replaces the one stored copy on a reinstall and keeps its links", async () => {
    await install(skillsCli(["wizard"]), ["wizard"]);

    await install(skillsCli(["wizard"], { version: "2", revision: "rev-2" }), ["wizard"]);

    const stored = join(home, ".afk/library/skills/wizard");
    expect(await readFile(join(stored, "SKILL.md"), "utf8")).toContain("version 2");
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await json(join(home, ".afk/library/.afk/skills/wizard.json"))).toMatchObject({ revision: "rev-2" });
    expect((await commits())[0]).toBe("Reinstall wizard");
  });

  it("moves a skill to the destination chosen for a different storage", async () => {
    await install(skillsCli(["wizard"]), ["wizard"], "machine");

    await install(skillsCli(["wizard"]), ["wizard"], "library");

    expect(await present(join(home, ".afk/machine/wizard"))).toBe(false);
    expect(await readlink(join(agents, "wizard"))).toBe(join(home, ".afk/library/skills/wizard"));
  });
});

describe("installing through the Install dialog's operation", () => {
  let operations: FieldworkOperations;
  beforeEach(() => {
    vi.spyOn(SourcePreparation.prototype, "discover").mockResolvedValue(["wizard", "other"]);
    vi.spyOn(SourcePreparation.prototype, "paths").mockResolvedValue({});
    vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(join(home, "nowhere"));
    operations = new FieldworkOperations(store);
  });
  afterEach(async () => { vi.restoreAllMocks(); await operations.close(); });

  it("installs to Core as one commit that holds the skill, its record and the Core list", async () => {
    operations.installRunner = skillsCli(["wizard"]);
    const before = await commits();

    const result = await operations.run("kit/install", { source: "owner/repo", names: ["wizard"], to: "core" }) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect((await commits()).length).toBe(before.length + 1);
    expect(await git("show", "--name-only", "--format=", "HEAD")).toContain("skills/wizard/SKILL.md");
    expect((await store.read()).kit?.core).toContainEqual({ source: "owner/repo", skills: ["wizard"] });
    expect(await json(join(home, ".afk/library/.afk/settings.json"))).toMatchObject({ core: [{ source: "owner/repo", skills: ["wizard"] }] });
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("installs to this machine without touching the library", async () => {
    operations.installRunner = skillsCli(["wizard"]);
    const before = await commits();

    await operations.run("kit/install", { source: "owner/repo", names: ["wizard"], to: "machine" });

    expect((await store.read()).machineOnly).toContain("wizard");
    expect(await readlink(join(agents, "wizard"))).toBe(join(home, ".afk/machine/wizard"));
    expect(await commits()).toEqual(before);
  });

  it("keeps Core unchanged when the install fails", async () => {
    operations.installRunner = skillsCli(["wizard"], { code: 2 });
    const before = await commits();

    const result = await operations.run("kit/install", { source: "owner/repo", names: ["wizard"], to: "core" }) as { ok: boolean };

    expect(result.ok).toBe(false);
    expect((await store.read()).kit?.core).toEqual([]);
    expect(await commits()).toEqual(before);
    expect(await present(join(agents, "wizard"))).toBe(false);
  });
});

describe("turning on a pack whose skills are not cached", () => {
  let operations: FieldworkOperations;
  let staged: string;
  beforeEach(async () => {
    staged = await mkdtemp(join(tmpdir(), "afk-staged-"));
    await mkdir(join(staged, "epsilon"), { recursive: true });
    await writeFile(join(staged, "epsilon/SKILL.md"), skill("epsilon"));
    const settings = await store.read();
    settings.preferences["Global|epsilon"] = "Manual only";
    settings.profiles.push({ id: "profile-new", name: "New", source: "owner/new", skills: ["epsilon"], enabled: [], ready: false });
    await store.save(settings);
    operations = new FieldworkOperations(store);
  });
  afterEach(async () => { vi.restoreAllMocks(); await operations.close(); await rm(staged, { recursive: true, force: true }); });

  it("downloads them into the pack cache with visible progress, applies the saved choice and links them", async () => {
    const seen: (InstallProgress | null)[] = [];
    vi.spyOn(SourcePreparation.prototype, "directory").mockImplementation(async (_source, run) => {
      run?.onOutput?.("Cloning owner/new\n");
      seen.push(await operations.run("skills/install-state") as InstallProgress | null);
      return staged;
    });

    await operations.run("activation", { id: "profile-new", scope: "Global", enabled: true });

    expect(seen[0]).toMatchObject({ pending: true, output: expect.stringContaining("Cloning owner/new"), phase: expect.stringContaining("New") });
    expect(await operations.run("skills/install-state")).toMatchObject({ pending: false, code: 0 });
    expect(await readFile(join(home, ".afk/packs-cache/epsilon/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readlink(join(agents, "epsilon"))).toBe(join(home, ".afk/packs-cache/epsilon"));
    expect(await present(join(home, ".afk/library/skills/epsilon"))).toBe(false);
  });

  it("stops when cancelled and leaves the pack off with nothing cached", async () => {
    vi.spyOn(SourcePreparation.prototype, "directory").mockImplementation(async (_source, run) => {
      await operations.run("skills/install-cancel");
      run?.signal?.throwIfAborted();
      return staged;
    });

    await expect(operations.run("activation", { id: "profile-new", scope: "Global", enabled: true })).rejects.toThrow();

    expect(await present(join(home, ".afk/packs-cache/epsilon"))).toBe(false);
    expect(await present(join(agents, "epsilon"))).toBe(false);
    expect((await store.read()).profiles.find(profile => profile.id === "profile-new")?.enabled).toEqual([]);
    expect(await operations.run("skills/install-state")).toMatchObject({ pending: false, cancelled: true });
  });
});

describe("installing into a pack", () => {
  it("stores one cached copy with the saved choice and commits the pack once", async () => {
    const staged = await mkdtemp(join(tmpdir(), "afk-staged-"));
    await mkdir(join(staged, "epsilon"), { recursive: true });
    await writeFile(join(staged, "epsilon/SKILL.md"), skill("epsilon"));
    vi.spyOn(SourcePreparation.prototype, "discover").mockResolvedValue(["epsilon"]);
    vi.spyOn(SourcePreparation.prototype, "paths").mockResolvedValue({});
    vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(staged);
    const settings = await store.read();
    settings.preferences["Global|epsilon"] = "Automatic allowed";
    await store.save(settings);
    const operations = new FieldworkOperations(store);
    const before = await commits();

    await operations.run("kit/install", { source: "owner/new", names: ["epsilon"], to: "new-pack", packName: "Fresh" });
    await operations.close();
    vi.restoreAllMocks();
    await rm(staged, { recursive: true, force: true });

    expect(await readFile(join(home, ".afk/packs-cache/epsilon/SKILL.md"), "utf8")).toContain("disable-model-invocation: false");
    expect(await present(join(home, ".afk/library/skills/epsilon"))).toBe(false);
    expect(await present(join(agents, "epsilon"))).toBe(false);
    expect((await commits()).length).toBe(before.length + 1);
    expect((await store.read()).profiles.map(profile => profile.name)).toContain("Fresh");
  });
});

describe("updating stored skills", () => {
  const upstream = (version: string, revision: string, code = 0): UpdateRunner => async (_cwd, env, args) => {
    expect(args.slice(-2)).toEqual(["-g", "-y"]);
    const lockPath = join(String(env.HOME), ".agents/.skill-lock.json");
    const entries = JSON.parse(await readFile(lockPath, "utf8")) as { skills: Record<string, { skillFolderHash?: string }> };
    for (const name of Object.keys(entries.skills)) {
      if (args.includes(name) || !args.some(arg => !arg.startsWith("-"))) {
        await writeFile(join(String(env.HOME), ".agents/skills", name, "SKILL.md"), skill(name, version));
        entries.skills[name]!.skillFolderHash = revision;
      }
    }
    await writeFile(lockPath, JSON.stringify(entries));
    return code;
  };
  const run = async (runner: UpdateRunner, names?: string[], signal?: AbortSignal) => updateSkills(store, await store.read(), "Global", () => {}, runner, signal, names);

  beforeEach(async () => {
    await install(skillsCli(["wizard", "other"]), ["wizard", "other"]);
    await install(skillsCli(["local"]), ["local"], "machine");
    const settings = await store.read();
    settings.preferences["Global|wizard"] = "Manual only";
    await store.save(settings);
  });

  it("replaces stored files, keeps the links, reapplies the choice and records the new revision in one commit", async () => {
    const before = await commits();

    const result = await run(upstream("2", "rev-2"));

    expect(result).toMatchObject({ code: 0, updated: 3, pending: false });
    const stored = join(home, ".afk/library/skills/wizard");
    const text = await readFile(join(stored, "SKILL.md"), "utf8");
    expect(text).toContain("version 2");
    expect(text).toContain("disable-model-invocation: true");
    expect(await readlink(join(agents, "wizard"))).toBe(stored);
    expect(await readlink(join(claude, "wizard"))).toBe(stored);
    expect(await json(join(home, ".afk/library/.afk/skills/wizard.json"))).toMatchObject({ revision: "rev-2", invocation: "Manual only" });
    expect(await readFile(join(home, ".afk/machine/local/SKILL.md"), "utf8")).toContain("version 2");
    expect((await commits()).length).toBe(before.length + 1);
    expect((await commits())[0]).toMatch(/^Update /);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("updates only the requested skill", async () => {
    await run(upstream("2", "rev-2"), ["wizard"]);

    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toContain("version 2");
    expect(await readFile(join(home, ".afk/library/skills/other/SKILL.md"), "utf8")).toContain("version 1");
    expect(await json(join(home, ".afk/library/.afk/skills/other.json"))).toMatchObject({ revision: "rev-1" });
  });

  it("keeps a skill that is turned off off", async () => {
    await new Library(home).unlink("other");

    await run(upstream("2", "rev-2"));

    expect(await present(join(agents, "other"))).toBe(false);
    expect(await readFile(join(home, ".afk/library/skills/other/SKILL.md"), "utf8")).toContain("version 2");
  });

  it("leaves files, links and commits alone when the update fails", async () => {
    const before = await commits();

    const result = await run(upstream("2", "rev-2", 1));

    expect(result.code).toBe(1);
    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toContain("version 1");
    expect(await commits()).toEqual(before);
  });

  it("leaves everything alone when cancelled", async () => {
    const before = await commits(), controller = new AbortController();

    const result = await run(async (...args) => { const code = await upstream("2", "rev-2")(...args); controller.abort(); return code; }, undefined, controller.signal);

    expect(result).toMatchObject({ cancelled: true, code: 130 });
    expect(await readFile(join(home, ".afk/library/skills/wizard/SKILL.md"), "utf8")).toContain("version 1");
    expect(await commits()).toEqual(before);
  });

  it("makes no commit when nothing changed upstream", async () => {
    const before = await commits();

    expect(await run(async () => 0)).toMatchObject({ code: 0, updated: 0 });

    expect(await commits()).toEqual(before);
  });

  it("refuses to replace files that changed during the update", async () => {
    await expect(run(async (...args) => {
      await upstream("2", "rev-2")(...args);
      await writeFile(join(home, ".afk/library/skills/other/SKILL.md"), skill("other", "edited"));
      return 0;
    })).rejects.toThrow("changed during");
    expect(await readFile(join(home, ".afk/library/skills/other/SKILL.md"), "utf8")).toContain("edited");
  });
});
