import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CommandTimeoutError, runCommand } from "./command-runner.js";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "afk-runner-")); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

const node = (script: string, extra: Partial<Parameters<typeof runCommand>[0]> = {}): Parameters<typeof runCommand>[0] => ({ command: process.execPath, args: ["-e", script], step: "Fake step", ...extra });
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function until(check: () => Promise<boolean> | boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await check()) return; await new Promise(accept => setTimeout(accept, 25)); }
  throw new Error("Condition was not met in time.");
}
const spawnsGrandchild = (file: string): string => `
  const { spawn } = require("node:child_process");
  const child = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  require("node:fs").writeFileSync(${JSON.stringify(file)}, String(child.pid));
  setInterval(() => {}, 1000);
`;

describe("command runner", () => {
  it("returns the exit code and combined output", async () => {
    const seen: string[] = [];
    const result = await runCommand(node(`console.log("out"); console.error("err"); process.exit(3)`, { onOutput: text => seen.push(text) }));
    expect(result.code).toBe(3);
    expect(result.output).toContain("out");
    expect(result.output).toContain("err");
    expect(seen.join("")).toContain("out");
  });

  it("stops a silent command at its deadline and names the step", async () => {
    const started = Date.now();
    const failure = await runCommand(node(`setInterval(()=>{},1000)`, { idleTimeoutMs: 200, step: "Fetching the source" })).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CommandTimeoutError);
    expect((failure as Error).message).toContain("Fetching the source");
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it("lets a command that keeps talking run past the silence limit", async () => {
    const result = await runCommand(node(`let n = 0; const t = setInterval(() => { console.log("tick"); if (++n === 15) { clearInterval(t); } }, 100)`, { idleTimeoutMs: 1000 }));
    expect(result.code).toBe(0);
  });

  it("stops a command that outlives its overall limit even while it talks", async () => {
    const failure = await runCommand(node(`setInterval(() => console.log("busy"), 50)`, { timeoutMs: 300, idleTimeoutMs: 5000 })).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CommandTimeoutError);
  });

  it("kills the whole process group at the deadline", async () => {
    const file = join(directory, "grandchild");
    await runCommand(node(spawnsGrandchild(file), { idleTimeoutMs: 1500 })).catch(() => undefined);
    const pid = Number(await readFile(file, "utf8"));
    await until(() => !alive(pid));
  });

  it("cancels the running command and its children", async () => {
    const file = join(directory, "grandchild");
    const controller = new AbortController();
    const pending = runCommand(node(spawnsGrandchild(file), { signal: controller.signal, idleTimeoutMs: 60_000 }));
    await until(async () => (await readFile(file, "utf8").catch(() => "")) !== "");
    const pid = Number(await readFile(file, "utf8"));
    controller.abort();
    const result = await pending;
    expect(result.cancelled).toBe(true);
    await until(() => !alive(pid));
  });

  it("does not start when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await runCommand(node(`require("node:fs").writeFileSync(${JSON.stringify(join(directory, "ran"))}, "")`, { signal: controller.signal }));
    expect(result.cancelled).toBe(true);
    await expect(readFile(join(directory, "ran"))).rejects.toThrow();
  });

  it("reports a missing command as a failure naming the step", async () => {
    await expect(runCommand({ command: "afk-command-that-does-not-exist", args: [], step: "Starting the tool" })).rejects.toThrow("Starting the tool");
  });
});
