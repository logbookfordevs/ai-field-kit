import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SettingsStore } from "./settings.js";
import { startFieldwork } from "./server.js";
import { runCommand } from "./command-runner.js";

interface Receipt { pid: number; url: string; token: string }
interface RunningReceipt extends Receipt { rssBytes?: number; settingsPath?: string }
function paths(home: string) {
  const directory = resolve(home, ".afk/background");
  return { directory, receipt: resolve(directory, "server.json"), log: resolve(home, ".afk/background.log") };
}
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return false; throw error; }
}
async function receipt(home: string): Promise<Receipt | undefined> {
  try {
    const value: unknown = JSON.parse(await readFile(paths(home).receipt, "utf8"));
    const record = value as Partial<Receipt>;
    if (!record || !Number.isSafeInteger(record.pid) || Number(record.pid) <= 0 || typeof record.token !== "string" || typeof record.url !== "string" || !/^http:\/\/127\.0\.0\.1:\d+$/.test(record.url)) throw new Error("Invalid AFK background record.");
    return record as Receipt;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
interface ProbeOptions { probeMs?: number; confirm?: ((message: string) => Promise<boolean>) | undefined }
type Probe = { state: "none" } | { state: "ready"; record: RunningReceipt } | { state: "unresponsive"; record: Receipt; cause: string };

async function probe(home: string, probeMs = 3000): Promise<Probe> {
  const record = await receipt(home);
  if (!record || !alive(record.pid)) return { state: "none" };
  let response: Response, status: { pid?: number; rssBytes?: unknown; settingsPath?: unknown };
  try {
    response = await fetch(`${record.url}/api/status`, { headers: { "x-afk-token": record.token }, signal: AbortSignal.timeout(probeMs) });
    status = await response.json() as typeof status;
  } catch (error) { return { state: "unresponsive", record, cause: error instanceof Error ? error.message : "No response." }; }
  if (!response.ok || status.pid !== record.pid) throw new Error("Could not verify the AFK background server. No process was stopped.");
  const validMemory = typeof status.rssBytes === "number" && Number.isFinite(status.rssBytes) && status.rssBytes > 0;
  return { state: "ready", record: { ...record, ...(typeof status.settingsPath === "string" && isAbsolute(status.settingsPath) ? { settingsPath: status.settingsPath } : {}), ...(validMemory ? { rssBytes: status.rssBytes as number } : {}) } };
}

function stuckMessage(record: Receipt): string {
  if (record.token === "starting") return `AFK background (PID ${record.pid}) is still starting. Try afk status shortly.`;
  return `AFK background (PID ${record.pid}) is running at ${record.url} but is not answering. Run afk stop --force to stop it and clear its record, then afk --background to start again.`;
}

async function running(home: string, options: ProbeOptions = {}): Promise<RunningReceipt | undefined> {
  const result = await probe(home, options.probeMs);
  if (result.state === "unresponsive") throw new Error(stuckMessage(result.record));
  return result.state === "ready" ? result.record : undefined;
}

export async function backgroundStatus(home: string, options: ProbeOptions = {}): Promise<number> {
  const result = await probe(home, options.probeMs);
  if (result.state === "unresponsive") { console.log(stuckMessage(result.record)); return 1; }
  const record = result.state === "ready" ? result.record : undefined;
  const memory = record?.rssBytes === undefined ? "unavailable (restart AFK after updating)" : `${(record.rssBytes / 1024 / 1024).toFixed(1)} MiB`;
  console.log(record ? `AFK background is running at ${record.url}\nPID: ${record.pid}\nMemory (RSS): ${memory}\nLog: ${paths(home).log}` : "AFK background is not running.");
  return 0;
}

export async function stopBackground(home: string, options: ProbeOptions & { force?: boolean } = {}): Promise<void> {
  const result = await probe(home, options.probeMs);
  if (result.state === "none") { console.log("AFK background is not running."); return; }
  if (result.state === "ready") { await stopVerifiedBackground(result.record); return; }
  const message = stuckMessage(result.record);
  const approved = options.force || (options.confirm !== undefined && await options.confirm(`${message}\nStop it now?`));
  if (!approved) throw new Error(message);
  await forceStop(home, result.record);
}

async function processCommand(pid: number): Promise<string> {
  if (process.platform === "win32") return "background.js";
  const result = await runCommand({ command: "ps", args: ["-p", String(pid), "-o", "command="], step: "Checking the recorded process", idleTimeoutMs: 5000, timeoutMs: 10_000 }).catch(() => undefined);
  return result?.output ?? "";
}

async function waitForExit(pid: number, ms: number): Promise<boolean> {
  for (const end = Date.now() + ms; Date.now() < end;) {
    if (!alive(pid)) return true;
    await new Promise(accept => setTimeout(accept, 50));
  }
  return !alive(pid);
}

async function forceStop(home: string, record: Receipt): Promise<void> {
  if (!(await processCommand(record.pid)).includes("background.js")) throw new Error(`PID ${record.pid} is not an AFK background server, so it was not stopped. Remove ${paths(home).directory} if the record is stale.`);
  try { process.kill(record.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  if (!await waitForExit(record.pid, 3000)) {
    try { process.kill(record.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
    if (!await waitForExit(record.pid, 3000)) throw new Error(`PID ${record.pid} did not exit. Stop it manually.`);
  }
  await rm(paths(home).directory, { recursive: true, force: true });
  console.log(`AFK background (PID ${record.pid}) stopped and its record cleared.`);
}

export async function stopVerifiedBackground(record: Receipt): Promise<void> {
  const response = await fetch(`${record.url}/api/exit`, { method: "POST", headers: { "x-afk-token": record.token }, signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Could not stop AFK.");
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!alive(record.pid)) { console.log("AFK background stopped."); return; }
    await new Promise(accept => setTimeout(accept, 100));
  }
  throw new Error("AFK is shutting down; active operations may still be finishing. Check afk status again.");
}

export async function restartBackground(home: string, options: ProbeOptions = {}): Promise<void> {
  const record = await running(home, options);
  if (!record) { console.log("AFK background is not running. Run afk --background to start it."); return; }
  let settingsPath = record.settingsPath;
  if (!settingsPath) {
    const response = await fetch(`${record.url}/api/state`, { headers: { "x-afk-token": record.token }, signal: AbortSignal.timeout(3000) });
    const state = await response.json() as { settingsPath?: unknown };
    if (!response.ok || typeof state.settingsPath !== "string" || !isAbsolute(state.settingsPath)) throw new Error("Could not read the running AFK settings path. No process was stopped.");
    settingsPath = state.settingsPath;
  }
  await stopVerifiedBackground(record);
  await startBackground(new SettingsStore(home, settingsPath), Number(new URL(record.url).port));
}

export async function startBackground(store: SettingsStore, port = 0, options: ProbeOptions = {}): Promise<void> {
  const existing = await running(store.home, options);
  if (existing && port && new URL(existing.url).port !== String(port)) throw new Error(`AFK background is already running at ${existing.url}. Run afk stop before starting on port ${port}.`);
  if (existing) { console.log(`AFK background is already running at ${existing.url}`); return; }
  const location = paths(store.home);
  await mkdir(resolve(store.home, ".afk"), { recursive: true });
  try { await mkdir(location.directory, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const previous = await receipt(store.home);
    if (!previous || alive(previous.pid)) throw new Error("AFK background is starting or its record needs review. Try afk status shortly.");
    await rm(location.directory, { recursive: true });
    await mkdir(location.directory, { mode: 0o700 });
  }
  await writeFile(location.receipt, JSON.stringify({ pid: process.pid, url: "http://127.0.0.1:1", token: "starting" }), { mode: 0o600 });
  const log = await open(location.log, "a", 0o600);
  let child: ChildProcess | undefined;
  try {
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), store.home, store.path, String(port)], { detached: true, env: { ...process.env, AFK_SETTINGS: store.path }, stdio: ["ignore", log.fd, log.fd, "ipc"] });
    const startedChild = child;
    await new Promise<void>((accept, reject) => {
      const timeout = setTimeout(() => { startedChild.kill(); reject(new Error(`AFK did not start. See ${location.log}`)); }, 15000);
      startedChild.once("error", error => { clearTimeout(timeout); reject(error); });
      startedChild.once("exit", () => { clearTimeout(timeout); reject(new Error(`AFK failed to start. See ${location.log}`)); });
      startedChild.once("message", (message: unknown) => {
        clearTimeout(timeout);
        const result = message as { error?: string };
        if (result?.error) { reject(new Error(result.error)); return; }
        startedChild.disconnect(); startedChild.unref(); accept();
      });
    });
    const started = await probe(store.home, options.probeMs);
    if (started.state === "unresponsive") throw new Error(`AFK started but could not be verified: ${started.cause}`);
    const record = started.state === "ready" ? started.record : undefined;
    console.log(`AFK background is running at ${record?.url}\nPID: ${record?.pid}\nLog: ${location.log}\nRun afk stop to close it.`);
  } catch (error) {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      const failedChild = child;
      await new Promise<void>(accept => {
        const timeout = setTimeout(() => { failedChild.kill("SIGKILL"); }, 3000);
        failedChild.once("exit", () => { clearTimeout(timeout); accept(); });
        failedChild.kill("SIGTERM");
      });
    }
    await rm(location.directory, { recursive: true, force: true });
    throw error;
  } finally { await log.close(); }
}

async function serve(home: string, settingsPath: string, port: number): Promise<void> {
  const location = paths(home);
  const app = await startFieldwork(new SettingsStore(home, settingsPath), port);
  await writeFile(location.receipt, JSON.stringify({ pid: process.pid, url: app.url, token: app.token }), { mode: 0o600 });
  const stop = () => { void app.close().catch(console.error); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  process.send?.({ ready: true });
}

if (process.send && process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , home, settingsPath, port] = process.argv;
  if (!home || !settingsPath) throw new Error("Missing background configuration.");
  try { await serve(home, settingsPath, Number(port ?? 0)); }
  catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : "AFK could not start." });
    process.disconnect?.();
    process.exitCode = 1;
  }
}
