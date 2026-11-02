import { stat } from "node:fs/promises";
import { expandPath, type Settings, type SettingsStore } from "./settings.js";

export async function projectStatus(store: SettingsStore, settings: Settings): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(settings.projects.map(async project => {
    try { return [project.name, (await stat(expandPath(project.path, store.home))).isDirectory() ? "present" : "not-folder"] as const; }
    catch (error) { return [project.name, ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "") ? "missing" : "unreadable"] as const; }
  })));
}
