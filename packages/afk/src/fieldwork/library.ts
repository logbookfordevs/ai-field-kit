import { AsyncLocalStorage } from "node:async_hooks";
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runCommand, type CommandSpec } from "./command-runner.js";
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
  configurationId?: string;
  core: KitSource[];
  agentRules?: { destinations: RulesDestination[] };
  welcomeDismissed?: true;
}

export type GitRunner = (spec: CommandSpec) => Promise<{ code: number; output: string }>;

const queues = new Map<string, Promise<unknown>>();
const changing = new AsyncLocalStorage<string>();

const GITIGNORE = ".DS_Store\nThumbs.db\n.afk-*\nnode_modules/\n";

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

/** Folders AFK links every skill that is on into. Ticket 12 makes this list configurable. */
export function agentSkillFolders(home: string): string[] {
  return [join(home, ".agents/skills"), join(home, ".claude/skills")];
}

export function libraryRoot(home: string): string {
  return join(home, ".afk/library");
}

export function packCacheRoot(home: string): string {
  return join(home, ".afk/packs-cache");
}

export function machineRoot(home: string): string {
  return join(home, ".afk/machine");
}

export type Storage = "library" | "pack" | "machine";

/** AFK's own Git repository of Core skills, their `.afk` records and small settings. */
export class Library {
  readonly root: string;

  constructor(readonly home: string, private readonly runner: GitRunner = runCommand) {
    this.root = libraryRoot(home);
  }

  skillPath(name: string): string {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    return join(this.root, "skills", name);
  }

  storagePath(name: string, storage: Storage): string {
    if (storage === "library") return this.skillPath(name);
    if (!skillName(name)) throw new Error("Invalid skill name.");
    return join(storage === "pack" ? packCacheRoot(this.home) : machineRoot(this.home), name);
  }

  /** Where AFK keeps its one copy of a skill: the library, the pack cache or machine storage. */
  async storage(name: string): Promise<Storage | undefined> {
    if (!skillName(name)) return undefined;
    if (await this.has(name)) return "library";
    for (const storage of ["pack", "machine"] as const) if (await exists(join(this.storagePath(name, storage), "SKILL.md"))) return storage;
    return undefined;
  }

  async location(name: string): Promise<string | undefined> {
    const storage = await this.storage(name);
    return storage && this.storagePath(name, storage);
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

  /** Runs one library change as exactly one commit; a failure restores the working tree to the last commit. A change made inside another joins its commit. */
  change<T>(message: string, mutate: () => Promise<T>): Promise<T> {
    if (changing.getStore() === this.root) return mutate();
    const next = (queues.get(this.root) ?? Promise.resolve()).then(() => changing.run(this.root, () => this.commitChange(message, mutate)));
    queues.set(this.root, next.catch(() => undefined));
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

  async linked(name: string): Promise<boolean> {
    return this.isOwnLink(this.links(name)[0]!, name);
  }

  /** Links a stored skill into every agent folder; an occupied destination stops before anything changes. */
  async link(name: string): Promise<void> {
    const target = await this.location(name);
    if (!target) throw new Error(`${name} is not stored by AFK.`);
    const pending: string[] = [];
    for (const path of await this.distinctLinks(name)) {
      if (await this.isOwnLink(path, name)) continue;
      if (await exists(path)) throw new Error(`${path} already exists. Existing files were preserved.`);
      pending.push(path);
    }
    const created: string[] = [];
    try {
      for (const path of pending) {
        await mkdir(dirname(path), { recursive: true });
        await symlink(target, path, "dir");
        created.push(path);
      }
    } catch (error) {
      for (const path of created) await rm(path, { force: true });
      throw error;
    }
  }

  /** Removes only AFK's own links to a stored skill; the stored files never move. */
  async unlink(name: string): Promise<void> {
    for (const path of this.links(name)) if (await this.isOwnLink(path, name)) await rm(path);
  }

  private async distinctLinks(name: string): Promise<string[]> {
    const seen = new Set<string>(), result: string[] = [];
    for (const folder of agentSkillFolders(this.home)) {
      let identity = folder;
      try { identity = await realpath(folder); } catch { /* A missing folder is created when linking. */ }
      if (seen.has(identity)) continue;
      seen.add(identity);
      result.push(join(folder, name));
    }
    return result;
  }

  private async isOwnLink(path: string, name: string): Promise<boolean> {
    try {
      if (!(await lstat(path)).isSymbolicLink()) return false;
      const target = resolve(dirname(path), await readlink(path));
      return (["library", "pack", "machine"] as const).some(storage => target === this.storagePath(name, storage));
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
