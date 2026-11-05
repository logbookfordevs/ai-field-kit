import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { runCommand, type CommandSpec } from "./command-runner.js";
import { DEFAULT_ENABLED, expandHome, SHARED_FOLDER, type AgentFolderSettings } from "./agent-folders.js";
import { skillName, type KitSource, type RulesDestination } from "./settings.js";

export type InvocationChoice = "" | "Manual only" | "Automatic allowed";

export interface SkillRecord {
  source?: string;
  skillPath?: string;
  revision?: string;
  invocation: InvocationChoice;
}

export interface LibrarySettings {
  version: 1;
  core: KitSource[];
  agentRules: { destinations: RulesDestination[] };
  agentFolders?: AgentFolderSettings;
}

export type GitRunner = (spec: CommandSpec) => Promise<{ code: number; output: string }>;

const GITIGNORE = ".DS_Store\nThumbs.db\n.afk-*\nnode_modules/\n";

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

/** The folders a new library links into until the user changes them: the shared folder and Claude Code's. */
export function agentSkillFolders(home: string): string[] {
  return [join(home, ".agents/skills"), join(home, ".claude/skills")];
}

export function libraryRoot(home: string): string {
  return join(home, ".afk/library");
}

/** AFK's own Git repository of Core skills, their `.afk` records and small settings. */
export class Library {
  readonly root: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(readonly home: string, private readonly runner: GitRunner = runCommand) {
    this.root = libraryRoot(home);
  }

  skillPath(name: string): string {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    return join(this.root, "skills", name);
  }

  async exists(): Promise<boolean> {
    return exists(join(this.root, ".git"));
  }

  async has(name: string): Promise<boolean> {
    return skillName(name) && await this.exists() && await exists(join(this.skillPath(name), "SKILL.md"));
  }

  async names(): Promise<string[]> {
    if (!await this.exists()) return [];
    try { return (await readdir(join(this.root, "skills"))).filter(name => skillName(name)).sort(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  async record(name: string): Promise<SkillRecord | undefined> {
    try { return JSON.parse(await readFile(this.recordPath(name), "utf8")) as SkillRecord; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  }

  async writeRecord(name: string, record: SkillRecord): Promise<void> {
    await this.writeJson(this.recordPath(name), record);
  }

  async writeSettings(settings: LibrarySettings): Promise<void> {
    await this.writeJson(join(this.root, ".afk/settings.json"), settings);
  }

  /** Runs one library change as exactly one commit; a failure restores the working tree to the last commit. */
  change<T>(message: string, mutate: () => Promise<T>): Promise<T> {
    const next = this.queue.then(() => this.commitChange(message, mutate));
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Creates the repository and its first commit; a failure removes everything it wrote. */
  async create<T>(message: string, populate: () => Promise<T>): Promise<T> {
    if (await exists(this.root)) throw new Error(`${this.root} already exists. AFK starts a library only in an empty location.`);
    try {
      await mkdir(this.root, { recursive: true });
      await this.git("Creating the library", "init", "--quiet", "--initial-branch=main");
      await writeFile(join(this.root, ".gitignore"), GITIGNORE);
      const result = await populate();
      await this.commit(message);
      return result;
    } catch (error) {
      await rm(this.root, { recursive: true, force: true });
      throw error;
    }
  }

  links(name: string): string[] {
    return agentSkillFolders(this.home).map(folder => join(folder, name));
  }

  async readSettings(): Promise<LibrarySettings | undefined> {
    try { return JSON.parse(await readFile(join(this.root, ".afk/settings.json"), "utf8")) as LibrarySettings; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  }

  async agentFolders(): Promise<AgentFolderSettings> {
    const saved = (await this.readSettings())?.agentFolders;
    return { enabled: saved?.enabled ?? [...DEFAULT_ENABLED], custom: saved?.custom ?? [] };
  }

  /** Every folder AFK links into: the shared folder, then the enabled ones, as absolute paths. */
  async folders(): Promise<string[]> {
    const { enabled } = await this.agentFolders();
    return [SHARED_FOLDER, ...enabled.filter(path => path !== SHARED_FOLDER)].map(path => expandHome(this.home, path));
  }

  async linked(name: string): Promise<boolean> {
    return this.isOwnLink(join(expandHome(this.home, SHARED_FOLDER), name), name);
  }

  /** Links a stored skill into every enabled folder; an occupied destination stops before anything changes. */
  async link(name: string): Promise<void> {
    await this.createLinks(await this.pendingLinks(await this.folders(), [name]));
  }

  /** Removes only AFK's own links to a stored skill; the stored files never move. */
  async unlink(name: string): Promise<void> {
    for (const folder of await this.folders()) {
      const path = join(folder, name);
      if (await this.isOwnLink(path, name)) await rm(path);
    }
  }

  /** Saves the enabled folders and links or unlinks every skill that is on, as one commit. */
  async changeAgentFolders(message: string, next: AgentFolderSettings): Promise<void> {
    await this.change(message, async () => {
      const before = await this.folders();
      const settings = await this.readSettings();
      if (!settings) throw new Error("The library has no settings yet.");
      await this.writeSettings({ ...settings, agentFolders: next });
      const after = await this.folders();
      const on = await this.onNames();
      const removed = before.filter(folder => !after.includes(folder));
      const added = after.filter(folder => !before.includes(folder));
      const created = await this.pendingLinks(added, on, before.filter(folder => after.includes(folder)));
      const dropped: string[] = [];
      try {
        for (const folder of removed) for (const name of on) {
          const path = join(folder, name);
          if (await this.isOwnLink(path, name)) { await rm(path); dropped.push(path); }
        }
        await this.createLinks(created);
      } catch (error) {
        for (const path of dropped) await symlink(this.skillPath(basename(path)), path, "dir");
        throw error;
      }
    });
  }

  private async onNames(): Promise<string[]> {
    const on: string[] = [];
    for (const name of await this.names()) if (await this.linked(name)) on.push(name);
    return on;
  }

  private async identity(folder: string): Promise<string> {
    try { return await realpath(folder); } catch { return folder; }
  }

  private async pendingLinks(folders: string[], names: string[], already: string[] = []): Promise<string[]> {
    const seen = new Set<string>();
    for (const folder of already) seen.add(await this.identity(folder));
    const pending: string[] = [];
    for (const folder of folders) {
      const identity = await this.identity(folder);
      if (seen.has(identity)) continue;
      seen.add(identity);
      for (const name of names) {
        const path = join(folder, name);
        if (await this.isOwnLink(path, name)) continue;
        if (await exists(path)) throw new Error(`${path} already exists. Existing files were preserved.`);
        pending.push(path);
      }
    }
    return pending;
  }

  private async createLinks(pending: string[]): Promise<void> {
    const created: string[] = [];
    try {
      for (const path of pending) {
        await mkdir(dirname(path), { recursive: true });
        await symlink(this.skillPath(basename(path)), path, "dir");
        created.push(path);
      }
    } catch (error) {
      for (const path of created) await rm(path, { force: true });
      throw error;
    }
  }

  private async isOwnLink(path: string, name: string): Promise<boolean> {
    try {
      if (!(await lstat(path)).isSymbolicLink()) return false;
      return resolve(dirname(path), await readlink(path)) === this.skillPath(name);
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
      throw error;
    }
  }

  private recordPath(name: string): string {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    return join(this.root, ".afk/skills", `${name}.json`);
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
    await rename(temporary, path);
  }

  private async commitChange<T>(message: string, mutate: () => Promise<T>): Promise<T> {
    if (!await this.exists()) throw new Error("Start a library first with `afk library init`.");
    if (await this.git("Checking the library", "status", "--porcelain")) throw new Error("The library has changes AFK did not make. Review them before changing it.");
    try {
      const result = await mutate();
      await this.commit(message);
      return result;
    } catch (error) {
      await this.git("Restoring the library", "reset", "--hard", "--quiet", "HEAD");
      await this.git("Restoring the library", "clean", "-fd", "--quiet");
      throw error;
    }
  }

  private async commit(message: string): Promise<void> {
    await this.git("Saving the library", "add", "-A");
    if (!await this.git("Saving the library", "status", "--porcelain")) return;
    await this.git("Saving the library", "commit", "--quiet", "--no-verify", "-m", message);
  }

  private async git(step: string, ...args: string[]): Promise<string> {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: this.home,
      GIT_CONFIG_GLOBAL: join(this.home, ".gitconfig"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_AUTHOR_NAME: "AFK",
      GIT_AUTHOR_EMAIL: "afk@localhost",
      GIT_COMMITTER_NAME: "AFK",
      GIT_COMMITTER_EMAIL: "afk@localhost",
    };
    const result = await this.runner({ command: "git", args: ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], step, cwd: this.root, env, timeoutMs: 60_000 });
    if (result.code !== 0) throw new Error(`${step} failed: ${result.output.trim().split("\n").at(-1) ?? `git exited with ${result.code}`}`);
    return result.output.trim();
  }
}
