import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { expandPath, type SavedSkill, type SavedSkills, type Settings, type SettingsStore } from "./settings.js";
import { SkillLibrary, type SkillEntry } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { installSkills, type InstallRunner } from "./skill-install.js";

export interface SnapshotReview {
  scope: string;
  skills: SavedSkill[];
  expected: SavedSkills | null;
  added: string[];
  removed: string[];
  changed: string[];
  inventoryHash: string;
}

export interface SavedSkillComparison extends SavedSkill {
  status: "missing" | "present" | "different" | "conflict" | "local" | "project-missing";
  reason: string;
}

export interface RestoreProgress {
  pending: boolean;
  scope: string;
  cancelled?: boolean;
  items: { name: string; phase: string; ok?: boolean; error?: string }[];
  output: string;
}

function sourceFor(_settings: Settings, entry: SkillEntry): string | undefined {
  const source = entry.source;
  return source && !source.startsWith("/") && !source.startsWith("~") && !source.startsWith(".") && !source.startsWith("file:") ? source : undefined;
}

function sourceIdentity(source: string): string {
  return source.replace(/^https?:\/\/github\.com\//, "").replace(/^git@github\.com:/, "").replace(/\.git\/?$/, "").replace(/\/$/, "");
}

export async function projectStatus(store: SettingsStore, settings: Settings): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(settings.projects.map(async project => {
    try { return [project.name, (await stat(expandPath(project.path, store.home))).isDirectory() ? "present" : "not-folder"] as const; }
    catch (error) { return [project.name, ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "") ? "missing" : "unreadable"] as const; }
  })));
}

export async function reviewSnapshot(store: SettingsStore, settings: Settings, scope: string): Promise<SnapshotReview> {
  if (scope !== "Global" && (await projectStatus(store, settings))[scope] !== "present") throw new Error("Choose an existing project folder in Settings before saving its skills.");
  const inventory = await new SkillLibrary(store).inventory(settings, scope);
  const skills = inventory.map(entry => {
    const source = sourceFor(settings, entry);
    return { name: entry.name, ...(source ? { source } : {}), available: entry.available, invocation: (settings.preferences[`${scope}|${entry.name}`] ?? "") as SavedSkill["invocation"] };
  });
  const expected = settings.savedSkills?.find(snapshot => snapshot.scope === scope) ?? null;
  const previous = new Map(expected?.skills.map(skill => [skill.name, skill]) ?? []);
  const current = new Map(skills.map(skill => [skill.name, skill]));
  const contents = await Promise.all(inventory.map(async entry => [entry.name, await readFile(join(entry.path, "SKILL.md"), "utf8"), entry.invocation]));
  return {
    scope, skills, expected,
    added: skills.filter(skill => !previous.has(skill.name)).map(skill => skill.name),
    removed: [...previous.keys()].filter(name => !current.has(name)),
    changed: skills.filter(skill => previous.has(skill.name) && JSON.stringify(previous.get(skill.name)) !== JSON.stringify(skill)).map(skill => skill.name),
    inventoryHash: createHash("sha256").update(JSON.stringify([skills, contents])).digest("hex"),
  };
}

export async function compareSavedSkills(store: SettingsStore, settings: Settings, scope: string): Promise<SavedSkillComparison[]> {
  const saved = settings.savedSkills?.find(snapshot => snapshot.scope === scope);
  if (!saved) return [];
  const missingProject = scope !== "Global" && (await projectStatus(store, settings))[scope] !== "present";
  const inventory = missingProject ? [] : await new SkillLibrary(store).inventory(settings, scope);
  return saved.skills.map(skill => {
    const entry = inventory.find(entry => entry.name === skill.name);
    let status: SavedSkillComparison["status"];
    let reason: string;
    if (missingProject) { status = "project-missing"; reason = "Choose the project folder in Settings."; }
    else if (!entry) { status = skill.source ? "missing" : "local"; reason = skill.source ? "Missing on this machine." : "No repository source. Add the original skill folder, then refresh."; }
    else if (skill.source && sourceIdentity(sourceFor(settings, entry) ?? "") !== sourceIdentity(skill.source)) { status = "conflict"; reason = "The installed source differs or cannot be verified. Existing files are preserved; inspect this copy in Installed."; }
    else if (skill.available !== entry.available || skill.invocation !== (settings.preferences[`${scope}|${skill.name}`] ?? "")) { status = "different"; reason = "Installed; saved availability or invocation differs."; }
    else { status = "present"; reason = "Installed with the saved settings."; }
    return { ...skill, status, reason };
  });
}

export async function restoreSavedSkills(store: SettingsStore, scope: string, names: string[], expected: SavedSkills, progress: (state: RestoreProgress) => void, signal?: AbortSignal, runner?: InstallRunner): Promise<RestoreProgress> {
  let settings = await store.read();
  const configurationId = settings.configurationId;
  const scopePath = scope === "Global" ? store.home : settings.projects.find(project => project.name === scope)?.path;
  const snapshot = settings.savedSkills?.find(snapshot => snapshot.scope === scope);
  if (!snapshot || JSON.stringify(expected) !== JSON.stringify(snapshot)) throw new Error("The saved list changed. Review it again before restoring.");
  if (!names.length || new Set(names).size !== names.length || names.some(name => !snapshot.skills.some(skill => skill.name === name))) throw new Error("Choose skills from the reviewed saved list.");
  const state: RestoreProgress = { pending: true, scope, items: names.map(name => ({ name, phase: "Waiting" })), output: "" };
  const report = (): void => progress(structuredClone(state));
  report();
  for (const item of state.items) {
    if (signal?.aborted) { state.cancelled = true; break; }
    try {
      settings = await store.read();
      if (JSON.stringify(snapshot) !== JSON.stringify(settings.savedSkills?.find(saved => saved.scope === scope))) throw new Error("The saved list changed during restore. Review it again.");
      const skill = snapshot.skills.find(skill => skill.name === item.name)!;
      const compared = (await compareSavedSkills(store, settings, scope)).find(skill => skill.name === item.name)!;
      if (["conflict", "local", "project-missing"].includes(compared.status)) throw new Error(compared.reason);
      if (compared.status === "missing") {
        const root = new SkillLibrary(store).root(settings, scope);
        for (const destination of [join(root, item.name), join(root, ".disabled", item.name)]) {
          try { await lstat(destination); throw new Error("An incomplete folder or link occupies this name. Inspect it before restoring."); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        }
        item.phase = "Installing"; report();
        const installed = await installSkills(store, settings, [{ source: skill.source!, skills: [skill.name] }], scope, "universal", "Restore saved skill", update => {
          state.output = update.output; report();
        }, signal, runner);
        if (installed.cancelled) { state.cancelled = true; throw new Error("Cancelled. Review any files installed before cancellation."); }
        if (installed.code !== 0) throw new Error("Installation failed. Review the output, then retry.");
      }
      signal?.throwIfAborted();
      settings = await store.read();
      const currentPath = scope === "Global" ? store.home : settings.projects.find(project => project.name === scope)?.path;
      if (configurationId !== settings.configurationId || currentPath !== scopePath || JSON.stringify(snapshot) !== JSON.stringify(settings.savedSkills?.find(saved => saved.scope === scope))) throw new Error("The configuration changed during restore. Review the saved list again.");
      const library = new SkillLibrary(store);
      const entry = (await library.inventory(settings, scope)).find(entry => entry.name === skill.name);
      if (!entry) throw new Error("The installer did not provide this skill in the selected scope.");
      if (settings.profiles.some(profile => profile.enabled.includes(scope) && profile.skills.includes(skill.name)) && entry.available !== skill.available) throw new Error("Disable owning profiles before applying different availability.");
      item.phase = "Applying invocation"; report();
      if (skill.invocation || settings.preferences[`${scope}|${skill.name}`]) await setInvocation(store, settings, skill.name, scope, skill.invocation);
      item.phase = "Applying availability"; report();
      if (entry.available !== skill.available) await library.toggle(settings, skill.name, scope);
      item.phase = "Done"; item.ok = true;
    } catch (error) {
      item.phase = "Failed"; item.ok = false; item.error = error instanceof Error ? error.message : "Restore failed.";
      if (signal?.aborted) state.cancelled = true;
    }
    report();
    if (state.cancelled) break;
  }
  if (state.cancelled) for (const item of state.items) if (item.ok === undefined) { item.phase = "Not started"; item.ok = false; item.error = "Cancelled before this item started."; }
  state.pending = false; report();
  return state;
}
