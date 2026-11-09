import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command-runner.js";
import { LocalChecks } from "./library-checks.js";
import type { GitRunner, Library } from "./library.js";
import { coreNames, deployLibrary, type DeploySummary } from "./library-deploy.js";
import { libraryUntouched } from "./library-settings.js";
import { pendingRestore } from "./restore-pending.js";

export type BackupState = "off" | "saved" | "waiting" | "failed";

export interface BackupStatus {
  library: boolean;
  state: BackupState;
  remote?: string;
  waiting: number;
  attention: number;
  held: boolean;
  lastSavedAt?: number;
  error?: string;
  pushing: boolean;
  /** The repository of a restore that put the library in place but has not finished linking it. */
  restoring?: string;
  /** The library AFK started by itself, with nothing in it and no backup yet. */
  fresh?: true;
}

export interface SaveEntry { id: string; at: number; message: string; pushed: boolean }

export interface BackupContents {
  coreSkills: number;
  skillBytes: number;
  packs: number;
  tools: number;
  bookmarks: number;
  choices: number;
  rules: boolean;
}

interface BackupMemory { lastSavedAt?: number; error?: string }

export interface BackupOptions {
  signal?: AbortSignal | undefined;
  now?: (() => number) | undefined;
  isOn?: ((name: string) => Promise<boolean>) | undefined;
}

const REMOTE = "origin";
const HISTORY_LIMIT = 200;

/** Refuses anything that would put a secret in `.git/config` or be read by Git as an option. */
export function checkRemoteUrl(value: string): string {
  const url = value.trim();
  if (!url || /\s/.test(url) || url.startsWith("-")) throw new Error("Provide a Git remote URL, such as git@github.com:owner/repo.git.");
  const scheme = /^([a-z][a-z0-9+.-]*):\/\/([^/]*)/i.exec(url);
  const authority = scheme?.[2] ?? "";
  const at = authority.lastIndexOf("@");
  if (scheme && at >= 0 && (authority.slice(0, at).includes(":") || /^https?$/i.test(scheme[1]!))) {
    throw new Error("Remove the password or token from the URL. AFK stores no credentials; Git uses its own sign-in.");
  }
  return url;
}

function repositoryName(value: string): string {
  const name = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error("Name the repository with letters, numbers, dots, dashes or underscores.");
  return name;
}

function failure(output: string): string {
  const lines = output.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("hint:"));
  return lines.slice(-2).join(" ") || "Git could not reach the remote.";
}

/** Saving the library to a Git remote. Git's own credentials are used; AFK never stores or passes a token. */
export class Backup {
  readonly checks: LocalChecks;
  private pushing: Promise<BackupStatus> | undefined;
  private readonly now: () => number;

  constructor(private readonly library: Library, private readonly runner: GitRunner = runCommand, private readonly options: BackupOptions = {}) {
    this.now = options.now ?? Date.now;
    this.checks = new LocalChecks(library, options.isOn ?? (async () => false));
  }

  async status(): Promise<BackupStatus> {
    if (!await this.library.exists()) return { library: false, state: "off", waiting: 0, attention: 0, held: false, pushing: false };
    const remote = await this.remoteUrl(), memory = await this.memory(), pushing = this.pushing !== undefined;
    const items = await this.checks.list(), attention = items.length, held = items.some(item => item.kind === "edited");
    const restoring = await pendingRestore(this.library.home);
    const unfinished = { ...(restoring === undefined ? {} : { restoring }), ...(!remote && await libraryUntouched(this.library.home) ? { fresh: true as const } : {}) };
    if (!remote) return { library: true, state: "off", waiting: 0, attention, held, pushing, ...unfinished };
    const waiting = await this.waiting();
    const state: BackupState = waiting === 0 ? "saved" : memory.error ? "failed" : "waiting";
    return { library: true, state, remote, waiting, attention, held, pushing, ...unfinished, ...(memory.lastSavedAt === undefined ? {} : { lastSavedAt: memory.lastSavedAt }), ...(memory.error && waiting > 0 ? { error: memory.error } : {}) };
  }

  /** Points the library at a remote and sends everything saved so far. A failed first push still leaves it connected. */
  async connect(url: string): Promise<BackupStatus> {
    const remote = checkRemoteUrl(url);
    if (!await this.library.exists()) throw new Error("Start a library first with `afk library init`.");
    if (await this.remoteUrl()) await this.git("Disconnecting the old remote", "remote", "remove", REMOTE);
    await this.git("Connecting the remote", "remote", "add", REMOTE, "--", remote);
    await this.remember({});
    return this.saveNow();
  }

  /** Creates a private repository with the GitHub CLI, which uses its own sign-in, then connects it. */
  async createRepository(name: string): Promise<BackupStatus> {
    const repository = repositoryName(name);
    let output: string;
    try {
      const result = await this.runner({ command: "gh", args: ["repo", "create", repository, "--private"], step: "Creating the GitHub repository", cwd: this.library.home, env: { ...this.environment(), GH_PROMPT_DISABLED: "1", NO_COLOR: "1" }, timeoutMs: 60_000, signal: this.options.signal });
      if (result.code !== 0) throw new Error(failure(result.output));
      output = result.output;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      throw new Error(`The GitHub CLI could not create the repository: ${reason}. Install it and run gh auth login, or paste a Git remote URL instead.`);
    }
    const url = output.split("\n").map(line => line.trim()).filter(Boolean).at(-1);
    if (!url) throw new Error("The GitHub CLI did not report the new repository's address.");
    return this.connect(url);
  }

  async disconnect(): Promise<BackupStatus> {
    if (await this.remoteUrl()) await this.git("Disconnecting the remote", "remote", "remove", REMOTE);
    await this.remember({});
    return this.status();
  }

  /** Pushes every waiting commit. A failure keeps them local and is reported in the status. */
  saveNow(): Promise<BackupStatus> {
    this.pushing ??= this.push().finally(() => { this.pushing = undefined; });
    return this.pushing;
  }

  async history(): Promise<SaveEntry[]> {
    if (!await this.library.exists()) return [];
    const log = await this.git("Reading history", "log", `--max-count=${HISTORY_LIMIT}`, "--format=%H%x1f%ct%x1f%s");
    const waiting = new Set(await this.waitingIds());
    return log.split("\n").filter(Boolean).map(line => {
      const [id, at, message] = line.split("\x1f");
      return { id: id!, at: Number(at) * 1000, message: message ?? "", pushed: !waiting.has(id!) };
    });
  }

  /** Restores the library to an earlier save as a new commit, so going back can itself be undone. Skills the save adds or removes are linked or unlinked. */
  async goBack(id: string): Promise<{ changed: boolean; deployed: DeploySummary }> {
    if (!/^[0-9a-f]{7,40}$/i.test(id)) throw new Error("Choose a save from the history.");
    const target = await this.git("Finding the save", "rev-parse", "--verify", "--quiet", `${id}^{commit}`).catch(() => "");
    if (!target || !await this.isAncestor(target)) throw new Error("That is not a save in this library's history.");
    const subject = await this.git("Reading the save", "log", "-1", "--format=%s", target);
    const before = await this.library.names(), coreBefore = await this.onSkills();
    const head = await this.git("Reading the library", "rev-parse", "HEAD");
    await this.library.change(`Went back to "${subject}"`, async () => {
      const folders = await this.library.folders();
      await this.git("Restoring the save", "read-tree", "-u", "--reset", target);
      await this.library.followFolders(folders, await this.library.folders());
    });
    const after = await this.library.names(), coreAfter = await this.onSkills();
    const differs = (first: string[], second: string[]): string[] => [...first.filter(name => !second.includes(name)), ...second.filter(name => !first.includes(name))];
    const deployed = await deployLibrary(this.library, { names: [...new Set([...differs(before, after), ...differs(coreBefore, coreAfter)])].sort() });
    return { changed: await this.git("Reading the library", "rev-parse", "HEAD") !== head, deployed };
  }

  private async onSkills(): Promise<string[]> {
    return coreNames(await this.library.readSettings());
  }

  async contents(): Promise<BackupContents> {
    const result: BackupContents = { coreSkills: 0, skillBytes: 0, packs: 0, tools: 0, bookmarks: 0, choices: 0, rules: false };
    if (!await this.library.exists()) return result;
    const listing = await this.git("Reading the library", "ls-tree", "-r", "-l", "HEAD").catch(() => "");
    const skills = new Set<string>();
    for (const line of listing.split("\n").filter(Boolean)) {
      const [meta, path = ""] = line.split("\t");
      const size = Number(meta!.trim().split(/\s+/)[3]) || 0;
      const folder = /^skills\/([^/]+)\//.exec(path);
      if (folder) { skills.add(folder[1]!); result.skillBytes += size; }
      else if (/^\.afk\/packs\/[^/]+\.json$/.test(path)) result.packs++;
      else if (/^\.afk\/tools\/[^/]+\.json$/.test(path)) result.tools++;
      else if (/^\.afk\/bookmarks\/[^/]+\.json$/.test(path)) result.bookmarks++;
      else if (path === "rules/AGENTS.md") result.rules = true;
    }
    result.coreSkills = skills.size;
    for (const name of skills) { if ((await this.library.record(name).catch(() => undefined))?.invocation) result.choices++; }
    return result;
  }

  async lastChange(): Promise<string> {
    return this.git("Reading the library", "rev-parse", "HEAD");
  }

  async waiting(): Promise<number> {
    return (await this.waitingIds()).length;
  }

  /** Skills whose files or record changed in saves the remote does not have yet. */
  async unpushedSkills(): Promise<string[]> {
    const ids = await this.waitingIds();
    if (!ids.length) return [];
    const tracked = await this.git("Reading the remote", "rev-parse", "--verify", "--quiet", `refs/remotes/${REMOTE}/${await this.git("Reading the branch", "symbolic-ref", "--short", "HEAD")}`).catch(() => "");
    const changed = tracked
      ? await this.git("Reading waiting changes", "diff", "--name-only", `${tracked}..HEAD`)
      : await this.git("Reading waiting changes", "ls-tree", "-r", "--name-only", "HEAD");
    const names = new Set<string>();
    for (const path of changed.split("\n")) {
      const name = /^skills\/([^/]+)\//.exec(path)?.[1] ?? /^\.afk\/skills\/([^/]+)\.json$/.exec(path)?.[1];
      if (name) names.add(name);
    }
    return [...names];
  }

  private async push(): Promise<BackupStatus> {
    const settled = async (): Promise<BackupStatus> => ({ ...await this.status(), pushing: false });
    if (!await this.remoteUrl() || await this.waiting() === 0) return settled();
    try {
      const branch = await this.git("Reading the branch", "symbolic-ref", "--short", "HEAD");
      await this.run("Saving to the remote", ["push", "--quiet", REMOTE, `HEAD:refs/heads/${branch}`], { timeoutMs: 5 * 60_000, idleTimeoutMs: 90_000 });
      await this.remember({ lastSavedAt: this.now() });
    } catch (error) {
      const memory = await this.memory();
      await this.remember({ ...memory, error: error instanceof Error ? error.message : "Saving failed." });
    }
    return settled();
  }

  private async waitingIds(): Promise<string[]> {
    const branch = await this.git("Reading the branch", "symbolic-ref", "--short", "HEAD").catch(() => "");
    if (!branch || !await this.remoteUrl()) return [];
    const tracked = await this.git("Reading the remote", "rev-parse", "--verify", "--quiet", `refs/remotes/${REMOTE}/${branch}`).catch(() => "");
    const out = await this.git("Counting waiting saves", "rev-list", tracked ? `${tracked}..HEAD` : "HEAD");
    return out.split("\n").filter(Boolean);
  }

  private async isAncestor(commit: string): Promise<boolean> {
    const result = await this.runner({ command: "git", args: ["merge-base", "--is-ancestor", commit, "HEAD"], step: "Checking the save", cwd: this.library.root, env: this.environment(), timeoutMs: 30_000 });
    return result.code === 0;
  }

  private async remoteUrl(): Promise<string | undefined> {
    const result = await this.runner({ command: "git", args: ["remote", "get-url", REMOTE], step: "Reading the remote", cwd: this.library.root, env: this.environment(), timeoutMs: 30_000 });
    return result.code === 0 ? result.output.trim() || undefined : undefined;
  }

  private get memoryPath(): string {
    return join(this.library.root, ".git/afk-backup.json");
  }

  private async memory(): Promise<BackupMemory> {
    try { return JSON.parse(await readFile(this.memoryPath, "utf8")) as BackupMemory; } catch { return {}; }
  }

  private async remember(memory: BackupMemory): Promise<void> {
    await mkdir(join(this.library.root, ".git"), { recursive: true });
    const temporary = `${this.memoryPath}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(memory)}\n`);
    await rename(temporary, this.memoryPath);
  }

  // Git keeps its normal global and system configuration here, so the user's credential helper and SSH keys apply.
  private environment(): NodeJS.ProcessEnv {
    const home = this.library.home;
    return {
      ...process.env,
      HOME: home,
      ...(home === homedir() ? {} : { XDG_CONFIG_HOME: join(home, ".config") }),
      GIT_TERMINAL_PROMPT: "0",
      GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
      GIT_AUTHOR_NAME: "AFK", GIT_AUTHOR_EMAIL: "afk@localhost", GIT_COMMITTER_NAME: "AFK", GIT_COMMITTER_EMAIL: "afk@localhost",
    };
  }

  private git(step: string, ...args: string[]): Promise<string> {
    return this.run(step, args, { timeoutMs: 60_000, idleTimeoutMs: 60_000 });
  }

  private async run(step: string, args: string[], limits: { timeoutMs: number; idleTimeoutMs: number }): Promise<string> {
    const result = await this.runner({ command: "git", args: ["-c", "core.hooksPath=/dev/null", ...args], step, cwd: this.library.root, env: this.environment(), signal: this.options.signal, ...limits });
    if (result.code !== 0) throw new Error(failure(result.output));
    return result.output.trim();
  }
}

/** The one moment each day AFK sends waiting saves to the remote; "Back up now" covers anything sooner. */
export const DAILY_BACKUP = { hours: 22, minutes: 0 };
const LATE_LIMIT_MS = 30 * 60_000;

export function nextDailyBackup(now: Date): Date {
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_BACKUP.hours, DAILY_BACKUP.minutes);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

export interface BackupScheduleOptions {
  now?: () => Date;
  onError?: (error: unknown) => void;
}

/**
 * Sleeps until the daily backup time with one timer, then pushes once. Node's timers pause while the Mac
 * sleeps, so the wall clock decides: a run more than 30 minutes late, held by an outside edit, or failing
 * is skipped until the next day, and the timer is set again from the wall clock.
 */
export function startBackup(backup: Backup, options: BackupScheduleOptions = {}): { tick: () => Promise<void>; stop: () => Promise<void>; nextAt: () => Date } {
  const now = options.now ?? (() => new Date());
  let slot = nextDailyBackup(now()), timer: NodeJS.Timeout | undefined, current: Promise<void> | undefined, stopped = false;

  const run = async (): Promise<void> => {
    const late = now().getTime() - slot.getTime();
    if (late < 0 || late > LATE_LIMIT_MS) return;
    const status = await backup.status();
    if (status.state === "off" || status.held || status.waiting === 0) return;
    await backup.saveNow();
  };

  const arm = (): void => {
    if (stopped) return;
    timer = setTimeout(() => void tick(), Math.max(0, slot.getTime() - now().getTime()));
    timer.unref();
  };

  const tick = (): Promise<void> => {
    current ??= run().catch(error => options.onError?.(error)).finally(() => {
      current = undefined;
      if (now() >= slot) slot = nextDailyBackup(now());
      clearTimeout(timer);
      arm();
    });
    return current;
  };

  arm();
  return { tick, nextAt: () => slot, stop: async () => { stopped = true; clearTimeout(timer); await current; } };
}
