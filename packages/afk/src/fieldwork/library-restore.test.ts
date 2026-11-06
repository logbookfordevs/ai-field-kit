import { lstat, mkdir, mkdtemp, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runFieldwork } from "./cli.js";
import { runCommand, type CommandResult, type CommandSpec } from "./command-runner.js";
import { Library } from "./library.js";
import { applyLibraryInit, startLibrary } from "./library-init.js";
import { Backup } from "./library-backup.js";
import { Restore } from "./library-restore.js";
import { writeInvocationChoice } from "./invocation.js";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";

let sourceHome: string;
let home: string;
let store: SettingsStore;
let remote: string;
let ghCalls: CommandSpec[];

const quiet = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@t" };
const skill = (name: string, body = "Body"): string => `---\nname: ${name}\ndescription: ${name} skill\n---\n${body} of ${name}.\n`;
const agents = (...path: string[]): string => join(home, ".agents/skills", ...path);
const claude = (...path: string[]): string => join(home, ".claude/skills", ...path);
const library = (): Library => new Library(home);
const day = new Date(2026, 10, 5, 9, 30);

const writesWiz = "mkdir -p .agents/skills/wiz && printf -- '---\\nname: wiz\\ndescription: wiz skill\\n---\\nFresh.\\n' > .agents/skills/wiz/SKILL.md";

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runCommand({ command: "git", args, step: "test git", cwd, env: { ...process.env, ...quiet, HOME: sourceHome } });
  if (result.code !== 0) throw new Error(result.output);
  return result.output.trim();
}

async function write(path: string, name: string, body?: string): Promise<void> {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "SKILL.md"), skill(name, body));
}

// Builds a real AFK library on another machine and pushes it to a bare repository.
async function sourceLibrary(extra: (settings: ReturnType<typeof emptySettings>) => void = () => undefined): Promise<void> {
  const source = new SettingsStore(sourceHome);
  await source.initialize();
  await write(join(sourceHome, ".agents/skills/alpha"), "alpha");
  await write(join(sourceHome, ".agents/skills/beta"), "beta");
  await mkdir(join(sourceHome, ".agents"), { recursive: true });
  await writeFile(join(sourceHome, ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: { alpha: { source: "owner/repo" }, beta: { source: "owner/repo" } } }));
  const settings = emptySettings();
  settings.kit = { core: [{ source: "owner/repo", skills: ["alpha", "beta"] }] };
  settings.preferences = { "Global|alpha": "Manual only", "Global|wiz": "Manual only" };
  settings.profiles = [{ id: "profile-docs", name: "Docs", source: "owner/docs", skills: ["delta"], enabled: [], ready: false }];
  settings.tools = [{ id: 1, name: "Wizard", install: writesWiz, update: "", provides: ["wiz"] }, { id: 2, name: "Other", install: "mkdir -p .agents/skills/other && printf 'x' > .agents/skills/other/SKILL.md", update: "", provides: ["other"] }];
  settings.favoriteSources = [{ name: "later", source: "owner/later" }];
  extra(settings);
  await source.save(settings);
  await applyLibraryInit(source);
  await mkdir(remote, { recursive: true });
  await git(remote, "init", "--quiet", "--bare", "--initial-branch=main");
  await new Library(sourceHome).changeAgentFolders("Use Cursor too", { enabled: ["~/.claude/skills", "~/.cursor/skills"], custom: [] });
  await new Backup(new Library(sourceHome)).connect(remote);
}

function restorer(runner?: (spec: CommandSpec) => Promise<CommandResult>, options: { signal?: AbortSignal } = {}): Restore {
  return new Restore(store, runner ?? (async spec => {
    if (spec.command !== "gh") return runCommand(spec);
    ghCalls.push(spec);
    return { code: 1, output: "gh is not available in tests", cancelled: false };
  }), { now: () => day, ...options });
}

beforeEach(async () => {
  sourceHome = await mkdtemp(join(tmpdir(), "afk-restore-source-"));
  home = await mkdtemp(join(tmpdir(), "afk-restore-"));
  remote = join(sourceHome, "remote.git");
  ghCalls = [];
  store = new SettingsStore(home);
  await store.initialize();
});

afterEach(async () => {
  await rm(sourceHome, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

describe("restoring a library into an empty home", () => {
  it("clones the library, links Core skills into the enabled folders and keeps choices in their files", async () => {
    await sourceLibrary();

    const summary = await restorer().restore(remote);

    expect(summary.linked).toEqual(["alpha", "beta"]);
    expect(summary.choices).toBe(2);
    expect(await readlink(agents("alpha"))).toBe(library().skillPath("alpha"));
    expect(await readlink(claude("beta"))).toBe(library().skillPath("beta"));
    expect(await readFile(agents("alpha/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readFile(agents("beta/SKILL.md"), "utf8")).toBe(skill("beta"));
    expect((await store.read()).preferences["Global|alpha"]).toBe("Manual only");
  });

  it("leaves the backup connected with nothing waiting and packs off", async () => {
    await sourceLibrary();

    await restorer().restore(remote);

    const status = await new Backup(library()).status();
    expect(status).toMatchObject({ state: "saved", waiting: 0, remote });
    const settings = await store.read();
    expect(settings.profiles.map(profile => [profile.name, profile.enabled])).toEqual([["Docs", []]]);
    expect(settings.independentSkills.Global).toEqual(["alpha", "beta"]);
    expect(await readdir(join(home, ".afk"))).not.toContainEqual(expect.stringMatching(/^\.restore-/));
  });
});

describe("an interrupted or refused restore", () => {
  it("leaves no partial library when the download is cancelled halfway", async () => {
    await sourceLibrary();
    const runner = async (spec: CommandSpec): Promise<CommandResult> => {
      if (!spec.args.includes("clone")) return runCommand(spec);
      const target = spec.args.at(-1)!;
      await mkdir(join(target, ".git"), { recursive: true });
      await writeFile(join(target, "half-written"), "partial");
      return { code: 130, output: "", cancelled: true };
    };

    await expect(restorer(runner).restore(remote)).rejects.toThrow(/cancelled/);

    expect(await present(library().root)).toBe(false);
    expect(await present(join(home, ".afk"))).toBe(true);
    expect((await readdir(join(home, ".afk"))).filter(name => name.startsWith(".restore-"))).toEqual([]);
    expect(await present(agents("alpha"))).toBe(false);
  });

  it("leaves no partial library when the download fails and clears a folder an earlier crash left behind", async () => {
    await mkdir(join(home, ".afk/.restore-clone-crashed/.git"), { recursive: true });

    await expect(restorer().restore(join(sourceHome, "missing.git"))).rejects.toThrow(/Could not reach/);

    expect(await present(library().root)).toBe(false);
    expect((await readdir(join(home, ".afk"))).filter(name => name.startsWith(".restore-"))).toEqual([]);
  });

  it("refuses a repository that is not an AFK library before cloning it", async () => {
    const other = join(sourceHome, "dotfiles.git"), work = join(sourceHome, "dotfiles");
    await mkdir(work, { recursive: true });
    await git(work, "init", "--quiet", "--initial-branch=main");
    await writeFile(join(work, "README.md"), "dotfiles");
    await git(work, "add", "-A");
    await git(work, "commit", "--quiet", "-m", "Start");
    await git(sourceHome, "clone", "--quiet", "--bare", work, other);
    const subcommands: string[] = [];

    await expect(restorer(async spec => { subcommands.push(spec.args.find(arg => ["clone", "fetch", "ls-tree"].includes(arg)) ?? ""); return runCommand(spec); }).restore(other)).rejects.toThrow(/not an AFK library/);

    expect(subcommands).not.toContain("clone");
    expect(await present(library().root)).toBe(false);
  });

  it("finishes a restore whose linking failed once the obstruction is gone, and reports it until then", async () => {
    await sourceLibrary();
    await mkdir(join(home, ".agents"), { recursive: true });
    await writeFile(agents(), "blocking regular file");

    await expect(restorer().restore(remote)).rejects.toThrow();
    expect(await new Backup(library()).status()).toMatchObject({ library: true, restoring: remote });
    await expect(restorer().restore(join(sourceHome, "other.git"))).rejects.toThrow(/did not finish/);

    await rm(agents());
    const summary = await restorer().restore(remote);

    expect(summary.linked).toEqual(["alpha", "beta"]);
    expect(await readlink(agents("alpha"))).toBe(library().skillPath("alpha"));
    expect((await store.read()).independentSkills.Global).toEqual(["alpha", "beta"]);
    expect((await new Backup(library()).status()).restoring).toBeUndefined();
    await expect(restorer().restore(remote)).rejects.toThrow(/already exists/);
  });

  it("keeps every restored Core skill on when the retry follows a failed settings save", async () => {
    await sourceLibrary();
    const save = store.save.bind(store);
    store.save = async () => { throw new Error("injected settings save failure"); };
    await expect(restorer().restore(remote)).rejects.toThrow(/injected/);
    store.save = save;

    const summary = await restorer().restore(remote);

    expect(summary.linked).toEqual(["alpha", "beta"]);
    expect((await store.read()).independentSkills.Global).toEqual(["alpha", "beta"]);
    expect((await new Backup(library()).status()).restoring).toBeUndefined();
  });

  it("refuses to restore over a machine that already has a library", async () => {
    await sourceLibrary();
    await restorer().restore(remote);

    await expect(restorer().restore(remote)).rejects.toThrow(/already exists/);
  });
});

describe("restoring over the empty library AFK started by itself", () => {
  it("replaces it, so a new machine can still bring its library back", async () => {
    await sourceLibrary();
    await startLibrary(store);

    const summary = await restorer().restore(remote);

    expect(summary.linked).toEqual(["alpha", "beta"]);
    expect(await library().names()).toEqual(["alpha", "beta"]);
  });

  it("still refuses once the library holds a skill", async () => {
    await sourceLibrary();
    await startLibrary(store);
    await library().change("Add stray", async () => { await write(library().skillPath("stray"), "stray"); });

    await expect(restorer().restore(remote)).rejects.toThrow(/already exists/);
    expect(await library().names()).toEqual(["stray"]);
  });
});

describe("skills already on the machine", () => {
  it("adopts an identical copy and moves a different one to a dated folder listed in the summary", async () => {
    await sourceLibrary();
    await write(agents("beta"), "beta");
    await write(agents("alpha"), "alpha", "My own edits");
    await mkdir(claude(), { recursive: true });
    await symlink(agents("alpha"), claude("alpha"), "dir");

    const summary = await restorer().restore(remote);

    const aside = join(home, ".afk/restore-aside/2026-11-05");
    expect(summary.adopted).toEqual(["beta"]);
    expect(summary.movedAside).toEqual([{ name: "alpha", from: agents("alpha"), to: join(aside, ".agents/skills/alpha") }]);
    expect(await readFile(join(aside, ".agents/skills/alpha/SKILL.md"), "utf8")).toContain("My own edits");
    expect(await readlink(agents("alpha"))).toBe(library().skillPath("alpha"));
    expect(await readlink(claude("alpha"))).toBe(library().skillPath("alpha"));
    expect(await readlink(agents("beta"))).toBe(library().skillPath("beta"));
    expect(await present(join(aside, ".agents/skills/beta"))).toBe(false);
  });

  it("moves aside a local copy edited after an earlier Manual/Automatic change instead of treating it as identical", async () => {
    await sourceLibrary();
    await write(agents("beta"), "beta");
    await writeInvocationChoice(agents("beta"), "Manual only");
    await writeFile(agents("beta/SKILL.md"), skill("beta", "UNIQUE LOCAL EDIT"));

    const summary = await restorer().restore(remote);

    expect(summary.adopted).toEqual([]);
    expect(summary.movedAside.map(move => move.name)).toEqual(["beta"]);
    expect(await readFile(join(summary.movedAside[0]!.to, "SKILL.md"), "utf8")).toContain("UNIQUE LOCAL EDIT");
  });

  it("adopts a local copy whose only difference is AFK's Manual/Automatic change", async () => {
    await sourceLibrary();
    await write(agents("beta"), "beta");
    await writeInvocationChoice(agents("beta"), "Manual only");

    const summary = await restorer().restore(remote);

    expect(summary.adopted).toEqual(["beta"]);
    expect(summary.movedAside).toEqual([]);
  });

  it("removes a broken link that sat where a Core skill goes", async () => {
    await sourceLibrary();
    await mkdir(agents(), { recursive: true });
    await symlink(join(home, "gone"), agents("beta"), "dir");

    const summary = await restorer().restore(remote);

    expect(summary.movedAside).toEqual([]);
    expect(await readlink(agents("beta"))).toBe(library().skillPath("beta"));
  });
});

describe("going back to an older save", () => {
  async function dropBeta(): Promise<Backup> {
    const backup = new Backup(library());
    await library().change("Drop beta", async () => {
      await rm(library().skillPath("beta"), { recursive: true });
      const settings = (await library().readSettings())!;
      await library().writeSettings({ ...settings, core: [{ source: "owner/repo", skills: ["alpha"] }] });
    });
    await library().unlink("beta");
    return backup;
  }

  it("links the skills the older save brings back and unlinks the ones it removes", async () => {
    await sourceLibrary();
    await restorer().restore(remote);
    const backup = await dropBeta();
    const [dropped, original] = (await backup.history()).map(entry => entry.id);
    expect(await present(agents("beta"))).toBe(false);

    await backup.goBack(original!);
    expect(await readlink(agents("beta"))).toBe(library().skillPath("beta"));
    expect(await readlink(claude("beta"))).toBe(library().skillPath("beta"));

    await backup.goBack(dropped!);
    expect(await present(agents("beta"))).toBe(false);
    expect(await present(claude("beta"))).toBe(false);
    expect(await readlink(agents("alpha"))).toBe(library().skillPath("alpha"));
  });

  it("does not turn on a skill the user turned off for reasons the older save has nothing to do with", async () => {
    await sourceLibrary();
    await restorer().restore(remote);
    const backup = await dropBeta();
    const [, original] = (await backup.history()).map(entry => entry.id);
    await library().unlink("alpha");

    await backup.goBack(original!);

    expect(await readlink(agents("beta"))).toBe(library().skillPath("beta"));
    expect(await present(agents("alpha"))).toBe(false);
  });

  it("moves a different local copy aside when the older save brings its name back", async () => {
    await sourceLibrary();
    await restorer().restore(remote);
    const backup = await dropBeta();
    const [, original] = (await backup.history()).map(entry => entry.id);
    await write(agents("beta"), "beta", "Written while it was gone");

    await backup.goBack(original!);

    expect(await readlink(agents("beta"))).toBe(library().skillPath("beta"));
    expect(await readFile(join(home, ".afk/restore-aside", (await readdir(join(home, ".afk/restore-aside")))[0]!, ".agents/skills/beta/SKILL.md"), "utf8")).toContain("Written while it was gone");
  });
});

describe("tools after a restore", () => {
  let operations: FieldworkOperations;
  beforeEach(() => { operations = new FieldworkOperations(store); });
  afterEach(async () => { await operations.close(); });

  it("keeps the tool skills' choices, applies the saved agent folders and runs no tool by itself", async () => {
    await sourceLibrary();

    const summary = await restorer().restore(remote);

    expect(summary.folders).toEqual([agents(), claude(), join(home, ".cursor/skills")]);
    expect(await readlink(join(home, ".cursor/skills/alpha"))).toBe(library().skillPath("alpha"));
    expect(summary.tools.map(tool => [tool.id, tool.name, tool.provides])).toEqual([[1, "Wizard", ["wiz"]], [2, "Other", ["other"]]]);
    expect((await store.read()).preferences["Global|wiz"]).toBe("Manual only");
    expect(await present(agents("wiz"))).toBe(false);
    expect(await present(agents("other"))).toBe(false);
  });

  it("applies the saved choice and links the skill into every enabled folder after a ticked tool runs", async () => {
    await sourceLibrary();
    await restorer().restore(remote);

    const result = await operations.run("tool/run", { id: 1 }) as { code: number; reapplied: string[] };

    expect(result).toMatchObject({ code: 0, reapplied: ["wiz"] });
    expect(await readFile(agents("wiz/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await readlink(claude("wiz"))).toBe(agents("wiz"));
    expect(await readlink(join(home, ".cursor/skills/wiz"))).toBe(agents("wiz"));
    expect(await present(agents("other"))).toBe(false);
  });
});

describe("tool skills and the enabled agent folders", () => {
  let operations: FieldworkOperations;
  beforeEach(() => { operations = new FieldworkOperations(store); });
  afterEach(async () => { await operations.close(); });

  it("links only into enabled folders, and turning the skill off and on follows them", async () => {
    await sourceLibrary();
    await restorer().restore(remote);
    await library().changeAgentFolders("Drop Claude", { enabled: ["~/.cursor/skills"], custom: [] });
    await operations.run("tool/run", { id: 1 });

    expect(await readlink(join(home, ".cursor/skills/wiz"))).toBe(agents("wiz"));
    expect(await present(claude("wiz"))).toBe(false);

    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    expect(await present(agents("wiz"))).toBe(false);
    expect(await present(join(home, ".cursor/skills/wiz"))).toBe(false);
    expect(await present(join(home, ".afk/off/wiz/SKILL.md"))).toBe(true);

    await operations.run("skill/toggle", { name: "wiz", scope: "Global" });
    expect(await readlink(join(home, ".cursor/skills/wiz"))).toBe(agents("wiz"));
  });
});

describe("choosing a repository", () => {
  const listing = JSON.stringify([
    { nameWithOwner: "leo/dotfiles", url: "https://github.com/leo/dotfiles", isPrivate: true, pushedAt: "2026-11-04T10:00:00Z" },
    { nameWithOwner: "leo/afk-library", url: "https://github.com/leo/afk-library", isPrivate: true, pushedAt: "2026-11-01T10:00:00Z" },
  ]);

  it("lists repositories through the GitHub CLI with likely libraries first", async () => {
    const runner = async (spec: CommandSpec): Promise<CommandResult> => { ghCalls.push(spec); return { code: 0, output: listing, cancelled: false }; };

    const repositories = await restorer(runner).repositories();

    expect(repositories.map(repository => repository.name)).toEqual(["leo/afk-library", "leo/dotfiles"]);
    expect(repositories[0]).toMatchObject({ url: "https://github.com/leo/afk-library.git", private: true });
    expect(ghCalls.map(call => [call.command, call.args[0]])).toEqual([["gh", "repo"]]);
  });

  it("says how to continue when the GitHub CLI is missing or signed out", async () => {
    await expect(restorer().repositories()).rejects.toThrow(/gh auth login, or paste a repository URL/);
  });

  it("asks to sign in, once, when the GitHub CLI is signed out", async () => {
    const signedOut = "To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.";
    const runner = async (): Promise<CommandResult> => ({ code: 4, output: signedOut, cancelled: false });

    const message = await restorer(runner).repositories().then(() => "", (error: Error) => error.message);

    expect(message).toBe("Sign in to the GitHub CLI with gh auth login to list your repositories, or paste a repository URL instead.");
  });

  it("restores from a pasted owner/repo by asking GitHub, never a local path", async () => {
    const seen: string[][] = [];
    const runner = async (spec: CommandSpec): Promise<CommandResult> => { seen.push(spec.args); return spec.args.includes("fetch") ? { code: 128, output: "stopped here", cancelled: false } : runCommand(spec); };

    await expect(restorer(runner).restore("leo/afk-library")).rejects.toThrow(/Could not reach/);

    expect(seen.flat()).toContain("https://github.com/leo/afk-library.git");
  });
});

describe("restore operations", () => {
  let operations: FieldworkOperations;
  beforeEach(() => { operations = new FieldworkOperations(store); });
  afterEach(async () => { await operations.close(); });

  it("inspects, restores and reports the tools to choose from without running any", async () => {
    await sourceLibrary();

    expect(await operations.run("restore/inspect", { repository: remote })).toMatchObject({ coreSkills: 2, packs: 1, tools: 2 });
    const summary = await operations.run("restore/start", { repository: remote }) as { linked: string[]; tools: { id: number }[] };

    expect(summary.linked).toEqual(["alpha", "beta"]);
    expect(summary.tools.map(tool => tool.id)).toEqual([1, 2]);
    expect(await present(agents("wiz"))).toBe(false);
    const state = await operations.run("backup/state", { brief: true }) as { status: { library: boolean; state: string } };
    expect(state.status).toMatchObject({ library: true, state: "saved" });
  });

  it("lists repositories through the GitHub CLI and refuses a repository that is not a library", async () => {
    operations.restoreRunner = async spec => spec.command === "gh" ? { code: 0, output: "[]", cancelled: false } : runCommand(spec);

    expect(await operations.run("restore/repositories")).toEqual([]);
    await expect(operations.run("restore/inspect", { repository: join(sourceHome, "nothing.git") })).rejects.toThrow(/Could not reach/);
    await expect(operations.run("restore/start", {})).rejects.toThrow(/repository/);
  });

  it("cancels a running restore and leaves no library", async () => {
    await sourceLibrary();
    operations.restoreRunner = async spec => {
      if (!spec.args.includes("clone")) return runCommand(spec);
      await operations.run("restore/cancel");
      return { code: 130, output: "", cancelled: true };
    };

    await expect(operations.run("restore/start", { repository: remote })).rejects.toThrow(/cancelled/);

    expect(await present(library().root)).toBe(false);
    expect(await operations.run("restore/cancel")).toEqual({ cancelled: false, reason: "No restore is running." });
  });
});

describe("afk library connect", () => {
  const lines: string[] = [];
  beforeEach(() => {
    lines.length = 0;
    vi.stubEnv("AFK_SETTINGS", undefined);
    vi.spyOn(console, "log").mockImplementation((value: unknown) => { lines.push(String(value)); });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("restores, lists the tools and runs none unless they are named", async () => {
    await sourceLibrary();

    expect(await runFieldwork(["library", "connect", remote], store)).toBe(0);

    expect(await readlink(agents("alpha"))).toBe(library().skillPath("alpha"));
    expect(lines.join("\n")).toMatch(/Wizard.*wiz/);
    expect(lines.join("\n")).toMatch(/--run-tools/);
    expect(await present(agents("wiz"))).toBe(false);
  });

  it("runs the tools named with --run-tools and applies their choices", async () => {
    await sourceLibrary();

    expect(await runFieldwork(["library", "connect", remote, "--run-tools", "1"], store)).toBe(0);

    expect(await readFile(agents("wiz/SKILL.md"), "utf8")).toContain("disable-model-invocation: true");
    expect(await present(agents("other"))).toBe(false);
  });

  it("refuses a repository that is not a library with a clear message", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((value: unknown) => { errors.push(String(value)); });

    expect(await runFieldwork(["library", "connect", join(sourceHome, "nothing.git")], store)).toBe(1);

    expect(errors.join("\n")).toMatch(/Could not reach/);
    expect(await present(library().root)).toBe(false);
  });
});
