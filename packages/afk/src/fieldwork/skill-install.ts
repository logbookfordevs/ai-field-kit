import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { containsControl, skillName, type Settings, type SettingsStore } from "./settings.js";

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
}
export interface InstallSource { source: string; skills?: string[] }
export type InstallRunner = (cwd: string, env: NodeJS.ProcessEnv, args: string[], output: (text: string) => void, signal?: AbortSignal) => Promise<number>;
const run: InstallRunner = (cwd, env, args, output, signal) => new Promise((accept, reject) => {
  signal?.throwIfAborted();
  const child = spawn("npx", ["--yes", "skills", "add", ...args], { cwd, env, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (data: Buffer) => output(data.toString()));
  child.stderr.on("data", (data: Buffer) => output(data.toString()));
  const cancel = (): void => {
    if (!child.pid) return;
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" }).once("error", () => child.kill());
    else { try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") reject(error instanceof Error ? error : new Error("Could not stop installation.")); } }
  };
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  child.once("error", error => { signal?.removeEventListener("abort", cancel); reject(error instanceof Error ? error : new Error("Could not stop installation.")); });
  child.once("close", code => { signal?.removeEventListener("abort", cancel); accept(code ?? 1); });
});

export async function installSkills(store: SettingsStore, settings: Settings, sources: InstallSource[], scope: string, agent: string, label: string, progress: (value: InstallProgress) => void, signal?: AbortSignal, runner: InstallRunner = run): Promise<InstallProgress> {
  if (!["universal", "codex", "claude-code", "cursor", "opencode"].includes(agent)) throw new Error("Choose an explicit installation agent; interactive prompts are not supported in the app.");
  if (!sources.length || sources.some(group => !group.source.trim() || group.source.startsWith("-") || containsControl(group.source) || (group.skills !== undefined && (!group.skills.length || !group.skills.every(skillName) || new Set(group.skills).size !== group.skills.length)))) throw new Error("Choose valid sources and skill selections.");
  const project = settings.projects.find(project => project.name === scope);
  if (scope !== "Global" && !project?.path) throw new Error("Choose a configured project with a local folder.");
  const path = project?.path;
  const cwd = scope === "Global" ? store.home : path === "~" ? store.home : path?.startsWith("~/") ? resolve(store.home, path.slice(2)) : resolve(path!);
  const env = { ...process.env, HOME: store.home, USERPROFILE: store.home, DISABLE_TELEMETRY: "1", ...(store.home !== homedir() ? { XDG_CONFIG_HOME: "", XDG_STATE_HOME: "", XDG_DATA_HOME: "" } : {}) };
  const state: InstallProgress = { pending: true, phase: "Preparing installation", output: "", completed: 0, total: sources.length, scope, agent, label };
  const report = (): void => progress({ ...state });
  const append = (text: string): void => { state.output = (state.output + text.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;?]*[A-Za-z]", "g"), "")).slice(-100_000); report(); };
  try {
    report();
    for (const group of sources) {
      signal?.throwIfAborted();
      state.phase = `Installing source ${state.completed + 1} of ${state.total}`; report();
      const args = [group.source, ...(group.skills ?? ["*"]).flatMap(name => ["--skill", name]), ...(scope === "Global" ? ["-g"] : []), "--agent", agent, "--yes"];
      append(`\nSource: ${group.source}\n`);
      const code = await runner(cwd, env, args, append, signal);
      signal?.throwIfAborted();
      if (code !== 0) { state.code = code; state.phase = "Installation stopped; review the output"; break; }
      state.completed++; report();
    }
    if (state.code === undefined) { state.code = 0; state.phase = "Installation complete"; }
  } catch (error) {
    if (signal?.aborted) state.cancelled = true;
    state.code = state.cancelled ? 130 : 1;
    state.phase = state.cancelled ? "Installation cancelled" : "Installation failed";
    if (!state.cancelled) append(error instanceof Error ? error.message : "Installation failed");
  }
  state.pending = false; report();
  return state;
}
