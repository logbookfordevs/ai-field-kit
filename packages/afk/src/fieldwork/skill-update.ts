import { ProcessOutput } from "./process-output.js";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { emptySettings, skillName, type Settings, type SettingsStore } from "./settings.js";
import { SettingsStore as Store } from "./settings.js";
import { SkillLibrary } from "./skills.js";
import { setInvocation } from "./invocation.js";

export interface UpdateProgress { pending: boolean; cancellable?: boolean; cancelled?: boolean; names?: string[]; phase: string; output: string; code?: number; updated?: number; scope: string }
export type UpdateRunner = (cwd: string, env: NodeJS.ProcessEnv, args: string[], output: (text: string) => void, signal?: AbortSignal) => Promise<number>;
const run: UpdateRunner = (cwd, env, args, output, signal) => new Promise((accept, reject) => {
  signal?.throwIfAborted();
  const child = spawn("npx", ["--yes", "skills", "update", ...args], { cwd, env, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => output(chunk));
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => output(chunk));
  const cancel = (): void => {
    if (!child.pid) return;
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }).once("error", () => child.kill());
    else { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") reject(error instanceof Error ? error : new Error("Could not stop the update process.")); } }
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  child.once("error", error => { signal?.removeEventListener("abort", cancel); reject(error); });
  child.once("close", code => { signal?.removeEventListener("abort", cancel); accept(code ?? 1); });
});
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
  const library = new SkillLibrary(store), root = library.root(settings, scope);
  const temporary = await mkdtemp(join(tmpdir(), "afk-skill-update-"));
  const home = join(temporary, "home"), project = join(temporary, "project");
  const stagedRoot = scope === "Global" ? join(home, ".agents/skills") : join(project, ".agents/skills");
  const state: UpdateProgress = { pending: true, cancellable: true, phase: "Preparing isolated update", output: "", scope, ...(selectedNames ? { names: selectedNames } : {}) };
  const report = (): void => progress({ ...state });
  const output = new ProcessOutput();
  const append = (text: string): void => { state.output = output.append(text); report(); };
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
    const entries = selectedNames ? inventory.filter(entry => selectedNames.includes(entry.name)) : inventory;
    if (selectedNames && entries.length !== selectedNames.length) throw new Error("A selected skill is missing from this scope.");
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
    state.phase = "Updating through Skills CLI"; report();
    const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_STATE_HOME: "", XDG_CONFIG_HOME: join(home, ".config"), XDG_DATA_HOME: join(home, ".local/share"), DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" };
    const code = await runner(project, env, [...(selectedNames || []), scope === "Global" ? "-g" : "-p", "-y"], append, signal);
    signal?.throwIfAborted();
    if (code !== 0) { state.code = code; state.phase = "Update failed; original skills unchanged"; return { ...state, pending: false, cancellable: false }; }
    state.phase = "Checking and applying updates"; report();
    const changed = [];
    const stagedStore = new Store(home, join(temporary, "settings.json"));
    await stagedStore.initialize();
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
    if (JSON.stringify(await store.read()) !== JSON.stringify(settings)) throw new Error("AFK settings changed during the update. Retry after other changes finish.");
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
    return { ...state, pending: false, cancellable: false };
  } catch (error) {
    for (const backup of (committed ? [] : backups).reverse()) { await rm(backup.path, { recursive: true, force: true }); await rename(backup.backup, backup.path); }
    if (signal?.aborted && !committed) return { ...state, pending: false, cancellable: false, cancelled: true, code: 130, phase: "Update cancelled; original skills unchanged" };
    throw error;
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); }
}
