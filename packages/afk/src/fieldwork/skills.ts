import type { Dirent } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { expandPath, skillName, type Settings, type SettingsStore } from "./settings.js";
import { Library } from "./library.js";
import { toolOwner } from "./kit.js";
import { offFolder, ToolSkills } from "./tool-skills.js";
import { readNativeMetadata, readOriginalInvocation, unknownInvocation, type SkillInvocation } from "./skill-metadata.js";

export function resolveProfile(settings: Settings, reference: string): Settings["profiles"][number] {
  const byId = settings.profiles.find(profile => profile.id === reference);
  if (byId) return byId;
  const matches = settings.profiles.filter(profile => profile.name.toLowerCase() === reference.trim().toLowerCase());
  if (matches.length > 1) throw new Error(`Multiple packs are named "${reference}". Use a pack ID: ${matches.map(profile => profile.id).join(", ")}.`);
  if (!matches[0]) throw new Error("Pack not found. Use a pack name or ID.");
  return matches[0];
}

export interface SkillEntry {
  name: string;
  path: string;
  owners: string[];
  stored: boolean;
  independent: boolean;
  available: boolean;
  shared: boolean;
  description: string;
  source?: string;
  invocation: SkillInvocation;
  defaultInvocation: SkillInvocation;
  invocationInherited: boolean;
  /** Set for skills a tool writes; they open read-only in the editor. */
  tool?: string;
  readOnly?: boolean;
  duplicate?: { identical: boolean };
}

export interface DuplicateCopy { name: string; live: string; stored: string; identical: boolean }
export type DuplicateKeep = "installed" | "stored";

export class DuplicateCopyError extends Error {
  readonly code = "duplicate-copy";
  constructor(readonly skill: string, readonly scope: string) {
    super(`Two different copies of ${skill} exist in ${scope}: the installed one and an older stored one. Choose which one to keep.`);
  }
}

export interface NestedSkillEntry {
  name: string;
  folder: string;
  path: string;
  description: string;
  invocation: SkillInvocation;
}

const nestedSkillDepth = 4;

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
}

// AFK's own bookkeeping files and invocation edits don't make two copies of a skill different.
async function comparableFiles(path: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const hash = (content: string | Buffer): string => createHash("sha256").update(content).digest("hex");
  const walk = async (folder: string, prefix = ""): Promise<void> => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      if (entry.name.startsWith(".afk-")) continue;
      const file = join(folder, entry.name), key = prefix + entry.name;
      if (entry.isDirectory()) await walk(file, key + "/");
      else if (entry.isSymbolicLink()) files.set(key, "link:" + await readlink(file));
      else files.set(key, hash(await readFile(file)));
    }
  };
  await walk(path);
  try {
    const backup = JSON.parse(await readFile(join(path, ".afk-invocation-original.json"), "utf8")) as { skill: string; metadata: string | null };
    files.set("SKILL.md", hash(backup.skill));
    if (backup.metadata === null) files.delete("agents/openai.yaml");
    else files.set("agents/openai.yaml", hash(backup.metadata));
  } catch { /* Without an invocation backup the files are compared as they are. */ }
  return files;
}

async function sharedDiscoveryFolder(root: string): Promise<boolean> {
  try { return await realpath(root) === await realpath(join(root, "../../.claude/skills")); }
  catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

async function installedSources(path: string): Promise<Record<string, string>> {
  try {
    const receipt = JSON.parse(await readFile(path, "utf8")) as { skills?: Record<string, { source?: unknown }> };
    return Object.fromEntries(Object.entries(receipt.skills ?? {}).flatMap(([name, entry]) =>
      typeof entry?.source === "string" ? [[name, entry.source]] : []));
  } catch { return {}; }
}

/** Skills CLI's global lock: under XDG state for the real home, otherwise inside the given home. */
export function globalLockPath(home: string): string {
  const stateHome = home === homedir() ? process.env.XDG_STATE_HOME : undefined;
  return stateHome ? join(stateHome, "skills/.skill-lock.json") : join(home, ".agents/.skill-lock.json");
}

export class SkillLibrary {
  readonly library: Library;
  private readonly toolSkills: ToolSkills;

  constructor(readonly store: SettingsStore) {
    this.library = new Library(store.home);
    this.toolSkills = new ToolSkills(store);
  }

  root(settings: Settings, scope: string): string {
    if (scope === "Global") return join(this.store.home, ".agents/skills");
    const project = settings.projects.find(p => p.name === scope);
    if (!project) throw new Error("Choose a configured project.");
    return join(expandPath(project.path, this.store.home), ".agents/skills");
  }

  async inventory(settings: Settings, scope: string): Promise<SkillEntry[]> {
    const root = this.root(settings, scope);
    const result: SkillEntry[] = [];
    const globalReceipt = globalLockPath(this.store.home);
    const sources = await installedSources(scope === "Global" ? globalReceipt : join(root, "../../skills-lock.json"));
    const globalSources = scope === "Global" ? sources : await installedSources(globalReceipt);
    const librarySources: Record<string, string> = {};
    if (scope === "Global") for (const name of await this.library.names()) {
      const source = (await this.library.record(name))?.source;
      if (source) librarySources[name] = source;
    }
    const folders = [{ directory: root, disabled: false }, ...(scope === "Global" ? [{ directory: join(this.library.root, "skills"), disabled: true }] : []), { directory: join(root, ".disabled"), disabled: true }, ...(scope === "Global" ? [{ directory: offFolder(this.store.home), disabled: true }] : [])];
    for (const { directory, disabled } of folders) {
      let names: string[];
      try { names = await readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
      const entries = await Promise.all(names.filter(name => skillName(name) && !name.startsWith(".") && !result.some(entry => entry.name === name)).map(async name => {
        const path = join(directory, name);
        if (!(await exists(join(path, "SKILL.md")))) return undefined;
        const owners = settings.profiles.filter(p => p.enabled.includes(scope) && p.skills.includes(name)).map(p => p.name);
        let globalPath: string | undefined;
        let invocationInherited = false;
        if (scope !== "Global") {
          try {
            globalPath = await this.locate(settings, name);
            invocationInherited = await realpath(path) === await realpath(globalPath);
          } catch { /* A project skill can exist without a Global copy. */ }
        }
        const shared = scope === "Global" || Object.prototype.hasOwnProperty.call(settings.managedLinks, path) || invocationInherited;
        const metadata = await readNativeMetadata(path);
        const resetsToGlobal = scope !== "Global" && (await lstat(path)).isSymbolicLink();
        const defaultInvocation = resetsToGlobal
          ? globalPath ? (await readNativeMetadata(globalPath)).invocation : unknownInvocation()
          : await readOriginalInvocation(path, metadata.invocation);
        let preparedSource: string | undefined;
        try { const receipt = JSON.parse(await readFile(join(path, ".afk-source.json"), "utf8")) as { source?: unknown }; if (typeof receipt.source === "string") preparedSource = receipt.source; } catch { /* Older prepared copies have no provenance receipt. */ }
        const source = librarySources[name] ?? preparedSource ?? sources[name] ?? (invocationInherited ? globalSources[name] : undefined);
        const tool = scope === "Global" ? toolOwner(settings, name) : undefined;
        return { name, path, ...(source ? { source } : {}), owners, stored: disabled, independent: owners.length === 0, available: !disabled, shared, ...metadata, defaultInvocation, invocationInherited, ...(tool ? { tool: tool.name, readOnly: true } : {}) };
      }));
      for (const entry of entries) if (entry) result.push(entry);
    }
    for (const copy of await this.duplicates(settings, scope)) {
      const entry = result.find(item => item.name === copy.name);
      if (entry) entry.duplicate = { identical: copy.identical };
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Subfolders belong to whichever tool created them, so their skills are listed without joining name-keyed management.
  async nested(settings: Settings, scope: string): Promise<NestedSkillEntry[]> {
    const root = this.root(settings, scope);
    const result: NestedSkillEntry[] = [];
    const walk = async (segments: string[]): Promise<void> => {
      let children: Dirent[];
      try { children = await readdir(join(root, ...segments), { withFileTypes: true }); }
      catch (error) { if (["ENOENT", "ENOTDIR", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) return; throw error; }
      for (const child of children) {
        if (!child.isDirectory() || child.name.startsWith(".") || child.name === "node_modules") continue;
        const path = join(root, ...segments, child.name);
        if (await exists(join(path, "SKILL.md"))) {
          if (segments.length) result.push({ name: child.name, folder: segments.join("/"), path, ...await readNativeMetadata(path) });
        } else if (segments.length < nestedSkillDepth) await walk([...segments, child.name]);
      }
    };
    await walk([]);
    return result.sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
  }

  async locate(settings: Settings, name: string, scope = "Global"): Promise<string> {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    const root = this.root(settings, scope);
    if (scope === "Global" && await this.library.has(name)) return this.library.skillPath(name);
    for (const directory of [join(root, ".disabled", name), join(root, name), ...(scope === "Global" ? [join(offFolder(this.store.home), name)] : [])]) {
      if (await exists(join(directory, "SKILL.md"))) return directory;
    }
    throw new Error(`Skill ${name} is not prepared in ${scope}.`);
  }

  // An installer can write a real folder where AFK expects its link, leaving an older stored copy of the same skill behind.
  async duplicate(settings: Settings, name: string, scope: string): Promise<DuplicateCopy | undefined> {
    if (!skillName(name)) return undefined;
    const root = this.root(settings, scope), live = join(root, name), stored = join(root, ".disabled", name);
    if (!await exists(join(live, "SKILL.md")) || !await exists(join(stored, "SKILL.md"))) return undefined;
    if ((await lstat(live)).isSymbolicLink() || (await lstat(stored)).isSymbolicLink()) return undefined;
    return { name, live, stored, identical: isDeepStrictEqual(await comparableFiles(live), await comparableFiles(stored)) };
  }

  async duplicates(settings: Settings, scope: string): Promise<DuplicateCopy[]> {
    let names: string[];
    try { names = await readdir(join(this.root(settings, scope), ".disabled")); }
    catch (error) { if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return []; throw error; }
    const copies = await Promise.all(names.map(name => this.duplicate(settings, name, scope)));
    return copies.filter((copy): copy is DuplicateCopy => copy !== undefined);
  }

  // Keeps one copy in stored storage and links the live path to it, so links from packs and projects stay valid.
  async consolidate(settings: Settings, name: string, scope: string, keep: DuplicateKeep): Promise<void> {
    const copy = await this.duplicate(settings, name, scope);
    if (!copy) throw new Error(`${name} has no second copy in ${scope}.`);
    const parked = join(this.root(settings, scope), ".disabled", `.afk-replaced-${randomUUID()}`);
    const outgoing = keep === "installed" ? copy.stored : copy.live;
    const originalLinks = { ...settings.managedLinks };
    const originalIndividuals = [...(settings.independentSkills[scope] ?? [])];
    const revert = async (): Promise<void> => {
      if (await exists(copy.live) && (await lstat(copy.live)).isSymbolicLink()) await rm(copy.live);
      if (keep === "installed" && await exists(copy.stored)) await rename(copy.stored, copy.live);
      await rename(parked, outgoing);
      settings.managedLinks = originalLinks;
      settings.independentSkills[scope] = originalIndividuals;
    };
    await rename(outgoing, parked);
    try {
      if (keep === "installed") await rename(copy.live, copy.stored);
      await symlink(copy.stored, copy.live, "dir");
      const packOwned = settings.profiles.some(profile => profile.enabled.includes(scope) && profile.skills.includes(name));
      if (packOwned) settings.managedLinks[copy.live] = copy.stored;
      else settings.independentSkills[scope] = [...new Set([...originalIndividuals, name])];
      await this.store.save(settings);
    } catch (error) {
      await revert();
      throw error;
    }
    await rm(parked, { recursive: true, force: true });
  }

  // Agents load the top-level entry; a physical install there can coexist with an older stored copy of the same name.
  async locateLoaded(settings: Settings, name: string, scope = "Global"): Promise<string> {
    const loaded = join(this.root(settings, scope), name);
    if (skillName(name) && await exists(join(loaded, "SKILL.md"))) return loaded;
    return this.locate(settings, name, scope);
  }

  async readGroup(settings: Settings, id: string): Promise<string> {
    const profile = resolveProfile(settings, id);
    const groups = await Promise.all(profile.skills.map(async name => {
      const path = await this.locate(settings, name);
      return `## ${name}\n\nSupporting files: ${path}\n\n${await readFile(join(path, "SKILL.md"), "utf8")}`;
    }));
    return `# ${profile.name}\n\n${groups.join("\n\n")}`;
  }

  async activate(settings: Settings, id: string, scope: string, enabled: boolean): Promise<void> {
    const profile = resolveProfile(settings, id);
    const root = this.root(settings, scope);
    if (enabled && scope !== "Global" && !(await stat(resolve(root, "../.."))).isDirectory()) throw new Error("Choose an existing project folder in Settings.");
    const operations: { path: string; source: string; create: boolean }[] = [];
    for (const name of profile.skills) {
      const shared = enabled ? await this.locate(settings, name) : join(this.root(settings, "Global"), ".disabled", name);
      const override = join(root, ".afk-overrides", name);
      const source = scope !== "Global" && await exists(join(override, "SKILL.md")) ? override : shared;
      const destinations = await sharedDiscoveryFolder(root)
        ? [join(root, name)]
        : [join(root, name), join(root, "../../.claude/skills", name)];
      for (const destination of destinations) {
        if (enabled) {
        if (await exists(destination)) {
          if (await realpath(destination) !== await realpath(source)) {
            const copy = destination === join(root, name) && source === join(root, ".disabled", name) ? await this.duplicate(settings, name, scope) : undefined;
            if (!copy) throw new Error(`${name} already exists in ${scope}. Existing files were preserved.`);
            if (!copy.identical) throw new DuplicateCopyError(name, scope);
            await this.consolidate(settings, name, scope, "stored");
          }
          continue;
        }
        operations.push({ path: destination, source, create: true });
      } else {
        const otherOwner = settings.profiles.some(p => p.id !== profile.id && p.enabled.includes(scope) && p.skills.includes(name));
        if (otherOwner || settings.independentSkills[scope]?.includes(name) || !settings.managedLinks[destination] || !(await exists(destination))) continue;
        const stat = await lstat(destination);
        if (!stat.isSymbolicLink()) continue;
        const target = resolve(destination, "..", await readlink(destination));
        if (target !== settings.managedLinks[destination]) continue;
        operations.push({ path: destination, source: target, create: false });
      }
    }
    }
    if (enabled) await mkdir(root, { recursive: true });
    const completed: typeof operations = [];
    const original = [...profile.enabled];
    const originalLinks = { ...settings.managedLinks };
    try {
      for (const operation of operations) {
        if (operation.create) { await mkdir(resolve(operation.path, ".."), { recursive: true }); await symlink(operation.source, operation.path, "dir"); }
        else await rm(operation.path);
        completed.push(operation);
        if (operation.create) settings.managedLinks[operation.path] = operation.source;
        else delete settings.managedLinks[operation.path];
      }
      profile.enabled = enabled ? [...new Set([...profile.enabled, scope])] : profile.enabled.filter(s => s !== scope);
      await this.store.save(settings);
    } catch (error) {
      profile.enabled = original;
      settings.managedLinks = originalLinks;
      for (const operation of completed.reverse()) {
        if (operation.create) await rm(operation.path);
        else await symlink(operation.source, operation.path, "dir");
      }
      throw error;
    }
  }

  async toggle(settings: Settings, name: string, scope: string): Promise<void> {
    if (settings.profiles.some(p => p.enabled.includes(scope) && p.skills.includes(name))) throw new Error("Turn the owning packs off first.");
    if (scope === "Global" && toolOwner(settings, name)) return this.toolSkills.toggle(settings, name);
    if (scope === "Global" && await this.library.has(name)) return this.toggleStored(settings, name);
    const root = this.root(settings, scope);
    const active = join(root, name);
    const disabled = join(root, ".disabled", name);
    await mkdir(join(root, ".disabled"), { recursive: true });
    const enabled = await exists(active);
    const copy = enabled ? await this.duplicate(settings, name, scope) : undefined;
    if (copy && !copy.identical) throw new DuplicateCopyError(name, scope);
    if (copy) await this.consolidate(settings, name, scope, "stored");
    if (!enabled) {
      const source = await this.locate(settings, name, scope);
      const alias = join(root, "../../.claude/skills", name);
      const hasAlias = await exists(alias);
      if (hasAlias) {
        const target = (await lstat(alias)).isSymbolicLink() ? resolve(alias, "..", await readlink(alias)) : undefined;
        const matches = target === active || await realpath(alias) === await realpath(source);
        if (!matches) throw new Error("A different Claude skill already occupies this name.");
      }
      const originalLinks = { ...settings.managedLinks };
      const originalIndividuals = [...(settings.independentSkills[scope] ?? [])];
      let createdAlias = false;
      await symlink(source, active, "dir");
      try {
        if (!hasAlias && !await sharedDiscoveryFolder(root)) {
          await mkdir(resolve(alias, ".."), { recursive: true }); await symlink(source, alias, "dir");
          createdAlias = true; settings.managedLinks[alias] = source;
        }
        settings.independentSkills[scope] = [...new Set([...originalIndividuals, name])];
        await this.store.save(settings);
      } catch (error) {
        await rm(active); if (createdAlias) await rm(alias);
        settings.managedLinks = originalLinks; settings.independentSkills[scope] = originalIndividuals;
        throw error;
      }
      return;
    }
    const stat = await lstat(active);
    if (stat.isSymbolicLink() && await exists(disabled) && await realpath(active) === await realpath(disabled)) {
      const alias = join(root, "../../.claude/skills", name);
      const removesAlias = !await sharedDiscoveryFolder(root) && settings.managedLinks[alias] === disabled && await exists(alias) && (await lstat(alias)).isSymbolicLink() && resolve(alias, "..", await readlink(alias)) === disabled;
      await rm(active);
      if (removesAlias) { await rm(alias); delete settings.managedLinks[alias]; }
      settings.independentSkills[scope] = (settings.independentSkills[scope] ?? []).filter(member => member !== name);
      try { await this.store.save(settings); } catch (error) { await symlink(disabled, active, "dir"); if (removesAlias) await symlink(disabled, alias, "dir"); throw error; }
      return;
    }
    if (await exists(disabled)) throw new Error("Another copy already occupies disabled storage. No files changed.");
    const dependentLinks = Object.entries(settings.managedLinks).filter(([, target]) => target === active);
    const movedLinks: string[] = [];
    const originalLinks = { ...settings.managedLinks };
    const alias = join(root, "../../.claude/skills", name);
    const ownedTarget = originalLinks[active];
    const removesAlias = Boolean(ownedTarget && originalLinks[alias] === ownedTarget && await exists(alias) && (await lstat(alias)).isSymbolicLink() && resolve(alias, "..", await readlink(alias)) === ownedTarget);
    await rename(active, disabled);
    try {
      delete settings.managedLinks[active];
      if (removesAlias) { await rm(alias); delete settings.managedLinks[alias]; }
      for (const [path] of dependentLinks) {
        if (!(await exists(path)) || !(await lstat(path)).isSymbolicLink()) continue;
        if (resolve(path, "..", await readlink(path)) !== active) continue;
        await rm(path); await symlink(disabled, path, "dir");
        movedLinks.push(path); settings.managedLinks[path] = disabled;
      }
      settings.independentSkills[scope] = (settings.independentSkills[scope] ?? []).filter(member => member !== name);
      await this.store.save(settings);
    } catch (error) {
      await rename(disabled, active);
      if (removesAlias) await symlink(ownedTarget!, alias, "dir");
      for (const path of movedLinks) { await rm(path); await symlink(active, path, "dir"); }
      settings.managedLinks = originalLinks;
      throw error;
    }
  }

  // A stored skill is on while AFK's links to it exist; turning it off removes them and moves no files.
  private async toggleStored(settings: Settings, name: string): Promise<void> {
    const on = await this.library.linked(name);
    const original = [...(settings.independentSkills.Global ?? [])];
    if (on) await this.library.unlink(name);
    else await this.library.link(name);
    settings.independentSkills.Global = on ? original.filter(member => member !== name) : [...new Set([...original, name])];
    try { await this.store.save(settings); }
    catch (error) {
      settings.independentSkills.Global = original;
      if (on) await this.library.link(name); else await this.library.unlink(name);
      throw error;
    }
  }

  async storePrepared(settings: Settings, source: string, names: string[], reference?: string): Promise<void> {
    const root = this.root(settings, "Global");
    for (const name of names) {
      if (!skillName(name)) throw new Error("Invalid skill name.");
      try { await this.locate(settings, name); continue; } catch { /* A missing member needs preparation. */ }
      const destination = join(root, ".disabled", name);
      if (await exists(destination)) throw new Error(`${name} has an incomplete stored copy. Inspect it before retrying.`);
      const from = join(source, name);
      if (!(await exists(join(from, "SKILL.md")))) throw new Error(`Installer did not prepare ${name}${reference ? ` from ${reference}` : ""}.`);
      await mkdir(join(root, ".disabled"), { recursive: true });
      await cp(await realpath(from), destination, { recursive: true, dereference: true, errorOnExist: true, force: false });
      if (reference) await writeFile(join(destination, ".afk-source.json"), JSON.stringify({ source: reference }), { mode: 0o600 });
    }
  }
}
