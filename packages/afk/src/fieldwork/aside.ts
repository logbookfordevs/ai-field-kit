import { lstat, mkdir, rename } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

export interface AsideMove { name: string; from: string; to: string }

/** Where AFK moves a user's differing copy instead of deleting it, one folder per day. */
export function asideRoot(home: string): string {
  return join(home, ".afk/restore-aside");
}

export function dateFolder(now: Date): string {
  const part = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${part(now.getMonth() + 1)}-${part(now.getDate())}`;
}

async function taken(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

async function freeSpot(path: string): Promise<string> {
  for (let index = 2, candidate = path; ; candidate = `${path}-${index++}`) if (!await taken(candidate)) return candidate;
}

/** Moves a path into today's aside folder, keeping its place relative to the home, and returns where it went. */
export async function moveAside(home: string, name: string, path: string, now: Date = new Date()): Promise<AsideMove> {
  const inside = relative(home, path);
  const to = await freeSpot(join(asideRoot(home), dateFolder(now), inside.startsWith("..") ? basename(path) : inside));
  await mkdir(dirname(to), { recursive: true });
  await rename(path, to);
  return { name, from: path, to };
}
