import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { agentSkillFolders } from "./library.js";
import { skillName, type Settings, type SettingsStore } from "./settings.js";

interface OffOrigin {
  folder: string;
  links: { path: string; owned: boolean }[];
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

export function offFolder(home: string): string {
  return join(home, ".afk/off");
}

/** Tool-provided skills are real folders a tool writes into an agent folder. Off moves the folder to `~/.afk/off`; they never enter the library. */
export class ToolSkills {
  constructor(private readonly store: SettingsStore) {}

  path(name: string): string {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    return join(offFolder(this.store.home), name);
  }

  async isOff(name: string): Promise<boolean> {
    return exists(join(this.path(name), "SKILL.md"));
  }

  /** The real folder a tool wrote into one of the agent folders, if any. */
  async live(name: string): Promise<string | undefined> {
    const seen = new Set<string>();
    for (const folder of agentSkillFolders(this.store.home)) {
      let identity = folder;
      try { identity = await realpath(folder); } catch { /* A missing folder holds nothing. */ }
      if (seen.has(identity)) continue;
      seen.add(identity);
      const path = join(folder, name);
      if (await exists(join(path, "SKILL.md")) && !(await lstat(path)).isSymbolicLink()) return path;
    }
    return undefined;
  }

  async toggle(settings: Settings, name: string): Promise<void> {
    const live = await this.live(name);
    if (live) return this.turnOff(settings, name, live);
    if (await this.isOff(name)) return this.turnOn(settings, name);
    throw new Error(`Skill ${name} is not prepared in Global.`);
  }

  private async turnOff(settings: Settings, name: string, live: string): Promise<void> {
    const off = this.path(name), note = this.origin(name), parked = join(offFolder(this.store.home), `.afk-replaced-${randomUUID()}`);
    const originalLinks = { ...settings.managedLinks };
    const links: OffOrigin["links"] = [];
    for (const folder of agentSkillFolders(this.store.home)) {
      const path = join(folder, name);
      if (path === live || !await exists(path) || !(await lstat(path)).isSymbolicLink()) continue;
      if (resolve(dirname(path), await readlink(path)) === live) links.push({ path, owned: Object.prototype.hasOwnProperty.call(originalLinks, path) });
    }
    await mkdir(offFolder(this.store.home), { recursive: true });
    const replaces = await exists(off);
    if (replaces) await rename(off, parked);
    let moved = false;
    const removed: string[] = [];
    try {
      await rename(live, off);
      moved = true;
      for (const link of links) { await rm(link.path); removed.push(link.path); delete settings.managedLinks[link.path]; }
      delete settings.managedLinks[live];
      await writeFile(note, JSON.stringify({ folder: dirname(live), links } satisfies OffOrigin));
      await this.store.save(settings);
    } catch (error) {
      for (const path of removed) await symlink(live, path, "dir");
      if (moved) await rename(off, live);
      if (replaces) await rename(parked, off);
      await rm(note, { force: true });
      settings.managedLinks = originalLinks;
      throw error;
    }
    if (replaces) await rm(parked, { recursive: true, force: true });
  }

  private async turnOn(settings: Settings, name: string): Promise<void> {
    const off = this.path(name), note = this.origin(name);
    const origin = await this.readOrigin(note);
    const destination = join(origin.folder, name);
    if (await exists(destination)) throw new Error(`${destination} already exists. Existing files were preserved.`);
    const originalLinks = { ...settings.managedLinks };
    const created: string[] = [];
    let moved = false;
    try {
      await mkdir(origin.folder, { recursive: true });
      await rename(off, destination);
      moved = true;
      for (const link of origin.links) {
        if (await exists(link.path)) continue;
        await mkdir(dirname(link.path), { recursive: true });
        await symlink(destination, link.path, "dir");
        created.push(link.path);
        if (link.owned) settings.managedLinks[link.path] = destination;
      }
      await this.store.save(settings);
    } catch (error) {
      for (const path of created) await rm(path, { force: true });
      if (moved) await rename(destination, off);
      settings.managedLinks = originalLinks;
      throw error;
    }
    await rm(note, { force: true });
  }

  private origin(name: string): string {
    return join(offFolder(this.store.home), `.afk-origin-${name}.json`);
  }

  private async readOrigin(path: string): Promise<OffOrigin> {
    try { return JSON.parse(await readFile(path, "utf8")) as OffOrigin; }
    catch { return { folder: agentSkillFolders(this.store.home)[0]!, links: [] }; }
  }
}
