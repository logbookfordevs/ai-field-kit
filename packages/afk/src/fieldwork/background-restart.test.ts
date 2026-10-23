import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { restartBackground } from "./background.js";

vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal<typeof import("node:child_process")>(), spawn: vi.fn(),
}));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([true, false])("restarts with the verified port and running settings path (new status: %s)", async modern => {
  const home = await mkdtemp(resolve(tmpdir(), "afk-restart-"));
  const oldPid = 123456789;
  const settingsPath = resolve(home, "portable/afk/settings.json");
  const receipt = resolve(home, ".afk/background/server.json");
  let oldAlive = true;
  const order: string[] = [];
  vi.stubEnv("AFK_SETTINGS", resolve(home, "wrong/settings.json"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(process, "kill").mockImplementation(pid => {
    if (pid === oldPid && !oldAlive) throw Object.assign(new Error("gone"), { code: "ESRCH" });
    return true;
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    const url = String(input);
    if (url.endsWith("/api/exit")) { order.push("stop"); oldAlive = false; return new Response("{}"); }
    if (url.endsWith("/api/state")) return new Response(JSON.stringify({ settingsPath }));
    return new Response(JSON.stringify({ pid: oldAlive ? oldPid : process.pid, ...(modern ? { settingsPath } : {}) }));
  });
  vi.mocked(spawn).mockImplementation((_command, args, options) => {
    order.push("start");
    expect(args?.slice(-2)).toEqual([settingsPath, "4310"]);
    expect(options?.env?.AFK_SETTINGS).toBe(settingsPath);
    const events = new EventEmitter();
    const child = Object.assign(events, { pid: process.pid, exitCode: null, signalCode: null, disconnect: vi.fn(), unref: vi.fn() });
    void writeFile(receipt, JSON.stringify({ pid: process.pid, url: "http://127.0.0.1:4310", token: "new" }))
      .then(() => events.emit("message", { ready: true }));
    return child as unknown as ChildProcess;
  });
  try {
    await mkdir(resolve(home, ".afk/background"), { recursive: true });
    await writeFile(receipt, JSON.stringify({ pid: oldPid, url: "http://127.0.0.1:4310", token: "old" }));
    await restartBackground(home);
    expect(order).toEqual(["stop", "start"]);
    expect(JSON.parse(await readFile(receipt, "utf8")).pid).toBe(process.pid);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`PID: ${process.pid}`));
  } finally { await rm(home, { recursive: true, force: true }); }
});

it("does not start a background instance when none is running", async () => {
  const home = await mkdtemp(resolve(tmpdir(), "afk-restart-idle-"));
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(spawn).mockClear();
  try {
    await restartBackground(home);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Run afk --background"));
    expect(spawn).not.toHaveBeenCalled();
  } finally { await rm(home, { recursive: true, force: true }); }
});

it("leaves the verified server running if its settings path cannot be recovered", async () => {
  const home = await mkdtemp(resolve(tmpdir(), "afk-restart-invalid-"));
  const calls: string[] = [];
  vi.mocked(spawn).mockClear();
  vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
    calls.push(String(input));
    return new Response(JSON.stringify({ pid: process.pid }));
  });
  try {
    await mkdir(resolve(home, ".afk/background"), { recursive: true });
    await writeFile(resolve(home, ".afk/background/server.json"), JSON.stringify({ pid: process.pid, url: "http://127.0.0.1:4310", token: "fixture" }));
    await expect(restartBackground(home)).rejects.toThrow("No process was stopped");
    expect(calls.some(url => url.endsWith("/api/exit"))).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  } finally { await rm(home, { recursive: true, force: true }); }
});
