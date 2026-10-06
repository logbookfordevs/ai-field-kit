import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export interface RulesDestination {
  id: string;
  name: string;
  kind: "codex" | "claude" | "custom";
  path: string;
}

export type AgentRulesDestination = RulesDestination;

export interface RulesReceipt {
  region: string;
  references: Record<string, string>;
  lastSync: string;
}

export interface AgentRulesSettings {
  destinations: RulesDestination[];
  receipts: Record<string, RulesReceipt>;
}

export interface Profile {
  id: string;
  name: string;
  source: string;
  skills: string[];
  enabled: string[];
  ready: boolean;
}

export interface FavoriteSource {
  name: string;
  source: string;
  skills?: string[];
}

export interface Settings {
  version: 1;
  profiles: Profile[];
  projects: { name: string; path: string }[];
  tools: { id: number; name: string; install: string; update: string }[];
  favoriteSources: FavoriteSource[];
  preferences: Record<string, string>;
  managedLinks: Record<string, string>;
  independentSkills: Record<string, string[]>;
  agentRules?: AgentRulesSettings | undefined;
  welcomeDismissed?: boolean;
}

export function emptySettings(): Settings {
  return { version: 1, profiles: [], projects: [], tools: [], favoriteSources: [], preferences: {}, managedLinks: {}, independentSkills: {} };
}

export function expandPath(path: string, home = homedir()): string {
  return resolve(path === "~" ? home : path.startsWith("~/") ? resolve(home, path.slice(2)) : path);
}

export function containsControl(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

export function skillName(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value) && value !== "." && value !== "..";
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !containsControl(value);
}

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") throw new Error("Choose an AFK settings file.");
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.projects) || !Array.isArray(data.tools) || !Array.isArray(data.favoriteSources)) {
    throw new Error("Unsupported settings format. Expected AFK settings version 1.");
  }
  const profiles = data.profiles as Profile[];
  const projects = data.projects as Settings["projects"];
  const tools = data.tools as Settings["tools"];
  const sources = data.favoriteSources as Settings["favoriteSources"];
  if (!projects.every(p => p && nonempty(p.name) && p.name !== "Global" && !p.name.includes("|") && nonempty(p.path))) throw new Error("Projects need unique names and folder paths.");
  const scopes = new Set(["Global", ...projects.map(p => p.name)]);
  if (scopes.size !== projects.length + 1) throw new Error("Project names must be unique.");
  if (!profiles.every(p => p && skillName(p.id) && nonempty(p.name) && nonempty(p.source) && Array.isArray(p.skills) && p.skills.length > 0 && p.skills.every(skillName) && new Set(p.skills).size === p.skills.length && Array.isArray(p.enabled) && p.enabled.every(s => scopes.has(s)) && typeof p.ready === "boolean")) throw new Error("Profiles need valid members and activation scopes.");
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error("Profile identifiers must be unique.");
  if (!tools.every(t => t && Number.isSafeInteger(t.id) && nonempty(t.name) && typeof t.install === "string" && t.install.trim() && !t.install.includes("\0") && typeof t.update === "string" && !t.update.includes("\0"))) throw new Error("Tools need names and install commands.");
  if (new Set(tools.map(t => t.id)).size !== tools.length) throw new Error("Tool identifiers must be unique.");
  if (!sources.every(s => s && nonempty(s.name) && nonempty(s.source) && !s.source.startsWith("-"))) throw new Error("Sources need names and repository references.");
  if (!sources.every(s => s.skills === undefined || (Array.isArray(s.skills) && s.skills.length > 0 && s.skills.every(skillName) && new Set(s.skills).size === s.skills.length))) throw new Error("Choose at least one valid, unique skill for each selected source.");
  const preferences = data.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences) || !Object.entries(preferences).every(([key, mode]) => key.includes("|") && ["Manual only", "Automatic allowed"].includes(String(mode)))) throw new Error("Invalid invocation preferences.");
  const links = data.managedLinks;
  if (!links || typeof links !== "object" || Array.isArray(links) || !Object.entries(links).every(([path, target]) => nonempty(path) && nonempty(target))) throw new Error("Invalid managed link receipts.");
  const independent = data.independentSkills;
  if (!independent || typeof independent !== "object" || Array.isArray(independent) || !Object.values(independent).every(members => Array.isArray(members) && members.every(skillName))) throw new Error("Invalid individual activation state.");
  if (data.welcomeDismissed !== undefined && typeof data.welcomeDismissed !== "boolean") throw new Error("Invalid welcome dismissal state.");
  if (data.agentRules !== undefined) {
    const rules = data.agentRules as AgentRulesSettings;
    if (!rules || !Array.isArray(rules.destinations) || !rules.destinations.every(d => d && skillName(d.id) && nonempty(d.name) && ["codex", "claude", "custom"].includes(d.kind) && nonempty(d.path))) throw new Error("Agent rules destinations need names and file paths.");
    if (new Set(rules.destinations.map(d => d.id)).size !== rules.destinations.length) throw new Error("Agent rules destination identifiers must be unique.");
    if (!rules.receipts || typeof rules.receipts !== "object" || Array.isArray(rules.receipts) || !Object.entries(rules.receipts).every(([id, r]) => skillName(id) && r && typeof r.region === "string" && typeof r.lastSync === "string" && r.references && typeof r.references === "object" && !Array.isArray(r.references) && Object.entries(r.references).every(([path, content]) => path.startsWith("references/") && !path.split("/").includes("..") && typeof content === "string"))) throw new Error("Invalid agent rules sync receipts.");
  }
  return structuredClone(value) as Settings;
}

export class SettingsStore {
  path: string;
  readonly home: string;
  readonly pointer: string;

  constructor(home = homedir(), path?: string) {
    this.home = home;
    this.pointer = resolve(home, ".afk/settings-location.json");
    this.path = expandPath(path ?? resolve(home, ".afk/settings.json"), home);
  }

  async initialize(): Promise<void> {
    if (process.env.AFK_SETTINGS) { this.path = expandPath(process.env.AFK_SETTINGS, this.home); return; }
    try {
      const pointer = JSON.parse(await readFile(this.pointer, "utf8")) as { path?: unknown };
      if (typeof pointer.path === "string") this.path = expandPath(pointer.path, this.home);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async read(): Promise<Settings> {
    try { return validateSettings(JSON.parse(await readFile(this.path, "utf8"))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySettings(); throw error; }
  }

  async save(settings: Settings): Promise<void> {
    const validated = validateSettings(settings);
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.path);
    } finally { await rm(temporary, { force: true }); }
  }

  async relocate(path: string): Promise<void> {
    const destination = expandPath(path, this.home);
    if (destination === this.path) return;
    try { await lstat(destination); throw new Error("That file already exists. Import it or choose another location."); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const settings = await this.read();
    const previous = this.path;
    const files: { path: string; content: string }[] = [];
    const checkedPath = async (root: string, path: string): Promise<void> => {
      let ancestor = root;
      while (ancestor !== dirname(ancestor)) {
        try {
          if ((await lstat(ancestor)).isSymbolicLink() && !["/var", "/tmp"].includes(ancestor)) throw new Error(`AFK folders cannot cross symbolic links: ${ancestor}`);
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        ancestor = dirname(ancestor);
      }
      let current = root;
      const parts = path.slice(root.length).split("/").filter(Boolean);
      for (const part of ["", ...parts]) {
        if (part) current = join(current, part);
        try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`AFK files cannot cross symbolic links: ${current}`); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
    };
    const collect = async (folder: string, prefix: string): Promise<void> => {
      await checkedPath(dirname(previous), folder);
      try {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
          if (entry.isSymbolicLink()) throw new Error("Rules references cannot contain symbolic links.");
          const path = `${prefix}${entry.name}`;
          if (entry.isDirectory()) await collect(join(folder, entry.name), `${path}/`);
          else if (entry.isFile()) files.push({ path, content: await readFile(join(folder, entry.name), "utf8") });
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    };
    if (dirname(destination) !== dirname(previous)) {
      await checkedPath(dirname(previous), join(dirname(previous), "AGENTS.md"));
      try { files.push({ path: "AGENTS.md", content: await readFile(join(dirname(previous), "AGENTS.md"), "utf8") }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      await collect(join(dirname(previous), "references"), "references/");
      await checkedPath(dirname(destination), join(dirname(destination), "references"));
      for (const file of files) {
        const target = join(dirname(destination), file.path);
        await checkedPath(dirname(destination), target);
        try { await lstat(target); throw new Error(`Rules file already exists at the destination: ${file.path}`); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
    }
    const created: string[] = [];
    this.path = destination;
    try {
      for (const file of files) {
        const target = join(dirname(destination), file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, { mode: 0o600, flag: "wx" });
        created.push(target);
      }
      await this.save(settings);
      created.push(destination);
      await mkdir(dirname(this.pointer), { recursive: true });
      const temporaryPointer = `${this.pointer}.${process.pid}.tmp`;
      try {
        await writeFile(temporaryPointer, JSON.stringify({ path: destination }), { mode: 0o600 });
        await rename(temporaryPointer, this.pointer);
      } finally { await rm(temporaryPointer, { force: true }); }
    } catch (error) {
      this.path = previous;
      await Promise.all(created.map(path => rm(path, { force: true })));
      throw error;
    }
  }

  async select(path: string): Promise<void> {
    const destination = expandPath(path, this.home);
    validateSettings(JSON.parse(await readFile(destination, "utf8")));
    await mkdir(dirname(this.pointer), { recursive: true });
    await writeFile(this.pointer, JSON.stringify({ path: destination }), { mode: 0o600 });
    this.path = destination;
  }

  async selectFolder(folder: string): Promise<void> {
    const current = await this.read();
    const hasActiveProfiles = current.profiles.some(profile => profile.enabled.length > 0);
    const hasRulesReceipts = Object.keys(current.agentRules?.receipts ?? {}).length > 0;
    const hasSkillOwnership = Object.keys(current.managedLinks).length > 0 || Object.values(current.independentSkills).some(skills => skills.length > 0);
    if (hasActiveProfiles || hasRulesReceipts || hasSkillOwnership) throw new Error("Disable active skills and profiles and disconnect synced rules before switching AFK folders.");
    await this.select(join(expandPath(folder, this.home), "settings.json"));
  }
}
