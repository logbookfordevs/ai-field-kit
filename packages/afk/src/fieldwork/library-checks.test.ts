import { cp, lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Backup, startBackup } from "./library-backup.js";
import { LocalChecks } from "./library-checks.js";
import { Library } from "./library.js";
import { FieldworkOperations } from "./operations.js";
import { SettingsStore } from "./settings.js";
import { runCommand } from "./command-runner.js";

let home: string;
let library: Library;
let checks: LocalChecks;
let remote: string;

const quiet = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t" };

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd, env: { ...process.env, ...quiet, HOME: home } });
  if (result.code !== 0) throw new Error(result.output);
  return result.output.trim();
}

const skillText = (name: string, body = "Body."): string => `---\nname: ${name}\ndescription: ${name} skill\n---\n${body}\n`;

async function store(name: string, invocation: "" | "Manual only" | "Automatic allowed" = ""): Promise<void> {
  await library.change(`Add ${name}`, async () => {
    await mkdir(library.skillPath(name), { recursive: true });
    await writeFile(join(library.skillPath(name), "SKILL.md"), skillText(name));
    await library.writeRecord(name, { source: "owner/repo", invocation });
  });
  await library.link(name);
}

async function commits(): Promise<string[]> {
  return (await git(library.root, "log", "--format=%s")).split("\n").filter(Boolean);
}

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

// Skills CLI removes the link and writes a plain folder in its place.
async function replaceLinkWithFolder(name: string, body: string): Promise<string> {
  const path = join(home, ".agents/skills", name);
  await rm(path);
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), skillText(name, body));
  return path;
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-checks-"));
  library = new Library(home);
  await library.create("Start the library", async () => undefined);
  checks = new LocalChecks(library, async () => true);
  remote = join(home, "remote.git");
  await mkdir(remote, { recursive: true });
  await git(remote, "init", "--quiet", "--bare", "--initial-branch=main");
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("edited outside AFK", () => {
  it("lists a stored file changed without the editor, and nothing once the library is clean", async () => {
    await store("kami");
    expect(await checks.list()).toEqual([]);

    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited by hand."));

    expect(await checks.list()).toEqual([expect.objectContaining({ id: "edited:kami", kind: "edited", name: "kami", files: ["SKILL.md"] })]);
  });
});

describe("resolving an edit made outside AFK", () => {
  it("Keep edit commits the edit, with the saved choice applied, and clears the item", async () => {
    await store("kami", "Manual only");
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited by hand."));
    await writeFile(join(library.skillPath("kami"), "notes.md"), "New file.\n");

    await checks.keep("edited:kami");

    expect(await checks.list()).toEqual([]);
    expect(await commits()).toEqual(["Kept an edit to kami made outside AFK", "Add kami", "Start the library"]);
    const text = await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8");
    expect(text).toContain("Edited by hand.");
    expect(text).toContain("disable-model-invocation: true");
    expect(await readFile(join(library.skillPath("kami"), "notes.md"), "utf8")).toBe("New file.\n");
    expect(await git(library.root, "status", "--porcelain")).toBe("");
  });

  it("Discard restores the saved files, removes new ones, and makes no commit", async () => {
    await store("kami");
    const before = await commits();
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited by hand."));
    await writeFile(join(library.skillPath("kami"), "notes.md"), "New file.\n");

    await checks.discard("edited:kami");

    expect(await checks.list()).toEqual([]);
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toBe(skillText("kami"));
    expect(await present(join(library.skillPath("kami"), "notes.md"))).toBe(false);
    expect(await commits()).toEqual(before);
  });

  it("only resolves the chosen skill and refuses an item that is no longer there", async () => {
    await store("kami");
    await store("wizard");
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited."));
    await writeFile(join(library.skillPath("wizard"), "SKILL.md"), skillText("wizard", "Edited."));

    await checks.discard("edited:kami");

    expect((await checks.list()).map(item => item.id)).toEqual(["edited:wizard"]);
    await expect(checks.keep("edited:kami")).rejects.toThrow(/no longer/i);
  });
});

describe("replaced by Skills CLI", () => {
  it("lists a link that became a plain folder, and says whether its files differ from the saved ones", async () => {
    await store("statechart");
    await store("wizard");
    expect(await checks.list()).toEqual([]);

    await replaceLinkWithFolder("statechart", "Newer.");
    await rm(join(home, ".agents/skills/wizard"));
    await cp(library.skillPath("wizard"), join(home, ".agents/skills/wizard"), { recursive: true });

    expect(await checks.list()).toEqual([
      expect.objectContaining({ id: "replaced:statechart", kind: "replaced", name: "statechart", changed: true }),
      expect.objectContaining({ id: "replaced:wizard", kind: "replaced", name: "wizard", changed: false }),
    ]);
  });

  it("does not list a skill that is simply off", async () => {
    await store("statechart");
    await library.unlink("statechart");

    expect(await checks.list()).toEqual([]);
  });

  it("Take the update stores the new files with the choice reapplied, relinks, and commits once", async () => {
    await store("statechart", "Manual only");
    const folder = await replaceLinkWithFolder("statechart", "Newer.");
    await mkdir(join(folder, "references"));
    await writeFile(join(folder, "references/extra.md"), "Added upstream.\n");

    await checks.take("statechart");

    const stored = join(library.skillPath("statechart"));
    const text = await readFile(join(stored, "SKILL.md"), "utf8");
    expect(text).toContain("Newer.");
    expect(text).toContain("disable-model-invocation: true");
    expect(await readFile(join(stored, "references/extra.md"), "utf8")).toBe("Added upstream.\n");
    expect((await lstat(folder)).isSymbolicLink()).toBe(true);
    expect(await readlink(folder)).toBe(stored);
    expect(await library.linked("statechart")).toBe(true);
    expect(await commits()).toEqual(["Took the Skills CLI update to statechart", "Add statechart", "Start the library"]);
    expect(await checks.list()).toEqual([]);
    expect(await git(library.root, "status", "--porcelain")).toBe("");
  });

  it("Take the update drops files the new version no longer has", async () => {
    await store("statechart");
    await library.change("Add old file", () => writeFile(join(library.skillPath("statechart"), "old.md"), "Old.\n"));
    await replaceLinkWithFolder("statechart", "Newer.");

    await checks.take("statechart");

    expect(await present(join(library.skillPath("statechart"), "old.md"))).toBe(false);
  });

  it("Restore saved version puts the link back, removes the folder, and leaves the library untouched", async () => {
    await store("statechart");
    const before = await commits();
    const folder = await replaceLinkWithFolder("statechart", "Newer.");

    await checks.restore("statechart");

    expect((await lstat(folder)).isSymbolicLink()).toBe(true);
    expect(await readFile(join(folder, "SKILL.md"), "utf8")).toBe(skillText("statechart"));
    expect(await commits()).toEqual(before);
    expect(await checks.list()).toEqual([]);
  });

  it("relinks every agent folder, not only the one Skills CLI replaced", async () => {
    await store("statechart");
    await rm(join(home, ".claude/skills/statechart"));
    await replaceLinkWithFolder("statechart", "Newer.");

    await checks.take("statechart");

    expect(await readlink(join(home, ".claude/skills/statechart"))).toBe(library.skillPath("statechart"));
    expect(await readlink(join(home, ".agents/skills/statechart"))).toBe(library.skillPath("statechart"));
  });

  it("Take the update moves a second, different copy to a dated recovery folder instead of deleting it", async () => {
    await store("statechart");
    await replaceLinkWithFolder("statechart", "New Agents copy.");
    const claude = join(home, ".claude/skills/statechart");
    await rm(claude);
    await mkdir(claude, { recursive: true });
    await writeFile(join(claude, "SKILL.md"), skillText("statechart", "UNIQUE CLAUDE EDIT."));

    const result = await checks.take("statechart");

    expect(await readFile(join(library.skillPath("statechart"), "SKILL.md"), "utf8")).toContain("New Agents copy.");
    expect(result.movedAside.map(move => ({ name: move.name, from: move.from }))).toEqual([{ name: "statechart", from: claude }]);
    expect(result.movedAside[0]!.to.startsWith(join(home, ".afk/restore-aside/"))).toBe(true);
    expect(await readFile(join(result.movedAside[0]!.to, "SKILL.md"), "utf8")).toContain("UNIQUE CLAUDE EDIT.");
    expect(await readlink(claude)).toBe(library.skillPath("statechart"));
  });

  it("Take the update drops a second copy that matches the one taken, keeping nothing aside", async () => {
    await store("statechart");
    await replaceLinkWithFolder("statechart", "Newer.");
    const claude = join(home, ".claude/skills/statechart");
    await rm(claude);
    await mkdir(claude, { recursive: true });
    await writeFile(join(claude, "SKILL.md"), skillText("statechart", "Newer."));

    const result = await checks.take("statechart");

    expect(result.movedAside).toEqual([]);
    expect(await present(join(home, ".afk/restore-aside"))).toBe(false);
    expect(await readlink(claude)).toBe(library.skillPath("statechart"));
  });

  it("Restore saved version moves a second copy that differs from both the saved and the reviewed one aside", async () => {
    await store("statechart");
    await replaceLinkWithFolder("statechart", "Newer.");
    const claude = join(home, ".claude/skills/statechart");
    await rm(claude);
    await mkdir(claude, { recursive: true });
    await writeFile(join(claude, "SKILL.md"), skillText("statechart", "UNIQUE CLAUDE EDIT."));

    const result = await checks.restore("statechart");

    expect(result.movedAside.map(move => move.from)).toEqual([claude]);
    expect(await readFile(join(result.movedAside[0]!.to, "SKILL.md"), "utf8")).toContain("UNIQUE CLAUDE EDIT.");
    expect(await readlink(claude)).toBe(library.skillPath("statechart"));
  });

  it("refuses a folder that is not a skill, and keeps it", async () => {
    await store("statechart");
    const folder = join(home, ".agents/skills/statechart");
    await rm(folder);
    await mkdir(folder);
    await writeFile(join(folder, "README.md"), "Not a skill.\n");

    await expect(checks.take("statechart")).rejects.toThrow(/SKILL\.md/);

    expect(await present(join(folder, "README.md"))).toBe(true);
    expect(await commits()).toEqual(["Add statechart", "Start the library"]);
  });

  it("refuses to take an update while an outside edit is waiting, and changes nothing", async () => {
    await store("statechart");
    await store("kami");
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited."));
    const folder = await replaceLinkWithFolder("statechart", "Newer.");

    await expect(checks.take("statechart")).rejects.toThrow(/changes AFK did not make/);

    expect((await lstat(folder)).isDirectory()).toBe(true);
    expect(await readFile(join(library.skillPath("statechart"), "SKILL.md"), "utf8")).toBe(skillText("statechart"));
    expect(await readFile(join(library.skillPath("kami"), "SKILL.md"), "utf8")).toContain("Edited.");
  });

  it("refuses a skill that is not replaced", async () => {
    await store("statechart");

    await expect(checks.take("statechart")).rejects.toThrow(/no longer/i);
    await expect(checks.restore("statechart")).rejects.toThrow(/no longer/i);
  });
});

describe("outside edits and saving to the remote", () => {
  const backupFor = (): Backup => new Backup(library);

  it("never sends an outside edit, and the scheduler holds back until the edit is resolved", async () => {
    await store("kami");
    const backup = backupFor();
    await backup.connect(remote);
    await store("wizard");
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited by hand."));
    let clock = 0;
    const schedule = startBackup(backup, { now: () => clock, interval: 3_600_000, quietMs: 120_000 });

    await schedule.tick();
    clock += 121_000;
    await schedule.tick();

    expect((await backup.status()).attention).toBe(1);
    expect((await git(remote, "log", "--format=%s", "main")).split("\n")).toEqual(["Add kami", "Start the library"]);

    await backup.checks.keep("edited:kami");
    clock += 1_000;
    await schedule.tick();
    clock += 121_000;
    await schedule.tick();
    await schedule.stop();

    expect((await backup.status()).attention).toBe(0);
    expect((await git(remote, "log", "--format=%s", "main")).split("\n")).toEqual(["Kept an edit to kami made outside AFK", "Add wizard", "Add kami", "Start the library"]);
  });

  it("counts both kinds in the status and sends nothing for a replaced link alone", async () => {
    await store("kami");
    await store("statechart");
    const backup = backupFor();
    await backup.connect(remote);
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited."));
    await replaceLinkWithFolder("statechart", "Newer.");

    expect((await backup.status()).attention).toBe(2);
    expect((await backup.checks.list()).length).toBe(2);
  });
});

describe("the Needs attention operations", () => {
  it("report the list with the status and resolve each item", async () => {
    await store("kami");
    await store("statechart");
    await writeFile(join(library.skillPath("kami"), "SKILL.md"), skillText("kami", "Edited by hand."));
    await replaceLinkWithFolder("statechart", "Newer.");
    const settings = new SettingsStore(home);
    await settings.initialize();
    const operations = new FieldworkOperations(settings);
    type Reply = { status: { attention: number; held: boolean }; attention: { id: string }[] };
    try {
      const state = await operations.run("backup/state", { brief: true }) as Reply;
      expect(state.attention.map(item => item.id)).toEqual(["edited:kami", "replaced:statechart"]);
      expect(state.status).toMatchObject({ attention: 2, held: true });

      await operations.run("backup/discard", { id: "edited:kami" });
      const taken = await operations.run("backup/take-update", { name: "statechart" }) as Reply;

      expect(taken.attention).toEqual([]);
      expect(taken.status).toMatchObject({ attention: 0, held: false });
      expect(await readFile(join(library.skillPath("statechart"), "SKILL.md"), "utf8")).toContain("Newer.");
      await expect(operations.run("backup/keep", { id: "edited:kami" })).rejects.toThrow(/no longer/i);
      await expect(operations.run("backup/restore-saved", { name: "../x" })).rejects.toThrow();
    } finally { await operations.close(); }
  });
});

describe("a replaced skill that was off", () => {
  async function replacedWhile(on: boolean, settings: SettingsStore): Promise<string> {
    await store("statechart");
    const state = await settings.read();
    state.independentSkills.Global = on ? ["statechart"] : [];
    await settings.save(state);
    if (!on) await library.unlink("statechart");
    const folder = join(home, ".agents/skills/statechart");
    await rm(folder, { force: true });
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "SKILL.md"), skillText("statechart", "Newer."));
    return folder;
  }

  it("Restore saved version relinks a skill that was on", async () => {
    const settings = new SettingsStore(home);
    await settings.initialize();
    const operations = new FieldworkOperations(settings);
    try {
      const folder = await replacedWhile(true, settings);

      await operations.run("backup/restore-saved", { name: "statechart" });

      expect(await readlink(folder)).toBe(library.skillPath("statechart"));
    } finally { await operations.close(); }
  });

  it("Restore saved version removes the plain folder and leaves the skill off", async () => {
    const settings = new SettingsStore(home);
    await settings.initialize();
    const operations = new FieldworkOperations(settings);
    try {
      const folder = await replacedWhile(false, settings);
      const before = await commits();

      await operations.run("backup/restore-saved", { name: "statechart" });

      expect(await present(folder)).toBe(false);
      expect(await library.linked("statechart")).toBe(false);
      expect(await commits()).toEqual(before);
    } finally { await operations.close(); }
  });

  it("Take the update stores the new files and leaves the skill off", async () => {
    const settings = new SettingsStore(home);
    await settings.initialize();
    const operations = new FieldworkOperations(settings);
    try {
      const folder = await replacedWhile(false, settings);

      await operations.run("backup/take-update", { name: "statechart" });

      expect(await readFile(join(library.skillPath("statechart"), "SKILL.md"), "utf8")).toContain("Newer.");
      expect(await present(folder)).toBe(false);
      expect(await library.linked("statechart")).toBe(false);
    } finally { await operations.close(); }
  });
});

describe("a folder Skills CLI wrote outside AFK", () => {
  it("is never adopted by reading the inventory or the backup state", async () => {
    const settings = new SettingsStore(home);
    await settings.initialize();
    const operations = new FieldworkOperations(settings);
    try {
      await store("statechart");
      const folder = await replaceLinkWithFolder("statechart", "Newer.");
      const before = await commits();

      await operations.run("kit/state", {});
      await operations.run("backup/state", { brief: true });

      expect((await lstat(folder)).isSymbolicLink()).toBe(false);
      expect(await readFile(join(library.skillPath("statechart"), "SKILL.md"), "utf8")).toBe(skillText("statechart"));
      expect(await commits()).toEqual(before);
      expect((await checks.list()).map(item => item.id)).toEqual(["replaced:statechart"]);
    } finally { await operations.close(); }
  });
});
