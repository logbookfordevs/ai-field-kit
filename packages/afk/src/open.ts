import { join } from "node:path";
import type { CliOptions, Runtime } from "./types.js";

export async function runAfkOpen(
  runtime: Runtime,
  options: Pick<CliOptions, "homeDir" | "cwd" | "afkOpenApp">,
): Promise<number> {
  const targetPath = join(options.homeDir, ".agents", "afk");
  runtime.io.stdout(`Opening ${targetPath}`);

  const command = options.afkOpenApp === "code" ? "code" : "open";
  const result = await runtime.spawn(command, [targetPath], options.cwd);
  if (result.code !== 0) {
    runtime.io.stderr(`Could not open ${targetPath}.`);
  }

  return result.code;
}
