import { cp, lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { expandPath, skillName, type Settings, type SettingsStore } from "./settings.js";
import { readNativeMetadata, readOriginalInvocation, unknownInvocation, type SkillInvocation } from "./skill-metadata.js";

export function resolveProfile(settings: Settings, reference: string): Settings["profiles"][number] {
  const byId = settings.profiles.find(profile => profile.id === reference);
  if (byId) return byId;
  const matches = settings.profiles.filter(profile => profile.name.toLowerCase() === reference.trim().toLowerCase());
  if (matches.length > 1) throw new Error(`Multiple profiles are named "${reference}". Use a profile ID: ${matches.map(profile => profile.id).join(", ")}.`);
  if (!matches[0]) throw new Error("Profile not found. Use a profile name or ID.");
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
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return false;
    throw error;
  }
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

export class SkillLibrary {
  constructor(readonly store: SettingsStore) {}

  root(settings: Settings, scope: string): string {
    if (scope === "Global") return join(this.store.home, ".agents/skills");
    const project = settings.projects.find(p => p.name === scope);
    if (!project) throw new Error("Choose a configured project.");
    return join(expandPath(project.path, this.store.home), ".agents/skills");
  }

  async inventory(settings: Settings, scope: string): Promise<SkillEntry[]> {
    const root = this.root(settings, scope);
    const result: SkillEntry[] = [];
    const stateHome = this.store.home === homedir() ? process.env.XDG_STATE_HOME : undefined;
    const globalReceipt = stateHome ? join(stateHome, "skills/.skill-lock.json") : join(this.store.home, ".agents/.skill-lock.json");
    const sources = await installedSources(scope === "Global" ? globalReceipt : join(root, "../../skills-lock.json"));
    const globalSources = scope === "Global" ? sources : await installedSources(globalReceipt);
    for (const disabled of [false, true]) {
      const directory = disabled ? join(root, ".disabled") : root;
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
        const source = preparedSource ?? sources[name] ?? (invocationInherited ? globalSources[name] : undefined);
        return { name, path, ...(source ? { source } : {}), owners, stored: disabled, independent: owners.length === 0, available: !disabled, shared, ...metadata, defaultInvocation, invocationInherited };
      }));
      for (const entry of entries) if (entry) result.push(entry);
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async locate(settings: Settings, name: string, scope = "Global"): Promise<string> {
    if (!skillName(name)) throw new Error("Invalid skill name.");
    const root = this.root(settings, scope);
    for (const directory of [join(root, ".disabled", name), join(root, name)]) {
      if (await exists(join(directory, "SKILL.md"))) return directory;
    }
    throw new Error(`Skill ${name} is not prepared in ${scope}.`);
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
          if (await realpath(destination) !== await realpath(source)) throw new Error(`${name} already exists in ${scope}. Existing files were preserved.`);
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
    if (settings.profiles.some(p => p.enabled.includes(scope) && p.skills.includes(name))) throw new Error("Disable the owning profiles first.");
    const root = this.root(settings, scope);
    const active = join(root, name);
    const disabled = join(root, ".disabled", name);
    await mkdir(join(root, ".disabled"), { recursive: true });
    const enabled = await exists(active);
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

  async storePrepared(settings: Settings, source: string, names: string[], reference?: string): Promise<void> {
    const root = this.root(settings, "Global");
    for (const name of names) {
      if (!skillName(name)) throw new Error("Invalid skill name.");
      try { await this.locate(settings, name); continue; } catch { /* A missing member needs preparation. */ }
      const destination = join(root, ".disabled", name);
      if (await exists(destination)) throw new Error(`${name} has an incomplete stored copy. Inspect it before retrying.`);
      const from = join(source, name);
      if (!(await exists(join(from, "SKILL.md")))) throw new Error(`Installer did not prepare ${name}.`);
      await mkdir(join(root, ".disabled"), { recursive: true });
      await cp(await realpath(from), destination, { recursive: true, dereference: true, errorOnExist: true, force: false });
      if (reference) await writeFile(join(destination, ".afk-source.json"), JSON.stringify({ source: reference }), { mode: 0o600 });
    }
  }
}
