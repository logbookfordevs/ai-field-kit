import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Library } from "./library.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore, type Settings } from "./settings.js";
import type { SkillEntry } from "./skills.js";

let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;

const agents = (...path: string[]): string => join(home, ".agents/skills", ...path);
const claude = (...path: string[]): string => join(home, ".claude/skills", ...path);
const off = (...path: string[]): string => join(home, ".afk/off", ...path);
const skillFile = (name: string, extra = ""): string => `---\nname: ${name}\ndescription: ${name} skill\n${extra}---\nBody.\n`;

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function configure(patch: Partial<Settings> = {}): Promise<void> {
  await store.save({ ...emptySettings(), tools: [{ id: 1, name: "Wizard", install: "unused", update: "", provides: ["wiz"] }], ...patch });
}

function toolWrites(command: string): Partial<Settings> {
  return { tools: [{ id: 1, name: "Wizard", install: command, update: "", provides: ["wiz"] }] };
}

const writesWiz = "mkdir -p .agents/skills/wiz && printf -- '---\\nname: wiz\\ndescription: wiz skill\\n---\\nFresh.\\n' > .agents/skills/wiz/SKILL.md";

async function installedByTool(): Promise<void> {
  await mkdir(agents("wiz"), { recursive: true });
  await writeFile(agents("wiz/SKILL.md"), skillFile("wiz"));
  await mkdir(claude(), { recursive: true });
  await symlink(agents("wiz"), claude("wiz"), "dir");
}

async function entry(name: string): Promise<SkillEntry | undefined> {
  const { inventories } = await operations.run("state") as { inventories: Record<string, SkillEntry[]> };
  return inventories.Global?.find(item => item.name === name);
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-tool-skills-"));
  store = new SettingsStore(home);
  await store.initialize();
  operations = new FieldworkOperations(store);
});

afterEach(async () => {
  await operations.close();
  await rm(home, { recursive: true, force: true });
});

describe("turning a tool skill off and on", () => {
  beforeEach(async () => { await configure(); await installedByTool(); });

  it("moves the tool's folder to ~/.afk/off and clears every agent folder", async () => {
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    expect(await readFile(off("wiz/SKILL.md"), "utf8")).toBe(skillFile("wiz"));
    expect(await present(agents("wiz"))).toBe(false);
    expect(await present(claude("wiz"))).toBe(false);
    expect(await present(agents(".disabled"))).toBe(false);
  });

  it("puts the folder and its links back when turned on", async () => {
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    expect((await lstat(agents("wiz"))).isDirectory()).toBe(true);
    expect(await readFile(agents("wiz/SKILL.md"), "utf8")).toBe(skillFile("wiz"));
    expect(await readlink(claude("wiz"))).toBe(agents("wiz"));
    expect(await present(off("wiz"))).toBe(false);
  });

  it("reports the skill as off and read-only while it waits in the off folder", async () => {
    await operations.run("skill/availability", { name: "wiz", scope: "Global", enabled: false });

    expect(await entry("wiz")).toMatchObject({ available: false, stored: true, readOnly: true, tool: "Wizard" });
  });

  it("reports the skill as read-only while it is on", async () => {
    expect(await entry("wiz")).toMatchObject({ available: true, readOnly: true, tool: "Wizard" });
  });

  it("replaces a stale off copy when the tool has written a fresh one", async () => {
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    await mkdir(agents("wiz"), { recursive: true });
    await writeFile(agents("wiz/SKILL.md"), skillFile("wiz", "owner: fresh\n"));

    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    expect(await readFile(off("wiz/SKILL.md"), "utf8")).toContain("owner: fresh");
    expect(await present(agents("wiz"))).toBe(false);
  });

  it("keeps the off copy when its place is taken by something else", async () => {
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    await mkdir(agents("wiz"), { recursive: true });
    await writeFile(agents("wiz/notes.txt"), "mine");

    await expect(operations.run("skill/toggle", { name: "wiz", scope: "Global" })).rejects.toThrow(/already exists/);
    expect(await present(off("wiz/SKILL.md"))).toBe(true);
    expect(await readFile(agents("wiz/notes.txt"), "utf8")).toBe("mine");
  });

  it("never copies a tool skill into the library", async () => {
    const library = new Library(home);
    await library.create("Start library", async () => { await library.writeSettings({ version: 1, core: [], agentRules: { destinations: [] } }); });

    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    expect(await library.has("wiz")).toBe(false);
    expect(await present(library.skillPath("wiz"))).toBe(false);
  });
});

describe("after a tool run", () => {
  it("applies the saved invocation choice to the skills the tool provides", async () => {
    await configure(toolWrites(writesWiz));
    await store.save({ ...await store.read(), preferences: { "Global|wiz": "Manual only" } });

    const result = await operations.run("tool/run", { id: 1 }) as { code: number; reapplied: string[] };

    expect(result).toMatchObject({ code: 0, reapplied: ["wiz"] });
    const skill = await readFile(agents("wiz/SKILL.md"), "utf8");
    expect(skill).toContain("disable-model-invocation: true");
    expect(skill).toContain("Fresh.");
    expect((await entry("wiz"))?.invocation).toEqual({ claude: "Manual only", codex: "Manual only" });
  });

  it("leaves the skills alone when no choice is saved", async () => {
    await configure(toolWrites(writesWiz));

    const result = await operations.run("tool/run", { id: 1 }) as { reapplied: string[] };

    expect(result.reapplied).toEqual([]);
    expect(await readFile(agents("wiz/SKILL.md"), "utf8")).not.toContain("disable-model-invocation");
  });

  it("applies the choices after a sync approves the tool", async () => {
    await configure({ ...toolWrites(writesWiz), kit: { core: [] }, preferences: { "Global|wiz": "Manual only" } });
    const { plan } = await operations.run("kit/state") as { plan: unknown };

    await operations.run("kit/sync", { expected: plan, runTools: [1] });

    expect(await readFile(agents("wiz/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
  });

  it("warns, naming the skill, when the run recreated a skill that is off", async () => {
    await configure(toolWrites(writesWiz));
    await mkdir(agents("wiz"), { recursive: true });
    await writeFile(agents("wiz/SKILL.md"), skillFile("wiz"));
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    const result = await operations.run("tool/run", { id: 1 }) as { output: string; warnings: string[] };

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("wiz");
    expect(result.output).toContain(result.warnings[0]);
    const { toolRuns } = await operations.run("state") as { toolRuns: Record<number, { warnings?: string[] }> };
    expect(toolRuns[1]?.warnings).toEqual(result.warnings);
    expect(await present(off("wiz/SKILL.md"))).toBe(true);
  });

  it("does not warn when a skill that is off stays off", async () => {
    await configure(toolWrites("true"));
    await mkdir(agents("wiz"), { recursive: true });
    await writeFile(agents("wiz/SKILL.md"), skillFile("wiz"));
    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });

    const result = await operations.run("tool/run", { id: 1 }) as { warnings: string[] };

    expect(result.warnings).toEqual([]);
  });
});
