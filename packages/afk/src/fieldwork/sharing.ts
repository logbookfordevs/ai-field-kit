import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readlink, realpath, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { SkillLibrary } from "./skills.js";
import { type Settings, type SettingsStore } from "./settings.js";

export async function sharingState(store: SettingsStore, settings: Settings, scope: string) {
  const source = new SkillLibrary(store).root(settings, scope);
  const destination = join(source, "../../.claude/skills");
  try {
    const info = await lstat(destination);
    const snapshot = `${info.ino}:${info.mtimeMs}`;
    if (info.isSymbolicLink()) {
      const target = resolve(dirname(destination), await readlink(destination));
      let connected = target === source;
      if (!connected) {
        try { connected = await realpath(destination) === await realpath(source); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      }
      return { scope, source, destination, status: connected ? "connected" : "conflict", snapshot, target, reason: connected ? "" : "Claude’s skills folder links somewhere else. AFK will preserve that link." };
    }
    if (info.isDirectory()) {
      const names = await readdir(destination);
      return { scope, source, destination, status: names.length ? "conflict" : "empty", snapshot, reason: names.length ? "Claude’s skills folder already contains files. Move or merge them yourself before sharing; AFK will not overwrite them." : "" };
    }
    return { scope, source, destination, status: "conflict", snapshot, reason: "A file occupies Claude’s skills folder path. AFK will preserve it." };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { scope, source, destination, status: "missing", snapshot: "missing", reason: "" };
  }
}

export async function setSharing(store: SettingsStore, settings: Settings, scope: string, enabled: boolean, expected: unknown): Promise<void> {
  const state = await sharingState(store, settings, scope);
  if (JSON.stringify(state) !== JSON.stringify(expected)) throw new Error("The folder changed since review. Open Claude sharing again.");
  if (state.status === "conflict") throw new Error(state.reason);
  if (enabled && state.status === "connected" || !enabled && state.status !== "connected") return;
  const backup = join(dirname(state.destination), `.afk-sharing-${randomUUID()}`);
  if (!enabled) {
    await rename(state.destination, backup);
    await rm(backup);
    return;
  }
  await mkdir(state.source, { recursive: true });
  await mkdir(dirname(state.destination), { recursive: true });
  const replacesEmpty = state.status === "empty";
  if (replacesEmpty) await rename(state.destination, backup);
  try {
    if (replacesEmpty && (await readdir(backup)).length) throw new Error("Claude’s folder gained files since review. Nothing was replaced.");
    await symlink(state.source, state.destination, "dir");
  }
  catch (error) { if (replacesEmpty) await rename(backup, state.destination); throw error; }
  if (replacesEmpty) await rm(backup, { recursive: true });
}
