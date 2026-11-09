import { lstat } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, sep } from "node:path";
import { AGENT_TABLE, type InvocationMechanism } from "./agent-table.js";

export const SHARED_FOLDER = "~/.agents/skills";
export const DEFAULT_ENABLED = ["~/.claude/skills"];

const LIBRARY_FOLDER = "~/.afk/library";

export interface CustomFolder {
  name: string;
  global: string;
  project?: string;
}

/** What the library saves: enabled folders as `~`-relative paths (the shared folder is always on and not listed). */
export interface AgentFolderSettings {
  enabled: string[];
  custom: CustomFolder[];
}

export interface AgentFolder {
  path: string;
  names: string[];
  project?: string;
  icon?: string;
  detected: boolean;
  enabled: boolean;
  shared: boolean;
  custom: boolean;
  /** Agent names in this folder known to follow each invocation mechanism. */
  mechanisms: Partial<Record<InvocationMechanism, string[]>>;
}

export function expandHome(home: string, path: string): string {
  return path === "~" ? home : path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

export function contractHome(home: string, path: string): string {
  const inside = relative(home, path);
  return inside && !inside.startsWith("..") && !isAbsolute(inside) ? `~/${inside.split(sep).join("/")}` : path;
}

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch { return false; }
}

function savedSettings(settings: AgentFolderSettings | undefined): AgentFolderSettings {
  return { enabled: settings?.enabled ?? [...DEFAULT_ENABLED], custom: settings?.custom ?? [] };
}

/** The shared folder first, then folders for agents found on this machine, then the rest of the table and custom folders. */
export async function agentFolderCatalog(home: string, settings: AgentFolderSettings | undefined): Promise<AgentFolder[]> {
  const saved = savedSettings(settings);
  const folders = new Map<string, AgentFolder>();

  for (const entry of AGENT_TABLE) {
    let folder = folders.get(entry.global);
    if (!folder) {
      const shared = entry.global === SHARED_FOLDER;
      folder = { path: entry.global, names: [], project: entry.project, detected: false, enabled: shared || saved.enabled.includes(entry.global), shared, custom: false, mechanisms: {} };
      folders.set(entry.global, folder);
    }
    folder.names.push(entry.name);
    if (!folder.icon && !folder.shared && entry.icon) folder.icon = entry.icon;
    if (entry.invocation) (folder.mechanisms[entry.invocation] ??= []).push(entry.name);
    if (!folder.detected && !folder.shared) folder.detected = (await Promise.all(entry.detect.map(path => present(expandHome(home, path))))).some(Boolean);
  }
  for (const entry of saved.custom) {
    folders.set(entry.global, { path: entry.global, names: [entry.name], ...(entry.project ? { project: entry.project } : {}), detected: false, enabled: saved.enabled.includes(entry.global), shared: false, custom: true, mechanisms: {} });
  }

  const all = [...folders.values()];
  const shared = all.filter(folder => folder.shared);
  const rest = all.filter(folder => !folder.shared);
  return [...shared, ...rest.filter(folder => folder.detected), ...rest.filter(folder => !folder.detected)];
}

/** Agents in enabled folders that follow each invocation mechanism, for the choice's tooltip. */
export function invocationAgents(folders: AgentFolder[]): Record<InvocationMechanism, string[]> {
  const result: Record<InvocationMechanism, string[]> = { claude: [], codex: [] };
  for (const folder of folders.filter(entry => entry.enabled)) {
    for (const mechanism of ["claude", "codex"] as const) result[mechanism].push(...(folder.mechanisms[mechanism] ?? []));
  }
  return result;
}

function cleanProject(project: string | undefined): string | undefined {
  const value = project?.trim();
  if (!value) return undefined;
  if (isAbsolute(value) || value.startsWith("~") || value.split("/").includes("..")) throw new Error("The project path must be relative to a project and cannot contain '..'.");
  return normalize(value).replace(/\/$/, "");
}

/** Checks a folder the user adds and returns it with its path saved `~`-relative. */
export function validateCustomFolder(home: string, input: { name: string; global: string; project?: string }): CustomFolder {
  const name = input.name?.trim();
  if (!name || name.length > 60) throw new Error("Give the folder a name of up to 60 characters.");
  const typed = input.global?.trim() ?? "";
  if (!typed.startsWith("/") && typed !== "~" && !typed.startsWith("~/")) throw new Error("Use an absolute path or one starting with ~/.");
  if (typed.split("/").includes("..")) throw new Error("The path cannot contain '..'.");
  const absolute = normalize(expandHome(home, typed)).replace(/\/$/, "");
  if (!absolute || absolute === normalize(home).replace(/\/$/, "") || absolute === "/") throw new Error("Choose a skills folder, not the home folder.");
  const global = contractHome(home, absolute);
  const library = expandHome(home, LIBRARY_FOLDER);
  if (absolute === library || absolute.startsWith(`${library}/`)) throw new Error("The folder cannot be inside AFK's library.");
  if (global === SHARED_FOLDER) throw new Error("~/.agents/skills is always on.");
  const known = AGENT_TABLE.filter(entry => entry.global === global);
  if (known.length) throw new Error(`${known.map(entry => entry.name).join(", ")} already uses this folder. Switch it on from the list.`);
  const project = cleanProject(input.project);
  return { name, global, ...(project ? { project } : {}) };
}
