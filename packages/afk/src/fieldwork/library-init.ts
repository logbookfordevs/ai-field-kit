import { cp, lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { writeInvocationChoice } from "./invocation.js";
import { toolOwner } from "./kit.js";
import { agentSkillFolders, Library, type GitRunner, type InvocationChoice, type SkillRecord, type Storage } from "./library.js";
import { planLibrarySettings } from "./library-settings.js";
import { RulesWorkspace } from "./rules.js";
import { offFolder } from "./tool-skills.js";
import { skillName, type Settings, type SettingsStore } from "./settings.js";
import { globalLockPath } from "./skills.js";

export interface LibraryInitSkill {
  name: string;
  on: boolean;
  from: string;
  originals: string[];
  record: SkillRecord;
}

export interface StoredInitSkill {
  name: string;
  on: boolean;
  from: string;
  originals: string[];
}

export interface LibraryInitPlan {
  library: string;
  backup: string;
  skills: LibraryInitSkill[];
  packSkills: StoredInitSkill[];
  machineSkills: StoredInitSkill[];
  offToolSkills: StoredInitSkill[];
  missing: string[];
  toolSkills: string[];
  rules: string[];
}

interface LockEntry { source?: unknown; skillPath?: unknown; skillFolderHash?: unknown }

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

async function lockEntries(path: string): Promise<Record<string, LockEntry>> {
  try { return (JSON.parse(await readFile(path, "utf8")) as { skills?: Record<string, LockEntry> }).skills ?? {}; }
  catch { return {}; }
}

function backupFolder(home: string): string {
  return join(home, ".afk/library-backups");
}

async function isLinkTo(path: string, target: string): Promise<boolean> {
  try { return (await lstat(path)).isSymbolicLink() && resolve(dirname(path), await readlink(path)) === target; }
  catch { return false; }
}

async function isFolder(path: string): Promise<boolean> {
  try { return !(await lstat(path)).isSymbolicLink() && await exists(join(path, "SKILL.md")); }
  catch { return false; }
}

// A pack or machine skill moves from `.disabled` or a real folder in `~/.agents/skills`; AFK's links to it go too.
async function storedSkill(library: Library, name: string, live: string, disabled: string, packOn: boolean): Promise<StoredInitSkill | undefined> {
  const real = await isFolder(live);
  const from = await isFolder(disabled) ? disabled : real ? live : undefined;
  if (!from) return undefined;
  const originals = [from];
  for (const path of await library.links(name)) {
    if (path !== from && (await isLinkTo(path, from) || await isLinkTo(path, live))) originals.push(path);
  }
  const on = packOn || real || await isLinkTo(live, disabled);
  return { name, on, from, originals };
}

function choice(value: string | undefined): InvocationChoice {
  return value === "Manual only" || value === "Automatic allowed" ? value : "";
}

/** Reads this machine's Core skills and reports what `--apply` would move; it writes nothing. */
export async function planLibraryInit(store: SettingsStore, runner?: GitRunner): Promise<LibraryInitPlan> {
  const home = store.home, library = new Library(home, runner);
  if (await exists(library.root)) throw new Error(`A library already exists at ${library.root}.`);
  const settings = await store.read();
  const lock = await lockEntries(globalLockPath(home));
  const [agents] = agentSkillFolders(home);
  const plan: LibraryInitPlan = { library: library.root, backup: join(backupFolder(home), new Date().toISOString().replace(/[:.]/g, "-")), skills: [], packSkills: [], machineSkills: [], offToolSkills: [], missing: [], toolSkills: [], rules: [] };

  for (const entry of settings.kit?.core ?? []) {
    for (const name of entry.skills) {
      if (toolOwner(settings, name)) { plan.toolSkills.push(name); continue; }
      const live = join(agents!, name), stored = join(agents!, ".disabled", name);
      const on = await exists(join(live, "SKILL.md"));
      const from = on ? live : await exists(join(stored, "SKILL.md")) ? stored : undefined;
      if (!from) { plan.missing.push(name); continue; }
      const seen = new Set<string>(), originals: string[] = [];
      for (const path of [...await library.links(name), stored]) {
        let identity = path;
        try { identity = join(await realpath(dirname(path)), name); } catch { /* A missing folder holds nothing to move. */ }
        if (seen.has(identity)) continue;
        seen.add(identity);
        if (await exists(path)) originals.push(path);
      }
      const receipt = lock[name] ?? {};
      const record: SkillRecord = {
        source: entry.source,
        ...(typeof receipt.skillPath === "string" ? { skillPath: receipt.skillPath } : {}),
        ...(typeof receipt.skillFolderHash === "string" ? { revision: receipt.skillFolderHash } : {}),
        invocation: choice(settings.preferences[`Global|${name}`]),
      };
      plan.skills.push({ name, on, from: await realpath(from), originals, record });
    }
  }
  plan.skills.sort((a, b) => a.name.localeCompare(b.name));
  await planStoredSkills(library, settings, agents!, plan);
  plan.rules = (await new RulesWorkspace(store).files()).filter(file => file.path !== "AGENTS.md" || file.content).map(file => file.path);
  return plan;
}

async function planStoredSkills(library: Library, settings: Settings, agents: string, plan: LibraryInitPlan): Promise<void> {
  const core = new Set((settings.kit?.core ?? []).flatMap(entry => entry.skills));
  const taken = (name: string): boolean => core.has(name) || Boolean(toolOwner(settings, name));
  const packMembers = new Set(settings.profiles.flatMap(profile => profile.skills).filter(name => !taken(name)));
  for (const name of [...packMembers].sort()) {
    const on = settings.profiles.some(profile => profile.enabled.includes("Global") && profile.skills.includes(name));
    const skill = await storedSkill(library, name, join(agents, name), join(agents, ".disabled", name), on);
    if (skill) plan.packSkills.push(skill);
  }
  let disabled: string[] = [];
  try { disabled = (await readdir(join(agents, ".disabled"))).filter(name => skillName(name)); } catch { /* No .disabled folder. */ }
  for (const name of disabled.filter(name => toolOwner(settings, name)).sort()) {
    const from = join(agents, ".disabled", name);
    if (await isFolder(from)) plan.offToolSkills.push({ name, on: false, from, originals: [from] });
  }
  const machine = new Set([...settings.machineOnly, ...disabled].filter(name => !taken(name) && !packMembers.has(name)));
  for (const name of [...machine].sort()) {
    const skill = await storedSkill(library, name, join(agents, name), join(agents, ".disabled", name), false);
    if (skill) plan.machineSkills.push(skill);
  }
}

/** Builds the library's first commit from this machine and replaces the original folders with links. */
export async function applyLibraryInit(store: SettingsStore, runner?: GitRunner): Promise<LibraryInitPlan> {
  const plan = await planLibraryInit(store, runner);
  const library = new Library(store.home, runner);
  const settings = await store.read();
  const ruleFiles = (await new RulesWorkspace(store).files()).filter(file => plan.rules.includes(file.path));
  const moved: [string, string][] = [];
  const linked: string[] = [];
  const copied: string[] = [];
  const stored: (readonly [StoredInitSkill, Exclude<Storage, "library">])[] = [...plan.packSkills.map(skill => [skill, "pack"] as const), ...plan.machineSkills.map(skill => [skill, "machine"] as const)];
  const destinations = new Map<StoredInitSkill, string>([...stored.map(([skill, storage]) => [skill, library.storagePath(skill.name, storage)] as const), ...plan.offToolSkills.map(skill => [skill, join(offFolder(store.home), skill.name)] as const)]);
  const undo = async (): Promise<void> => {
    for (const name of linked) await library.unlink(name);
    for (const [original, destination] of moved.reverse()) await rename(destination, original);
    for (const path of copied) await rm(path, { recursive: true, force: true });
  };

  try {
    for (const [skill, destination] of destinations) {
      await mkdir(dirname(destination), { recursive: true });
      await cp(await realpath(skill.from), destination, { recursive: true, dereference: true, errorOnExist: true, force: false });
      copied.push(destination);
    }
    await library.create(`Start library with ${plan.skills.length} Core skill${plan.skills.length === 1 ? "" : "s"}`, async () => {
      for (const skill of plan.skills) {
        await mkdir(dirname(library.skillPath(skill.name)), { recursive: true });
        await cp(skill.from, library.skillPath(skill.name), { recursive: true, dereference: true, errorOnExist: true, force: false });
        if (skill.record.invocation) await writeInvocationChoice(library.skillPath(skill.name), skill.record.invocation);
        await library.writeRecord(skill.name, skill.record);
      }
      for (const [skill] of stored.filter(([, storage]) => storage === "pack")) {
        const invocation = choice(settings.preferences[`Global|${skill.name}`]);
        if (invocation) await writeInvocationChoice(library.storagePath(skill.name, "pack"), invocation);
      }
      await (await planLibrarySettings(store.home, settings))?.apply();
      for (const file of ruleFiles) {
        const path = join(library.root, "rules", file.path);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, file.content);
      }
    });
  } catch (error) {
    await undo();
    throw error;
  }

  try {
    for (const skill of [...plan.skills, ...destinations.keys()]) {
      for (const original of skill.originals) {
        const destination = join(plan.backup, relative(store.home, original));
        await mkdir(dirname(destination), { recursive: true });
        await rename(original, destination);
        moved.push([original, destination]);
        delete settings.managedLinks[original];
      }
    }
    for (const skill of plan.skills.filter(entry => entry.on)) {
      await library.link(skill.name);
      linked.push(skill.name);
    }
    for (const [skill, storage] of stored.filter(([skill]) => skill.on)) {
      await library.link(skill.name);
      linked.push(skill.name);
      if (storage === "pack") for (const path of await library.links(skill.name)) settings.managedLinks[path] = library.storagePath(skill.name, "pack");
    }
    const on = [...plan.skills, ...plan.machineSkills].filter(skill => skill.on).map(skill => skill.name);
    settings.independentSkills.Global = [...new Set([...(settings.independentSkills.Global ?? []), ...on])];
    settings.machineOnly = [...new Set([...settings.machineOnly, ...plan.machineSkills.map(skill => skill.name)])];
    await store.save(settings);
  } catch (error) {
    await undo();
    await rm(library.root, { recursive: true, force: true });
    throw error;
  }
  return plan;
}

/** Deletes the dated backups of the folders a library migration replaced. */
export async function confirmLibraryInit(store: SettingsStore): Promise<string> {
  const folder = backupFolder(store.home);
  await rm(folder, { recursive: true, force: true });
  return folder;
}
