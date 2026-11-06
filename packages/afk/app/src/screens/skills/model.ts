import type { AppState, InvocationMode, SkillEntry } from "@/screens/skills/api";
import { isRepositorySource } from "@/text/format";

export const skillsDescription = "Turn skills on or off and choose how they start. New skills come in from Sources.";

export type Place = "core" | "machine" | "review" | "pack" | "tool" | "project";

export interface Skill {
  name: string;
  description: string;
  place: Place;
  /** Pack or tool name for those places. */
  owner?: string;
  ownerId?: string | number;
  source?: string;
  /** Absent for Core skills that are not on this machine yet. */
  entry?: SkillEntry;
  on: boolean;
  /** The saved choice, else what the files say when both agents agree. */
  mode: InvocationMode | null;
  /** Saved choice that the files no longer follow. */
  drift?: InvocationMode;
  installable: boolean;
  /** Subfolder of a nested skill another app manages; read-only. */
  folder?: string;
  /** Marked "keep on this machine", so the kit stops asking about it. */
  keptHere?: boolean;
}

export type StateFilter = "all" | "on" | "off" | "manual" | "auto";

export interface Filters {
  query: string;
  from: string;
  state: StateFilter;
}

export const noFilters: Filters = { query: "", from: "all", state: "all" };

const placeLabels: Record<Exclude<Place, "pack" | "tool">, string> = { core: "Core", machine: "This machine", review: "To review", project: "This project" };

function savedMode(state: AppState, scope: string, name: string): InvocationMode | undefined {
  const saved = state.settings.preferences[`${scope}|${name}`];
  return saved === "Manual only" || saved === "Automatic allowed" ? saved : undefined;
}

export function modeOf(state: AppState, scope: string, entry: SkillEntry): Pick<Skill, "mode" | "drift"> {
  const saved = savedMode(state, scope, entry.name);
  const { claude, codex } = entry.invocation;
  const known = [claude, codex].filter(mode => mode !== "Unknown");
  const drift = saved && known.some(mode => mode !== saved) ? { drift: saved } : {};
  if (saved) return { mode: saved, ...drift };
  const agreed = claude === codex && (claude === "Manual only" || claude === "Automatic allowed") ? claude : null;
  return { mode: agreed };
}

/** Every Global skill once, placed by what the kit says about it rather than by stored lists that can go stale. */
export function globalSkills(state: AppState): Skill[] {
  const inventory = state.inventories.Global ?? [];
  const core = new Map(state.kit.core.map(item => [item.name, item]));
  const review = new Map(state.kit.undecided.map(item => [item.name, item]));
  const skills: Skill[] = inventory.map(entry => {
    const tool = state.settings.tools.find(item => item.provides?.includes(entry.name));
    const pack = state.settings.profiles.find(profile => profile.skills.includes(entry.name));
    const base = { name: entry.name, description: entry.description, entry, on: entry.available, ...modeOf(state, "Global", entry), ...(entry.source ? { source: entry.source } : {}) };
    if (tool) return { ...base, place: "tool", owner: tool.name, ownerId: tool.id, installable: false };
    if (core.has(entry.name) || entry.storage === "library") return { ...base, place: "core", installable: isRepositorySource(entry.source) };
    if (pack) return { ...base, place: "pack", owner: pack.name, ownerId: pack.id, installable: isRepositorySource(entry.source) };
    if (review.has(entry.name)) return { ...base, place: "review", installable: review.get(entry.name)?.installable ?? false };
    return { ...base, place: "machine", installable: isRepositorySource(entry.source), keptHere: state.settings.machineOnly.includes(entry.name) };
  });
  for (const item of state.kit.core) {
    if (item.status !== "missing") continue;
    skills.push({ name: item.name, description: "", place: "core", source: item.source, on: false, mode: null, installable: isRepositorySource(item.source) });
  }
  return skills.sort((a, b) => Number(b.place === "review") - Number(a.place === "review") || a.name.localeCompare(b.name));
}

/** A project's own skills, then the read-only ones other apps keep in its subfolders. */
export function projectSkills(state: AppState, scope: string): { own: Skill[]; nested: Skill[] } {
  const own = (state.inventories[scope] ?? []).map(entry => ({
    name: entry.name, description: entry.description, place: "project" as const, entry, on: entry.available,
    ...modeOf(state, scope, entry), ...(entry.source ? { source: entry.source } : {}), installable: isRepositorySource(entry.source),
  }));
  const nested = (state.nestedInventories[scope] ?? []).map(item => {
    const agreed = item.invocation.claude === item.invocation.codex && item.invocation.claude !== "Unknown" ? item.invocation.claude : null;
    return { name: item.name, description: item.description, place: "project" as const, folder: item.folder, on: true, mode: agreed, installable: false };
  });
  return { own: own.sort((a, b) => a.name.localeCompare(b.name)), nested };
}

export function fromKey(skill: Skill): string {
  return skill.owner ? `${skill.place}:${skill.owner}` : skill.place;
}

export function fromLabel(skill: Skill): string {
  return skill.owner ? `${skill.place === "pack" ? "Pack" : "Tool"} · ${skill.owner}` : placeLabels[skill.place as keyof typeof placeLabels];
}

function keyLabel(key: string): string {
  const [place, owner] = key.split(/:(.*)/s);
  if (owner) return `${place === "pack" ? "Pack" : "Tool"} · ${owner}`;
  return placeLabels[key as keyof typeof placeLabels];
}

export function fromOptions(skills: Skill[]): { value: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const skill of skills) counts.set(fromKey(skill), (counts.get(fromKey(skill)) ?? 0) + 1);
  const order = ["core", "machine", "review"];
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : key.startsWith("pack:") ? 3 : 4);
  const keys = [...counts.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return [{ value: "all", label: `Anywhere (${skills.length})` }, ...keys.map(key => ({ value: key, label: `${keyLabel(key)} (${counts.get(key)})` }))];
}

export function isFiltered(filters: Filters): boolean {
  return Boolean(filters.query.trim()) || filters.from !== "all" || filters.state !== "all";
}

export function filterSkills(skills: Skill[], filters: Filters): Skill[] {
  const needle = filters.query.trim().toLowerCase();
  return skills.filter(skill => {
    if (filters.from !== "all" && fromKey(skill) !== filters.from) return false;
    if (filters.state === "on" && !skill.on) return false;
    if (filters.state === "off" && skill.on) return false;
    if (filters.state === "manual" && skill.mode !== "Manual only") return false;
    if (filters.state === "auto" && skill.mode !== "Automatic allowed") return false;
    return !needle || skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle);
  });
}

/** Read by the navigation on every screen, so it tolerates a partial state. */
export function reviewCount(state: Partial<AppState>): number {
  return state.kit?.undecided.length ?? 0;
}
