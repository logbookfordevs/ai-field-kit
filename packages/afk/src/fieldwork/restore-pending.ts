import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Written before a cloned library takes its place and removed once it is deployed, so an interrupted restore can be finished.
const pendingPath = (home: string): string => join(home, ".afk/restore-pending.json");

/** The repository of a restore that put the library in place but did not finish linking it. */
export async function pendingRestore(home: string): Promise<string | undefined> {
  try {
    const { repository } = JSON.parse(await readFile(pendingPath(home), "utf8")) as { repository?: unknown };
    return typeof repository === "string" ? repository : undefined;
  } catch { return undefined; }
}

export async function markRestorePending(home: string, repository: string): Promise<void> {
  await mkdir(join(home, ".afk"), { recursive: true });
  await writeFile(pendingPath(home), JSON.stringify({ repository }), { mode: 0o600 });
}

export async function clearRestorePending(home: string): Promise<void> {
  await rm(pendingPath(home), { force: true });
}
