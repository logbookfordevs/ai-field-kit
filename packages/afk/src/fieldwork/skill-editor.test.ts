import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "./command-runner.js";
import { Library, machineRoot, packCacheRoot, type InvocationChoice } from "./library.js";
import type { SkillEditorView } from "./skill-editor.js";
import { updateSkills, type UpdateRunner } from "./skill-update.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { SkillLibrary } from "./skills.js";

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
const skillText = (name: string, body = "Body.", extra = ""): string => `---\nname: ${name}\ndescription: ${name} skill\n${extra}---\n${body}\n`;

async function store1(name: string, options: { invocation?: InvocationChoice; source?: string | null; updates?: "stopped" | "replace" } = {}): Promise<void> {
  await library.change(`Add ${name}`, async () => {
    await mkdir(library.skillPath(name), { recursive: true });
    await writeFile(join(library.skillPath(name), "SKILL.md"), skillText(name));
    await mkdir(join(library.skillPath(name), "scripts"), { recursive: true });
    await writeFile(join(library.skillPath(name), "scripts/run.sh"), "echo hi\n");
    const source = options.source === undefined ? "owner/repo" : options.source;
    await library.writeRecord(name, { ...(source ? { source } : {}), invocation: options.invocation ?? "", ...(options.updates ? { updates: options.updates } : {}) });
  });
  await library.link(name);
}

const open = (name: string, file?: string): Promise<SkillEditorView> => operations.run("skill/editor", { name, ...(file === undefined ? {} : { file }) }) as Promise<SkillEditorView>;
const save = (name: string, file: string, content: string, extra: Record<string, unknown> = {}): Promise<unknown> => operations.run("skill/edit", { name, file, content, ...extra });

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-editor-"));
  library = new Library(home);
  await library.create("Start the library", async () => undefined);
  store = new SettingsStore(home);
  await store.initialize();
  await store.save(emptySettings());
  operations = new FieldworkOperations(store);
});

afterEach(async () => {
  await operations.close();
  await rm(home, { recursive: true, force: true });
});

describe("saving an edit", () => {
  it("writes the file, keeps the invocation choice and makes one commit", async () => {
    await store1("kami", { invocation: "Manual only", source: null });
    const before = await commits();
    const edited = skillText("kami", "A new body.", "disable-model-invocation: false\n");

    await save("kami", "SKILL.md", edited);

    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toContain("A new body.");
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect((await library.record("kami"))?.invocation).toBe("Manual only");
    const after = await commits();
    expect(after.length).toBe(before.length + 1);
    expect(after[0]).toBe("Edit kami");
    expect(await git("status", "--porcelain")).toBe("");
  });
});

describe("a skill that updates from its repository", () => {
  const edited = skillText("kami", "My version.");

  it("asks before saving and changes nothing until the user chooses", async () => {
    await store1("kami");
    const before = await commits();

    expect((await open("kami")).updates).toBe("ask");
    await expect(save("kami", "SKILL.md", edited)).rejects.toThrow(/keep your version or let updates replace/);

    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).not.toContain("My version.");
    expect(await commits()).toEqual(before);
  });

  it("keeps the user's version by stopping its updates, in the same commit as the edit", async () => {
    await store1("kami", { invocation: "Automatic allowed" });
    const before = await commits();

    await save("kami", "SKILL.md", edited, { updates: "keep" });

    expect(await library.record("kami")).toMatchObject({ source: "owner/repo", invocation: "Automatic allowed", updates: "stopped" });
    expect((await commits()).length).toBe(before.length + 1);
    expect(await git("show", "--name-only", "--format=", "HEAD")).toContain(".afk/skills/kami.json");
    expect((await open("kami")).updates).toBe("stopped");
    expect((await new SkillLibrary(store).inventory(await store.read(), "Global")).find(entry => entry.name === "kami")?.updatesStopped).toBe(true);
    await save("kami", "SKILL.md", skillText("kami", "Edited again."));
    expect((await commits()).length).toBe(before.length + 2);
  });

  it("remembers the choice to let updates replace edits, so it does not ask again", async () => {
    await store1("kami");

    await save("kami", "SKILL.md", edited, { updates: "replace" });
    await save("kami", "SKILL.md", skillText("kami", "Second edit."));

    expect(await library.record("kami")).toMatchObject({ updates: "replace" });
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toContain("Second edit.");
  });

  it("never asks for a skill with no repository to update from", async () => {
    await store1("kami", { source: null });
    expect((await open("kami")).updates).toBe("none");
    await expect(save("kami", "SKILL.md", edited)).resolves.toBeDefined();
  });

  it("skips a skill whose updates were stopped when updating everything, and refuses it when selected", async () => {
    await store1("kami", { updates: "stopped" });
    await store1("lumi");
    const upstream: UpdateRunner = async (_cwd, env) => {
      for (const name of await readdir(join(String(env.HOME), ".agents/skills"))) await writeFile(join(String(env.HOME), ".agents/skills", name, "SKILL.md"), skillText(name, "Upstream."));
      return 0;
    };
    const settings = await store.read();

    await updateSkills(store, settings, "Global", () => undefined, upstream);

    expect(await readFile(join(library.skillPath("lumi"), "SKILL.md"), "utf8")).toContain("Upstream.");
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).not.toContain("Upstream.");
    await expect(updateSkills(store, settings, "Global", () => undefined, upstream, undefined, ["kami"])).rejects.toThrow(/kept your version/);
  });
});

describe("skills the editor cannot save", () => {
  it("opens a tool's skill read-only and refuses to save it", async () => {
    const folder = join(home, ".agents/skills/tooled");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "SKILL.md"), skillText("tooled"));
    const settings = await store.read();
    settings.tools = [{ id: 1, name: "Waypoint", install: "echo", update: "echo", provides: ["tooled"] }];
    await store.save(settings);

    const view = await open("tooled");

    expect(view.content).toContain("tooled skill");
    expect(view.readOnly).toMatch(/Waypoint/);
    await expect(save("tooled", "SKILL.md", skillText("tooled", "Changed."))).rejects.toThrow(/Waypoint/);
    expect(await readFile(join(folder, "SKILL.md"), "utf8")).not.toContain("Changed.");
  });

  it("opens a pack's cached skill and a skill AFK does not keep read-only", async () => {
    await mkdir(join(packCacheRoot(home), "cached"), { recursive: true });
    await writeFile(join(packCacheRoot(home), "cached/SKILL.md"), skillText("cached"));
    await mkdir(join(home, ".agents/skills/loose"), { recursive: true });
    await writeFile(join(home, ".agents/skills/loose/SKILL.md"), skillText("loose"));

    expect((await open("cached")).readOnly).toBeDefined();
    expect((await open("loose")).readOnly).toBeDefined();
    await expect(save("cached", "SKILL.md", skillText("cached", "x"))).rejects.toThrow();
    await expect(save("loose", "SKILL.md", skillText("loose", "x"))).rejects.toThrow();
  });

  it("saves a this-machine skill without a commit", async () => {
    await mkdir(join(machineRoot(home), "mine"), { recursive: true });
    await writeFile(join(machineRoot(home), "mine/SKILL.md"), skillText("mine"));
    await library.link("mine");
    const before = await commits();

    await save("mine", "SKILL.md", skillText("mine", "Edited here."));

    expect(await readFile(join(machineRoot(home), "mine/SKILL.md"), "utf8")).toContain("Edited here.");
    expect(await commits()).toEqual(before);
  });

  it("shows binary files as not editable", async () => {
    await store1("kami", { source: null });
    await library.change("Add binary", () => writeFile(join(library.skillPath("kami"), "scripts/logo.bin"), Buffer.from([0, 1, 2, 3])));

    const view = await open("kami", "scripts/logo.bin");

    expect(view.content).toBeNull();
    expect(view.readOnly).toBeDefined();
  });
});

describe("paths outside the skill folder", () => {
  const outside = (): string => join(home, "outside.txt");

  beforeEach(async () => {
    await store1("kami", { source: null });
    await writeFile(outside(), "secret");
  });

  it("cannot be read or written, however they are spelled", async () => {
    const outsideFolder = join(home, "elsewhere");
    await mkdir(outsideFolder, { recursive: true });
    await writeFile(join(outsideFolder, "secret.txt"), "secret");
    await library.change("Add links", async () => {
      await symlink(outside(), join(library.skillPath("kami"), "leak.txt"));
      await symlink(outsideFolder, join(library.skillPath("kami"), "leakdir"));
    });

    for (const file of ["../../../../outside.txt", "/etc/hosts", outside(), "scripts/../../kami2/SKILL.md", "leak.txt", "leakdir/secret.txt", ".git/config", ".afk-source.json", "..", "", "scripts\\..\\x"]) {
      await expect(open("kami", file), `read ${file}`).rejects.toThrow();
      await expect(save("kami", file, "overwritten"), `write ${file}`).rejects.toThrow();
    }
    expect(await readFile(outside(), "utf8")).toBe("secret");
    expect(await readFile(join(outsideFolder, "secret.txt"), "utf8")).toBe("secret");
  });

  it("refuses to save SKILL.md when a file AFK rewrites alongside it is a link out of the skill", async () => {
    await store1("sample", { invocation: "Manual only", source: null });
    const external = join(home, "outside.yaml");
    await writeFile(external, "policy: {}\n");
    await library.change("Link metadata", async () => {
      await mkdir(join(library.skillPath("sample"), "agents"), { recursive: true });
      await symlink(external, join(library.skillPath("sample"), "agents/openai.yaml"));
    });
    const before = await commits();

    await expect(save("sample", "SKILL.md", skillText("sample", "Edited."))).rejects.toThrow(/link/i);

    expect(await readFile(external, "utf8")).toBe("policy: {}\n");
    expect(await readFile(join(library.skillPath("sample"), "SKILL.md"), "utf8")).not.toContain("Edited.");
    expect(await commits()).toEqual(before);
  });

  it("refuses to save when the folder holding AFK's metadata is a link out of the skill", async () => {
    await store1("sample", { invocation: "Manual only", source: null });
    const external = join(home, "outside-agents");
    await mkdir(external, { recursive: true });
    await library.change("Link agents", () => symlink(external, join(library.skillPath("sample"), "agents")));

    await expect(save("sample", "SKILL.md", skillText("sample", "Edited."))).rejects.toThrow(/link/i);

    expect(await readdir(external)).toEqual([]);
  });

  it("cannot reach a skill through a name that leaves the library", async () => {
    await expect(open("../outside")).rejects.toThrow();
    await expect(save("../outside", "SKILL.md", skillText("outside"))).rejects.toThrow();
  });

  it("does not follow a skill folder that is itself a link", async () => {
    const elsewhere = join(home, "elsewhere-skill");
    await mkdir(elsewhere, { recursive: true });
    await writeFile(join(elsewhere, "SKILL.md"), skillText("linked", "Original."));
    await mkdir(join(library.root, "skills"), { recursive: true });
    await symlink(elsewhere, library.skillPath("linked"));

    await expect(save("linked", "SKILL.md", skillText("linked", "Overwritten."))).rejects.toThrow();
    expect(await readFile(join(elsewhere, "SKILL.md"), "utf8")).toContain("Original.");
  });
});

describe("a save that cannot complete", () => {
  it("leaves the file, the commit history and the choice unchanged when the frontmatter is broken", async () => {
    await store1("kami", { invocation: "Manual only", source: null });
    const before = await commits();
    const original = await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8");

    await expect(save("kami", "SKILL.md", "No frontmatter at all.\n")).rejects.toThrow(/frontmatter/);

    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toBe(original);
    expect(await commits()).toEqual(before);
  });

  it("refuses while the library holds changes AFK did not make, and leaves them alone", async () => {
    await store1("kami", { source: null });
    await writeFile(join(library.skillPath("kami"), "scripts/run.sh"), "echo changed outside\n");

    await expect(save("kami", "SKILL.md", skillText("kami", "New."))).rejects.toThrow(/changes AFK did not make/);

    expect(await readFile(join(library.skillPath("kami"), "scripts/run.sh"), "utf8")).toBe("echo changed outside\n");
  });

  it("edits a supporting file as one commit without touching the invocation line", async () => {
    await store1("kami", { invocation: "Manual only", source: null });
    const skillBefore = await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8");
    const before = await commits();

    await save("kami", "scripts/run.sh", "echo changed\n");

    expect(await readFile(join(library.skillPath("kami"), "scripts/run.sh"), "utf8")).toBe("echo changed\n");
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toBe(skillBefore);
    expect((await commits()).length).toBe(before.length + 1);
  });
});
