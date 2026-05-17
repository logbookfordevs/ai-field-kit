import { join } from "node:path";
import { canExecute, pathExists } from "./fs-utils.js";
import type { CliOptions, Runtime } from "./types.js";

export async function runDoctor(runtime: Runtime, options: CliOptions): Promise<number> {
  const checks = [
    ["repo", pathExists(join(options.repoDir, "README.md"))],
    ["rules", pathExists(join(options.repoDir, "rules", "AGENTS.md"))],
    ["workflows", pathExists(join(options.repoDir, "workflows"))],
    ["skills manifest", pathExists(join(options.repoDir, "packages", "afk", "manifests", "skills.json"))],
    ["node", canExecute(process.execPath)],
  ] as const;

  runtime.io.stdout("\nAFK doctor");
  for (const [label, ok] of checks) {
    runtime.io.stdout(`${ok ? "ok" : "missing"} ${label}`);
  }

  const failed = checks.some(([, ok]) => !ok);
  return failed ? 1 : 0;
}
