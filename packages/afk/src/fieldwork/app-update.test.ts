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

it("shows an available update and launches only the explicit update action", async () => {
  const { readFileSync } = await import("node:fs");
  const { createContext, runInContext } = await import("node:vm");
  const source = readFileSync(new URL("../../web/app-update.js", import.meta.url), "utf8");
  const target = { innerHTML: "" }, calls: string[] = [];
  const context = createContext({ $: () => target, esc: String, skillActionLabel: (label: string) => label,
    button: (label: string) => label, request: async (operation: string) => { calls.push(operation); return { started: true }; },
  });
  runInContext(source, context);
  runInContext("appVersion={current:'2.0.3',latest:'2.1.0',available:true};renderAppUpdate()", context);
  expect(target.innerHTML).toContain("Version 2.1.0 is available");
  expect(target.innerHTML).toContain("Update & restart");
  expect(calls).toEqual([]);
  runInContext("pollAppUpdate=()=>{}", context);
  await runInContext("startAppUpdate()", context);
  expect(calls).toEqual(["app/update"]);
});

it("shows checking immediately, prevents repeat checks, and confirms no update was found", async () => {
  const { readFileSync } = await import("node:fs");
  const { createContext, runInContext } = await import("node:vm");
  const source = readFileSync(new URL("../../web/app-update.js", import.meta.url), "utf8");
  const notice = { innerHTML: "" }, messages: string[] = [];
  let finishCheck!: (result: unknown) => void;
  const result = new Promise(resolve => { finishCheck = resolve; });
  const request = vi.fn((operation: string) => operation.startsWith("app/update-check") ? result : Promise.resolve(null));
  const context = createContext({ $: () => notice, esc: String, request,
    button: (label: string, _action: string, _class: string, attrs: string) => `<button ${attrs}>${label}</button>`,
    toast: (message: string) => messages.push(message),
  });
  runInContext(source, context);
  runInContext("appVersion={current:'2.0.3',available:false}", context);
  const checking = runInContext("checkAppVersion(true)", context);
  expect(notice.innerHTML).toContain("Checking for updates…");
  expect(notice.innerHTML).toContain("<button disabled>Checking…</button>");
  await runInContext("checkAppVersion(true)", context);
  expect(request).toHaveBeenCalledTimes(1);
  finishCheck({ current: "2.0.3", available: false });
  await checking;
  expect(notice.innerHTML).toContain("Up to date");
  expect(messages).toEqual(["AFK 2.0.3 is up to date. No update found."]);
});

it("reports a failed manual check and keeps successful checks independent of update-state failures", async () => {
  const { readFileSync } = await import("node:fs");
  const { createContext, runInContext } = await import("node:vm");
  const source = readFileSync(new URL("../../web/app-update.js", import.meta.url), "utf8");
  for (const fails of [true, false]) {
    const notice = { innerHTML: "" }, messages: string[] = [];
    const context = createContext({ $: () => notice, esc: String, button: (label: string) => label,
      toast: (message: string) => messages.push(message),
      request: async (operation: string) => {
        if (operation === "app/update-state") throw new Error("State unavailable");
        return { current: "2.0.3", available: false, ...(fails ? { error: "Offline" } : {}) };
      },
    });
    runInContext(source, context);
    await runInContext("checkAppVersion(true)", context);
    expect(notice.innerHTML).toContain(fails ? "Update check unavailable" : "Up to date");
    expect(messages).toEqual([fails ? "Could not check for updates. Try again." : "AFK 2.0.3 is up to date. No update found."]);
  }
});

it("hides successful update logs while keeping progress and failure details visible", async () => {
  const { readFileSync } = await import("node:fs");
  const { createContext, runInContext } = await import("node:vm");
  const notice = { innerHTML: "" };
  const context = createContext({ $: () => notice, esc: String, button: (label: string) => label });
  runInContext(readFileSync(new URL("../../web/app-update.js", import.meta.url), "utf8"), context);
  runInContext("appVersion={current:'2.0.4',available:false};appUpdateJob={pending:true,phase:'Restarting AFK…',output:'Installer output'};renderAppUpdate()", context);
  expect(notice.innerHTML).toContain("Update details");
  runInContext("appUpdateJob.pending=false;appUpdateJob.phase='AFK updated and restarted.';renderAppUpdate()", context);
  expect(notice.innerHTML).not.toContain("Update details");
  expect(notice.innerHTML).toContain("Up to date");
  expect(runInContext("appUpdateJob.output", context)).toBe("Installer output");
  runInContext("appUpdateJob.error='Restart failed';renderAppUpdate()", context);
  expect(notice.innerHTML).toContain("Update details");
  expect(notice.innerHTML).toContain("Restart failed");
});
