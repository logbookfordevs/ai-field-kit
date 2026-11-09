import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agentFolderCatalog, validateCustomFolder } from "./agent-folders.js";
import { applyLibraryInit } from "./library-init.js";
import { Library } from "./library.js";
import { runCommand } from "./command-runner.js";
import { FieldworkOperations } from "./operations.js";
import { startFieldwork } from "./server.js";
import { fixtureWeb } from "./web.test-helper.js";
import { emptySettings, SettingsStore } from "./settings.js";

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

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-folders-"));
  store = new SettingsStore(home);
  await store.initialize();
  const agents = join(home, ".agents/skills");
  for (const name of ["alpha", "beta"]) {
    await mkdir(join(agents, name), { recursive: true });
    await writeFile(join(agents, name, "SKILL.md"), skill(name));
  }
  await mkdir(join(agents, ".disabled/gamma"), { recursive: true });
  await writeFile(join(agents, ".disabled/gamma/SKILL.md"), skill("gamma"));
  const settings = emptySettings();
  settings.kit = { core: [{ source: "owner/repo", skills: ["alpha", "beta", "gamma"] }] };
  await store.save(settings);
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("agent folder catalog", () => {
  it("lists agents found on this machine first, each with a switch, after the always-on shared folder", async () => {
    await mkdir(join(home, ".cursor"), { recursive: true });
    await mkdir(join(home, ".codex"), { recursive: true });

    const catalog = await agentFolderCatalog(home, undefined);

    expect(catalog[0]).toMatchObject({ path: "~/.agents/skills", shared: true, enabled: true });
    expect(catalog[0]!.names).toEqual(expect.arrayContaining(["Codex", "Cline", "Warp", "Zed"]));
    const detected = catalog.filter(folder => folder.detected && !folder.shared);
    expect(detected.map(folder => folder.path)).toEqual(["~/.cursor/skills"]);
    expect(catalog.slice(1, 1 + detected.length)).toEqual(detected);
    expect(catalog.find(folder => folder.path === "~/.gemini/skills")).toMatchObject({ detected: false, enabled: false, names: ["Gemini CLI"] });
  });

  it("turns Claude Code on by default and reports where the table knows how an agent is invoked", async () => {
    const catalog = await agentFolderCatalog(home, undefined);

    expect(catalog.find(folder => folder.path === "~/.claude/skills")).toMatchObject({ names: ["Claude Code"], enabled: true, mechanisms: { claude: ["Claude Code"] }, icon: "claude_code.svg" });
    expect(catalog.find(folder => folder.path === "~/.cursor/skills")).toMatchObject({ enabled: false });
    expect(catalog.find(folder => folder.shared)!.icon).toBeUndefined();
    expect(catalog.find(folder => folder.path === "~/.cursor/skills")!.mechanisms).toEqual({});
    expect(catalog.find(folder => folder.path === "~/.agents/skills")!.mechanisms).toEqual({ claude: ["Pi"], codex: ["Codex"] });
  });

  it("lists saved custom folders with a lettered placeholder and no icon", async () => {
    const catalog = await agentFolderCatalog(home, { enabled: ["~/.claude/skills", "~/tools/skills"], custom: [{ name: "Tools", global: "~/tools/skills", project: ".tools/skills" }] });
    const custom = catalog.find(folder => folder.path === "~/tools/skills");

    expect(custom).toMatchObject({ names: ["Tools"], custom: true, enabled: true, project: ".tools/skills" });
    expect(custom!.icon).toBeUndefined();
  });
});

describe("custom folder validation", () => {
  const library = () => join(home, ".afk/library");

  it("accepts an absolute or ~ path and saves it ~-relative", () => {
    expect(validateCustomFolder(home, { name: "Tools", global: join(home, "tools/skills"), project: ".tools/skills" })).toEqual({ name: "Tools", global: "~/tools/skills", project: ".tools/skills" });
    expect(validateCustomFolder(home, { name: " Tools ", global: "~/tools/skills" })).toEqual({ name: "Tools", global: "~/tools/skills" });
    expect(validateCustomFolder(home, { name: "Elsewhere", global: "/opt/agent/skills" })).toEqual({ name: "Elsewhere", global: "/opt/agent/skills" });
  });

  it.each([
    ["a blank name", { name: " ", global: "~/x" }, /name/i],
    ["a relative path", { name: "X", global: "tools/skills" }, /absolute/i],
    ["the home folder itself", { name: "X", global: "~" }, /folder/i],
    ["a path with ..", { name: "X", global: "~/a/../b" }, /\.\./],
    ["an absolute project path", { name: "X", global: "~/x", project: "/etc/skills" }, /project/i],
    ["a project path with ..", { name: "X", global: "~/x", project: "../skills" }, /project/i],
  ])("rejects %s", (_label, input, message) => {
    expect(() => validateCustomFolder(home, input)).toThrow(message);
  });

  it("rejects a folder inside the library, and the library itself", () => {
    expect(() => validateCustomFolder(home, { name: "X", global: "~/.afk/library/skills" })).toThrow(/library/i);
    expect(() => validateCustomFolder(home, { name: "X", global: join(library()) })).toThrow(/library/i);
  });

  it("rejects the shared folder and a folder the table already names", () => {
    expect(() => validateCustomFolder(home, { name: "X", global: "~/.agents/skills" })).toThrow(/always on|already/i);
    expect(() => validateCustomFolder(home, { name: "X", global: "~/.cursor/skills" })).toThrow(/Cursor/);
  });
});

describe("agent folders in the library", () => {
  let operations: FieldworkOperations;
  const link = (folder: string, name: string) => join(home, folder, name);
  const target = (name: string) => join(home, ".afk/library/skills", name);

  beforeEach(async () => {
    await applyLibraryInit(store);
    operations = new FieldworkOperations(store);
  });
  afterEach(async () => { await operations.close(); });

  it("reproduces today's links: the shared folder and Claude Code", async () => {
    expect(await readlink(link(".agents/skills", "alpha"))).toBe(target("alpha"));
    expect(await readlink(link(".claude/skills", "alpha"))).toBe(target("alpha"));
    const state = await operations.run("agent-folders/state") as { folders: { path: string; enabled: boolean }[] };
    expect(state.folders.filter(folder => folder.enabled).map(folder => folder.path).sort()).toEqual(["~/.agents/skills", "~/.claude/skills"]);
  });

  it("links every skill that is on when a folder is enabled and saves it in the library", async () => {
    await operations.run("agent-folders/enable", { path: "~/.cursor/skills" });

    expect(await readlink(link(".cursor/skills", "alpha"))).toBe(target("alpha"));
    expect(await readlink(link(".cursor/skills", "beta"))).toBe(target("beta"));
    expect(await present(link(".cursor/skills", "gamma"))).toBe(false);
    expect(JSON.parse(await readFile(join(home, ".afk/library/.afk/settings.json"), "utf8")).agentFolders).toEqual({ enabled: ["~/.claude/skills", "~/.cursor/skills"], custom: [] });
    expect(await git("log", "--format=%s", "-1")).toMatch(/Cursor/);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("links a skill into every enabled folder when it is turned on, and removes them all when off", async () => {
    await operations.run("agent-folders/enable", { path: "~/.cursor/skills" });
    await operations.run("skill/toggle", { name: "gamma", scope: "Global" });
    for (const folder of [".agents/skills", ".claude/skills", ".cursor/skills"]) expect(await readlink(link(folder, "gamma"))).toBe(target("gamma"));

    await operations.run("skill/toggle", { name: "gamma", scope: "Global" });
    for (const folder of [".agents/skills", ".claude/skills", ".cursor/skills"]) expect(await present(link(folder, "gamma"))).toBe(false);
  });

  it("removes only AFK's links when a folder is disabled and leaves other files", async () => {
    await operations.run("agent-folders/enable", { path: "~/.cursor/skills" });
    await mkdir(link(".cursor/skills", "mine"), { recursive: true });
    await writeFile(join(link(".cursor/skills", "mine"), "SKILL.md"), skill("mine"));
    await operations.run("agent-folders/disable", { path: "~/.cursor/skills" });

    expect(await present(link(".cursor/skills", "alpha"))).toBe(false);
    expect(await present(link(".cursor/skills", "beta"))).toBe(false);
    expect(await readFile(join(link(".cursor/skills", "mine"), "SKILL.md"), "utf8")).toBe(skill("mine"));
    expect(await readlink(link(".agents/skills", "alpha"))).toBe(target("alpha"));
    const saved = JSON.parse(await readFile(join(home, ".afk/library/.afk/settings.json"), "utf8")).agentFolders;
    expect(saved.enabled).toEqual(["~/.claude/skills"]);
  });

  it("stops Claude Code links when its folder is disabled, and restores them when enabled again", async () => {
    await operations.run("agent-folders/disable", { path: "~/.claude/skills" });
    expect(await present(link(".claude/skills", "alpha"))).toBe(false);
    expect(await readlink(link(".agents/skills", "alpha"))).toBe(target("alpha"));

    await operations.run("agent-folders/enable", { path: "~/.claude/skills" });
    expect(await readlink(link(".claude/skills", "alpha"))).toBe(target("alpha"));
  });

  it("changes nothing when a destination holds someone else's skill", async () => {
    await mkdir(link(".cursor/skills", "beta"), { recursive: true });
    await writeFile(join(link(".cursor/skills", "beta"), "SKILL.md"), "mine");

    await expect(operations.run("agent-folders/enable", { path: "~/.cursor/skills" })).rejects.toThrow(/already exists/);

    expect(await present(link(".cursor/skills", "alpha"))).toBe(false);
    expect(await readFile(join(link(".cursor/skills", "beta"), "SKILL.md"), "utf8")).toBe("mine");
    expect(JSON.parse(await readFile(join(home, ".afk/library/.afk/settings.json"), "utf8")).agentFolders?.enabled ?? ["~/.claude/skills"]).toEqual(["~/.claude/skills"]);
    expect(await git("status", "--porcelain")).toBe("");
  });

  it("adds a custom folder, links every skill that is on, and saves it in the library", async () => {
    await operations.run("agent-folders/add", { name: "Tools", global: join(home, "tools/skills"), project: ".tools/skills" });

    expect(await readlink(link("tools/skills", "alpha"))).toBe(target("alpha"));
    const saved = JSON.parse(await readFile(join(home, ".afk/library/.afk/settings.json"), "utf8")).agentFolders;
    expect(saved.custom).toEqual([{ name: "Tools", global: "~/tools/skills", project: ".tools/skills" }]);
    expect(saved.enabled).toContain("~/tools/skills");
    const state = await operations.run("agent-folders/state") as { folders: { path: string; custom: boolean; enabled: boolean }[] };
    expect(state.folders.find(folder => folder.path === "~/tools/skills")).toMatchObject({ custom: true, enabled: true });
  });

  it("removes a custom folder and only AFK's links in it", async () => {
    await operations.run("agent-folders/add", { name: "Tools", global: "~/tools/skills" });
    await operations.run("agent-folders/remove", { path: "~/tools/skills" });

    expect(await present(link("tools/skills", "alpha"))).toBe(false);
    const saved = JSON.parse(await readFile(join(home, ".afk/library/.afk/settings.json"), "utf8")).agentFolders;
    expect(saved).toEqual({ enabled: ["~/.claude/skills"], custom: [] });
    await expect(operations.run("agent-folders/remove", { path: "~/.cursor/skills" })).rejects.toThrow(/custom/i);
  });

  it("refuses to disable the shared folder", async () => {
    await expect(operations.run("agent-folders/disable", { path: "~/.agents/skills" })).rejects.toThrow(/always on/i);
  });

  it("enables an unknown folder only if it is in the table or saved as custom", async () => {
    await expect(operations.run("agent-folders/enable", { path: "~/.nowhere/skills" })).rejects.toThrow(/unknown/i);
  });

  it("is reachable through the library when a skill is linked directly", async () => {
    await operations.run("agent-folders/enable", { path: "~/.gemini/skills" });
    const library = new Library(home);
    await library.unlink("alpha");
    expect(await present(link(".gemini/skills", "alpha"))).toBe(false);
    await library.link("alpha");
    expect(await readlink(link(".gemini/skills", "alpha"))).toBe(target("alpha"));
  });
});

describe("agent folders without a library and over HTTP", () => {
  it("lists the table with Claude Code on by default and refuses changes until a library exists", async () => {
    const operations = new FieldworkOperations(store);
    const state = await operations.run("agent-folders/state") as { library: boolean; folders: { path: string; enabled: boolean }[] };

    expect(state.library).toBe(false);
    expect(state.folders.filter(folder => folder.enabled).map(folder => folder.path).sort()).toEqual(["~/.agents/skills", "~/.claude/skills"]);
    await expect(operations.run("agent-folders/enable", { path: "~/.cursor/skills" })).rejects.toThrow(/library/i);
    await operations.close();
  });

  it("serves the state and the agent icons to the app", async () => {
    const app = await startFieldwork(store, 0, { web: await fixtureWeb(home) });
    try {
      const token = /window.afkToken="([^"]+)"/.exec(await (await fetch(app.url)).text())![1]!;
      const state = await (await fetch(`${app.url}/api/agent-folders/state`, { headers: { "x-afk-token": token } })).json() as { folders: { icon?: string }[] };
      const icon = state.folders.find(folder => folder.icon)!.icon!;
      const response = await fetch(`${app.url}/assets/agent-icons/${icon}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/image\//);
    } finally { await app.close(); }
  });
});

describe("agent folders and tool skills", () => {
  it("links a tool's skills into a folder when it is enabled, and removes only those links when disabled", async () => {
    const wiz = join(home, ".agents/skills/wiz");
    await mkdir(wiz, { recursive: true });
    await writeFile(join(wiz, "SKILL.md"), skill("wiz"));
    await store.save({ ...await store.read(), tools: [{ id: 1, name: "Wizard", install: "unused", update: "", provides: ["wiz"] }] });
    await applyLibraryInit(store);
    const operations = new FieldworkOperations(store);
    try {
      await operations.run("agent-folders/enable", { path: "~/.cursor/skills" });
      expect(await readlink(join(home, ".cursor/skills/wiz"))).toBe(wiz);
      expect(await readlink(join(home, ".cursor/skills/alpha"))).toBe(join(home, ".afk/library/skills/alpha"));

      await operations.run("agent-folders/disable", { path: "~/.cursor/skills" });
      expect(await present(join(home, ".cursor/skills/wiz"))).toBe(false);
      expect(await readFile(join(wiz, "SKILL.md"), "utf8")).toBe(skill("wiz"));
    } finally { await operations.close(); }
  });
});
