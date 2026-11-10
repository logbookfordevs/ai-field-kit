import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { writeInvocationChoice } from "./invocation.js";
import { Library, type InvocationChoice, type Storage } from "./library.js";
import { sameSkillName, skillName, type Settings, type SettingsStore } from "./settings.js";

export interface StagedSkill {
  name: string;
  path: string;
  /** Absent for an uploaded skill, which has no repository to update from. */
  source?: string;
  skillPath?: string;
  revision?: string;
}

interface LockEntry { source?: unknown; skillPath?: unknown; skillFolderHash?: unknown }

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

export function stagedLockPath(home: string): string {
  return join(home, ".agents/.skill-lock.json");
}

export async function readLock(path: string): Promise<Record<string, LockEntry>> {
  try { return (JSON.parse(await readFile(path, "utf8")) as { skills?: Record<string, LockEntry> }).skills ?? {}; }
  catch { return {}; }
}

/** The skills Skills CLI left in an isolated home, with the source and revision it recorded for each. */
export async function readStaged(home: string, fallbackSource: string, names?: string[]): Promise<StagedSkill[]> {
  const root = join(home, ".agents/skills"), lock = await readLock(stagedLockPath(home));
  let found: string[] = [];
  try { found = (await readdir(root)).filter(name => skillName(name)); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const wanted = names ?? found;
  const staged: StagedSkill[] = [];
  for (const name of wanted) {
    if (!await exists(join(root, name, "SKILL.md"))) throw new Error(`Skills CLI did not install ${name} from ${fallbackSource}.`);
    const entry = lock[name] ?? {};
    staged.push({
      name, path: join(root, name),
      source: typeof entry.source === "string" ? entry.source : fallbackSource,
      ...(typeof entry.skillPath === "string" ? { skillPath: entry.skillPath } : {}),
      ...(typeof entry.skillFolderHash === "string" ? { revision: entry.skillFolderHash } : {}),
    });
  }
  return staged;
}

export interface StoreOptions {
  /** Where new skills go; a skill already stored somewhere else is moved here, otherwise it stays where it is. */
  destination?: Storage;
  /** Saves the skills for a pack that stays off until turned on: stored where `destination` says, never linked or marked on here. */
  packMember?: boolean;
  /** Replaces files in place: links, on/off state and the Core list stay as they are. */
  update?: boolean;
  /** Names the library save instead of "Install …", for a move between storages. */
  message?: string;
  /** Installs only: leaves the folder where Skills CLI put it, so the skill waits in To review. */
  unstored?: boolean;
  /** Edits the settings inside the same commit as the copied files. */
  finalize?: (settings: Settings, names: string[]) => void;
}

function choice(value: string | undefined): InvocationChoice {
  return value === "Manual only" || value === "Automatic allowed" ? value : "";
}

/** Copies staged skills into the library, pack cache or machine storage, links them and commits once; a failure leaves everything as it was. */
export async function storeSkills(store: SettingsStore, staged: StagedSkill[], options: StoreOptions = {}): Promise<void> {
  const library = new Library(store.home);
  if (!staged.length) return;
  for (const { name } of staged) {
    const twin = await library.caseTwin(name);
    if (twin) throw new Error(`${name} differs from the stored ${twin} only in letter case, so both would share one folder. Nothing was changed; rename the new skill or replace ${twin} under its own name.`);
  }
  const twins = staged.find(skill => staged.some(other => other !== skill && sameSkillName(other.name, skill.name)));
  if (twins) throw new Error(`Two skills named ${twins.name} apart from letter case can't be stored together. Nothing was changed.`);
  const existing = new Map<string, Storage | undefined>();
  for (const { name } of staged) existing.set(name, await library.storage(name));
  const targets = staged.map(skill => ({ skill, from: existing.get(skill.name), to: options.destination ?? existing.get(skill.name) ?? "library" as Storage }));
  const names = staged.map(skill => skill.name);
  const shown = targets.some(target => target.to === "library") ? targets.filter(target => target.to === "library") : targets;
  const member = options.packMember === true;
  const reinstall = shown.every(target => target.from === target.to);
  const message = options.message ?? `${options.update ? "Update" : reinstall ? "Reinstall" : "Install"} ${shown.map(target => target.skill.name).join(", ")}`;

  const original = structuredClone(await store.read());

  // The outermost library change owns rollback and cleanup, so an enclosing change that fails later still gets the old copies back.
  await library.change(message, async () => {
    const undo = (step: () => Promise<unknown>): void => library.onRollback(step);
    for (const { skill, from, to } of targets) {
      const destination = library.storagePath(skill.name, to);
      const fresh = join(dirname(destination), `.afk-new-${randomUUID()}`);
      await mkdir(dirname(destination), { recursive: true });
      // A library copy is found by its record, so the source note kept beside pack and machine copies stays behind.
      const keep = (path: string): boolean => to !== "library" || dirname(path) !== skill.path || basename(path) !== ".afk-source.json";
      await cp(skill.path, fresh, { recursive: true, dereference: true, errorOnExist: true, force: false, filter: keep });
      undo(() => rm(fresh, { recursive: true, force: true }));
      const mode = choice(original.preferences[`Global|${skill.name}`]);
      if (mode) await writeInvocationChoice(fresh, mode);
      if (to !== "library" && skill.source) await writeFile(join(fresh, ".afk-source.json"), JSON.stringify({ source: skill.source }), { mode: 0o600 });

      const wasOn = await library.linked(skill.name);
      const moved = from !== undefined && from !== to;
      if (moved) {
        await library.unlink(skill.name);
        undo(async () => { if (wasOn) await library.link(skill.name); });
      }
      const previous = from ? library.storagePath(skill.name, from) : undefined;
      if (previous) {
        const aside = join(dirname(previous), `.afk-old-${randomUUID()}`);
        await rename(previous, aside);
        undo(async () => { await rm(previous, { recursive: true, force: true }); await rename(aside, previous); });
        library.afterCommit(() => rm(aside, { recursive: true, force: true }));
      }
      if (await exists(destination)) {
        const parked = join(dirname(destination), `.afk-old-${randomUUID()}`);
        await rename(destination, parked);
        undo(async () => { await rm(destination, { recursive: true, force: true }); await rename(parked, destination); });
        library.afterCommit(() => rm(parked, { recursive: true, force: true }));
      }
      await rename(fresh, destination);
      undo(() => rm(destination, { recursive: true, force: true }));

      if (to !== "machine") await library.writeRecord(skill.name, { ...(skill.source ? { source: skill.source } : {}), ...(skill.skillPath ? { skillPath: skill.skillPath } : {}), ...(skill.revision ? { revision: skill.revision } : {}), invocation: mode });
      if (!options.update && ((to !== "pack" && !member) || wasOn)) {
        const created = await library.link(skill.name);
        undo(async () => { for (const path of created) await rm(path, { force: true }); });
      }
    }
    if (options.update) return;
    const settings = await store.read();
    const independent = new Set(settings.independentSkills.Global ?? []);
    for (const { skill, to } of targets) if (to !== "pack" && !member) independent.add(skill.name);
    settings.independentSkills.Global = [...independent];
    options.finalize?.(settings, names);
    undo(() => store.save(original));
    await store.save(settings);
  });
}
