import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

export function defaultRepoDir(): string {
  return resolve(packageRoot(), "..", "..");
}

export function resolveHome(input: NodeJS.ProcessEnv = process.env): string {
  return input.HOME ?? input.USERPROFILE ?? process.cwd();
}

export function resolveRepoDir(input: NodeJS.ProcessEnv = process.env): string {
  return input.AI_RULES_REPO ? resolve(input.AI_RULES_REPO) : defaultRepoDir();
}

export function manifestPath(name: string): string {
  return resolve(packageRoot(), "manifests", name);
}
