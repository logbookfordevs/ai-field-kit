import { runCommand } from "./command-runner.js";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { newerVersion, type AppUpdateJob, type UpdateTarget } from "./app-update.js";

export async function updateAndRestart(target: UpdateTarget, run: (command: string, args: string[], env: NodeJS.ProcessEnv) => Promise<string>, stop: () => Promise<void>, report: (phase: string) => Promise<void>): Promise<void> {
  const env = { ...process.env, HOME: target.home, USERPROFILE: target.home, AFK_SETTINGS: target.settingsPath };
  await report("Installing AFK update…");
  await run(process.execPath, [fileURLToPath(new URL("../index.js", import.meta.url)), "update"], env);
  const launcher = resolve(process.env.AFK_BIN_DIR ?? join(target.home, ".local/bin"), "afk");
  const installed = (await run(launcher, ["--version"], env)).trim().replace(/^v/, "");
  if (!target.latest || (installed !== target.latest && !newerVersion(installed, target.latest))) throw new Error("The installed version could not be verified. The current app is still running.");
  await report("Restarting AFK…");
  await stop();
  const port = new URL(target.url).port;
  await run(launcher, ["--background", "--port", port], env);
  await report("AFK updated and restarted.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.once("message", (target: UpdateTarget) => {
  const state: AppUpdateJob = { pending: true, phase: "Starting update…", output: "", pid: process.pid, startedAt: Date.now(), ...(target.latest ? { targetVersion: target.latest } : {}) };
  const directory = join(target.home, ".afk"), path = join(directory, "app-update.json");
  let writes = Promise.resolve();
  const save = (): Promise<void> => {
    const contents = JSON.stringify(state);
    writes = writes.then(async () => { await mkdir(directory, { recursive: true }); await writeFile(path + ".tmp", contents, { mode: 0o600 }); await rename(path + ".tmp", path); });
    return writes;
  };
  const run = async (command: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> => {
    let stdout = "";
    const result = await runCommand({
      command, args, env, step: "The update command", idleTimeoutMs: 3 * 60_000, timeoutMs: 10 * 60_000,
      onOutput: (chunk, stream) => {
        if (stream === "stdout") stdout = (stdout + chunk).slice(-30_000);
        state.output = (state.output + chunk).slice(-30_000); void save().catch(() => {});
      },
    });
    if (result.code !== 0) throw new Error(`Update command failed (exit ${result.code}).`);
    return stdout;
  };
  const stop = async (): Promise<void> => {
    const response = await fetch(target.url + "/api/exit", { method: "POST", headers: { "X-AFK-Token": target.token }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Could not stop the current AFK app.");
    for (let attempt = 0; attempt < 300; attempt++) {
      try { await fetch(target.url, { signal: AbortSignal.timeout(1000) }); }
      catch { return; }
      await new Promise(accept => setTimeout(accept, 100));
    }
    throw new Error("AFK is still shutting down. Wait for active operations, then run afk restart.");
  };
  void (async () => {
    await mkdir(directory, { recursive: true });
    const lockPath = join(directory, "app-update.lock");
    let lock;
    try { lock = await open(lockPath, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(lockPath, "utf8"));
      if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error("An invalid updater lock needs attention.");
      try { process.kill(pid, 0); throw new Error("AFK is already updating."); }
      catch (failure) { if ((failure as NodeJS.ErrnoException).code !== "ESRCH") throw failure; }
      await rm(lockPath); lock = await open(lockPath, "wx", 0o600);
    }
    await lock.writeFile(String(process.pid)); await lock.close();
    try {
      await save(); process.send?.({ ready: true });
      try {
        await updateAndRestart(target, run, stop, async phase => { state.phase = phase; await save(); });
      } catch (error) {
        state.phase = "Update needs attention"; state.error = error instanceof Error ? error.message : "Update failed.";
      }
      state.pending = false; await save();
    } finally { await rm(lockPath, { force: true }); }
  })().catch(() => { process.exitCode = 1; });
});
