import { ChildProcess, spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runFieldwork } from "./cli.js";
import { SettingsStore } from "./settings.js";
import { installerCommand } from "./update.js";

vi.mock("node:child_process", async importOriginal => ({ ...await importOriginal<typeof import("node:child_process")>(), spawn: vi.fn() }));
let store: SettingsStore;
beforeEach(() => {
  store = new SettingsStore("/unused-afk-update-home");
  vi.spyOn(store, "initialize").mockRejectedValue(new Error("Update must not read AFK settings"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.mocked(spawn).mockReset(); });

describe("AFK self-update CLI", () => {
  it("prints a dry-run command without spawning or reading settings", async () => {
    expect(await runFieldwork(["update", "--dry-run"], store)).toBe(0);
    expect(console.log).toHaveBeenCalledWith(installerCommand);
    expect(spawn).not.toHaveBeenCalled(); expect(store.initialize).not.toHaveBeenCalled();
  });
  it.each(["--help", "-h", "help"])("shows update help for %s without running the installer", async flag => {
    expect(await runFieldwork(["update", flag], store)).toBe(0);
    expect(spawn).not.toHaveBeenCalled(); expect(store.initialize).not.toHaveBeenCalled();
  });
  it.each([0, 7, null])("runs the hosted installer with live output and propagates status %s", async code => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = new ChildProcess(); queueMicrotask(() => child.emit("close", code)); return child;
    });
    expect(await runFieldwork(["update"], store)).toBe(code ?? 1);
    expect(spawn).toHaveBeenCalledWith("bash", ["-o", "pipefail", "-c", installerCommand], { stdio: "inherit" });
    expect(store.initialize).not.toHaveBeenCalled();
    if (code !== 0) expect(console.error).toHaveBeenCalledWith(installerCommand);
  });
  it("reports a missing shell as a command failure", async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const child = new ChildProcess(); queueMicrotask(() => child.emit("error", new Error("bash unavailable"))); return child;
    });
    expect(await runFieldwork(["update"], store)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("bash unavailable"));
  });
  it.each([["--unknown"], ["--dry-run", "extra"], ["--help", "extra"]].map(args => ({ args })))("rejects unsupported arguments $args before executing", async ({ args }) => {
    expect(await runFieldwork(["update", ...args], store)).toBe(1); expect(spawn).not.toHaveBeenCalled();
  });
});
