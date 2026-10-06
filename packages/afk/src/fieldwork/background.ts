import { spawn } from "node:child_process";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SettingsStore } from "./settings.js";
import { startFieldwork } from "./server.js";

interface Receipt { pid: number; url: string; token: string }
interface RunningReceipt extends Receipt { rssBytes?: number }
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
async function running(home: string): Promise<RunningReceipt | undefined> {
  const record = await receipt(home);
  if (!record || !alive(record.pid)) return undefined;
  const response = await fetch(`${record.url}/api/status`, { headers: { "x-afk-token": record.token }, signal: AbortSignal.timeout(3000) });
  const status = await response.json() as { pid?: number; rssBytes?: unknown };
  if (!response.ok || status.pid !== record.pid) throw new Error("Could not verify the AFK background server. No process was stopped.");
  const validMemory = typeof status.rssBytes === "number" && Number.isFinite(status.rssBytes) && status.rssBytes > 0;
  return { ...record, ...(validMemory ? { rssBytes: status.rssBytes as number } : {}) };
}

export async function backgroundStatus(home: string): Promise<void> {
  const record = await running(home);
  const memory = record?.rssBytes === undefined ? "unavailable (restart AFK after updating)" : `${(record.rssBytes / 1024 / 1024).toFixed(1)} MiB`;
  console.log(record ? `AFK background is running at ${record.url}\nPID: ${record.pid}\nMemory (RSS): ${memory}\nLog: ${paths(home).log}` : "AFK background is not running.");
}

export async function stopBackground(home: string): Promise<void> {
  const record = await running(home);
  if (!record) { console.log("AFK background is not running."); return; }
  const response = await fetch(`${record.url}/api/exit`, { method: "POST", headers: { "x-afk-token": record.token }, signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Could not stop AFK.");
  for (let attempt = 0; attempt < 100; attempt++) {
    if (!alive(record.pid)) { console.log("AFK background stopped."); return; }
    await new Promise(accept => setTimeout(accept, 100));
  }
  throw new Error("AFK is shutting down; active operations may still be finishing. Check afk status again.");
}

export async function startBackground(store: SettingsStore, port = 0): Promise<void> {
  const existing = await running(store.home);
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
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), store.home, store.path, String(port)], { detached: true, stdio: ["ignore", log.fd, log.fd, "ipc"] });
    await new Promise<void>((accept, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error(`AFK did not start. See ${location.log}`)); }, 15000);
      child.once("error", error => { clearTimeout(timeout); reject(error); });
      child.once("exit", () => { clearTimeout(timeout); reject(new Error(`AFK failed to start. See ${location.log}`)); });
      child.once("message", (message: unknown) => {
        clearTimeout(timeout);
        const result = message as { error?: string };
        if (result?.error) { reject(new Error(result.error)); return; }
        child.disconnect(); child.unref(); accept();
      });
    });
    const record = await running(store.home);
    console.log(`AFK background is running at ${record?.url}\nLog: ${location.log}\nRun afk stop to close it.`);
  } catch (error) {
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
