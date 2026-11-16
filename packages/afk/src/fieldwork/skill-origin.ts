import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Library, Storage } from "./library.js";

/** Where a stored skill comes from: enough for Skills CLI to check it against its repository. */
export interface SkillOrigin {
  source: string;
  skillPath?: string | undefined;
  revision?: string | undefined;
}

/** Stands in for a revision AFK never recorded. It never matches upstream, so Skills CLI downloads the skill and AFK compares files. */
export const UNVERIFIED_REVISION = "unverified";

const NOTE = ".afk-source.json";

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export async function readSourceNote(folder: string): Promise<SkillOrigin | undefined> {
  try {
    const note = JSON.parse(await readFile(join(folder, NOTE), "utf8")) as Record<string, unknown>;
    const source = nonEmpty(note.source), skillPath = nonEmpty(note.skillPath), revision = nonEmpty(note.revision);
    return source ? { source, ...(skillPath ? { skillPath } : {}), ...(revision ? { revision } : {}) } : undefined;
  } catch { return undefined; }
}

/** The note kept beside a pack or machine copy, which has no library record of its own. */
export async function writeSourceNote(folder: string, origin: SkillOrigin): Promise<void> {
  const { source, skillPath, revision } = origin;
  await writeFile(join(folder, NOTE), JSON.stringify({ source, ...(skillPath ? { skillPath } : {}), ...(revision ? { revision } : {}) }), { mode: 0o600 });
}

/** A stored skill's origin from its library record, or from the note beside its copy; each fills what the other lacks. */
export async function originOf(library: Library, name: string, folder: string, storage: Storage): Promise<SkillOrigin | undefined> {
  const record = storage === "machine" ? undefined : await library.record(name);
  const note = await readSourceNote(folder);
  const source = record?.source ?? note?.source;
  if (!source) return undefined;
  const same = note?.source === source;
  const skillPath = record?.skillPath ?? (same ? note?.skillPath : undefined);
  const revision = record?.revision ?? (same ? note?.revision : undefined);
  return { source, ...(skillPath ? { skillPath } : {}), ...(revision ? { revision } : {}) };
}
