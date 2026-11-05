import { spawn } from "node:child_process";

export interface CommandSpec {
  command: string;
  args: string[];
  step: string;
  cwd?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  idleTimeoutMs?: number | undefined;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
  inherit?: boolean | undefined;
  onOutput?: ((text: string, stream: "stdout" | "stderr") => void) | undefined;
}

export interface CommandResult { code: number; output: string; cancelled: boolean }

export class CommandTimeoutError extends Error {
  constructor(readonly step: string, readonly reason: "idle" | "deadline", readonly limitMs: number) {
    const seconds = Math.max(1, Math.round(limitMs / 1000));
    super(reason === "idle" ? `${step} stopped: no output for ${seconds}s. The command was cancelled.` : `${step} stopped: it ran longer than ${seconds}s. The command was cancelled.`);
    this.name = "CommandTimeoutError";
  }
}

const DEFAULT_IDLE_MS = 120_000;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const OUTPUT_LIMIT = 100_000;
const posix = process.platform !== "win32";

function override(name: string): number | undefined {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function killTree(pid: number | undefined, fallback: () => void): void {
  if (!pid) return;
  if (!posix) { spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" }).once("error", fallback); return; }
  try { process.kill(-pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") fallback(); }
}

export function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const { command, args, step, signal } = spec;
  const idleMs = override("AFK_COMMAND_IDLE_MS") ?? spec.idleTimeoutMs ?? DEFAULT_IDLE_MS, totalMs = override("AFK_COMMAND_TIMEOUT_MS") ?? spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (signal?.aborted) return Promise.resolve({ code: 130, output: "", cancelled: true });
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: spec.cwd, env: spec.env, detached: posix && !spec.inherit, stdio: spec.inherit ? "inherit" : ["ignore", "pipe", "pipe"] });
    let output = "", cancelled = false, failure: Error | undefined, settled = false;
    let idle: NodeJS.Timeout | undefined;
    const stop = (): void => spec.inherit ? void child.kill("SIGKILL") : killTree(child.pid, () => child.kill("SIGKILL"));
    const fail = (error: Error): void => { failure ??= error; stop(); };
    const armIdle = (): void => {
      if (spec.inherit) return;
      clearTimeout(idle);
      idle = setTimeout(() => fail(new CommandTimeoutError(step, "idle", idleMs)), idleMs);
    };
    const total = setTimeout(() => fail(new CommandTimeoutError(step, "deadline", totalMs)), totalMs);
    const cancel = (): void => { cancelled = true; stop(); };
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true; clearTimeout(idle); clearTimeout(total); signal?.removeEventListener("abort", cancel);
      action();
    };
    const take = (name: "stdout" | "stderr") => (chunk: string): void => {
      armIdle();
      output = (output + chunk).slice(-OUTPUT_LIMIT);
      spec.onOutput?.(chunk, name);
    };
    child.stdout?.setEncoding("utf8").on("data", take("stdout"));
    child.stderr?.setEncoding("utf8").on("data", take("stderr"));
    signal?.addEventListener("abort", cancel, { once: true });
    armIdle();
    child.once("error", error => finish(() => reject(new Error(`${step} could not start: ${error.message}`))));
    child.once("close", code => finish(() => failure ? reject(failure) : accept({ code: cancelled ? 130 : code ?? 1, output, cancelled })));
  });
}
