import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readFile, readlink, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { addToCore, isRepositorySource, toolOwner } from "./kit.js";
import type { InvocationChoice, SkillRecord } from "./library.js";
import { sourceIdentity } from "./migration.js";
import { UPLOADED_SOURCE, type Settings } from "./settings.js";
import { globalLockPath, sameSkillFiles, SkillLibrary } from "./skills.js";

export type AdoptDestination = "library" | "machine";

async function kind(path: string): Promise<"link" | "folder" | undefined> {
  try { return (await lstat(path)).isSymbolicLink() ? "link" : "folder"; }
  catch (error) { if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return undefined; throw error; }
}

async function lockEntry(home: string, name: string): Promise<{ skillPath?: unknown; skillFolderHash?: unknown }> {
  try { return (JSON.parse(await readFile(globalLockPath(home), "utf8")) as { skills?: Record<string, { skillPath?: unknown; skillFolderHash?: unknown }> }).skills?.[name] ?? {}; }
  catch { return {}; }
}

/** Moves a skill installed outside AFK into the library or machine storage and links it from every agent folder. */
export async function adoptSkill(skills: SkillLibrary, settings: Settings, name: string, to: AdoptDestination, bookmark = false): Promise<void> {
  const { library, store } = skills;
  if (!await library.exists()) throw new Error("Start a library first with `afk library init`.");
  if (await library.storage(name)) throw new Error(`${name} is already stored by AFK.`);
  if (toolOwner(settings, name)) throw new Error(`${name} is provided by a tool and stays where the tool put it.`);
  const live = join(skills.root(settings, "Global"), name);
  if (await kind(live) !== "folder" || await kind(join(live, "SKILL.md")) === undefined) throw new Error(`${name} is not a skill folder in ${dirname(live)}.`);

  const others: string[] = [];
  for (const path of (await library.links(name)).filter(path => path !== live)) {
    const found = await kind(path);
    if (found === "link" && resolve(dirname(path), await readlink(path)) === live) others.push(path);
    else if (found === "folder" && await sameSkillFiles(path, live)) others.push(path);
    else if (found) throw new Error(`${path} holds a different copy of ${name}. Existing files were preserved.`);
  }

  const source = (await skills.inventory(settings, "Global")).find(entry => entry.name === name)?.source;
  const stored = library.storagePath(name, to);
  const parked: [string, string][] = [];
  if (await kind(stored)) throw new Error(`${stored} already exists. Existing files were preserved.`);

  const adopt = async (): Promise<void> => {
    await mkdir(dirname(stored), { recursive: true });
    await cp(live, stored, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
    for (const path of [live, ...others]) {
      const aside = join(dirname(path), `.afk-adopting-${randomUUID()}`);
      await rename(path, aside);
      parked.push([path, aside]);
    }
    if (to === "library") {
      const repository = isRepositorySource(source) ? source : undefined;
      const receipt = repository ? await lockEntry(store.home, name) : {};
      const record: SkillRecord = {
        ...(repository ? { source: repository } : {}),
        ...(typeof receipt.skillPath === "string" ? { skillPath: receipt.skillPath } : {}),
        ...(typeof receipt.skillFolderHash === "string" ? { revision: receipt.skillFolderHash } : {}),
        invocation: (settings.preferences[`Global|${name}`] ?? "") as InvocationChoice,
      };
      await library.writeRecord(name, record);
      addToCore(settings, name, repository ?? UPLOADED_SOURCE);
      settings.machineOnly = settings.machineOnly.filter(member => member !== name);
    } else {
      settings.machineOnly = [...new Set([...settings.machineOnly, name])];
      if (bookmark && isRepositorySource(source) && !settings.favoriteSources.some(item => sourceIdentity(item.source) === sourceIdentity(source))) settings.favoriteSources.push({ name, source });
    }
    await library.link(name);
    settings.independentSkills.Global = [...new Set([...(settings.independentSkills.Global ?? []), name])];
    await store.save(settings);
  };

  const original = structuredClone(settings);
  try {
    if (to === "library") await library.change(`Add ${name} to the library`, adopt);
    else await adopt();
  } catch (error) {
    await library.unlink(name);
    for (const [path, aside] of parked.reverse()) await rename(aside, path);
    if (to === "machine") await rm(stored, { recursive: true, force: true });
    Object.assign(settings, original);
    throw error;
  }
  for (const [, aside] of parked) await rm(aside, { recursive: true, force: true });
}
