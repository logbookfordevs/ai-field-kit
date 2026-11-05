import { lstat, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseDocument } from "yaml";
import { writeInvocationChoice } from "./invocation.js";
import { isRepositorySource } from "./kit.js";
import { type InvocationChoice, type Storage } from "./library.js";
import { SkillLibrary } from "./skills.js";
import type { Settings, SettingsStore } from "./settings.js";

const MAX_BYTES = 500_000;
const MAX_FILES = 200;
const MANAGED = ["SKILL.md", "agents/openai.yaml", ".afk-invocation-original.json"];

export type UpdatesChoice = "keep" | "replace";

/** What an edit means for later updates: no source to update from, still to be asked, or already decided. */
export type UpdatesState = "none" | "ask" | "replace" | "stopped";

export interface SkillEditorView {
  name: string;
  storage?: Storage;
  path: string;
  files: string[];
  file: string;
  /** Null when the file is binary or too large to show as text. */
  content: string | null;
  /** Why saving is refused; absent when the file can be saved. */
  readOnly?: string;
  invocation: InvocationChoice;
  source?: string;
  updates: UpdatesState;
}

export interface SkillEdit {
  name: string;
  file: string;
  content: string;
  updates?: UpdatesChoice;
}

interface Located {
  base: string;
  storage?: Storage;
  readOnly?: string;
  invocation: InvocationChoice;
  source?: string;
  updates: UpdatesState;
}

async function optional(path: string): Promise<string | null> {
  try { return await readFile(path, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function relativeParts(file: unknown): string[] {
  if (typeof file !== "string" || !file || file.includes("\0") || file.includes("\\") || isAbsolute(file)) throw new Error("Choose a file inside the skill folder.");
  const parts = file.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || part.startsWith("."))) throw new Error("Choose a file inside the skill folder.");
  return parts;
}

/** Resolves a file by walking from the skill folder and refusing every link on the way, so no path leaves the folder. */
async function fileInside(base: string, file: unknown): Promise<string> {
  let current = base;
  for (const part of relativeParts(file)) {
    current = join(current, part);
    let info;
    try { info = await lstat(current); } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw new Error("That file is not in this skill.");
      throw error;
    }
    if (info.isSymbolicLink()) throw new Error("Choose a file inside the skill folder.");
  }
  if (!(await lstat(current)).isFile()) throw new Error("Choose a file inside the skill folder.");
  return current;
}

async function listFiles(base: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (directory: string, prefix: string): Promise<void> => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".") || files.length >= MAX_FILES) continue;
      if (entry.isDirectory()) await walk(join(directory, entry.name), `${prefix}${entry.name}/`);
      else if (entry.isFile()) files.push(prefix + entry.name);
    }
  };
  await walk(base, "");
  return files.sort((a, b) => Number(b === "SKILL.md") - Number(a === "SKILL.md"));
}

function checkFrontmatter(text: string): void {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match || parseDocument(match[1]!).errors.length) throw new Error("SKILL.md must start with valid YAML frontmatter between --- lines.");
}

async function locate(store: SettingsStore, settings: Settings, name: string): Promise<Located> {
  const skills = new SkillLibrary(store);
  const entry = (await skills.inventory(settings, "Global")).find(skill => skill.name === name);
  if (!entry) throw new Error("Skill not found on this machine.");
  const storage = entry.storage;
  const record = storage === "library" || storage === "pack" ? await skills.library.record(name) : undefined;
  const preferred = settings.preferences[`Global|${name}`];
  const invocation: InvocationChoice = record?.invocation || (preferred === "Manual only" || preferred === "Automatic allowed" ? preferred : "");
  const source = record?.source ?? entry.source;
  const updates: UpdatesState = storage === "library" && isRepositorySource(record?.source) ? record?.updates ?? "ask" : "none";
  const base = storage ? skills.library.storagePath(name, storage) : entry.path;
  const common = { base, ...(storage ? { storage } : {}), invocation, ...(source ? { source } : {}), updates };
  if (entry.tool) return { ...common, readOnly: `${entry.tool} installs and updates this skill, so edits would be overwritten. Change it in the tool's own repository.` };
  if (storage === "pack") return { ...common, readOnly: "A pack downloads this skill again when it is turned on, so edits would be lost. Add the skill to your library to edit it." };
  if (!storage) return { ...common, readOnly: "AFK does not keep this skill yet. Add it to your library or keep it on this machine to edit it." };
  if ((await lstat(base)).isSymbolicLink()) return { ...common, readOnly: "This skill folder is a link, and AFK edits only folders it stores itself." };
  return common;
}

async function textOf(path: string): Promise<{ content: string | null; reason?: string }> {
  if ((await stat(path)).size > MAX_BYTES) return { content: null, reason: "This file is too large to edit here." };
  const text = await readFile(path, "utf8");
  if (text.includes("\0")) return { content: null, reason: "This file is not plain text." };
  return { content: text };
}

export async function openSkillEditor(store: SettingsStore, settings: Settings, name: string, file = "SKILL.md"): Promise<SkillEditorView> {
  const located = await locate(store, settings, name);
  const base = await realpath(located.base);
  const target = await fileInside(base, file);
  const { content, reason } = await textOf(target);
  const readOnly = located.readOnly ?? reason;
  return {
    name, ...(located.storage ? { storage: located.storage } : {}), path: located.base, files: await listFiles(base), file, content,
    ...(readOnly ? { readOnly } : {}), invocation: located.invocation, ...(located.source ? { source: located.source } : {}), updates: located.updates,
  };
}

async function snapshot(folder: string): Promise<Map<string, string | null>> {
  const files = new Map<string, string | null>();
  for (const path of MANAGED) files.set(path, await optional(join(folder, path)));
  return files;
}

async function restore(folder: string, files: Map<string, string | null>): Promise<void> {
  for (const [path, text] of files) {
    if (text === null) await rm(join(folder, path), { force: true });
    else await writeFile(join(folder, path), text);
  }
}

/** Saves one file of a stored skill, reapplies its invocation choice and, for a library skill, commits it as "Edit <name>". */
export async function saveSkillEdit(store: SettingsStore, settings: Settings, edit: SkillEdit): Promise<{ file: string }> {
  if (typeof edit.content !== "string" || edit.content.includes("\0") || Buffer.byteLength(edit.content) > MAX_BYTES) throw new Error("Only plain text up to 500 KB can be saved here.");
  if (edit.updates !== undefined && edit.updates !== "keep" && edit.updates !== "replace") throw new Error("Choose keep my version or let updates replace my edits.");
  const located = await locate(store, settings, edit.name);
  if (located.readOnly) throw new Error(located.readOnly);
  const folder = await realpath(located.base);
  const target = await fileInside(folder, edit.file);
  if ((await textOf(target)).content === null) throw new Error("Only plain text files can be saved here.");
  if (edit.file === "SKILL.md") checkFrontmatter(edit.content);

  const library = new SkillLibrary(store).library;
  let decided = located.updates === "replace" || located.updates === "stopped" ? located.updates : undefined;
  if (located.updates !== "none") {
    if (edit.updates) decided = edit.updates === "keep" ? "stopped" : "replace";
    else if (!decided) throw new Error("This skill updates from its repository. Choose whether to keep your version or let updates replace your edits.");
  }

  const write = async (): Promise<void> => {
    const before = await snapshot(folder);
    const original = await readFile(target, "utf8");
    try {
      await writeFile(target, edit.content);
      if (located.invocation && (edit.file === "SKILL.md" || edit.file === "agents/openai.yaml")) await writeInvocationChoice(folder, located.invocation);
      if (located.storage === "library" && decided && decided !== (await library.record(edit.name))?.updates) {
        const record = await library.record(edit.name);
        await library.writeRecord(edit.name, { ...record, invocation: record?.invocation ?? "", updates: decided });
      }
    } catch (error) {
      await writeFile(target, original);
      await restore(folder, before);
      throw error;
    }
  };
  if (located.storage === "library") await library.change(`Edit ${edit.name}`, write);
  else await write();
  return { file: edit.file };
}
