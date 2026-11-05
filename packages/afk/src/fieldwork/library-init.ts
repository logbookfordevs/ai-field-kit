import { cp, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { writeInvocationChoice } from "./invocation.js";
import { toolOwner } from "./kit.js";
import { agentSkillFolders, Library, type GitRunner, type InvocationChoice, type SkillRecord } from "./library.js";
import { RulesWorkspace } from "./rules.js";
import type { SettingsStore } from "./settings.js";
import { globalLockPath } from "./skills.js";

export interface LibraryInitSkill {
  name: string;
  on: boolean;
  from: string;
  originals: string[];
  record: SkillRecord;
}

export interface LibraryInitPlan {
  library: string;
  backup: string;
  skills: LibraryInitSkill[];
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
  const plan: LibraryInitPlan = { library: library.root, backup: join(backupFolder(home), new Date().toISOString().replace(/[:.]/g, "-")), skills: [], missing: [], toolSkills: [], rules: [] };

  for (const entry of settings.kit?.core ?? []) {
    for (const name of entry.skills) {
      if (toolOwner(settings, name)) { plan.toolSkills.push(name); continue; }
      const live = join(agents!, name), stored = join(agents!, ".disabled", name);
      const on = await exists(join(live, "SKILL.md"));
      const from = on ? live : await exists(join(stored, "SKILL.md")) ? stored : undefined;
      if (!from) { plan.missing.push(name); continue; }
      const seen = new Set<string>(), originals: string[] = [];
      for (const path of [...library.links(name), stored]) {
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
  plan.rules = (await new RulesWorkspace(store).files()).filter(file => file.path !== "AGENTS.md" || file.content).map(file => file.path);
  return plan;
}

/** Builds the library's first commit from this machine and replaces the original folders with links. */
export async function applyLibraryInit(store: SettingsStore, runner?: GitRunner): Promise<LibraryInitPlan> {
  const plan = await planLibraryInit(store, runner);
  const library = new Library(store.home, runner);
  const settings = await store.read();
  const rules = new RulesWorkspace(store);

  await library.create(`Start library with ${plan.skills.length} Core skill${plan.skills.length === 1 ? "" : "s"}`, async () => {
    for (const skill of plan.skills) {
      await mkdir(dirname(library.skillPath(skill.name)), { recursive: true });
      await cp(skill.from, library.skillPath(skill.name), { recursive: true, dereference: true, errorOnExist: true, force: false });
      if (skill.record.invocation) await writeInvocationChoice(library.skillPath(skill.name), skill.record.invocation);
      await library.writeRecord(skill.name, skill.record);
    }
    await library.writeSettings({ version: 1, core: settings.kit?.core ?? [], agentRules: { destinations: settings.agentRules?.destinations ?? [] } });
    for (const file of (await rules.files()).filter(file => plan.rules.includes(file.path))) {
      const path = join(library.root, "rules", file.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, file.content);
    }
  });

  const moved: [string, string][] = [];
  const linked: string[] = [];
  try {
    for (const skill of plan.skills) {
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
    const on = plan.skills.filter(skill => skill.on).map(skill => skill.name);
    settings.independentSkills.Global = [...new Set([...(settings.independentSkills.Global ?? []), ...on])];
    await store.save(settings);
  } catch (error) {
    for (const name of linked) await library.unlink(name);
    for (const [original, destination] of moved.reverse()) await rename(destination, original);
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
