import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./command-runner.js";
import { Library, type GitRunner, type LibrarySettings } from "./library.js";
import { checkRemoteUrl } from "./library-backup.js";
import { deployLibrary, type AsideMove } from "./library-deploy.js";
import { recordedInvocations } from "./library-settings.js";
import { clearRestorePending, markRestorePending, pendingRestore } from "./restore-pending.js";
import type { SettingsStore, Tool } from "./settings.js";

export interface RestoreOptions {
  signal?: AbortSignal | undefined;
  now?: (() => Date) | undefined;
}

export interface RepositoryChoice {
  name: string;
  url: string;
  private: boolean;
  pushedAt?: string;
}

export interface LibraryPreview {
  repository: string;
  coreSkills: number;
  packs: number;
  tools: number;
}

export interface RestoreSummary {
  repository: string;
  linked: string[];
  adopted: string[];
  movedAside: AsideMove[];
  choices: number;
  folders: string[];
  packs: string[];
  tools: Tool[];
}

const TEMPORARY = ".restore-";

interface GitResult { code: number; output: string; cancelled?: boolean | undefined }

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

function failure(output: string): string {
  const lines = output.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("hint:"));
  return lines.slice(-2).join(" ") || "Git could not reach the repository.";
}

/** `owner/repo` means that repository on GitHub; anything else is a Git remote URL or path. */
export function repositoryUrl(value: string): string {
  const text = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9._-]+$/.test(text) && !text.startsWith(".") ? `https://github.com/${text.replace(/\.git$/, "")}.git` : checkRemoteUrl(text);
}

/** Brings a saved library back onto this machine from a Git repository. */
export class Restore {
  private readonly library: Library;

  constructor(private readonly store: SettingsStore, private readonly runner: GitRunner = runCommand, private readonly options: RestoreOptions = {}) {
    this.library = new Library(store.home, runner);
  }

  /** The signed-in GitHub account's repositories, from the GitHub CLI and its own sign-in. */
  async repositories(): Promise<RepositoryChoice[]> {
    let result: GitResult;
    try {
      result = await this.runner({ command: "gh", args: ["repo", "list", "--limit", "100", "--json", "nameWithOwner,url,isPrivate,pushedAt"], step: "Listing your GitHub repositories", cwd: this.store.home, env: { ...process.env, HOME: this.store.home, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" }, signal: this.options.signal, timeoutMs: 60_000 });
    } catch (error) {
      throw new Error(`The GitHub CLI could not list your repositories: ${error instanceof Error ? error.message : "unknown error"}. Install it and run gh auth login, or paste a repository URL instead.`);
    }
    if (result.code !== 0) throw new Error(`The GitHub CLI could not list your repositories: ${failure(result.output)} Run gh auth login, or paste a repository URL instead.`);
    let listed: { nameWithOwner: string; url: string; isPrivate: boolean; pushedAt?: string }[];
    try { listed = JSON.parse(result.output) as typeof listed; } catch { throw new Error("The GitHub CLI returned a list AFK could not read. Paste a repository URL instead."); }
    const likely = (name: string): number => /afk|library/i.test(name) ? 0 : 1;
    return listed
      .map(entry => ({ name: entry.nameWithOwner, url: `${entry.url.replace(/\.git$/, "")}.git`, private: entry.isPrivate, ...(entry.pushedAt ? { pushedAt: entry.pushedAt } : {}) }))
      .sort((a, b) => likely(a.name) - likely(b.name) || (b.pushedAt ?? "").localeCompare(a.pushedAt ?? ""));
  }

  /** Fetches only the tip of the repository into a scratch folder to confirm it is an AFK library; nothing is cloned. */
  async inspect(repository: string): Promise<LibraryPreview> {
    const url = repositoryUrl(repository), scratch = await this.scratch("probe");
    try {
      await this.run(["init", "--quiet"], scratch, "Checking the repository");
      await this.run(["remote", "add", "origin", "--", url], scratch, "Checking the repository");
      const fetched = await this.git(["fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", "HEAD"], scratch, "Checking the repository");
      if (fetched.cancelled) throw new Error("Restore was cancelled. Nothing was changed.");
      if (fetched.code !== 0) throw new Error(`Could not reach the repository: ${failure(fetched.output)}`);
      const listing = await this.git(["ls-tree", "-r", "--name-only", "FETCH_HEAD", "--", ".afk"], scratch, "Checking the repository");
      const files = listing.output.split("\n").filter(Boolean);
      if (!files.includes(".afk/settings.json")) throw new Error("That repository is not an AFK library. Add it to Try later instead if it holds skills.");
      const shown = await this.git(["show", "FETCH_HEAD:.afk/settings.json"], scratch, "Checking the repository");
      const settings = JSON.parse(shown.output) as LibrarySettings;
      return {
        repository: url,
        coreSkills: new Set(settings.core.flatMap(entry => entry.skills)).size,
        packs: files.filter(file => file.startsWith(".afk/packs/")).length,
        tools: files.filter(file => file.startsWith(".afk/tools/")).length,
      };
    } finally { await rm(scratch, { recursive: true, force: true }); }
  }

  async restore(repository: string): Promise<RestoreSummary> {
    const url = repositoryUrl(repository), home = this.store.home;
    const pending = await exists(this.library.root) ? await pendingRestore(home) : undefined;
    if (pending !== undefined && pending !== url) throw new Error(`The restore from ${pending} did not finish. Restore from it again to finish linking its skills.`);
    if (pending === undefined) {
      if (await exists(this.library.root)) throw new Error(`A library already exists at ${this.library.root}. Restore needs an empty machine.`);
      await this.clearLeftovers();
      await this.inspect(url);
      await markRestorePending(home, url);
      try { await this.clone(url); } catch (error) { await clearRestorePending(home); throw error; }
    }
    const { packs, tools } = await this.contents();
    const deployed = await deployLibrary(this.library, this.options.now ? { now: this.options.now } : {});
    const settings = await this.store.read();
    settings.independentSkills.Global = [...new Set([...(settings.independentSkills.Global ?? []), ...deployed.linked])].sort();
    await this.store.save(settings);
    await clearRestorePending(home);
    return {
      repository: url,
      linked: deployed.linked,
      adopted: deployed.adopted,
      movedAside: deployed.movedAside,
      choices: Object.values(await recordedInvocations(this.store.home)).filter(Boolean).length,
      folders: await this.library.folders(),
      packs,
      tools,
    };
  }

  private async contents(): Promise<{ packs: string[]; tools: Tool[] }> {
    const settings = await this.store.read();
    return { packs: settings.profiles.map(profile => profile.name), tools: settings.tools };
  }

  // The clone is built beside the final place and moved only when complete, so nothing half-written is ever the library.
  private async clone(url: string): Promise<void> {
    const temporary = await this.scratch("clone"), parent = join(this.store.home, ".afk");
    try {
      const result = await this.git(["clone", "--quiet", "--no-hardlinks", "--", url, temporary], parent, "Downloading the library");
      if (result.cancelled) throw new Error("Restore was cancelled. Nothing was changed.");
      if (result.code !== 0) throw new Error(`Could not download the library: ${failure(result.output)}`);
      await readFile(join(temporary, ".afk/settings.json"), "utf8").then(text => JSON.parse(text) as LibrarySettings);
      await rename(temporary, this.library.root);
    } catch (error) {
      await rm(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  // A scratch path under ~/.afk, on the same disk as the library. A restore clears what a crashed one left behind.
  private async scratch(kind: "probe" | "clone"): Promise<string> {
    const parent = join(this.store.home, ".afk");
    await mkdir(parent, { recursive: true });
    return join(parent, `${TEMPORARY}${kind}-${randomUUID()}`);
  }

  private async clearLeftovers(): Promise<void> {
    const parent = join(this.store.home, ".afk");
    await mkdir(parent, { recursive: true });
    for (const name of await readdir(parent)) if (name.startsWith(TEMPORARY)) await rm(join(parent, name), { recursive: true, force: true });
  }

  private async run(args: string[], cwd: string, step: string): Promise<void> {
    await mkdir(cwd, { recursive: true });
    const result = await this.git(args, cwd, step);
    if (result.code !== 0) throw new Error(`${step} failed: ${failure(result.output)}`);
  }

  private git(args: string[], cwd: string, step: string): Promise<GitResult> {
    const home = this.store.home;
    return this.runner({
      command: "git",
      args: ["-c", "core.hooksPath=/dev/null", ...args],
      step,
      cwd,
      env: {
        ...process.env,
        HOME: home,
        ...(home === homedir() ? {} : { XDG_CONFIG_HOME: join(home, ".config") }),
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes",
        GIT_AUTHOR_NAME: "AFK", GIT_AUTHOR_EMAIL: "afk@localhost", GIT_COMMITTER_NAME: "AFK", GIT_COMMITTER_EMAIL: "afk@localhost",
      },
      signal: this.options.signal,
      timeoutMs: 10 * 60_000,
      idleTimeoutMs: 120_000,
    });
  }
}
