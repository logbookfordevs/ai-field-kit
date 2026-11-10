import { sourceIdentity } from "./migration.js";
import { UPLOADED_SOURCE, type KitSource, type Settings } from "./settings.js";
import type { SkillEntry } from "./skills.js";

export interface KitStatus {
  core: { name: string; source: string; sourceName?: string; follow: boolean; status: "on" | "off" | "missing" }[];
  sources: { source: string; name?: string; follow: boolean; skills: number }[];
  tools: { id: number; name: string; provides: string[]; missing: string[] }[];
  undecided: { name: string; source?: string; description: string; installable: boolean }[];
  machineOnly: string[];
}

export interface InstallCandidate {
  name: string;
  description: string;
  state: "new" | "installed" | "conflict" | "tool";
  path?: string;
  tool?: string;
  installedFrom?: string;
  /** Where it already belongs; installing leaves it there. */
  inKit?: string;
}

/** Where a skill already belongs in the kit: "Core", a pack's name, or "This machine". */
export function placeOf(settings: Settings, name: string): string | undefined {
  if (settings.kit?.core.some(item => item.skills.includes(name))) return "Core";
  const pack = settings.profiles.find(profile => profile.skills.includes(name));
  if (pack) return pack.name;
  return settings.machineOnly.includes(name) ? "This machine" : undefined;
}

export function isRepositorySource(source: string | undefined): source is string {
  return Boolean(source) && source !== UPLOADED_SOURCE && !source!.startsWith("/") && !source!.startsWith("~") && !source!.startsWith(".") && !source!.startsWith("file:");
}

export function toolOwner(settings: Pick<Settings, "tools">, name: string): Settings["tools"][number] | undefined {
  return settings.tools.find(tool => tool.provides?.includes(name));
}

/** Pure comparison of the portable kit against one machine's Global inventory. */
export function kitStatus(settings: Settings, inventory: SkillEntry[]): KitStatus {
  const installed = new Map(inventory.map(entry => [entry.name, entry]));
  const core: KitStatus["core"] = [];
  const entries = settings.kit?.core ?? [];

  for (const entry of entries) {
    for (const name of entry.skills) {
      if (toolOwner(settings, name)) continue;
      const found = installed.get(name);
      const status = !found ? "missing" : found.available ? "on" : "off";
      core.push({ name, source: entry.source, ...(entry.name ? { sourceName: entry.name } : {}), follow: Boolean(entry.follow), status });
    }
  }
  core.sort((a, b) => a.name.localeCompare(b.name));

  const tools: KitStatus["tools"] = settings.tools.filter(tool => tool.provides?.length).map(tool => ({
    id: tool.id, name: tool.name, provides: tool.provides!, missing: tool.provides!.filter(name => !installed.has(name)),
  }));

  const inKit = new Set([...entries.flatMap(entry => entry.skills), ...settings.profiles.flatMap(profile => profile.skills), ...settings.tools.flatMap(tool => tool.provides ?? [])]);
  const machineOnly = new Set(settings.machineOnly ?? []);
  const undecided = inventory.filter(entry => entry.available && !inKit.has(entry.name) && !machineOnly.has(entry.name)).map(entry => ({
    name: entry.name, ...(entry.source ? { source: entry.source } : {}), description: entry.description, installable: isRepositorySource(entry.source),
  }));

  return {
    core,
    sources: entries.map(entry => ({ source: entry.source, ...(entry.name ? { name: entry.name } : {}), follow: Boolean(entry.follow), skills: entry.skills.length })),
    tools,
    undecided,
    machineOnly: [...machineOnly],
  };
}

export function coreEntry(settings: Settings, source: string): KitSource | undefined {
  return settings.kit?.core.find(entry => sourceIdentity(entry.source) === sourceIdentity(source));
}

export function addToCore(settings: Settings, name: string, source: string): void {
  settings.kit ??= { core: [] };
  settings.machineOnly = settings.machineOnly.filter(member => member !== name);
  const other = settings.kit.core.find(entry => entry.skills.includes(name));
  if (other) {
    if (sourceIdentity(other.source) === sourceIdentity(source)) return;
    other.skills = other.skills.filter(member => member !== name);
    if (!other.skills.length && !other.follow) settings.kit.core = settings.kit.core.filter(entry => entry !== other);
  }
  const entry = coreEntry(settings, source);
  if (entry) entry.skills.push(name);
  else settings.kit.core.push({ source, skills: [name] });
}

export function dropFromCore(settings: Settings, name: string): boolean {
  if (!settings.kit) return false;
  const entry = settings.kit.core.find(item => item.skills.includes(name));
  if (!entry) return false;
  entry.skills = entry.skills.filter(member => member !== name);
  if (!entry.skills.length && !entry.follow) settings.kit.core = settings.kit.core.filter(item => item !== entry);
  return true;
}
