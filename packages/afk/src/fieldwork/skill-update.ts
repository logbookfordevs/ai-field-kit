import { ProcessOutput } from "./process-output.js";
import { isDeepStrictEqual } from "node:util";
import { runCommand } from "./command-runner.js";
import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptySettings, skillName, type Settings, type SettingsStore } from "./settings.js";
import { SettingsStore as Store } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";
import { Library } from "./library.js";
import { readLock, stagedLockPath, storeSkills, type StagedSkill } from "./library-install.js";

export interface UpdateProgress { pending: boolean; cancellable?: boolean; cancelled?: boolean; names?: string[]; phase: string; output: string; code?: number; updated?: number; scope: string; startedAt?: number; finishedAt?: number; item?: string; lastLine?: string }
export type UpdateRunner = (cwd: string, env: NodeJS.ProcessEnv, args: string[], output: (text: string) => void, signal?: AbortSignal) => Promise<number>;
const run: UpdateRunner = async (cwd, env, args, output, signal) => (await runCommand({
  command: "npx", args: ["--yes", "skills", "update", ...args], step: "Updating through Skills CLI",
  cwd, env, signal, idleTimeoutMs: 120_000, timeoutMs: 15 * 60_000, onOutput: output,
})).code;
async function optional(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function digest(path: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(folder: string, prefix = ""): Promise<void> {
    for (const name of (await readdir(folder)).sort()) {
      const file = join(folder, name), info = await lstat(file);
      hash.update(prefix + name); hash.update(String(info.mode));
      if (info.isDirectory()) await walk(file, prefix + name + "/");
      else if (info.isFile()) hash.update(await readFile(file));
      else throw new Error("This skill contains symbolic links or special files. Update it manually.");
    }
  }
  await walk(path); return hash.digest("hex");
}

export async function updateSkills(store: SettingsStore, settings: Settings, scope: string, progress: (value: UpdateProgress) => void, runner: UpdateRunner = run, signal?: AbortSignal, selectedNames?: string[]): Promise<UpdateProgress> {
  if (selectedNames && (!selectedNames.length || !selectedNames.every(skillName) || new Set(selectedNames).size !== selectedNames.length)) throw new Error("Select unique skill names.");
  if (scope === "Global" && await new Library(store.home).exists()) return updateStoredSkills(store, settings, progress, runner, signal, selectedNames);
  const toolOwned = new Map(settings.tools.flatMap(tool => (tool.provides ?? []).map(name => [name, tool.name] as const)));
  const library = new SkillLibrary(store), root = library.root(settings, scope);
  const temporary = await mkdtemp(join(tmpdir(), "afk-skill-update-"));
  const home = join(temporary, "home"), project = join(temporary, "project");
  const stagedRoot = scope === "Global" ? join(home, ".agents/skills") : join(project, ".agents/skills");
  const state: UpdateProgress = { pending: true, cancellable: true, phase: "Preparing isolated update", output: "", scope, startedAt: Date.now(), ...(selectedNames ? { names: selectedNames } : {}) };
  const report = (): void => progress({ ...state });
  const output = new ProcessOutput();
  const append = (text: string): void => { state.output = output.append(text); state.lastLine = output.lastLine(); report(); };
  const finished = (extra: Partial<UpdateProgress> = {}): UpdateProgress => ({ ...state, ...extra, pending: false, cancellable: false, finishedAt: Date.now() });
  let committed = false;
  const backups: { path: string; backup: string }[] = [];
  try {
    signal?.throwIfAborted(); report();
    await mkdir(stagedRoot, { recursive: true }); await mkdir(project, { recursive: true });
    const stateHome = store.home === homedir() ? process.env.XDG_STATE_HOME : undefined;
    const receipt = scope === "Global" ? stateHome ? join(stateHome, "skills/.skill-lock.json") : join(store.home, ".agents/.skill-lock.json") : join(root, "../../skills-lock.json");
    const receiptText = await optional(receipt);
    if (!receiptText) throw new Error("Skills CLI has no update receipt for this scope. Install tracked skills through Skills CLI first.");
    const stagedReceipt = scope === "Global" ? join(home, ".agents/.skill-lock.json") : join(project, "skills-lock.json");
    const inventory = await library.inventory(settings, scope);
    const entries = selectedNames ? inventory.filter(entry => selectedNames.includes(entry.name)) : inventory.filter(entry => !toolOwned.has(entry.name));
    if (selectedNames && entries.length !== selectedNames.length) throw new Error("A selected skill is missing from this scope.");
    for (const name of selectedNames ?? []) if (toolOwned.has(name)) throw new Error(`${name} is managed by ${toolOwned.get(name)}. Update it from Tools.`);
    const originalReceipt = JSON.parse(receiptText) as { skills: Record<string, unknown> };
    if (!originalReceipt.skills || typeof originalReceipt.skills !== "object" || Array.isArray(originalReceipt.skills)) throw new Error("Skills CLI update receipt is invalid.");
    if (selectedNames?.some(name => !Object.hasOwn(originalReceipt.skills, name))) throw new Error("This skill has no Skills CLI update receipt. Reinstall it from its source through Skills CLI first.");
    const names = new Set(entries.map(entry => entry.name));
    await writeFile(stagedReceipt, JSON.stringify({ ...originalReceipt, skills: Object.fromEntries(Object.entries(originalReceipt.skills).filter(([name]) => names.has(name))) }));
    const snapshots = [];
    for (const entry of entries.filter(entry => Object.hasOwn(originalReceipt.skills, entry.name))) {
      signal?.throwIfAborted();
      const path = await realpath(entry.path), before = await digest(path), staged = join(stagedRoot, entry.name);
      await cp(path, staged, { recursive: true, dereference: false });
      snapshots.push({ entry, path, before, staged });
    }
    signal?.throwIfAborted();
    state.phase = "Updating through Skills CLI"; state.item = selectedNames?.join(", ") || `${scope} tracked skills`; report();
    const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: "", XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"), DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" };
    const code = await runner(project, env, [...(selectedNames || []), scope === "Global" ? "-g" : "-p", "-y"], append, signal);
    signal?.throwIfAborted();
    if (code !== 0) { state.code = code; state.phase = "Update failed; original skills unchanged"; return finished(); }
    state.phase = "Checking and applying updates"; report();
    const changed = [];
    const stagedStore = new Store(home, join(temporary, "settings.json"));
    const stagedSettings = emptySettings();
    if (scope !== "Global") stagedSettings.projects.push({ name: scope, path: project });
    for (const snapshot of snapshots) {
      if (await optional(join(snapshot.staged, "SKILL.md")) === null) throw new Error(`Updated source removed ${snapshot.entry.name}. Original skills preserved; review upstream removal manually.`);
      if (await digest(snapshot.staged) === snapshot.before) continue;
      await rm(join(snapshot.staged, ".afk-invocation-original.json"), { force: true });
      const mode = settings.preferences[`${scope}|${snapshot.entry.name}`] || (snapshot.entry.invocationInherited ? settings.preferences[`Global|${snapshot.entry.name}`] : undefined);
      if (mode) await setInvocation(stagedStore, stagedSettings, snapshot.entry.name, scope, mode);
      changed.push(snapshot);
    }
    for (const snapshot of snapshots) {
      if (await realpath(snapshot.entry.path) !== snapshot.path || await digest(snapshot.path) !== snapshot.before) throw new Error("Skills changed during the update. Original files preserved; retry after other changes finish.");
    }
    if (await optional(receipt) !== receiptText) throw new Error("Skills CLI receipts changed during the update. Retry after other updates finish.");
    if (!isDeepStrictEqual(await store.read(), settings)) throw new Error("AFK settings changed during the update. Retry after other changes finish.");
    signal?.throwIfAborted();
    state.cancellable = false; report();
    const destinations = new Set<string>();
    for (const snapshot of changed) {
      if (destinations.has(snapshot.path)) continue;
      destinations.add(snapshot.path);
      const replacement = join(dirname(snapshot.path), `.afk-update-${randomUUID()}`), backup = replacement + "-before";
      await cp(snapshot.staged, replacement, { recursive: true, dereference: false });
      await rename(snapshot.path, backup); backups.push({ path: snapshot.path, backup });
      await rename(replacement, snapshot.path);
    }
    const receiptBackup = receipt + `.afk-update-${randomUUID()}`;
    await rename(receipt, receiptBackup); backups.push({ path: receipt, backup: receiptBackup });
    const updatedReceipt = JSON.parse(await readFile(stagedReceipt, "utf8")) as { skills: Record<string, unknown> };
    await writeFile(receipt, JSON.stringify({ ...originalReceipt, skills: { ...originalReceipt.skills, ...updatedReceipt.skills } }, null, 2) + "\n", { mode: 0o600 });
    committed = true;
    state.updated = changed.length; state.code = 0; state.phase = "Updated; availability preserved";
    for (const backup of backups) await rm(backup.backup, { recursive: true, force: true }).catch(() => undefined);
    backups.length = 0;
    return finished();
  } catch (error) {
    for (const backup of (committed ? [] : backups).reverse()) { await rm(backup.path, { recursive: true, force: true }); await rename(backup.backup, backup.path); }
    if (signal?.aborted && !committed) return finished({ cancelled: true, code: 130, phase: "Update cancelled; original skills unchanged" });
    throw error;
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); }
}

function lockEntry(source: string, skillPath: string | undefined, revision: string | undefined): Record<string, unknown> {
  const github = /^[\w.-]+\/[\w.-]+$/.test(source);
  const url = github ? `https://github.com/${source}.git` : source;
  const now = new Date().toISOString();
  return { source, sourceType: github || /github\.com/.test(source) ? "github" : "git", sourceUrl: url, ...(skillPath ? { skillPath } : {}), ...(revision ? { skillFolderHash: revision } : {}), installedAt: now, updatedAt: now };
}

async function sourceOf(library: Library, name: string, path: string, storage: string): Promise<{ source?: string; skillPath?: string; revision?: string }> {
  const record = storage === "machine" ? undefined : await library.record(name);
  if (record?.source) return { source: record.source, ...(record.skillPath ? { skillPath: record.skillPath } : {}), ...(record.revision ? { revision: record.revision } : {}) };
  try { const receipt = JSON.parse(await readFile(join(path, ".afk-source.json"), "utf8")) as { source?: unknown }; if (typeof receipt.source === "string") return { source: receipt.source }; } catch { /* A copy without a receipt has no source to update from. */ }
  return {};
}

/** Updates stored skills in an isolated home, then replaces their stored files and records the new revisions in one commit. */
async function updateStoredSkills(store: SettingsStore, settings: Settings, progress: (value: UpdateProgress) => void, runner: UpdateRunner, signal?: AbortSignal, selectedNames?: string[]): Promise<UpdateProgress> {
  const library = new Library(store.home);
  const temporary = await mkdtemp(join(tmpdir(), "afk-skill-update-"));
  const home = join(temporary, "home"), stagedRoot = join(home, ".agents/skills");
  const state: UpdateProgress = { pending: true, cancellable: true, phase: "Preparing isolated update", output: "", scope: "Global", startedAt: Date.now(), ...(selectedNames ? { names: selectedNames } : {}) };
  const report = (): void => progress({ ...state });
  const output = new ProcessOutput();
  const append = (text: string): void => { state.output = output.append(text); state.lastLine = output.lastLine(); report(); };
  const finished = (extra: Partial<UpdateProgress> = {}): UpdateProgress => ({ ...state, ...extra, pending: false, cancellable: false, finishedAt: Date.now() });
  try {
    signal?.throwIfAborted(); report();
    if (selectedNames && (!selectedNames.length || !selectedNames.every(skillName) || new Set(selectedNames).size !== selectedNames.length)) throw new Error("Select unique skill names.");
    const toolOwned = new Map(settings.tools.flatMap(tool => (tool.provides ?? []).map(name => [name, tool.name] as const)));
    const kept = new Set<string>();
    for (const name of await library.storedNames()) if ((await library.record(name))?.updates === "stopped") kept.add(name);
    const storedNames = await library.storedNames();
    for (const name of selectedNames ?? []) if (!storedNames.includes(name) && !toolOwned.has(name)) throw new Error(`${name} is missing from this scope.`);
    // A selection can include skills that never update here; they are named and skipped so the rest still update.
    const skipped: string[] = [];
    for (const name of selectedNames ?? []) {
      if (toolOwned.has(name)) skipped.push(`${name}: ${toolOwned.get(name)} updates it, from Tools`);
      else if (kept.has(name)) skipped.push(`${name}: you kept your version; let updates replace your edits from its editor`);
    }
    const stored = storedNames.filter(name => selectedNames ? selectedNames.includes(name) && !toolOwned.has(name) && !kept.has(name) : !toolOwned.has(name) && !kept.has(name));
    await mkdir(stagedRoot, { recursive: true });
    const snapshots: { name: string; path: string; before: string; staged: string; source: string; skillPath?: string; revision?: string }[] = [];
    const lock: Record<string, unknown> = {};
    for (const name of stored) {
      signal?.throwIfAborted();
      const storage = (await library.storage(name))!, path = library.storagePath(name, storage), origin = await sourceOf(library, name, path, storage);
      if (!origin.source) {
        if (selectedNames) skipped.push(`${name}: it has no repository to update from (an uploaded skill updates only when you upload it again)`);
        continue;
      }
      const staged = join(stagedRoot, name);
      await cp(path, staged, { recursive: true, dereference: false });
      lock[name] = lockEntry(origin.source, origin.skillPath, origin.revision);
      snapshots.push({ name, path, before: await digest(path), staged, source: origin.source, ...(origin.skillPath ? { skillPath: origin.skillPath } : {}), ...(origin.revision ? { revision: origin.revision } : {}) });
    }
    if (skipped.length) append(`Skipped ${skipped.length === 1 ? "1 skill" : `${skipped.length} skills`}:\n${skipped.map(line => `  ${line}`).join("\n")}\n\n`);
    if (!snapshots.length) throw new Error(skipped.length ? `None of the selected skills can update here.\n${skipped.join("\n")}` : "No stored skill has a recorded source to update from. Install tracked skills from a repository first.");
    await writeFile(stagedLockPath(home), JSON.stringify({ version: 3, skills: lock }));
    signal?.throwIfAborted();
    state.phase = "Updating through Skills CLI"; state.item = selectedNames?.join(", ") || "Global tracked skills"; report();
    const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: "", XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"), DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" };
    const code = await runner(temporary, env, [...(selectedNames || []), "-g", "-y"], append, signal);
    signal?.throwIfAborted();
    if (code !== 0) { state.code = code; state.phase = "Update failed; original skills unchanged"; return finished(); }
    state.phase = "Checking and applying updates"; report();
    const updatedLock = await readLock(stagedLockPath(home));
    const changed: StagedSkill[] = [];
    for (const snapshot of snapshots) {
      if (await optional(join(snapshot.staged, "SKILL.md")) === null) throw new Error(`Updated source removed ${snapshot.name}. Original skills preserved; review upstream removal manually.`);
      if (await digest(snapshot.staged) === snapshot.before) continue;
      await rm(join(snapshot.staged, ".afk-invocation-original.json"), { force: true });
      const entry = updatedLock[snapshot.name] ?? {};
      const revision = typeof entry.skillFolderHash === "string" ? entry.skillFolderHash : snapshot.revision;
      changed.push({ name: snapshot.name, path: snapshot.staged, source: snapshot.source, ...(snapshot.skillPath ? { skillPath: snapshot.skillPath } : {}), ...(revision ? { revision } : {}) });
    }
    for (const snapshot of snapshots) if (await digest(snapshot.path) !== snapshot.before) throw new Error("Skills changed during the update. Original files preserved; retry after other changes finish.");
    if (!isDeepStrictEqual(await store.read(), settings)) throw new Error("AFK settings changed during the update. Retry after other changes finish.");
    signal?.throwIfAborted();
    state.cancellable = false; report();
    await storeSkills(store, changed, { update: true });
    state.updated = changed.length; state.code = 0; state.phase = "Updated; availability preserved";
    return finished();
  } catch (error) {
    if (signal?.aborted) return finished({ cancelled: true, code: 130, phase: "Update cancelled; original skills unchanged" });
    throw error;
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); }
}
