import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { validateSavedStack, type SavedStack } from "./stacks.js";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { applyLocalState, localState, portableSettings, verifiedLegacyState, type LocalState } from "./local-state.js";
import { Library } from "./library.js";
import { librarySettingsActive, planLibrarySettings, readLibrarySettings, recordedInvocations } from "./library-settings.js";

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
  claudeMdImport?: boolean;
}

export type AgentRulesDestination = RulesDestination;

export interface RulesReceipt {
  region: string;
  references: Record<string, string>;
  lastSync: string;
  claudeMdImport?: string;
}

export interface AgentRulesSettings {
  destinations: RulesDestination[];
  receipts: Record<string, RulesReceipt>;
}

export interface ProfileGroup {
  source: string;
  skills: string[];
}

export interface Profile {
  id: string;
  name: string;
  source: string;
  skills: string[];
  groups?: ProfileGroup[];
  description?: string;
  origin?: string;
  sourceNames?: Record<string, string>;
  enabled: string[];
  ready: boolean;
}

export interface KitSource {
  source: string;
  name?: string;
  skills: string[];
  follow?: boolean;
}

export interface Kit {
  core: KitSource[];
}

export interface Tool {
  id: number;
  name: string;
  install: string;
  update: string;
  provides?: string[];
}

export const LOCAL_PROFILE_SOURCE = "Local skill selection";
/** Names the saved copy of uploaded skills in Core and pack definitions, which have no repository to point at. */
export const UPLOADED_SOURCE = "Uploaded skill";

export function profileGroups(profile: Pick<Profile, "source" | "skills" | "groups">): ProfileGroup[] {
  return profile.groups ?? [{ source: profile.source, skills: profile.skills }];
}

export function isProfileGroup(value: unknown): value is ProfileGroup {
  if (!value || typeof value !== "object") return false;
  const { source, skills } = value as Record<string, unknown>;
  return nonempty(source) && !source.startsWith("-") && Array.isArray(skills) && skills.length > 0 && skills.every(skillName);
}

export function validProfileGroups(groups: unknown): groups is ProfileGroup[] {
  return Array.isArray(groups) && groups.length > 1 && groups.every(isProfileGroup)
    && new Set(groups.map(group => group.source)).size === groups.length;
}

export interface FavoriteSource {
  name: string;
  source: string;
  description?: string;
  skills?: string[];
}

export const SETTINGS_VERSION = 2;

export interface Settings {
  version: 1 | 2;
  configurationId?: string;
  /** Version 1 only; read so migration can carry it forward. */
  savedSkills?: SavedSkills[];
  profiles: Profile[];
  projects: { name: string; path: string }[];
  tools: Tool[];
  favoriteSources: FavoriteSource[];
  /** Version 1 only; read so migration can carry it forward. */
  stacks?: SavedStack[];
  kit?: Kit;
  machineOnly: string[];
  preferences: Record<string, string>;
  managedLinks: Record<string, string>;
  independentSkills: Record<string, string[]>;
  agentRules?: AgentRulesSettings | undefined;
  welcomeDismissed?: boolean;
}

export function emptySettings(): Settings {
  return { version: SETTINGS_VERSION, profiles: [], projects: [], tools: [], favoriteSources: [], kit: { core: [] }, machineOnly: [], preferences: {}, managedLinks: {}, independentSkills: {} };
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

/** Skill names are folder names, and most agent machines fold letter case, so `Foo` and `foo` are one skill. */
export function sameSkillName(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !containsControl(value);
}

export function requiresMigrationChoice(settings: Pick<Settings, "version" | "stacks">): boolean {
  return settings.version === 1 && Boolean(settings.stacks?.length);
}

function upgradeStackless(settings: Settings): void {
  settings.version = SETTINGS_VERSION;
  settings.kit ??= { core: [] };
  delete settings.stacks;
  delete settings.savedSkills;
}

function validateKit(value: unknown): asserts value is Kit {
  const core = (value as Kit | null)?.core;
  if (!Array.isArray(core)) throw new Error("The kit needs a core list.");
  for (const entry of core) {
    if (!entry || !nonempty(entry.source) || entry.source.startsWith("-") || (entry.name !== undefined && !nonempty(entry.name)) || (entry.follow !== undefined && typeof entry.follow !== "boolean") || !Array.isArray(entry.skills) || !entry.skills.every(skillName)) throw new Error("Core sources need a repository reference and valid skill names.");
    if (!entry.skills.length && !entry.follow) throw new Error("A core source needs at least one skill unless it is followed.");
  }
  const names = core.flatMap(entry => entry.skills);
  if (new Set(names).size !== names.length) throw new Error("Each core skill can come from only one source.");
  if (new Set(core.map(entry => entry.source)).size !== core.length) throw new Error("Each core source can appear only once.");
}

export const MIGRATION_REQUIRED = "These settings use the old stacks format. Run `afk migrate` to review the change, or open the AFK app, before making changes.";

export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") throw new Error("Choose an AFK settings file.");
  const data = structuredClone(value) as Record<string, unknown>;
  if ((data.version !== 1 && data.version !== SETTINGS_VERSION) || !Array.isArray(data.profiles) || !Array.isArray(data.projects) || !Array.isArray(data.tools) || !Array.isArray(data.favoriteSources)) {
    throw new Error("Unsupported settings format. Expected AFK settings version 1 or 2. Update AFK if this file came from a newer version.");
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
  data.machineOnly ??= [];
  if (data.version === SETTINGS_VERSION) data.kit ??= { core: [] };
  if (data.agentRules && typeof data.agentRules === "object") (data.agentRules as AgentRulesSettings).receipts ??= {};
  const projects = data.projects as Settings["projects"];
  const tools = data.tools as Settings["tools"];
  const sources = data.favoriteSources as Settings["favoriteSources"];
  if (!projects.every(p => p && nonempty(p.name) && p.name !== "Global" && !p.name.includes("|") && nonempty(p.path))) throw new Error("Projects need unique names and folder paths.");
  const scopes = new Set(["Global", ...projects.map(p => p.name)]);
  if (scopes.size !== projects.length + 1) throw new Error("Project names must be unique.");
  if (!profiles.every(p => p && skillName(p.id) && nonempty(p.name) && nonempty(p.source) && Array.isArray(p.skills) && p.skills.length > 0 && p.skills.every(skillName) && new Set(p.skills).size === p.skills.length && Array.isArray(p.enabled) && p.enabled.every(s => scopes.has(s)) && typeof p.ready === "boolean")) throw new Error("Profiles need valid members and activation scopes.");
  if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error("Profile identifiers must be unique.");
  for (const profile of profiles) {
    if (profile.groups === undefined) continue;
    if (!validProfileGroups(profile.groups) || profile.source !== profile.groups[0]!.source || JSON.stringify(profile.groups.flatMap(group => group.skills)) !== JSON.stringify(profile.skills)) throw new Error("Multi-source profiles need distinct sources whose skills match the profile members; each skill comes from one source.");
  }
  if (!tools.every(t => t && Number.isSafeInteger(t.id) && nonempty(t.name) && typeof t.install === "string" && t.install.trim() && !t.install.includes("\0") && typeof t.update === "string" && !t.update.includes("\0"))) throw new Error("Tools need names and install commands.");
  if (new Set(tools.map(t => t.id)).size !== tools.length) throw new Error("Tool identifiers must be unique.");
  if (!tools.every(t => t.provides === undefined || (Array.isArray(t.provides) && t.provides.length > 0 && t.provides.every(skillName) && new Set(t.provides).size === t.provides.length))) throw new Error("A tool's provided skills must be unique, valid skill names.");
  const provided = tools.flatMap(t => t.provides ?? []);
  if (new Set(provided).size !== provided.length) throw new Error("Each skill can be provided by only one tool.");
  if (!sources.every(s => s && nonempty(s.name) && nonempty(s.source) && !s.source.startsWith("-"))) throw new Error("Sources need names and repository references.");
  if (!sources.every(s => s.description === undefined || (nonempty(s.description) && s.description.length <= 280))) throw new Error("Source descriptions must be short text without control characters.");
  if (!sources.every(s => s.skills === undefined || (Array.isArray(s.skills) && s.skills.length > 0 && s.skills.every(skillName) && new Set(s.skills).size === s.skills.length))) throw new Error("Choose at least one valid, unique skill for each selected source.");
  if (data.version === SETTINGS_VERSION && (data.stacks !== undefined || data.savedSkills !== undefined)) throw new Error("Version 2 settings use kit and packs instead of stacks and saved skills.");
  if (!Array.isArray(data.machineOnly) || !data.machineOnly.every(skillName)) throw new Error("Invalid machine-only skills.");
  if (data.kit !== undefined) validateKit(data.kit);
  for (const profile of profiles) {
    if (profile.description !== undefined && !nonempty(profile.description)) throw new Error("Pack descriptions must be text without control characters.");
    if (profile.origin !== undefined && !nonempty(profile.origin)) throw new Error("Pack origins must be text without control characters.");
    if (profile.sourceNames !== undefined && (!profile.sourceNames || typeof profile.sourceNames !== "object" || Array.isArray(profile.sourceNames) || !Object.values(profile.sourceNames).every(nonempty))) throw new Error("Pack source names must be text without control characters.");
  }
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
    if (!rules || !Array.isArray(rules.destinations) || !rules.destinations.every(d => d && skillName(d.id) && nonempty(d.name) && ["codex", "claude", "custom"].includes(d.kind) && nonempty(d.path) && (d.claudeMdImport === undefined || typeof d.claudeMdImport === "boolean" && d.kind !== "codex"))) throw new Error("Agent rules destinations need names and file paths.");
    if (new Set(rules.destinations.map(d => d.id)).size !== rules.destinations.length) throw new Error("Agent rules destination identifiers must be unique.");
    if (!rules.receipts || typeof rules.receipts !== "object" || Array.isArray(rules.receipts) || !Object.entries(rules.receipts).every(([id, r]) => skillName(id) && r && typeof r.region === "string" && typeof r.lastSync === "string" && (r.claudeMdImport === undefined || typeof r.claudeMdImport === "string") && r.references && typeof r.references === "object" && !Array.isArray(r.references) && Object.entries(r.references).every(([path, content]) => path.startsWith("references/") && !path.split("/").includes("..") && typeof content === "string"))) throw new Error("Invalid agent rules sync receipts.");
  }
  return data as unknown as Settings;
}

const PERMANENT_BACKUP_NAME = /^pre-kit-[0-9A-Za-z-]+\.json$/;

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
    if (await librarySettingsActive(this.home)) return this.readLibrary();
    try {
      const settings = validateSettings(JSON.parse(await this.readPortable()));
      if (settings.version === 1 && !requiresMigrationChoice(settings)) upgradeStackless(settings);
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

  // After library init the portable settings come from the library's `.afk/` files and `settings.json` is left as it was.
  private async readLibrary(): Promise<Settings> {
    const settings = await readLibrarySettings(this.home);
    settings.configurationId ??= this.identifier();
    let state: LocalState | undefined;
    try { state = JSON.parse(await readFile(this.localPath(settings.configurationId), "utf8")) as LocalState; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    settings.projects = state?.projects ?? [];
    const result = applyLocalState(validateSettings(settings), state, this.home);
    await this.dropStoredMachineOnly(result, state);
    for (const [name, invocation] of Object.entries(await recordedInvocations(this.home))) {
      if (invocation) result.preferences[`Global|${name}`] = invocation;
      else delete result.preferences[`Global|${name}`];
    }
    return validateSettings(result);
  }

  // A skill is in Core or the library, or it is machine-only, never both; earlier versions left both marks behind.
  private async dropStoredMachineOnly(settings: Settings, state: LocalState | undefined): Promise<void> {
    const stored = new Set([...(settings.kit?.core ?? []).flatMap(entry => entry.skills), ...await new Library(this.home).names()]);
    const kept = settings.machineOnly.filter(name => !stored.has(name));
    if (kept.length === settings.machineOnly.length) return;
    settings.machineOnly = kept;
    if (!state || !settings.configurationId) return;
    const local = this.localPath(settings.configurationId);
    await mkdir(dirname(local), { recursive: true });
    await writeFile(`${local}.${process.pid}.tmp`, `${JSON.stringify({ ...state, machineOnly: kept }, null, 2)}\n`, { mode: 0o600 });
    await rename(`${local}.${process.pid}.tmp`, local);
  }

  private async saveLibrary(settings: Settings): Promise<void> {
    const local = this.localPath(settings.configurationId!);
    let previous: string | undefined;
    try { previous = await readFile(local, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const writeLocal = async (text: string): Promise<void> => {
      await mkdir(dirname(local), { recursive: true });
      await writeFile(`${local}.${process.pid}.tmp`, text, { mode: 0o600 });
      await rename(`${local}.${process.pid}.tmp`, local);
    };
    const next = `${JSON.stringify(localState(settings, this.home), null, 2)}\n`;
    const change = await planLibrarySettings(this.home, settings);
    if (!change) return writeLocal(next);
    try {
      await new Library(this.home).change(change.message, async () => { await change.apply(); await writeLocal(next); });
    } catch (error) {
      if (previous === undefined) await rm(local, { force: true }); else await writeLocal(previous);
      throw error;
    }
  }

  // A sync can briefly remove the file; only a machine that saved settings before, or a custom location, can be in that gap.
  private async readPortable(): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      try { return await readFile(this.path, "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || attempt === 4 || !await this.mayBeSyncing()) throw error;
        await new Promise(done => setTimeout(done, 100));
      }
    }
  }

  private async mayBeSyncing(): Promise<boolean> {
    if (this.path !== resolve(this.home, ".afk/settings.json")) return true;
    try { await readdir(join(this.home, ".afk/local")); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
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

  async save(settings: Settings, options: { migrating?: boolean } = {}): Promise<void> {
    settings.configurationId ??= this.identifier();
    if (settings.version === 1) {
      if (requiresMigrationChoice(settings)) throw new Error(MIGRATION_REQUIRED);
      upgradeStackless(settings);
    }
    const validated = validateSettings(settings);
    if (await librarySettingsActive(this.home)) return this.saveLibrary(validated);
    await mkdir(dirname(this.path), { recursive: true });
    const serialized = `${JSON.stringify(portableSettings(validated), null, 2)}\n`;
    const existing = await this.existingPortable();
    if (existing?.legacy) {
      if (existing.legacy === "stacks" && !options.migrating) throw new Error(MIGRATION_REQUIRED);
      await this.preserveLegacy(existing.text);
    }
    if (existing !== undefined && existing.text !== serialized && existing.configurationId !== undefined && existing.configurationId !== validated.configurationId) {
      throw new Error("Refusing to overwrite a different AFK configuration.");
    }
    const temporary = `${this.path}.${process.pid}.tmp`;
    const local = this.localPath(validated.configurationId!);
    await mkdir(dirname(local), { recursive: true });
    const localTemporary = `${local}.${process.pid}.tmp`;
    let previous: string | undefined;
    try { previous = await readFile(local, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    try {
      await writeFile(temporary, serialized, { mode: 0o600 });
      await writeFile(localTemporary, `${JSON.stringify(localState(validated, this.home), null, 2)}\n`, { mode: 0o600 });
      await rename(localTemporary, local);
      await rename(temporary, this.path);
    } catch (error) {
      if (previous === undefined) await rm(local, { force: true });
      else { await writeFile(localTemporary, previous, { mode: 0o600 }); await rename(localTemporary, local); }
      throw error;
    } finally { await rm(temporary, { force: true }); await rm(localTemporary, { force: true }); }
  }

  private async existingPortable(): Promise<{ text: string; configurationId?: string; legacy?: "stacks" | "plain" } | undefined> {
    let text: string;
    try { text = await readFile(this.path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
    try {
      const parsed = JSON.parse(text) as { configurationId?: unknown; version?: unknown; stacks?: unknown };
      const legacy = parsed.version === 1 ? { legacy: Array.isArray(parsed.stacks) && parsed.stacks.length ? "stacks" as const : "plain" as const } : {};
      return { text, ...(typeof parsed.configurationId === "string" ? { configurationId: parsed.configurationId } : {}), ...legacy };
    } catch { return { text }; }
  }

  get backupFolder(): string {
    return join(this.home, ".afk/backups");
  }

  /** The fingerprint a migration review is tied to; a file edited since then must be reviewed again. */
  async portableText(): Promise<string | undefined> {
    return (await this.existingPortable())?.text;
  }

  /** Keeps a permanent copy of pre-kit settings so a migration can always be undone. */
  async preserveLegacy(text: string): Promise<string> {
    const folder = this.backupFolder;
    await mkdir(folder, { recursive: true });
    for (const name of await readdir(folder)) {
      if (PERMANENT_BACKUP_NAME.test(name) && await readFile(join(folder, name), "utf8") === text) return join(folder, name);
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = join(folder, `pre-kit-${stamp}-${randomUUID().slice(0, 8)}.json`);
    await writeFile(path, text, { mode: 0o600, flag: "wx" });
    return path;
  }
}
