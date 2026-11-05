import { lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLibraryInit, confirmLibraryInit, planLibraryInit } from "./library-init.js";
import { Library } from "./library.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { runCommand } from "./command-runner.js";
import { runFieldwork } from "./cli.js";

let home: string;
let store: SettingsStore;

const skill = (name: string): string => `---\nname: ${name}\ndescription: ${name} skill\n---\nBody of ${name}.\n`;

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function git(...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd: join(home, ".afk/library"), env: { ...process.env, HOME: home, GIT_CONFIG_GLOBAL: join(home, ".gitconfig"), GIT_CONFIG_NOSYSTEM: "1" } });
  return result.output.trim();
}

async function commits(): Promise<string[]> {
  return (await git("log", "--format=%s")).split("\n").filter(Boolean);
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-library-"));
  store = new SettingsStore(home);
  await store.initialize();
  const agents = join(home, ".agents/skills"), claude = join(home, ".claude/skills");
  await mkdir(join(agents, "alpha"), { recursive: true });
  await writeFile(join(agents, "alpha/SKILL.md"), skill("alpha"));
  await mkdir(join(agents, ".disabled/beta"), { recursive: true });
  await writeFile(join(agents, ".disabled/beta/SKILL.md"), skill("beta"));
  await mkdir(join(agents, "loose"), { recursive: true });
  await writeFile(join(agents, "loose/SKILL.md"), skill("loose"));
  await mkdir(claude, { recursive: true });
  await symlink(join(agents, "alpha"), join(claude, "alpha"), "dir");
  await writeFile(join(home, ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: { alpha: { source: "owner/repo", skillPath: "skills/alpha/SKILL.md", skillFolderHash: "abc123" }, beta: { source: "owner/repo", skillPath: "skills/beta/SKILL.md", skillFolderHash: "def456" } } }));
  await mkdir(join(home, ".afk/references"), { recursive: true });
  await writeFile(join(home, ".afk/AGENTS.md"), "# Rules\n");
  await writeFile(join(home, ".afk/references/style.md"), "Style.\n");
  const settings = emptySettings();
  settings.kit = { core: [{ source: "owner/repo", skills: ["alpha", "beta", "gone"] }] };
  settings.preferences = { "Global|alpha": "Manual only" };
  await store.save(settings);
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("afk library init", () => {
  it("reports what would move on a dry run and writes nothing", async () => {
    const plan = await planLibraryInit(store);

    expect(plan.skills.map(entry => ({ name: entry.name, on: entry.on }))).toEqual([{ name: "alpha", on: true }, { name: "beta", on: false }]);
    expect(plan.missing).toEqual(["gone"]);
    expect(plan.rules).toEqual(["AGENTS.md", "references/style.md"]);
    expect(await present(join(home, ".afk/library"))).toBe(false);
    expect((await lstat(join(home, ".agents/skills/alpha"))).isDirectory()).toBe(true);
  });

  it("moves each Core skill into the library once, links the ones that are on and records them in one commit", async () => {
    const result = await applyLibraryInit(store);
    const library = join(home, ".afk/library");

    expect((await readdir(join(library, "skills"))).sort()).toEqual(["alpha", "beta"]);
    expect(await readlink(join(home, ".agents/skills/alpha"))).toBe(join(library, "skills/alpha"));
    expect(await readlink(join(home, ".claude/skills/alpha"))).toBe(join(library, "skills/alpha"));
    expect(await present(join(home, ".agents/skills/beta"))).toBe(false);
    expect(await present(join(home, ".agents/skills/.disabled/beta"))).toBe(false);
    expect(await present(join(home, ".claude/skills/beta"))).toBe(false);
    expect((await lstat(join(home, ".agents/skills/loose"))).isDirectory()).toBe(true);

    expect(JSON.parse(await readFile(join(library, ".afk/skills/alpha.json"), "utf8"))).toEqual({ source: "owner/repo", skillPath: "skills/alpha/SKILL.md", revision: "abc123", invocation: "Manual only" });
    expect(JSON.parse(await readFile(join(library, ".afk/skills/beta.json"), "utf8"))).toEqual({ source: "owner/repo", skillPath: "skills/beta/SKILL.md", revision: "def456", invocation: "" });
    expect(await readFile(join(library, "skills/alpha/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(JSON.parse(await readFile(join(library, ".afk/settings.json"), "utf8"))).toMatchObject({ core: [{ source: "owner/repo", skills: ["alpha", "beta", "gone"] }] });
    expect(await readFile(join(library, "rules/AGENTS.md"), "utf8")).toBe("# Rules\n");
    expect(await readFile(join(library, "rules/references/style.md"), "utf8")).toBe("Style.\n");

    expect(await commits()).toHaveLength(1);
    expect(await git("status", "--porcelain")).toBe("");
    expect(await readFile(join(result.backup, ".agents/skills/alpha/SKILL.md"), "utf8")).toBe(skill("alpha"));
    expect(await present(join(result.backup, ".agents/skills/.disabled/beta/SKILL.md"))).toBe(true);
  });

  it("keeps the Installed Skills view of availability and invocation", async () => {
    await applyLibraryInit(store);
    const inventory = await new SkillLibrary(store).inventory(await store.read(), "Global");
    const pick = (name: string) => inventory.find(entry => entry.name === name);

    expect(pick("alpha")).toMatchObject({ available: true, source: "owner/repo", invocation: { claude: "Manual only", codex: "Manual only" } });
    expect(pick("beta")).toMatchObject({ available: false, stored: true, source: "owner/repo" });
    expect(pick("loose")).toMatchObject({ available: true });
  });

  it("removes the dated backup only once the user confirms", async () => {
    const { backup } = await applyLibraryInit(store);
    expect(await present(backup)).toBe(true);

    await confirmLibraryInit(store);
    expect(await present(backup)).toBe(false);
  });

  it("leaves the machine untouched when the first commit fails", async () => {
    const failing = async (spec: Parameters<typeof runCommand>[0]) => spec.args.includes("commit") ? { code: 1, output: "fatal: cannot commit", cancelled: false } : runCommand(spec);
    await expect(applyLibraryInit(store, failing)).rejects.toThrow(/cannot commit/);

    expect(await present(join(home, ".afk/library"))).toBe(false);
    expect((await lstat(join(home, ".agents/skills/alpha"))).isDirectory()).toBe(true);
    expect(await present(join(home, ".agents/skills/.disabled/beta/SKILL.md"))).toBe(true);
  });

  it("runs as a dry run from the CLI unless --apply is given", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await runFieldwork(["library", "init"], store)).toBe(0);
    expect(log.mock.calls.join("\n")).toContain("alpha");
    expect(await present(join(home, ".afk/library"))).toBe(false);

    expect(await runFieldwork(["library", "init", "--apply"], store)).toBe(0);
    expect(await present(join(home, ".afk/library/skills/alpha/SKILL.md"))).toBe(true);
    log.mockRestore();
  });

  it("refuses to start a second library", async () => {
    await applyLibraryInit(store);
    await expect(planLibraryInit(store)).rejects.toThrow(/already/);
  });
});

describe("Core skills in the library", () => {
  beforeEach(async () => { await applyLibraryInit(store); });

  it("turns a skill off by removing its links, moving no files, and back on by restoring them", async () => {
    const operations = new FieldworkOperations(store);
    const library = join(home, ".afk/library/skills/alpha");

    await operations.run("skill/toggle", { name: "alpha", scope: "Global" });
    expect(await present(join(home, ".agents/skills/alpha"))).toBe(false);
    expect(await present(join(home, ".claude/skills/alpha"))).toBe(false);
    expect(await readFile(join(library, "SKILL.md"), "utf8")).toContain("alpha");
    expect((await new SkillLibrary(store).inventory(await store.read(), "Global")).find(entry => entry.name === "alpha")).toMatchObject({ available: false });

    await operations.run("skill/toggle", { name: "alpha", scope: "Global" });
    expect(await readlink(join(home, ".agents/skills/alpha"))).toBe(library);
    expect(await readlink(join(home, ".claude/skills/alpha"))).toBe(library);
    expect(await commits()).toHaveLength(1);
    await operations.close();
  });

  it("saves an invocation change in the files and the record as one commit", async () => {
    const operations = new FieldworkOperations(store);
    await operations.run("invocation", { name: "beta", scope: "Global", mode: "Manual only" });
    const library = join(home, ".afk/library");

    expect(await readFile(join(library, "skills/beta/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(JSON.parse(await readFile(join(library, ".afk/skills/beta.json"), "utf8"))).toMatchObject({ invocation: "Manual only" });
    expect(await commits()).toEqual(["Set beta to Manual only", expect.stringMatching(/^Start library/)]);
    expect(await git("status", "--porcelain")).toBe("");
    await operations.close();
  });

  it("leaves the working tree as it was when a change fails", async () => {
    const library = new Library(home);
    await expect(library.change("Broken change", async () => {
      await writeFile(join(library.skillPath("alpha"), "SKILL.md"), "half written");
      await writeFile(join(library.root, "stray.txt"), "stray");
      throw new Error("boom");
    })).rejects.toThrow("boom");

    expect(await readFile(join(library.skillPath("alpha"), "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await present(join(library.root, "stray.txt"))).toBe(false);
    expect(await commits()).toHaveLength(1);
  });
});
