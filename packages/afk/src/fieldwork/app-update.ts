import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface VersionCheck { current: string; latest?: string; available: boolean; error?: string }
export interface AppUpdateJob { pending: boolean; phase: string; output: string; error?: string; pid?: number; startedAt?: number }
export interface UpdateTarget { home: string; settingsPath: string; url: string; token: string; current?: string; latest?: string }

export function newerVersion(latest: string, current: string): boolean {
  const parse = (value: string): number[] | undefined => /^v?\d+\.\d+\.\d+$/.test(value) ? value.replace(/^v/, "").split(".").map(Number) : undefined;
  const next = parse(latest), installed = parse(current);
  if (!next || !installed) return false;
  for (let index = 0; index < 3; index++) if (next[index] !== installed[index]) return next[index]! > installed[index]!;
  return false;
}

export class AppUpdates {
  private cached: VersionCheck | undefined;
  private checkedAt = 0;
  private checking: Promise<VersionCheck> | undefined;
  private launching = false;
  constructor(readonly current: string) {}

  check(force = false): Promise<VersionCheck> {
    if (force) this.checkedAt = 0;
    if (this.cached && Date.now() - this.checkedAt < 60 * 60_000) return Promise.resolve(this.cached);
    this.checking ??= this.fetchVersion().finally(() => { this.checking = undefined; });
    return this.checking;
  }
  private async fetchVersion(): Promise<VersionCheck> {
    try {
      const response = await fetch("https://api.github.com/repos/logbookfordevs/ai-field-kit/releases/latest", { headers: { Accept: "application/vnd.github+json", "User-Agent": "AFK" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Could not check for updates.");
      const release = await response.json() as { tag_name?: unknown; draft?: unknown; prerelease?: unknown };
      if (typeof release.tag_name !== "string" || !/^v?\d+\.\d+\.\d+$/.test(release.tag_name) || release.draft || release.prerelease) throw new Error("The latest release version could not be verified.");
      this.cached = { current: this.current, latest: release.tag_name.replace(/^v/, ""), available: newerVersion(release.tag_name, this.current) };
    } catch (error) {
      this.cached = { current: this.current, available: false, error: error instanceof Error ? error.message : "Could not check for updates." };
    }
    this.checkedAt = Date.now();
    return this.cached;
  }
  async state(home: string): Promise<AppUpdateJob | null> {
    try {
      const job = JSON.parse(await readFile(join(home, ".afk/app-update.json"), "utf8")) as AppUpdateJob;
      if (job.pending && job.startedAt && Date.now() - job.startedAt > 15 * 60_000) return { ...job, pending: false, error: "The updater did not finish. Review its output and retry." };
      if (job.pending && job.pid) {
        try { process.kill(job.pid, 0); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") return { ...job, pending: false, error: "The updater stopped before finishing. Review its output and retry." }; throw error; }
      }
      return job;
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  async start(target: UpdateTarget): Promise<{ started: true }> {
    if (this.launching) throw new Error("AFK is already updating.");
    this.launching = true;
    try {
      if ((await this.state(target.home))?.pending) throw new Error("AFK is already updating.");
      const checked = await this.check();
      if (!checked.available) throw new Error("No verified newer release is available. Check for updates again.");
      const child = spawn(process.execPath, [fileURLToPath(new URL("./app-update-worker.js", import.meta.url))], { detached: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
      try {
        await new Promise<void>((accept, reject) => {
          const timer = setTimeout(() => { child.kill(); reject(new Error("Could not start the updater.")); }, 5000);
          child.once("error", error => { clearTimeout(timer); reject(error); });
          child.once("exit", () => { clearTimeout(timer); reject(new Error("The updater exited before starting.")); });
          child.once("message", () => { clearTimeout(timer); accept(); });
          child.send({ ...target, current: this.current, latest: checked.latest });
        });
      } catch (error) {
        if (child.connected) child.disconnect();
        child.kill();
        throw error;
      }
      child.disconnect(); child.unref();
      return { started: true };
    } finally { this.launching = false; }
  }
}
