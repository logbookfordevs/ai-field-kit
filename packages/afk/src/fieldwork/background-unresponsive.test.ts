import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backgroundStatus, restartBackground, startBackground, stopBackground } from "./background.js";
import { SettingsStore } from "./settings.js";

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
  vi.restoreAllMocks();
});

const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
const probe = { probeMs: 200 };

async function unresponsiveServer(scriptName = "background.js") {
  const home = await mkdtemp(join(tmpdir(), "afk-unresponsive-"));
  const scripts = await mkdtemp(join(tmpdir(), "afk-fake-server-"));
  await mkdir(join(home, ".afk/background"), { recursive: true });
  const script = join(scripts, scriptName);
  await writeFile(script, `const server = require("node:net").createServer(socket => socket.on("data", () => {}));
server.listen(0, "127.0.0.1", () => console.log(server.address().port));`);
  const child = spawn(process.execPath, [script], { stdio: ["ignore", "pipe", "ignore"], detached: true });
  cleanup.push(async () => { try { process.kill(child.pid!, "SIGKILL"); } catch { /* already stopped */ } await rm(home, { recursive: true, force: true }); await rm(scripts, { recursive: true, force: true }); });
  const port = await new Promise<number>(accept => child.stdout.once("data", data => accept(Number(String(data).trim()))));
  const receipt = join(home, ".afk/background/server.json");
  await writeFile(receipt, JSON.stringify({ pid: child.pid, url: `http://127.0.0.1:${port}`, token: "secret" }));
  return { home, pid: child.pid!, receipt };
}

describe("a recorded server that is alive but not answering", () => {
  it("is reported by status with its PID and the fix, not as a fetch failure", async () => {
    const server = await unresponsiveServer();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await backgroundStatus(server.home, probe);
    const text = log.mock.calls.flat().join("\n");
    expect(code).toBe(1);
    expect(text).toContain(`PID ${server.pid}`);
    expect(text).toContain("afk stop --force");
    expect(text).not.toContain("fetch failed");
    expect(alive(server.pid)).toBe(true);
  });

  it("is not stopped by a plain stop, which names the fix instead", async () => {
    const server = await unresponsiveServer();
    await expect(stopBackground(server.home, probe)).rejects.toThrow(`afk stop --force`);
    expect(alive(server.pid)).toBe(true);
  });

  it("is stopped after confirmation", async () => {
    const server = await unresponsiveServer();
    const confirm = vi.fn(async () => true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    await stopBackground(server.home, { ...probe, confirm });
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(String(server.pid)));
    expect(alive(server.pid)).toBe(false);
  });

  it("stays running when the confirmation is declined", async () => {
    const server = await unresponsiveServer();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(stopBackground(server.home, { ...probe, confirm: async () => false })).rejects.toThrow("afk stop --force");
    expect(alive(server.pid)).toBe(true);
  });

  it("is stopped and its record cleared by stop --force", async () => {
    const server = await unresponsiveServer();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await stopBackground(server.home, { ...probe, force: true });
    expect(alive(server.pid)).toBe(false);
    await expect(stat(server.receipt)).rejects.toThrow();
    expect(log.mock.calls.flat().join("\n")).toContain("stopped");
    await backgroundStatus(server.home, probe);
    expect(log.mock.calls.flat().at(-1)).toBe("AFK background is not running.");
  });

  it("is never killed when the recorded PID is not an AFK server", async () => {
    const server = await unresponsiveServer("something-else.js");
    await expect(stopBackground(server.home, { ...probe, force: true })).rejects.toThrow("not an AFK background server");
    expect(alive(server.pid)).toBe(true);
    expect(JSON.parse(await readFile(server.receipt, "utf8")).pid).toBe(server.pid);
  });

  it("blocks starting and restarting with the same explanation", async () => {
    const server = await unresponsiveServer();
    await expect(startBackground(new SettingsStore(server.home), 0, probe)).rejects.toThrow(`PID ${server.pid}`);
    await expect(restartBackground(server.home, probe)).rejects.toThrow("afk stop --force");
    expect(alive(server.pid)).toBe(true);
  });
});
