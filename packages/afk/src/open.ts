import { join } from "node:path";
import type { CliOptions, Runtime } from "./types.js";

export async function runAfkOpen(
  runtime: Runtime,
  options: Pick<CliOptions, "homeDir" | "cwd">,
): Promise<number> {
  const targetPath = join(options.homeDir, ".agents", "afk");
  runtime.io.stdout(`Opening ${targetPath}`);

  const result = await runtime.spawn("open", [targetPath], options.cwd);
  if (result.code !== 0) {
    runtime.io.stderr(`Could not open ${targetPath}.`);
  }

  return result.code;
}
