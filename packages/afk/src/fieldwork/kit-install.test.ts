import { lstat, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAdd } from "./kit-cli.js";
import type { KitStatus } from "./kit.js";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore, type Settings } from "./settings.js";

let home: string;
let store: SettingsStore;
let operations: FieldworkOperations;
let installed: string[][];

async function skill(name: string, source?: string, root = join(home, ".agents/skills")): Promise<void> {
  await mkdir(join(root, name), { recursive: true });
  await writeFile(join(root, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} skill\n---\n${name} instructions\n`);
  if (!source) return;
  const path = join(home, ".agents/.skill-lock.json");
  const lock = await readFile(path, "utf8").then(text => JSON.parse(text) as { skills: Record<string, unknown> }, () => ({ skills: {} as Record<string, unknown> }));
  lock.skills[name] = { source };
  await writeFile(path, JSON.stringify(lock));
}

async function configure(patch: Partial<Settings>): Promise<void> {
  await store.save({ ...emptySettings(), ...patch });
}

function useRepository(names: string[]): void {
  const directory = join(home, "stage");
  vi.spyOn(SourcePreparation.prototype, "discover").mockResolvedValue(names);
  vi.spyOn(SourcePreparation.prototype, "paths").mockResolvedValue({});
  vi.spyOn(SourcePreparation.prototype, "directory").mockResolvedValue(directory);
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-kit-install-"));
  store = new SettingsStore(home);
  operations = new FieldworkOperations(store);
  installed = [];
  operations.installRunner = async (_cwd, _env, args) => {
    installed.push(args);
    for (let index = 0; index < args.length; index++) if (args[index] === "--skill") await skill(args[index + 1]!, args[0]);
    return 0;
  };
  await configure({});
  for (const name of ["one", "two", "three"]) await skill(name, undefined, join(home, "stage"));
  useRepository(["one", "two", "three"]);
});

afterEach(() => vi.restoreAllMocks());

describe("catching up one missing Core skill", () => {
  it("installs only the chosen skill and leaves the other one missing", async () => {
    await configure({ kit: { core: [{ source: "me/core", skills: ["one", "two"] }] } });

    await operations.run("kit/install", { source: "me/core", names: ["one"], to: "core" });

    expect(installed).toEqual([["me/core", "--skill", "one", "-g", "--agent", "universal", "--yes"]]);
    const { core } = await operations.run("kit/state") as KitStatus;
    expect(core.map(item => [item.name, item.status])).toEqual([["one", "on"], ["two", "missing"]]);
  });
});

describe("previewing a repository", () => {
  it("says how each skill relates to this machine and your kit", async () => {
    await skill("one", "https://github.com/me/repo.git");
    await skill("two", "someone/else");
    await configure({ tools: [{ id: 1, name: "Waypoint", install: "x", update: "", provides: ["three"] }] });

    const preview = await operations.run("kit/install-preview", { source: "me/repo" }) as { candidates: unknown[] };

    expect(preview.candidates).toEqual([
      expect.objectContaining({ name: "one", state: "installed", description: "one skill" }),
      expect.objectContaining({ name: "two", state: "conflict", installedFrom: "someone/else" }),
      expect.objectContaining({ name: "three", state: "tool", tool: "Waypoint" }),
    ]);
  });

  it("lets you read a skill before anything is installed", async () => {
    const { content } = await operations.run("kit/install-read", { source: "me/repo", name: "one" }) as { content: string };

    expect(content).toContain("one instructions");
    await expect(lstat(join(home, ".agents/skills/one"))).rejects.toThrow();
  });

  it("refuses to read outside the repository's skills", async () => {
    await expect(operations.run("kit/install-read", { source: "me/repo", name: "../../secret" })).rejects.toThrow(/valid skill/i);
    await expect(operations.run("kit/install-read", { source: "me/repo", name: "absent" })).rejects.toThrow(/not in this repository/i);
  });
});

describe("installing with a destination", () => {
  it("Core installs now and joins the kit, so it is never undecided", async () => {
    const result = await operations.run("kit/install", { source: "me/repo", names: ["one", "two"], to: "core" }) as { ok: boolean; status: KitStatus };

    expect(result.ok).toBe(true);
    expect(installed).toEqual([["me/repo", "--skill", "one", "--skill", "two", "-g", "--agent", "universal", "--yes"]]);
    expect((await store.read()).kit!.core).toEqual([{ source: "me/repo", skills: ["one", "two"] }]);
    expect(result.status.undecided).toEqual([]);
  });

  it("does not add to Core when the installation fails", async () => {
    operations.installRunner = async () => 4;

    const result = await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "core" }) as { ok: boolean; install: { code: number } };

    expect(result.ok).toBe(false);
    expect(result.install.code).toBe(4);
    expect((await store.read()).kit!.core).toEqual([]);
  });

  it("Core adopts a copy already installed from that repository without reinstalling it", async () => {
    await skill("one", "https://github.com/me/repo");

    await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "core" });

    expect(installed).toEqual([]);
    expect((await store.read()).kit!.core[0]!.skills).toEqual(["one"]);
  });

  it("refuses to replace a skill from another repository unless told to", async () => {
    await skill("one", "someone/else");

    await expect(operations.run("kit/install", { source: "me/repo", names: ["one"], to: "core" })).rejects.toThrow(/someone\/else/);
    expect(installed).toEqual([]);

    await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "core", replace: ["one"] });
    expect(installed).toHaveLength(1);
  });

  it("refuses a skill a tool owns and names the tool", async () => {
    await configure({ tools: [{ id: 1, name: "Waypoint", install: "x", update: "", provides: ["one"] }] });

    await expect(operations.run("kit/install", { source: "me/repo", names: ["one"], to: "machine" })).rejects.toThrow(/Waypoint/);
  });

  it("This machine installs and stops asking, without touching the portable file", async () => {
    const result = await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "machine" }) as { status: KitStatus };

    expect(result.status.machineOnly).toEqual(["one"]);
    expect(result.status.undecided).toEqual([]);
    expect(await readFile(store.path, "utf8")).not.toContain("one");
  });

  it("a project install stays out of the kit", async () => {
    const project = join(home, "work");
    await mkdir(project);
    await configure({ projects: [{ name: "Work", path: project }] });

    await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "machine", scope: "Work" });

    expect(installed[0]).not.toContain("-g");
    const saved = await store.read();
    expect(saved.machineOnly).toEqual([]);
    expect(saved.kit!.core).toEqual([]);
  });

  it("only allows a project scope for This machine", async () => {
    await expect(operations.run("kit/install", { source: "me/repo", names: ["one"], to: "core", scope: "Work" })).rejects.toThrow(/Global/);
  });

  it("a pack downloads the skills and stays off", async () => {
    await configure({ profiles: [{ id: "art", name: "Art", source: "me/repo", skills: ["two"], enabled: [], ready: false }] });

    await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "art" });

    const pack = (await store.read()).profiles[0]!;
    expect(pack.skills).toEqual(["two", "one"]);
    expect(pack.enabled).toEqual([]);
    expect(await readFile(join(home, ".agents/skills/.disabled/one/SKILL.md"), "utf8")).toContain("one instructions");
    await expect(lstat(join(home, ".agents/skills/one"))).rejects.toThrow();
    expect(installed).toEqual([]);
  });

  it("can start a new pack", async () => {
    await operations.run("kit/install", { source: "me/repo", names: ["one"], to: "new-pack", packName: "Fresh" });

    expect((await store.read()).profiles[0]).toMatchObject({ name: "Fresh", source: "me/repo", skills: ["one"], enabled: [], ready: true });
  });

  it("Try later saves a bookmark and installs nothing", async () => {
    await operations.run("kit/install", { source: "https://github.com/me/repo", names: ["one"], to: "later" });

    expect((await store.read()).favoriteSources).toEqual([{ name: "repo", source: "https://github.com/me/repo", skills: ["one"] }]);
    expect(installed).toEqual([]);
  });

  it("Try later with nothing picked bookmarks the whole repository, and merges into an existing bookmark", async () => {
    await operations.run("kit/install", { source: "me/repo", names: [], to: "later" });
    expect((await store.read()).favoriteSources).toEqual([{ name: "repo", source: "me/repo" }]);

    await configure({ favoriteSources: [{ name: "Mine", source: "me/repo", skills: ["one"] }] });
    await operations.run("kit/install", { source: "https://github.com/me/repo.git", names: ["two"], to: "later" });
    expect((await store.read()).favoriteSources).toEqual([{ name: "Mine", source: "me/repo", skills: ["one", "two"] }]);
  });

  it("needs a known destination and at least one skill to install", async () => {
    await expect(operations.run("kit/install", { source: "me/repo", names: ["one"], to: "nowhere" })).rejects.toThrow(/destination/i);
    await expect(operations.run("kit/install", { source: "me/repo", names: [], to: "core" })).rejects.toThrow(/at least one/i);
    await expect(operations.run("kit/install", { source: "me/repo", names: ["absent"], to: "core" })).rejects.toThrow(/not in this repository/i);
  });
});

describe("afk add", () => {
  const log = (): void => {};

  it("installs named skills to Core in one line", async () => {
    expect(await runAdd(["me/repo", "--skill", "one", "--core", "--yes"], store, { log, interactive: false, runner: operations.installRunner! })).toBe(0);

    expect((await store.read()).kit!.core).toEqual([{ source: "me/repo", skills: ["one"] }]);
  });

  it("asks which skills and where when run in a terminal", async () => {
    const output: string[] = [], answers = ["one,two", "here", "", "y"];

    expect(await runAdd(["me/repo"], store, { log: text => output.push(text), interactive: true, ask: async () => answers.shift()!, runner: operations.installRunner! })).toBe(0);

    expect(output.join("\n")).toContain("three");
    expect((await store.read()).machineOnly).toEqual(["one", "two"]);
  });

  it("changes nothing when the confirmation is declined", async () => {
    const answers = ["all", "core", "n"];

    expect(await runAdd(["me/repo"], store, { log, interactive: true, ask: async () => answers.shift()!, runner: operations.installRunner! })).toBe(0);

    expect(installed).toEqual([]);
    expect((await store.read()).kit!.core).toEqual([]);
  });

  it("bookmarks a whole repository without downloading it", async () => {
    const discover = vi.spyOn(SourcePreparation.prototype, "discover");

    expect(await runAdd(["me/repo", "--later", "--yes"], store, { log, interactive: false })).toBe(0);

    expect(discover).not.toHaveBeenCalled();
    expect((await store.read()).favoriteSources).toEqual([{ name: "repo", source: "me/repo" }]);
  });

  it("says it is working before a slow download", async () => {
    const output: string[] = [];
    let seenBeforeDownload = false;
    vi.spyOn(SourcePreparation.prototype, "discover").mockImplementation(async () => { seenBeforeDownload = output.join().includes("me/repo"); return ["one"]; });

    await runAdd(["me/repo", "--skill", "one", "--later", "--yes"], store, { log: text => output.push(text), interactive: false });

    expect(seenBeforeDownload).toBe(true);
  });

  it("needs the skills and destination spelled out when nobody can answer", async () => {
    await expect(runAdd(["me/repo", "--yes"], store, { log, interactive: false })).rejects.toThrow(/--skill/);
    await expect(runAdd(["me/repo", "--skill", "one", "--yes"], store, { log, interactive: false })).rejects.toThrow(/--core/);
    await expect(runAdd(["me/repo", "--skill", "one", "--core"], store, { log, interactive: false })).rejects.toThrow(/--yes/);
  });

  it("warns about a replacement and needs --replace unattended", async () => {
    await skill("one", "someone/else");

    await expect(runAdd(["me/repo", "--skill", "one", "--core", "--yes"], store, { log, interactive: false })).rejects.toThrow(/--replace/);
    expect(await runAdd(["me/repo", "--skill", "one", "--core", "--yes", "--replace"], store, { log, interactive: false, runner: operations.installRunner! })).toBe(0);
  });
});
