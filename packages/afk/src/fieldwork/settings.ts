import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { validateSavedStack, type SavedStack } from "./stacks.js";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { applyLocalState, localState, portableSettings, verifiedLegacyState, type LocalState } from "./local-state.js";

export interface SavedSkill {
  name: string;
  source?: string;
  available: boolean;
  invocation: "" | "Manual only" | "Automatic allowed";
}

export interface SavedSkills {
  scope: string;
  savedAt: string;
  skills: SavedSkill[];
}

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
  configurationId?: string;
  savedSkills?: SavedSkills[];
  profiles: Profile[];
  projects: { name: string; path: string }[];
  tools: { id: number; name: string; install: string; update: string }[];
  favoriteSources: FavoriteSource[];
  stacks?: SavedStack[];
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
  const data = structuredClone(value) as Record<string, unknown>;
  if (data.version !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.projects) || !Array.isArray(data.tools) || !Array.isArray(data.favoriteSources)) {
    throw new Error("Unsupported settings format. Expected AFK settings version 1.");
  }
  const profiles = data.profiles as Profile[];
  for (const profile of profiles) {
    if (profile && typeof profile === "object") {
      profile.enabled ??= [];
      profile.ready ??= false;
    }
  }
  data.preferences ??= {};
  data.managedLinks ??= {};
  data.independentSkills ??= {};
  if (data.agentRules && typeof data.agentRules === "object") (data.agentRules as AgentRulesSettings).receipts ??= {};
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
  if (data.stacks !== undefined) {
    if (!Array.isArray(data.stacks)) throw new Error("Stacks must be an array of saved manifests.");
    const stacks = data.stacks.map(validateSavedStack);
    if (new Set(stacks.map(stack => stack.manifest.id)).size !== stacks.length) throw new Error("Stack identifiers must be unique.");
  }
  const preferences = data.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences) || !Object.entries(preferences).every(([key, mode]) => key.includes("|") && ["Manual only", "Automatic allowed"].includes(String(mode)))) throw new Error("Invalid invocation preferences.");
  const links = data.managedLinks;
  if (!links || typeof links !== "object" || Array.isArray(links) || !Object.entries(links).every(([path, target]) => nonempty(path) && nonempty(target))) throw new Error("Invalid managed link receipts.");
  const independent = data.independentSkills;
  if (!independent || typeof independent !== "object" || Array.isArray(independent) || !Object.values(independent).every(members => Array.isArray(members) && members.every(skillName))) throw new Error("Invalid individual activation state.");
  if (data.welcomeDismissed !== undefined && typeof data.welcomeDismissed !== "boolean") throw new Error("Invalid welcome dismissal state.");
  if (data.configurationId !== undefined && !skillName(data.configurationId)) throw new Error("Invalid configuration identifier.");
  if (data.savedSkills !== undefined) {
    const snapshots = data.savedSkills as SavedSkills[];
    if (!Array.isArray(snapshots) || !snapshots.every(snapshot => snapshot && scopes.has(snapshot.scope) && typeof snapshot.savedAt === "string" && Number.isFinite(Date.parse(snapshot.savedAt)) && Array.isArray(snapshot.skills) && snapshot.skills.every(skill => skill && skillName(skill.name) && typeof skill.available === "boolean" && ["", "Manual only", "Automatic allowed"].includes(skill.invocation) && (skill.source === undefined || (nonempty(skill.source) && !skill.source.startsWith("-")))) && new Set(snapshot.skills.map(skill => skill.name)).size === snapshot.skills.length) || new Set(snapshots.map(snapshot => snapshot.scope)).size !== snapshots.length) throw new Error("Invalid saved skills snapshot.");
  }
  if (data.agentRules !== undefined) {
    const rules = data.agentRules as AgentRulesSettings;
    if (!rules || !Array.isArray(rules.destinations) || !rules.destinations.every(d => d && skillName(d.id) && nonempty(d.name) && ["codex", "claude", "custom"].includes(d.kind) && nonempty(d.path))) throw new Error("Agent rules destinations need names and file paths.");
    if (new Set(rules.destinations.map(d => d.id)).size !== rules.destinations.length) throw new Error("Agent rules destination identifiers must be unique.");
    if (!rules.receipts || typeof rules.receipts !== "object" || Array.isArray(rules.receipts) || !Object.entries(rules.receipts).every(([id, r]) => skillName(id) && r && typeof r.region === "string" && typeof r.lastSync === "string" && r.references && typeof r.references === "object" && !Array.isArray(r.references) && Object.entries(r.references).every(([path, content]) => path.startsWith("references/") && !path.split("/").includes("..") && typeof content === "string"))) throw new Error("Invalid agent rules sync receipts.");
  }
  return data as unknown as Settings;
}

export class SettingsStore {
  path: string;
  readonly home: string;
  readonly pointer: string;
  private readonly identifiers = new Map<string, string>();

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
    try {
      const settings = validateSettings(JSON.parse(await readFile(this.path, "utf8")));
      const legacy = !settings.configurationId;
      settings.configurationId ??= this.identifier(true);
      let state: LocalState | undefined;
      try {
        const raw = JSON.parse(await readFile(this.localPath(settings.configurationId), "utf8")) as LocalState;
        if (raw.version !== 1 || !raw.profiles || typeof raw.profiles !== "object" || Array.isArray(raw.profiles) || !Object.values(raw.profiles).every(profile => profile && typeof profile.definition === "string" && Array.isArray(profile.enabled) && profile.enabled.every(scope => typeof scope === "string") && typeof profile.ready === "boolean")) throw new Error("Invalid machine-local profile state.");
        validateSettings({ ...settings, preferences: raw.preferences, managedLinks: raw.managedLinks, independentSkills: raw.independentSkills, agentRules: { destinations: [], receipts: raw.ruleReceipts } });
        if (raw.projectPaths !== undefined && (!raw.projectPaths || typeof raw.projectPaths !== "object" || Array.isArray(raw.projectPaths) || !Object.values(raw.projectPaths).every(path => typeof path === "string"))) throw new Error("Invalid machine-local project paths.");
        state = raw;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (!state && legacy) state = await verifiedLegacyState(settings, this.home);
      return applyLocalState(settings, state, this.home);
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySettings(); throw error; }
  }

  private identifier(legacy = false): string {
    const key = this.path + (legacy ? "|legacy" : "");
    let id = this.identifiers.get(key);
    if (!id) { id = randomUUID(); this.identifiers.set(key, id); }
    return id;
  }

  localPath(id: string): string {
    if (!skillName(id)) throw new Error("Invalid configuration identifier.");
    return join(this.home, ".afk/local", id + ".json");
  }

  async save(settings: Settings): Promise<void> {
    settings.configurationId ??= this.identifier();
    const validated = validateSettings(settings);
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    const local = this.localPath(validated.configurationId!);
    await mkdir(dirname(local), { recursive: true });
    const localTemporary = `${local}.${process.pid}.tmp`;
    let previous: string | undefined;
    try { previous = await readFile(local, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    try {
      await writeFile(temporary, `${JSON.stringify(portableSettings(validated), null, 2)}\n`, { mode: 0o600 });
      await writeFile(localTemporary, `${JSON.stringify(localState(validated, this.home), null, 2)}\n`, { mode: 0o600 });
      await rename(localTemporary, local);
      await rename(temporary, this.path);
    } catch (error) {
      if (previous === undefined) await rm(local, { force: true });
      else { await writeFile(localTemporary, previous, { mode: 0o600 }); await rename(localTemporary, local); }
      throw error;
    } finally { await rm(temporary, { force: true }); await rm(localTemporary, { force: true }); }
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
