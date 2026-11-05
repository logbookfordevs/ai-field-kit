import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { writeInvocationChoice } from "./invocation.js";
import type { Library } from "./library.js";

export interface AttentionItem {
  id: string;
  kind: "edited" | "replaced";
  name: string;
  files?: string[];
  at?: number;
  changed?: boolean;
}

interface Edit extends AttentionItem { kind: "edited"; paths: string[] }

const OTHER = "edited:library";

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}

async function filesOf(root: string, folder = ""): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    if (entry.name.startsWith(".afk-") || entry.name === ".git") continue;
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await filesOf(root, path));
    else found.push(path);
  }
  return found.sort();
}

async function sameFiles(left: string, right: string): Promise<boolean> {
  const names = await filesOf(left);
  if (JSON.stringify(names) !== JSON.stringify(await filesOf(right))) return false;
  for (const name of names) if (!(await readFile(join(left, name))).equals(await readFile(join(right, name)))) return false;
  return true;
}

function group(paths: string[]): Edit[] {
  const groups = new Map<string, Edit>();
  for (const path of paths) {
    const skill = /^skills\/([^/]+)\/(.+)$/.exec(path), record = /^\.afk\/skills\/([^/]+)\.json$/.exec(path);
    const name = skill?.[1] ?? record?.[1];
    const id = name ? `edited:${name}` : OTHER;
    const item = groups.get(id) ?? { id, kind: "edited", name: name ?? "Library files", files: [], paths: [] };
    item.files!.push(skill?.[2] ?? path);
    item.paths.push(path);
    groups.set(id, item);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Things on this machine that need the user: stored files edited outside AFK, and links replaced by Skills CLI. */
export class LocalChecks {
  constructor(private readonly library: Library) {}

  async list(): Promise<AttentionItem[]> {
    const edits = (await this.edits()).map(({ paths: _paths, ...item }) => item);
    return [...edits, ...await this.replacements()];
  }

  /** Keeps the new files Skills CLI wrote: stores them with the saved choice, relinks and commits. */
  async take(name: string): Promise<void> {
    const folders = await this.replacedFolders(name);
    const source = folders[0]!;
    if (!await exists(join(source, "SKILL.md"))) throw new Error(`The new ${name} folder has no SKILL.md, so AFK left it as it is.`);
    await this.library.change(`Took the Skills CLI update to ${name}`, async () => {
      const target = this.library.skillPath(name);
      await rm(target, { recursive: true, force: true });
      await cp(source, target, { recursive: true, dereference: true, filter: path => !path.endsWith("/.git") });
      const choice = (await this.library.record(name))?.invocation;
      if (choice) await writeInvocationChoice(target, choice);
    });
    await this.relink(name, folders);
  }

  /** Puts the saved version's link back and removes the plain folder. */
  async restore(name: string): Promise<void> {
    await this.relink(name, await this.replacedFolders(name));
  }

  /** Commits an edit made outside AFK, with the saved invocation choice applied to its files. */
  async keep(id: string): Promise<void> {
    const edit = await this.edit(id);
    const skill = id === OTHER ? undefined : edit.name;
    const folder = skill ? this.library.skillPath(skill) : undefined;
    const choice = skill ? (await this.library.record(skill))?.invocation : undefined;
    const paths = skill ? [...new Set([`skills/${skill}`, ...edit.paths])] : edit.paths;
    await this.library.commitPaths(`Kept an edit to ${edit.name} made outside AFK`, paths, async () => {
      if (!folder || !choice || !await exists(join(folder, "SKILL.md"))) return;
      await writeInvocationChoice(folder, choice);
    });
  }

  /** Puts the saved version back. Nothing is committed, so nothing is pushed. */
  async discard(id: string): Promise<void> {
    await this.library.restorePaths((await this.edit(id)).paths);
  }

  private async replacements(): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];
    for (const name of await this.library.names()) {
      const [folder] = await this.plainFolders(name);
      if (!folder) continue;
      const changed = !await sameFiles(this.library.skillPath(name), folder).catch(() => true);
      const info = await stat(folder).catch(() => undefined);
      items.push({ id: `replaced:${name}`, kind: "replaced", name, changed, ...(info ? { at: info.mtimeMs } : {}) });
    }
    return items;
  }

  private async plainFolders(name: string): Promise<string[]> {
    const seen = new Set<string>(), found: string[] = [];
    for (const path of this.library.links(name)) {
      const info = await lstat(path).catch(() => undefined);
      if (!info?.isDirectory()) continue;
      const identity = await realpath(path);
      if (seen.has(identity)) continue;
      seen.add(identity);
      found.push(path);
    }
    return found;
  }

  private async replacedFolders(name: string): Promise<string[]> {
    const folders = await this.library.has(name) ? await this.plainFolders(name) : [];
    if (!folders.length) throw new Error(`${name} is no longer replaced by a plain folder. Nothing was changed.`);
    return folders;
  }

  // The folders wait in a trash inside .git until the link is in place, so a failure puts them back.
  private async relink(name: string, folders: string[]): Promise<void> {
    const trash = join(this.library.root, ".git/afk-replaced");
    const moved: [string, string][] = [];
    await rm(trash, { recursive: true, force: true });
    await mkdir(trash, { recursive: true });
    try {
      for (const [index, folder] of folders.entries()) {
        const aside = join(trash, `${name}-${index}`);
        await rename(folder, aside);
        moved.push([folder, aside]);
      }
      await this.library.link(name);
    } catch (error) {
      for (const [folder, aside] of moved) { await rm(folder, { recursive: true, force: true }); await rename(aside, folder); }
      throw error;
    }
    await rm(trash, { recursive: true, force: true });
  }

  private async edit(id: string): Promise<Edit> {
    const edit = (await this.edits()).find(item => item.id === id);
    if (!edit) throw new Error("That edit is no longer waiting. Nothing was changed.");
    return edit;
  }

  private async edits(): Promise<Edit[]> {
    const edits = group(await this.library.dirtyPaths());
    for (const edit of edits) {
      const times = await Promise.all(edit.paths.map(path => stat(join(this.library.root, path)).then(info => info.mtimeMs, () => 0)));
      const latest = Math.max(0, ...times);
      if (latest) edit.at = latest;
    }
    return edits;
  }
}
