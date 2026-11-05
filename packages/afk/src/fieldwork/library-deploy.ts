import { lstat, mkdir, readlink, realpath, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Library, type LibrarySettings } from "./library.js";
import { readLibrarySettings } from "./library-settings.js";
import { sameSkillFiles } from "./skills.js";

export interface AsideMove { name: string; from: string; to: string }

export interface DeploySummary {
  linked: string[];
  unlinked: string[];
  adopted: string[];
  movedAside: AsideMove[];
}

export interface DeployOptions {
  /** Only these skills are deployed; by default every skill the library stores. */
  names?: string[];
  now?: () => Date;
}

export function asideRoot(home: string): string {
  return join(home, ".afk/restore-aside");
}

export function coreNames(settings: Pick<LibrarySettings, "core"> | undefined): string[] {
  return [...new Set((settings?.core ?? []).flatMap(entry => entry.skills))];
}

function dateFolder(now: Date): string {
  const part = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}`;
}

async function lstatOrUndefined(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try { return await lstat(path); } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return undefined;
    throw error;
  }
}

async function pointsTo(path: string, target: string): Promise<boolean> {
  return (await lstatOrUndefined(path))?.isSymbolicLink() === true && resolve(dirname(path), await readlink(path)) === target;
}

async function distinctFolders(library: Library): Promise<string[]> {
  const seen = new Set<string>(), folders: string[] = [];
  for (const folder of await library.folders()) {
    let identity = folder;
    try { identity = await realpath(folder); } catch { /* A missing folder holds nothing yet. */ }
    if (seen.has(identity)) continue;
    seen.add(identity);
    folders.push(folder);
  }
  return folders;
}

async function freeSpot(path: string): Promise<string> {
  for (let index = 2, candidate = path; ; candidate = `${path}-${index++}`) if (!await lstatOrUndefined(candidate)) return candidate;
}

/**
 * Makes this machine's agent folders match the library: skills the library lists as Core are linked,
 * and AFK's links to skills it no longer lists are removed. A copy already in an agent folder is adopted when its files
 * match the library's and moved to a dated folder when they differ.
 */
export async function deployLibrary(library: Library, options: DeployOptions = {}): Promise<DeploySummary> {
  const summary: DeploySummary = { linked: [], unlinked: [], adopted: [], movedAside: [] };
  const settings = await library.readSettings();
  const stored = new Set(await library.names());
  const on = coreNames(settings).filter(name => stored.has(name));
  const pack = new Set(settings ? (await readLibrarySettings(library.home)).profiles.flatMap(profile => profile.skills) : []);
  const names = options.names ?? [...new Set([...stored, ...on])].sort();
  const aside = join(asideRoot(library.home), dateFolder((options.now ?? (() => new Date()))()));

  const clear = async (name: string): Promise<void> => {
    const target = library.skillPath(name), copy = join(target, "SKILL.md");
    for (const folder of await distinctFolders(library)) {
      const path = join(folder, name);
      const entry = await lstatOrUndefined(path);
      if (!entry || await pointsTo(path, target)) continue;
      const resolved = entry.isSymbolicLink() ? await stat(path).then(() => realpath(path), () => undefined) : path;
      if (resolved === undefined) { await rm(path); continue; }
      if (await lstatOrUndefined(copy) && (await stat(resolved)).isDirectory() && await sameSkillFiles(resolved, target)) {
        await rm(path, { recursive: true });
        summary.adopted.push(name);
        continue;
      }
      const inside = relative(library.home, path);
      const to = await freeSpot(join(aside, inside.startsWith("..") ? basename(path) : inside));
      await mkdir(dirname(to), { recursive: true });
      await rename(path, to);
      summary.movedAside.push({ name, from: path, to });
    }
  };

  for (const name of names) {
    if (on.includes(name)) {
      const before = await library.linked(name);
      await clear(name);
      await library.link(name);
      if (!before) summary.linked.push(name);
    } else if (!pack.has(name) && !["pack", "machine"].includes(await library.storage(name) ?? "")) {
      if (await library.linked(name)) summary.unlinked.push(name);
      await library.unlink(name);
    }
  }
  return summary;
}
