import { afterEach, expect, it, vi } from "vitest";
import { AppUpdates, newerVersion, type UpdateTarget } from "./app-update.js";
import { updateAndRestart } from "./app-update-worker.js";

afterEach(() => { vi.restoreAllMocks(); });
it("compares stable versions numerically without treating older or prerelease builds as updates", () => {
  expect(newerVersion("v2.10.0", "2.9.0")).toBe(true);
  expect(newerVersion("2.0.3", "2.0.3")).toBe(false);
  expect(newerVersion("2.0.2", "2.0.3")).toBe(false);
  expect(newerVersion("2.1.0-beta.1", "2.0.3")).toBe(false);
});
it("shares and caches checks, with an explicit refresh option", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ tag_name: "v2.1.0" })));
  const updates = new AppUpdates("2.0.3");
  const results = await Promise.all([updates.check(), updates.check()]);
  expect(results[0]).toEqual({ current: "2.0.3", latest: "2.1.0", available: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  await updates.check(); expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ tag_name: "v2.1.0" })));
  await updates.check(true); expect(fetch).toHaveBeenCalledTimes(2);
});
it("reports check failure without claiming the installed version is current", async () => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline"));
  expect(await new AppUpdates("2.0.3").check()).toEqual({ current: "2.0.3", available: false, error: "Offline" });
});
const target: UpdateTarget = { home: "/tmp/example-home", settingsPath: "/tmp/shared/settings.json", url: "http://127.0.0.1:4310", token: "fixture", current: "2.0.3", latest: "2.1.0" };
it("updates and verifies before stopping, then restarts on the same port and settings", async () => {
  const order: string[] = [];
  const run = vi.fn(async (_command: string, args: string[], env: NodeJS.ProcessEnv) => {
    expect(env.AFK_SETTINGS).toBe(target.settingsPath); expect(env.HOME).toBe(target.home);
    order.push(args.includes("update") ? "update" : args[0]!);
    return args[0] === "--version" ? "2.1.0\n" : "";
  });
  await updateAndRestart(target, run, async () => { order.push("stop"); }, async () => {});
  expect(order).toEqual(["update", "--version", "stop", "--background"]);
  expect(run.mock.calls[2]?.[1]).toEqual(["--background", "--port", "4310"]);
});
it("leaves the current server running when installation or version verification fails", async () => {
  for (const installs of [false, true]) {
    const stop = vi.fn(async () => {});
    const run = vi.fn(async () => { if (!installs) throw new Error("Installer failed"); return "2.0.3"; });
    await expect(updateAndRestart(target, run, stop, async () => {})).rejects.toThrow();
    expect(stop).not.toHaveBeenCalled();
  }
});
it("does not launch a replacement when the old server cannot shut down", async () => {
  const run = vi.fn(async () => "2.1.0");
  await expect(updateAndRestart(target, run, async () => { throw new Error("Still draining"); }, async () => {})).rejects.toThrow("Still draining");
  expect(run).toHaveBeenCalledTimes(2);
});
