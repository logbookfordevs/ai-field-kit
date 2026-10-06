import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { backgroundStatus, stopBackground, startBackground } from "./background.js";
import { SettingsStore } from "./settings.js";
import { startFieldwork } from "./server.js";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const action of cleanup.reverse()) await action();
  cleanup.length = 0;
  vi.restoreAllMocks();
});
async function home() {
  const directory = await mkdtemp(resolve(tmpdir(), "afk-background-test-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  await mkdir(resolve(directory, ".afk/background"), { recursive: true });
  return directory;
}

describe("background instance verification", () => {
  it("reports a missing background instance without loading settings", async () => {
    const directory = await home();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await backgroundStatus(directory);
    await stopBackground(directory);
    expect(log.mock.calls.flat()).toEqual(["AFK background is not running.", "AFK background is not running."]);
  });

  it("reports an authenticated server URL and process", async () => {
    const directory = await home();
    const app = await startFieldwork(new SettingsStore(directory));
    cleanup.push(app.close);
    await writeFile(resolve(directory, ".afk/background/server.json"), JSON.stringify({ pid: process.pid, url: app.url, token: app.token }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await backgroundStatus(directory);
    expect(log.mock.calls[0]?.[0]).toContain(app.url);
    expect(log.mock.calls[0]?.[0]).toContain(`PID: ${process.pid}`);
  });

  it("preserves a running background instance when another port is requested", async () => {
    const directory = await home();
    const store = new SettingsStore(directory);
    const app = await startFieldwork(store);
    cleanup.push(app.close);
    await writeFile(resolve(directory, ".afk/background/server.json"), JSON.stringify({ pid: process.pid, url: app.url, token: app.token }));
    const port = Number(new URL(app.url).port);
    await expect(startBackground(store, port === 4310 ? 4311 : 4310)).rejects.toThrow("Run afk stop");
    const response = await fetch(`${app.url}/api/status`, { headers: { "x-afk-token": app.token } });
    expect(response.ok).toBe(true);
  });

  it("does not fall back when a requested port is occupied", async () => {
    const directory = await home();
    const app = await startFieldwork(new SettingsStore(directory));
    cleanup.push(app.close);
    const port = Number(new URL(app.url).port);
    await expect(startFieldwork(new SettingsStore(directory), port)).rejects.toThrow(`Port ${port} is already in use`);
  });

  it("refuses to stop an instance with an invalid token", async () => {
    const directory = await home();
    const app = await startFieldwork(new SettingsStore(directory));
    cleanup.push(app.close);
    await writeFile(resolve(directory, ".afk/background/server.json"), JSON.stringify({ pid: process.pid, url: app.url, token: "wrong" }));
    await expect(stopBackground(directory)).rejects.toThrow("Could not verify");
    const response = await fetch(`${app.url}/api/status`, { headers: { "x-afk-token": app.token } });
    expect(response.ok).toBe(true);
  });
});
