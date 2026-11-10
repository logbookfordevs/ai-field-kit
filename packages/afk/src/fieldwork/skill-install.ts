import { ProcessOutput } from "./process-output.js";
import { runCommand } from "./command-runner.js";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { containsControl, skillName, type Settings, type SettingsStore } from "./settings.js";
import { adoptInstalled } from "./duplicates.js";
import { restoreInvocations } from "./invocation.js";
import { SkillLibrary } from "./skills.js";
import { Library } from "./library.js";
import { readStaged, storeSkills, type StagedSkill, type StoreOptions } from "./library-install.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface InstallProgress {
  pending: boolean;
  cancelled?: boolean;
  phase: string;
  output: string;
  code?: number;
  completed: number;
  total: number;
  scope: string;
  agent: string;
  label: string;
  startedAt?: number;
  finishedAt?: number;
  item?: string;
  lastLine?: string;
}
export interface InstallSource { source: string; skills?: string[] }
export type InstallRunner = (cwd: string, env: NodeJS.ProcessEnv, args: string[], output: (text: string) => void, signal?: AbortSignal) => Promise<number>;
const run: InstallRunner = async (cwd, env, args, output, signal) => (await runCommand({
  command: "npx", args: ["--yes", "skills", "add", ...args], step: `Installing ${args[0] ?? "skills"} through Skills CLI`,
  cwd, env, signal, idleTimeoutMs: 120_000, timeoutMs: 15 * 60_000, onOutput: output,
})).code;

export async function installSkills(store: SettingsStore, settings: Settings, sources: InstallSource[], scope: string, agent: string, label: string, progress: (value: InstallProgress) => void, signal?: AbortSignal, runner: InstallRunner = run, storage: StoreOptions = {}): Promise<InstallProgress> {
  if (!["universal", "codex", "claude-code", "cursor", "opencode"].includes(agent)) throw new Error("Choose an explicit installation agent; interactive prompts are not supported in the app.");
  if (!sources.length || sources.some(group => !group.source.trim() || group.source.startsWith("-") || containsControl(group.source) || (group.skills !== undefined && (!group.skills.length || !group.skills.every(skillName) || new Set(group.skills).size !== group.skills.length)))) throw new Error("Choose valid sources and skill selections.");
  const project = settings.projects.find(project => project.name === scope);
  if (scope !== "Global" && !project?.path) throw new Error("Choose a configured project with a local folder.");
  const path = project?.path;
  const cwd = scope === "Global" ? store.home : path === "~" ? store.home : path?.startsWith("~/") ? resolve(store.home, path.slice(2)) : resolve(path!);
  const stored = scope === "Global" && !storage.unstored && await new Library(store.home).exists();
  const env = { ...process.env, HOME: store.home, USERPROFILE: store.home, DISABLE_TELEMETRY: "1", ...(store.home !== homedir() ? { XDG_CONFIG_HOME: "", XDG_STATE_HOME: "", XDG_DATA_HOME: "" } : {}) };
  const state: InstallProgress = { pending: true, phase: "Preparing installation", output: "", completed: 0, total: sources.length, scope, agent, label, startedAt: Date.now() };
  const report = (): void => progress({ ...state });
  const output = new ProcessOutput();
  const append = (text: string): void => { state.output = output.append(text); state.lastLine = output.lastLine(); report(); };
  if (stored) return await installIntoStorage(store, sources, label, state, progress, signal, runner, storage);
  try {
    report();
    const before = new Set((await new SkillLibrary(store).duplicates(settings, scope)).map(copy => copy.name));
    for (const group of sources) {
      signal?.throwIfAborted();
      state.phase = `Installing source ${state.completed + 1} of ${state.total}`; state.item = group.source; report();
      const args = [group.source, ...(group.skills ?? ["*"]).flatMap(name => ["--skill", name]), ...(scope === "Global" ? ["-g"] : []), "--agent", agent, "--yes"];
      append(`\nSource: ${group.source}\n`);
      const code = await runner(cwd, env, args, append, signal);
      signal?.throwIfAborted();
      if (code !== 0) { state.code = code; state.phase = "Installation stopped; review the output"; break; }
      state.completed++; report();
    }
    if (state.code === undefined) {
      const adopted = await adoptInstalled(store, scope, before, sources.flatMap(group => group.skills ?? []));
      if (adopted.length) append(`\nReplaced the older stored ${adopted.length === 1 ? "copy" : "copies"} of ${adopted.join(", ")} with this installation.\n`);
      state.code = 0; state.phase = "Installation complete";
    }
    try {
      const restored = await restoreInvocations(store, settings, scope);
      if (restored.restored.length) append(`\nRestored your invocation choice for ${restored.restored.join(", ")}.\n`);
      for (const failure of restored.failed) append(`\nCould not restore your invocation choice for ${failure.name}: ${failure.error}\n`);
    } catch (error) {
      signal?.throwIfAborted();
      append(`\nCould not restore your invocation choices: ${error instanceof Error ? error.message : "Unknown error."}\n`);
    }
  } catch (error) {
    if (signal?.aborted) state.cancelled = true;
    state.code = state.cancelled ? 130 : 1;
    state.phase = state.cancelled ? "Installation cancelled" : "Installation failed";
    if (!state.cancelled) append(error instanceof Error ? error.message : "Installation failed");
  }
  state.pending = false; delete state.item; state.finishedAt = Date.now(); report();
  return state;
}

/** Runs Skills CLI in an isolated home, then copies what it installed into storage; nothing outside the temporary home changes until every source succeeded. */
async function installIntoStorage(store: SettingsStore, sources: InstallSource[], label: string, state: InstallProgress, progress: (value: InstallProgress) => void, signal: AbortSignal | undefined, runner: InstallRunner, storage: StoreOptions): Promise<InstallProgress> {
  const report = (): void => progress({ ...state });
  const output = new ProcessOutput();
  const append = (text: string): void => { state.output = output.append(text); state.lastLine = output.lastLine(); report(); };
  const temporary = await mkdtemp(join(tmpdir(), "afk-install-"));
  try {
    report();
    const staged: StagedSkill[] = [];
    for (const group of sources) {
      signal?.throwIfAborted();
      const home = join(temporary, `source-${state.completed}`);
      await mkdir(home, { recursive: true });
      const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: "", XDG_STATE_HOME: "", XDG_DATA_HOME: "", DISABLE_TELEMETRY: "1", DO_NOT_TRACK: "1" };
      state.phase = `Installing source ${state.completed + 1} of ${state.total}`; state.item = group.source; report();
      const args = [group.source, ...(group.skills ?? ["*"]).flatMap(name => ["--skill", name]), "-g", "--agent", "universal", "--yes"];
      append(`\nSource: ${group.source}\n`);
      const code = await runner(home, env, args, append, signal);
      signal?.throwIfAborted();
      if (code !== 0) { state.code = code; state.phase = "Installation stopped; nothing was added"; break; }
      staged.push(...await readStaged(home, group.source, group.skills));
      state.completed++; report();
    }
    if (state.code === undefined) {
      state.phase = "Saving to your library"; delete state.item; report();
      await storeSkills(store, staged, storage);
      state.code = 0; state.phase = "Installation complete";
    }
  } catch (error) {
    if (signal?.aborted) state.cancelled = true;
    state.code = state.cancelled ? 130 : 1;
    state.phase = state.cancelled ? "Installation cancelled" : "Installation failed";
    if (!state.cancelled) append(error instanceof Error ? error.message : "Installation failed");
  } finally { await rm(temporary, { recursive: true, force: true }).catch(() => undefined); }
  state.pending = false; delete state.item; state.finishedAt = Date.now(); report();
  return state;
}
