import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FieldworkOperations } from "./operations.js";
import { SourcePreparation } from "./preparation.js";
import { emptySettings, SettingsStore } from "./settings.js";
import { installSkills } from "./skill-install.js";
import { updateSkills } from "./skill-update.js";
import { SkillLibrary } from "./skills.js";
import { startFieldwork } from "./server.js";

let home: string;
let store: SettingsStore;

async function hangingNpx(): Promise<void> {
  const bin = join(home, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "npx"), "#!/bin/sh\necho 'Cloning repository'\nexec sleep 60\n");
  await chmod(join(bin, "npx"), 0o755);
  vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
  vi.stubEnv("AFK_COMMAND_IDLE_MS", "400");
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "afk-launch-"));
  store = new SettingsStore(home);
  await store.initialize();
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(home, { recursive: true, force: true }); });

describe("a stalled outside command", () => {
  it("fails an install with a message naming the step, and the app keeps serving", async () => {
    await hangingNpx();
    const result = await installSkills(store, await store.read(), [{ source: "owner/repo" }], "Global", "universal", "Test", () => {});
    expect(result).toMatchObject({ pending: false, code: 1, phase: "Installation failed" });
    expect(result.output).toContain("Installing owner/repo through Skills CLI stopped");
    expect(result.finishedAt).toBeGreaterThanOrEqual(result.startedAt!);
  });

  it("fails a source preparation with a message naming the step", async () => {
    await hangingNpx();
    const preparation = new SourcePreparation();
    await expect(preparation.discover("owner/repo")).rejects.toThrow("Reading owner/repo through Skills CLI stopped");
    await preparation.close();
  });

  it("fails a skill update and leaves stored skills unchanged", async () => {
    await hangingNpx();
    const settings = await store.read();
    const root = new SkillLibrary(store).root(settings, "Global");
    const skill = join(root, ".disabled/sample");
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "---\nname: sample\ndescription: Fixture\n---\nold\n");
    await mkdir(join(home, ".agents"), { recursive: true });
    await writeFile(join(home, ".agents/.skill-lock.json"), JSON.stringify({ version: 3, skills: { sample: { source: "fixture" } } }));
    await expect(updateSkills(store, settings, "Global", () => {})).rejects.toThrow("Updating through Skills CLI stopped");
    expect(await readFile(join(skill, "SKILL.md"), "utf8")).toContain("old");
  });

  it("fails a tool run instead of hanging, reporting the step", async () => {
    vi.stubEnv("SHELL", "/bin/sh");
    vi.stubEnv("AFK_COMMAND_IDLE_MS", "300");
    const settings = emptySettings();
    settings.tools = [{ id: 3, name: "Slow", install: "echo started; sleep 60", update: "" }];
    await store.save(settings);
    const operations = new FieldworkOperations(store);
    await expect(operations.run("tool/run", { id: 3 })).rejects.toThrow("The tool command stopped");
    expect((await operations.run("state") as { toolRuns: Record<number, { code?: number; pending: boolean }> }).toolRuns[3]).toMatchObject({ pending: false, code: 1 });
    await operations.close();
  });
});

describe("shutdown", () => {
  it("kills running tool commands instead of waiting for them", async () => {
    vi.stubEnv("SHELL", "/bin/sh");
    const marker = join(home, "still-running");
    const settings = emptySettings();
    settings.tools = [{ id: 4, name: "Long", install: `echo up; sleep 60 & echo $! > ${marker}; wait`, update: "" }];
    await store.save(settings);
    const operations = new FieldworkOperations(store);
    const running = operations.run("tool/run", { id: 4 }).catch(() => undefined);
    for (let attempt = 0; attempt < 100 && !(await readFile(marker, "utf8").catch(() => "")); attempt++) await new Promise(accept => setTimeout(accept, 25));
    const started = Date.now();
    expect(await operations.close(5000)).toEqual({ abandoned: [] });
    await running;
    expect(Date.now() - started).toBeLessThan(3000);
    const pid = Number(await readFile(marker, "utf8"));
    await new Promise(accept => setTimeout(accept, 100));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it("stops waiting at its deadline and logs what it abandoned", async () => {
    vi.spyOn(SkillLibrary.prototype, "inventory").mockReturnValue(new Promise(() => {}));
    const operations = new FieldworkOperations(store);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    void operations.run("state").catch(() => undefined);
    const started = Date.now();
    const result = await operations.close(300);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.abandoned).toEqual(["state"]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("abandoned: state"));
    vi.restoreAllMocks();
  });
});

describe("server shutdown", () => {
  const call = (app: { url: string; token: string }, path: string, body?: unknown): Promise<Response> =>
    fetch(`${app.url}/api/${path}`, { method: body ? "POST" : "GET", headers: { "x-afk-token": app.token }, ...(body ? { body: JSON.stringify(body) } : {}) });

  it("completes within its deadline while an operation is hung, and logs it", async () => {
    vi.spyOn(SkillLibrary.prototype, "inventory").mockReturnValue(new Promise(() => {}));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = await startFieldwork(store, 0, { shutdownMs: 300 });
    void call(app, "state").catch(() => undefined);
    await new Promise(accept => setTimeout(accept, 100));
    const started = Date.now();
    await app.close();
    expect(Date.now() - started).toBeLessThan(2500);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("abandoned: state"));
    vi.restoreAllMocks();
  });

  it("stops a running tool command and its children", async () => {
    vi.stubEnv("SHELL", "/bin/sh");
    const marker = join(home, "child-pid");
    const settings = emptySettings();
    settings.tools = [{ id: 5, name: "Long", install: `sleep 60 & echo $! > ${marker}; wait`, update: "" }];
    await store.save(settings);
    const app = await startFieldwork(store, 0, { shutdownMs: 5000 });
    void call(app, "tool/run", { id: 5 }).catch(() => undefined);
    await vi.waitFor(async () => expect(await readFile(marker, "utf8")).not.toBe(""), { timeout: 3000 });
    const pid = Number(await readFile(marker, "utf8"));
    await app.close();
    await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 3000 });
  });
});

describe("launch sites", () => {
  it("start outside commands only through the shared runner, apart from the launchers", async () => {
    const launchers = new Set(["command-runner.ts", "cli.ts", "background.ts", "app-update.ts"]);
    const names = (await readdir(new URL(".", import.meta.url))).filter(name => name.endsWith(".ts") && !name.includes(".test"));
    const offenders: string[] = [];
    for (const name of names) {
      if (launchers.has(name)) continue;
      if (/node:child_process/.test(await readFile(new URL(name, import.meta.url), "utf8"))) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});
