import { setInvocation } from "./invocation.js";
import { SkillLibrary, type DuplicateKeep } from "./skills.js";
import type { Settings, SettingsStore } from "./settings.js";

export async function resolveDuplicate(store: SettingsStore, settings: Settings, name: string, scope: string, keep: DuplicateKeep): Promise<void> {
  const skills = new SkillLibrary(store);
  const resolve = async (): Promise<void> => {
    await skills.consolidate(settings, name, scope, keep);
    const mode = settings.preferences[`${scope}|${name}`];
    if (keep === "installed" && mode) await setInvocation(store, settings, name, scope, mode);
  };
  if (keep === "installed" && scope === "Global" && await skills.library.has(name)) await skills.library.change(`Reinstall ${name}`, resolve);
  else await resolve();
}

// A fresh installation wins over a stored copy of the same skill; duplicates that predate it wait for the user.
export async function adoptInstalled(store: SettingsStore, scope: string, before: Set<string>, requested: string[]): Promise<string[]> {
  const settings = await store.read();
  if (scope !== "Global" && !settings.projects.some(project => project.name === scope)) return [];
  const adopted: string[] = [];
  for (const copy of await new SkillLibrary(store).duplicates(settings, scope)) {
    if (before.has(copy.name) && !requested.includes(copy.name)) continue;
    await resolveDuplicate(store, settings, copy.name, scope, "installed");
    adopted.push(copy.name);
  }
  return adopted;
}
