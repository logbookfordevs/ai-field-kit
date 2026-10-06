import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { startBackground } from "./background.js";
import { SettingsStore } from "./settings.js";

vi.mock("node:child_process", async importOriginal => ({
  ...await importOriginal<typeof import("node:child_process")>(), spawn: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

it("stops its child before deleting the record when verification fails after startup", async () => {
  const home = await mkdtemp(resolve(tmpdir(), "afk-failed-start-"));
  const events = new EventEmitter();
  const kill = vi.fn(() => {
    process.nextTick(() => events.emit("exit", null, "SIGTERM"));
    return true;
  });
  const child = Object.assign(events, { pid: process.pid, exitCode: null, signalCode: null, kill, disconnect: vi.fn(), unref: vi.fn() });
  vi.mocked(spawn).mockImplementation(() => {
    void writeFile(resolve(home, ".afk/background/server.json"), JSON.stringify({ pid: process.pid, url: "http://127.0.0.1:4310", token: "fixture" }))
      .then(() => events.emit("message", { ready: true }));
    return child as unknown as ChildProcess;
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("verification unavailable"));
  try {
    await expect(startBackground(new SettingsStore(home))).rejects.toThrow("verification unavailable");
    expect(kill).toHaveBeenCalledWith("SIGTERM");
    await expect(readFile(resolve(home, ".afk/background/server.json"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await rm(home, { recursive: true, force: true }); }
});
