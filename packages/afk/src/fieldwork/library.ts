import { AsyncLocalStorage } from "node:async_hooks";
import { lstat, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runCommand, type CommandSpec } from "./command-runner.js";
import { DEFAULT_ENABLED, expandHome, SHARED_FOLDER, type AgentFolderSettings } from "./agent-folders.js";
import { sameSkillName, skillName, type KitSource, type RulesDestination } from "./settings.js";

export type InvocationChoice = "" | "Manual only" | "Automatic allowed";

export interface SkillRecord {
  source?: string;
  skillPath?: string;
  revision?: string;
  invocation: InvocationChoice;
  /** Set once the user edited a skill that updates from its repository: stopped keeps their version, replace lets updates overwrite it. */
  updates?: "stopped" | "replace";
}

export interface LibrarySettings {
  version: 1;
  configurationId?: string;
  core: KitSource[];
  agentRules?: { destinations: RulesDestination[] };
  welcomeDismissed?: true;
  agentFolders?: AgentFolderSettings;
}

interface PendingLink { path: string; target: string }

export type GitRunner = (spec: CommandSpec) => Promise<{ code: number; output: string }>;

const queues = new Map<string, Promise<unknown>>();
interface ChangeContext { root: string; undo: (() => Promise<unknown>)[]; after: (() => Promise<unknown>)[] }
const changing = new AsyncLocalStorage<ChangeContext>();

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

export function packCacheRoot(home: string): string {
  return join(home, ".afk/packs-cache");
}

export function machineRoot(home: string): string {
  return join(home, ".afk/machine");
}

export type Storage = "library" | "pack" | "machine";

async function entries(folder: string): Promise<string[]> {
  try { return await readdir(folder); }
  catch (error) { if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return []; throw error; }
}

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
    for (const storage of ["pack", "machine"] as const) {
      const path = this.storagePath(name, storage);
      if (await exists(join(path, "SKILL.md")) && (await entries(dirname(path))).includes(name)) return storage;
    }
    return undefined;
  }

  /** A stored skill whose name differs from this one only in letter case, which a case-folding disk would treat as the same folder. */
  async caseTwin(name: string): Promise<string | undefined> {
    const stored = [
      ...await this.names(),
      ...await entries(packCacheRoot(this.home)),
      ...await entries(machineRoot(this.home)),
      ...(await entries(join(this.root, ".afk/skills"))).filter(file => file.endsWith(".json")).map(file => file.slice(0, -5)),
    ];
    return stored.find(other => other !== name && skillName(other) && sameSkillName(other, name));
  }

  async location(name: string): Promise<string | undefined> {
    const storage = await this.storage(name);
    return storage && this.storagePath(name, storage);
  }

  async exists(): Promise<boolean> {
    return exists(join(this.root, ".git"));
  }

  async has(name: string): Promise<boolean> {
    return skillName(name) && await this.exists() && await exists(join(this.skillPath(name), "SKILL.md")) && (await this.names()).includes(name);
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

  async removeRecord(name: string): Promise<void> {
    await rm(this.recordPath(name), { force: true });
  }

  async writeSettings(settings: LibrarySettings): Promise<void> {
    await this.writeJson(join(this.root, ".afk/settings.json"), settings);
  }

  /** Runs one library change as exactly one commit; a failure restores the working tree to the last commit. A change made inside another joins its commit. */
  change<T>(message: string, mutate: () => Promise<T>): Promise<T> {
    if (changing.getStore()?.root === this.root) return mutate();
    return this.enqueue(() => this.commitChange(message, mutate));
  }

  /** Inside a change: undoes work outside the repository if the outermost change fails, newest step first. */
  onRollback(step: () => Promise<unknown>): void {
    this.context().undo.push(step);
  }

  /** Inside a change: runs once the outermost change has committed, such as removing copies kept for a rollback. */
  afterCommit(step: () => Promise<unknown>): void {
    this.context().after.push(step);
  }

  private context(): ChangeContext {
    const context = changing.getStore();
    if (context?.root !== this.root) throw new Error("This step runs only inside a library change.");
    return context;
  }

  /** Paths whose files differ from the last commit, as the library itself would list them. */
  dirtyPaths(): Promise<string[]> {
    return this.enqueue(async () => {
      if (!await this.exists()) return [];
      const output = await this.gitOutput("Checking the library", "status", "--porcelain", "-z", "-uall", "--no-renames");
      return output.split("\0").filter(entry => entry.length > 3).map(entry => entry.slice(3));
    });
  }

  /** Commits exactly these paths, leaving every other change in the library alone. */
  commitPaths(message: string, paths: string[], prepare?: () => Promise<void>): Promise<void> {
    return this.enqueue(async () => {
      await prepare?.();
      await this.git("Saving the library", "--literal-pathspecs", "add", "-A", "--", ...paths);
      await this.git("Saving the library", "commit", "--quiet", "--no-verify", "-m", message);
    });
  }

  /** Puts these paths back to how the last commit has them; no commit is made. */
  restorePaths(paths: string[]): Promise<void> {
    return this.enqueue(async () => {
      await this.git("Restoring the library", "--literal-pathspecs", "clean", "-fdq", "--", ...paths);
      const tracked = (await this.git("Restoring the library", "--literal-pathspecs", "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", ...paths)).split("\0").filter(Boolean);
      if (tracked.length) await this.git("Restoring the library", "--literal-pathspecs", "checkout", "HEAD", "--", ...tracked);
    });
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

  /** Where AFK links a stored skill: one path in each folder from `folders()`. */
  async links(name: string): Promise<string[]> {
    return (await this.folders()).map(folder => join(folder, name));
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
  /** Returns the links it created; links that were already there are left out. */
  async link(name: string): Promise<string[]> {
    return this.createLinks(await this.pendingLinks(await this.folders(), [name]));
  }

  /** Removes only AFK's own links to a stored skill; the stored files never move. */
  async unlink(name: string): Promise<void> {
    for (const path of await this.links(name)) if (await this.isOwnLink(path, name)) await rm(path);
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
      const dropped: PendingLink[] = [];
      try {
        for (const folder of removed) for (const name of on) {
          const path = join(folder, name);
          if (!await this.isOwnLink(path, name)) continue;
          const target = resolve(dirname(path), await readlink(path));
          await rm(path);
          dropped.push({ path, target });
        }
        await this.createLinks(created);
      } catch (error) {
        for (const { path, target } of dropped) await symlink(target, path, "dir");
        throw error;
      }
    });
  }

  /** Every skill AFK stores in the library, the pack cache or machine storage. */
  async storedNames(): Promise<string[]> {
    const names = new Set(await this.names());
    for (const root of [packCacheRoot(this.home), machineRoot(this.home)]) {
      try { for (const name of await readdir(root)) if (await this.storage(name)) names.add(name); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return [...names].sort();
  }

  private async onNames(): Promise<string[]> {
    const on: string[] = [];
    for (const name of await this.storedNames()) if (await this.linked(name)) on.push(name);
    return on;
  }

  private async identity(folder: string): Promise<string> {
    try { return await realpath(folder); } catch { return folder; }
  }

  private async pendingLinks(folders: string[], names: string[], already: string[] = []): Promise<PendingLink[]> {
    const targets = new Map<string, string>();
    for (const name of names) {
      const target = await this.location(name);
      if (!target) throw new Error(`${name} is not stored by AFK.`);
      targets.set(name, target);
    }
    const seen = new Set<string>();
    for (const folder of already) seen.add(await this.identity(folder));
    const pending: PendingLink[] = [];
    for (const folder of folders) {
      const identity = await this.identity(folder);
      if (seen.has(identity)) continue;
      seen.add(identity);
      for (const name of names) {
        const path = join(folder, name);
        if (await this.isOwnLink(path, name)) continue;
        if (await exists(path)) throw new Error(`${path} already exists. Existing files were preserved.`);
        pending.push({ path, target: targets.get(name)! });
      }
    }
    return pending;
  }

  private async createLinks(pending: PendingLink[]): Promise<string[]> {
    const created: string[] = [];
    try {
      for (const { path, target } of pending) {
        await mkdir(dirname(path), { recursive: true });
        await symlink(target, path, "dir");
        created.push(path);
      }
    } catch (error) {
      for (const path of created) await rm(path, { force: true });
      throw error;
    }
    return created;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    if (changing.getStore()?.root === this.root) return work();
    const next = (queues.get(this.root) ?? Promise.resolve()).then(() => changing.run({ root: this.root, undo: [], after: [] }, work));
    queues.set(this.root, next.catch(() => undefined));
    return next;
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
    const context = this.context();
    let result: T;
    try {
      result = await mutate();
      await this.commit(message);
    } catch (error) {
      for (const step of context.undo.splice(0).reverse()) await step().catch(() => undefined);
      context.after.length = 0;
      await this.git("Restoring the library", "reset", "--hard", "--quiet", "HEAD");
      await this.git("Restoring the library", "clean", "-fd", "--quiet");
      throw error;
    }
    context.undo.length = 0;
    for (const step of context.after.splice(0)) await step().catch(() => undefined);
    return result;
  }

  private async commit(message: string): Promise<void> {
    await this.git("Saving the library", "add", "-A");
    if (!await this.git("Saving the library", "status", "--porcelain")) return;
    await this.git("Saving the library", "commit", "--quiet", "--no-verify", "-m", message);
  }

  private async git(step: string, ...args: string[]): Promise<string> {
    return (await this.gitOutput(step, ...args)).trim();
  }

  private async gitOutput(step: string, ...args: string[]): Promise<string> {
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
    return result.output;
  }
}
