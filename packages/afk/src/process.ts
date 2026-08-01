import spawn from "cross-spawn";
import type { CommandResult, SpawnBehavior } from "./types.js";

export function spawnCommand(
  command: string,
  args: string[],
  cwd?: string,
  behavior: SpawnBehavior = { verbose: false },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: behavior.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: false,
    });

    child.stdout?.resume();
    child.stderr?.resume();
    child.on("close", (code) => resolve({ code: code ?? 1 }));
    child.on("error", () => resolve({ code: 1 }));
  });
}
