import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FieldworkOperations } from "./operations.js";
import { emptySettings, SettingsStore } from "./settings.js";

interface ToolState { tools: { id: number; name: string }[]; runs: Record<number, { pending: boolean; output: string; code?: number }>; home: string }

let home: string;
let store: SettingsStore;

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-tool-state-"));
  store = new SettingsStore(home);
  await store.initialize();
  vi.stubEnv("SHELL", "/bin/sh");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }); });

async function waitFor<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for the expected state.");
}

describe("tool/state", () => {
  it("lists saved tools, the home folder and the result of finished runs without the rest of the app state", async () => {
    const settings = emptySettings();
    settings.tools = [{ id: 1, name: "Echo", install: "echo installed", update: "" }];
    await store.save(settings);
    const operations = new FieldworkOperations(store);
    expect(await operations.run("tool/state")).toMatchObject({ tools: [{ id: 1, name: "Echo" }], runs: {}, home });
    await operations.run("tool/run", { id: 1 });
    const state = await operations.run("tool/state") as ToolState;
    expect(state.runs[1]).toMatchObject({ pending: false, code: 0 });
    expect(state.runs[1]?.output).toContain("installed");
    expect(state).not.toHaveProperty("inventories");
    await operations.close();
  });

  it("shows a running command's output as it arrives", async () => {
    const settings = emptySettings();
    settings.tools = [{ id: 2, name: "Slow", install: "echo first-line; sleep 1; echo last-line", update: "" }];
    await store.save(settings);
    const operations = new FieldworkOperations(store);
    const finished = operations.run("tool/run", { id: 2 });
    const running = await waitFor(async () => await operations.run("tool/state") as ToolState, state => Boolean(state.runs[2]?.output.includes("first-line")));
    expect(running.runs[2]).toMatchObject({ pending: true });
    expect(running.runs[2]?.output).not.toContain("last-line");
    await finished;
    const done = await operations.run("tool/state") as ToolState;
    expect(done.runs[2]).toMatchObject({ pending: false, code: 0 });
    expect(done.runs[2]?.output).toContain("last-line");
    await operations.close();
  });
});
