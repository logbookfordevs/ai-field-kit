import { lstat, mkdir, readdir, readFile, readlink, rename, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { moveAside, type AsideMove } from "./aside.js";
import { restoreInvocations } from "./invocation.js";
import { restoreInvocationFields, type InvocationBackup } from "./invocation-fields.js";
import { sameSkillFiles, SkillLibrary } from "./skills.js";
import type { Settings, SettingsStore } from "./settings.js";

export interface ProjectMigration { migrated: boolean; kept: string[]; movedAside: AsideMove[] }

async function entryType(path: string): Promise<"missing" | "link" | "folder" | "file"> {
  try {
    const info = await lstat(path);
    return info.isSymbolicLink() ? "link" : info.isDirectory() ? "folder" : "file";
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return "missing";
    throw error;
  }
}

async function names(folder: string): Promise<string[]> {
  try { return await readdir(folder); } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return [];
    throw error;
  }
}

async function optional(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch (error) { if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return null; throw error; }
}

const inside = (path: string, folder: string): boolean => path === folder || path.startsWith(folder + sep);

// Projects keep their own skills in place now. This returns what earlier versions parked, copied or linked there to the files it came from,
// and is safe to run again after an interruption.
export async function migrateProject(store: SettingsStore, settings: Settings, scope: string): Promise<ProjectMigration> {
  const root = new SkillLibrary(store).root(settings, scope);
  const aliasRoot = resolve(root, "../../.claude/skills");
  const parked = join(root, ".disabled"), overrides = join(root, ".afk-overrides");
  const kept: string[] = [], movedAside: AsideMove[] = [], backups: string[] = [];
  let changed = false;

  // Migration moves and deletes what these folders hold, so it never reaches them through a link to somewhere else.
  const project = resolve(root, "../..");
  for (const container of [parked, overrides]) {
    if (await entryType(container) === "missing") continue;
    for (let path = container; path !== project && inside(path, project); path = dirname(path)) {
      if (await entryType(path) === "link") throw new Error(`${path} is a link to another folder, so AFK left it and what it holds alone. Replace the link with a real folder or remove it, then open the project again.`);
    }
  }

  const targetOf = async (link: string): Promise<string> => resolve(dirname(link), await readlink(link));
  const dropLink = async (link: string, ownedBy: (target: string) => boolean): Promise<void> => {
    if (await entryType(link) !== "link" || !ownedBy(await targetOf(link))) return;
    await rm(link); changed = true;
  };

  for (const [path, receipt] of Object.entries(settings.managedLinks)) {
    if (!inside(path, root) && !inside(path, aliasRoot)) continue;
    await dropLink(path, target => target === resolve(receipt));
    delete settings.managedLinks[path]; changed = true;
  }
  for (const profile of settings.profiles) {
    if (!profile.enabled.includes(scope)) continue;
    profile.enabled = profile.enabled.filter(enabled => enabled !== scope); changed = true;
  }
  if (settings.independentSkills[scope]?.length) changed = true;
  delete settings.independentSkills[scope];

  const afkOwned = (target: string): boolean => inside(target, parked) || inside(target, overrides);
  for (const folder of [root, aliasRoot]) for (const name of await names(folder)) await dropLink(join(folder, name), afkOwned);

  for (const name of await names(parked)) {
    const from = join(parked, name), live = join(root, name);
    if (name.startsWith(".afk-")) { await rm(from, { recursive: true, force: true }); changed = true; continue; }
    if (await entryType(from) === "link") { await rm(from); changed = true; continue; }
    if (await entryType(live) !== "missing") { kept.push(name); continue; }
    await rename(from, live); changed = true;
  }
  if (await entryType(parked) === "folder" && !(await names(parked)).length) { await rmdir(parked); changed = true; }

  for (const name of await names(overrides)) {
    const copy = join(overrides, name);
    if (name.startsWith(".afk-") || await entryType(copy) !== "folder") continue;
    const origin = await entryType(join(root, name)) === "folder" ? join(root, name) : await new SkillLibrary(store).locate(settings, name).catch(() => undefined);
    if (origin && await sameSkillFiles(copy, origin)) continue;
    movedAside.push(await moveAside(store.home, name, copy)); changed = true;
  }
  if (await entryType(overrides) !== "missing") { await rm(overrides, { recursive: true, force: true }); changed = true; }

  // Only AFK's two invocation fields go back to how the backup had them; the backup stays until the settings are saved.
  // A reset never writes through a link, so a linked skill, skills folder or metadata file keeps what it points to.
  let rootLinked = false;
  for (let path = root; path !== project && inside(path, project); path = dirname(path)) if (await entryType(path) === "link") rootLinked = true;
  const managed = ["SKILL.md", "agents", "agents/openai.yaml", ".afk-invocation-original.json"];
  for (const name of rootLinked ? [] : await names(root)) {
    const path = join(root, name), backupPath = join(path, ".afk-invocation-original.json");
    if (await entryType(path) !== "folder") continue;
    if ((await Promise.all(managed.map(file => entryType(join(path, file))))).includes("link")) continue;
    const text = await optional(backupPath);
    if (text === null) continue;
    let backup: InvocationBackup;
    try { backup = JSON.parse(text) as InvocationBackup; } catch (error) { if (error instanceof SyntaxError) { backups.push(backupPath); changed = true; continue; } throw error; }
    const current = { skill: await readFile(join(path, "SKILL.md"), "utf8"), metadata: await optional(join(path, "agents/openai.yaml")) };
    const reset = restoreInvocationFields(current, backup);
    if (!reset) continue;
    if (reset.skill !== current.skill) await writeFile(join(path, "SKILL.md"), reset.skill);
    if (reset.metadata === null) await rm(join(path, "agents/openai.yaml"), { force: true });
    else if (reset.metadata !== current.metadata) { await mkdir(join(path, "agents"), { recursive: true }); await writeFile(join(path, "agents/openai.yaml"), reset.metadata); }
    backups.push(backupPath); changed = true;
  }

  for (const key of Object.keys(settings.preferences)) {
    if (!key.startsWith(scope + "|") || await entryType(join(root, key.slice(scope.length + 1))) !== "missing") continue;
    delete settings.preferences[key]; changed = true;
  }

  if (!changed) return { migrated: false, kept, movedAside };
  await store.save(settings);
  for (const backup of backups) await rm(backup, { force: true });
  await restoreInvocations(store, settings, scope);
  return { migrated: true, kept, movedAside };
}
