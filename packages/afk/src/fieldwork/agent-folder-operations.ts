import { agentFolderCatalog, invocationAgents, SHARED_FOLDER, validateCustomFolder, type AgentFolder, type AgentFolderSettings } from "./agent-folders.js";
import type { InvocationMechanism } from "./agent-table.js";
import { Library } from "./library.js";
import type { SettingsStore } from "./settings.js";
import { ToolSkills } from "./tool-skills.js";

export interface AgentFolderState {
  library: boolean;
  folders: AgentFolder[];
  invocationAgents: Record<InvocationMechanism, string[]>;
}

export type AgentFolderAction = "enable" | "disable" | "add" | "remove";

export async function agentFolderState(home: string): Promise<AgentFolderState> {
  const library = new Library(home);
  const exists = await library.exists();
  const folders = await agentFolderCatalog(home, exists ? await library.agentFolders() : undefined);
  return { library: exists, folders, invocationAgents: invocationAgents(folders) };
}

/** Switches a folder, adds or removes a custom one, and links or unlinks every skill that is on there, tool skills included. */
export async function changeAgentFolders(store: SettingsStore, action: AgentFolderAction, data: Record<string, unknown>): Promise<AgentFolderState> {
  const home = store.home, library = new Library(home);
  if (!await library.exists()) throw new Error("Start a library first with `afk library init`.");
  const saved = await library.agentFolders();
  const catalog = await agentFolderCatalog(home, saved);
  const find = (path: unknown): AgentFolder => {
    const folder = catalog.find(entry => entry.path === path);
    if (!folder) throw new Error("Unknown agent folder. Pick one from the list or add it as a custom folder.");
    return folder;
  };
  const next: AgentFolderSettings = { enabled: [...saved.enabled], custom: [...saved.custom] };
  let message: string;

  if (action === "add") {
    const folder = validateCustomFolder(home, { name: String(data.name ?? ""), global: String(data.global ?? ""), ...(typeof data.project === "string" ? { project: data.project } : {}) });
    if (catalog.some(entry => entry.path === folder.global)) throw new Error("This folder is already in the list.");
    next.custom.push(folder);
    next.enabled.push(folder.global);
    message = `Add the ${folder.name} folder and link skills into it`;
  } else {
    const folder = find(data.path);
    const label = folder.names.join(", ");
    if (action === "remove") {
      if (!folder.custom) throw new Error("Only custom folders can be removed. Switch a known agent off instead.");
      next.custom = next.custom.filter(entry => entry.global !== folder.path);
      next.enabled = next.enabled.filter(path => path !== folder.path);
      message = `Remove the ${label} folder`;
    } else {
      if (folder.path === SHARED_FOLDER) throw new Error("~/.agents/skills is always on.");
      next.enabled = next.enabled.filter(path => path !== folder.path);
      if (action === "enable") next.enabled.push(folder.path);
      message = action === "enable" ? `Link skills into ${label}` : `Stop linking skills into ${label}`;
    }
  }

  const before = await library.folders();
  await library.changeAgentFolders(message, next);
  const after = await library.folders();
  const tools = new ToolSkills(store), provided = (await store.read()).tools.flatMap(tool => tool.provides ?? []);
  for (const folder of before.filter(folder => !after.includes(folder))) for (const name of provided) await tools.unlinkFrom(folder, name);
  for (const name of provided) await tools.link(name);
  return agentFolderState(home);
}
