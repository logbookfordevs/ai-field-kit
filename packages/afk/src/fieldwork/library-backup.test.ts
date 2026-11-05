import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Backup, checkRemoteUrl, startBackup } from "./library-backup.js";
import { Library } from "./library.js";
import { runCommand, type CommandSpec } from "./command-runner.js";
import { FieldworkOperations } from "./operations.js";
import { SettingsStore } from "./settings.js";

let home: string;
let library: Library;
let backup: Backup;
let remote: string;
let ghCalls: CommandSpec[];
let created: string;

const quiet = { HOME: "", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t" };

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd, env: { ...process.env, ...quiet, HOME: home } });
  if (result.code !== 0) throw new Error(result.output);
  return result.output.trim();
}

async function bare(path: string): Promise<string> {
  await mkdir(path, { recursive: true });
  await git(path, "init", "--quiet", "--bare", "--initial-branch=main");
  return path;
}

async function save(message: string, name = message.replace(/\W+/g, "-")): Promise<void> {
  await library.change(message, async () => {
    await mkdir(library.skillPath(name), { recursive: true });
    await writeFile(join(library.skillPath(name), "SKILL.md"), `---\nname: ${name}\ndescription: ${message}\n---\n`);
    await library.writeRecord(name, { invocation: "" });
  });
}

async function remoteLog(): Promise<string[]> {
  return (await git(remote, "log", "--format=%s", "main")).split("\n");
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-backup-"));
  remote = await bare(join(home, "remote.git"));
  ghCalls = [];
  created = join(home, "gh-created.git");
  library = new Library(home);
  await library.create("Start the library", async () => undefined);
  backup = new Backup(library, async spec => {
    if (spec.command !== "gh") return runCommand(spec);
    ghCalls.push(spec);
    await bare(created);
    return { code: 0, output: `${created}\n`, cancelled: false };
  });
});

afterEach(async () => { await rm(home, { recursive: true, force: true }); });

describe("saving the library to a remote", () => {
  it("pushes every commit when a remote is connected and again on Save now", async () => {
    await save("Add alpha");
    await backup.connect(remote);

    expect(await remoteLog()).toEqual(["Add alpha", "Start the library"]);

    await save("Add beta");
    expect((await backup.status()).state).toBe("waiting");
    expect((await backup.saveNow()).state).toBe("saved");
    expect(await remoteLog()).toEqual(["Add beta", "Add alpha", "Start the library"]);
  });

  it("keeps commits local while the remote is unreachable, reports them as failed, and sends them all on the next success", async () => {
    const missing = join(home, "later.git");
    await backup.connect(missing);
    await save("Add alpha");
    await save("Add beta");

    const failed = await backup.saveNow();

    expect(failed).toMatchObject({ state: "failed", waiting: 3 });
    expect(failed.error).toBeTruthy();
    expect(await git(library.root, "log", "--format=%s")).toBe("Add beta\nAdd alpha\nStart the library");

    await bare(missing);
    const recovered = await backup.saveNow();

    expect(recovered).toMatchObject({ state: "saved", waiting: 0 });
    expect(recovered.error).toBeUndefined();
    expect(await git(missing, "log", "--format=%s", "main")).toBe("Add beta\nAdd alpha\nStart the library");
  });

  it("reports no backup until a remote is connected", async () => {
    expect(await backup.status()).toMatchObject({ library: true, state: "off", waiting: 0 });
    expect(await new Backup(new Library(join(home, "empty"))).status()).toMatchObject({ library: false });
  });

  it("never force-pushes over a remote that has other history", async () => {
    const other = await mkdtemp(join(tmpdir(), "afk-other-"));
    try {
      await git(other, "clone", "--quiet", remote, "work");
      await writeFile(join(other, "work/x"), "x");
      await git(join(other, "work"), "add", "x");
      await git(join(other, "work"), "commit", "--quiet", "-m", "Someone else");
      await git(join(other, "work"), "push", "--quiet", "origin", "HEAD:main");
    } finally { await rm(other, { recursive: true, force: true }); }

    const result = await backup.connect(remote);

    expect(result.state).toBe("failed");
    expect(await remoteLog()).toEqual(["Someone else"]);
  });
});

describe("credentials", () => {
  it.each(["https://user:secret@example.com/o/r.git", "https://ghp_token@github.com/o/r.git", "--upload-pack=x", "two words"])("refuses %s and writes nothing", async url => {
    await expect(backup.connect(url)).rejects.toThrow();
    expect(await git(library.root, "remote")).toBe("");
    expect(await readFile(join(library.root, ".git/config"), "utf8")).not.toMatch(/secret|ghp_token/);
  });

  it("accepts SSH and local remotes, which carry no secret", () => {
    for (const url of ["git@github.com:owner/repo.git", "ssh://git@example.com/owner/repo.git", "https://example.com/owner/repo.git", "/srv/backups/library.git"]) {
      expect(checkRemoteUrl(url)).toBe(url);
    }
  });
});

describe("a private GitHub repository", () => {
  it("is created through the GitHub CLI as private, then connected and pushed", async () => {
    const status = await backup.createRepository("afk-library");

    expect(ghCalls).toHaveLength(1);
    expect(ghCalls[0]!.args.slice(0, 3)).toEqual(["repo", "create", "afk-library"]);
    expect(ghCalls[0]!.args).toContain("--private");
    expect(status).toMatchObject({ state: "saved", remote: created });
    expect(await git(created, "log", "--format=%s", "main")).toBe("Start the library");
  });

  it("explains when the GitHub CLI is missing and leaves the library unconnected", async () => {
    const missing = new Backup(library, async spec => {
      if (spec.command === "gh") throw new Error("The GitHub repository could not start: spawn gh ENOENT");
      return runCommand(spec);
    });

    await expect(missing.createRepository("afk-library")).rejects.toThrow(/GitHub CLI/);
    expect((await missing.status()).state).toBe("off");
  });

  it.each(["", "-x", "a b", "a/b/c"])("refuses the repository name %j", async name => {
    await expect(backup.createRepository(name)).rejects.toThrow();
    expect(ghCalls).toHaveLength(0);
  });
});

describe("history and going back", () => {
  it("lists saves newest first, marking the ones not pushed yet", async () => {
    await save("Add alpha");
    await backup.connect(remote);
    await save("Add beta");

    const history = await backup.history();

    expect(history.map(entry => ({ message: entry.message, pushed: entry.pushed }))).toEqual([
      { message: "Add beta", pushed: false },
      { message: "Add alpha", pushed: true },
      { message: "Start the library", pushed: true },
    ]);
  });

  it("names the skills whose files or choices changed in saves not pushed yet", async () => {
    await save("Add alpha", "alpha");
    await save("Add gamma", "gamma");
    await backup.connect(remote);
    await save("Add beta", "beta");
    await library.change("Choose manual for gamma", async () => { await library.writeRecord("gamma", { invocation: "Manual only" }); });

    expect((await backup.unpushedSkills()).sort()).toEqual(["beta", "gamma"]);
    await backup.saveNow();
    expect(await backup.unpushedSkills()).toEqual([]);
  });

  it("restores an earlier save as a new commit that can itself be undone", async () => {
    await save("Add alpha");
    await save("Add beta");
    const [beta, alpha] = await backup.history();

    await backup.goBack(alpha!.id);

    expect(await library.names()).toEqual(["Add-alpha"]);
    expect((await backup.history())[0]!.message).toMatch(/Went back/);
    expect(await git(library.root, "status", "--porcelain")).toBe("");

    const [restore] = await backup.history();
    await backup.goBack(beta!.id);

    expect(await library.names()).toEqual(["Add-alpha", "Add-beta"]);
    expect(restore!.id).not.toBe(beta!.id);
  });

  it("removes AFK's links to skills that the earlier save did not have", async () => {
    await save("Add alpha", "alpha");
    const [alphaSave] = await backup.history();
    await save("Add beta", "beta");
    await library.link("beta");

    await backup.goBack(alphaSave!.id);

    expect(await library.linked("beta")).toBe(false);
  });

  it("refuses an id that is not a save in this library", async () => {
    await expect(backup.goBack("deadbeef")).rejects.toThrow();
    await expect(backup.goBack("--hard")).rejects.toThrow();
  });

  it("leaves nothing new when the library already matches the chosen save", async () => {
    const [first] = await backup.history();
    await backup.goBack(first!.id);
    expect(await backup.history()).toHaveLength(1);
  });

  it("pushes the going-back commit like any other save", async () => {
    await save("Add alpha");
    await backup.connect(remote);
    const [alpha, start] = await backup.history();
    expect(alpha).toBeDefined();
    await backup.goBack(start!.id);
    await backup.saveNow();

    expect((await remoteLog())[0]).toMatch(/Went back/);
  });
});

describe("what the backup holds", () => {
  it("counts the saved objects by kind from the library as a whole", async () => {
    await save("Add alpha", "alpha");
    await library.change("Add records", async () => {
      await library.writeRecord("alpha", { invocation: "Manual only" });
      for (const folder of ["packs", "tools", "bookmarks"]) {
        await mkdir(join(library.root, ".afk", folder), { recursive: true });
        await writeFile(join(library.root, ".afk", folder, "one.json"), "{}\n");
      }
      await mkdir(join(library.root, "rules"), { recursive: true });
      await writeFile(join(library.root, "rules/AGENTS.md"), "# Rules\n");
    });

    expect(await backup.contents()).toMatchObject({ coreSkills: 1, packs: 1, tools: 1, bookmarks: 1, choices: 1, rules: true });
    expect((await backup.contents()).skillBytes).toBeGreaterThan(0);
  });
});

describe("the quiet period", () => {
  it("pushes a change two minutes after it is first seen, and not before", async () => {
    await backup.connect(remote);
    let now = 1_000_000;
    const schedule = startBackup(backup, { now: () => now, interval: 3_600_000 });
    try {
      await schedule.tick();
      await save("Add alpha");
      await schedule.tick();
      now += 119_000;
      await schedule.tick();
      expect(await remoteLog()).toEqual(["Start the library"]);

      now += 1_000;
      await schedule.tick();
      expect(await remoteLog()).toEqual(["Add alpha", "Start the library"]);
    } finally { await schedule.stop(); }
  });

  it("restarts the quiet period with each new change", async () => {
    await backup.connect(remote);
    let now = 1_000_000;
    const schedule = startBackup(backup, { now: () => now, interval: 3_600_000 });
    try {
      await schedule.tick();
      await save("Add alpha");
      await schedule.tick();
      now += 100_000;
      await save("Add beta");
      await schedule.tick();
      now += 100_000;
      await schedule.tick();
      expect(await remoteLog()).toEqual(["Start the library"]);

      now += 20_000;
      await schedule.tick();
      expect(await remoteLog()).toEqual(["Add beta", "Add alpha", "Start the library"]);
    } finally { await schedule.stop(); }
  });

  it("retries a failed push after another quiet period without losing the commits", async () => {
    const later = join(home, "later.git");
    await backup.connect(later);
    let now = 1_000_000;
    const schedule = startBackup(backup, { now: () => now, interval: 3_600_000 });
    try {
      await schedule.tick();
      now += 120_000;
      await schedule.tick();
      expect((await backup.status()).state).toBe("failed");

      await bare(later);
      now += 119_000;
      await schedule.tick();
      expect((await backup.status()).state).toBe("failed");

      now += 1_000;
      await schedule.tick();
      expect((await backup.status()).state).toBe("saved");
    } finally { await schedule.stop(); }
  });

  it("does nothing without a remote", async () => {
    let now = 0;
    const schedule = startBackup(backup, { now: () => now, interval: 3_600_000 });
    try {
      await schedule.tick();
      now += 600_000;
      await expect(schedule.tick()).resolves.toBeUndefined();
      expect((await backup.status()).state).toBe("off");
    } finally { await schedule.stop(); }
  });
});

describe("the backup operations", () => {
  it("connect, report, save and go back through the operation catalog", async () => {
    const store = new SettingsStore(home);
    await store.initialize();
    const operations = new FieldworkOperations(store);
    try {
      await operations.run("backup/connect", { url: remote });
      await save("Add alpha", "alpha");
      const brief = await operations.run("backup/state", { brief: true }) as { unpushed: string[] };
      expect(brief.unpushed).toEqual(["alpha"]);
      await operations.run("backup/save");
      const state = await operations.run("backup/state") as { status: { state: string; remote: string }; history: { id: string }[]; contents: { coreSkills: number }; unpushed: string[] };

      expect(state.status).toMatchObject({ state: "saved", remote });
      expect(state.unpushed).toEqual([]);
      expect(state.history).toHaveLength(2);
      expect(state.contents.coreSkills).toBe(1);
      await expect(operations.run("backup/connect", { url: "https://u:p@example.com/r.git" })).rejects.toThrow();
      await expect(operations.run("backup/restore", { id: "nope" })).rejects.toThrow();
      expect(await operations.run("backup/disconnect")).toMatchObject({ state: "off" });
    } finally { await operations.close(); }
  });
});
