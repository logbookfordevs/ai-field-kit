import type { PackState, Profile, ProfileGroup, SkillEntry } from "@/screens/packs/types";

const LOCAL_SOURCE = "Local skill selection";
const UPLOADED_SOURCE = "Uploaded skill";

export const GLOBAL = "Global";

export interface Member {
  name: string;
  /** Where the skill comes from, in words. */
  origin: string;
  /** Downloaded to this machine. */
  here: boolean;
}

export interface PackView {
  profile: Profile;
  members: Member[];
  hereCount: number;
  awayCount: number;
  /** Scopes the pack is on in; Global is the one the switch controls. */
  scopes: string[];
  on: boolean;
  /** Why the manifest can't be exported, or null when it can. */
  exportBlock: string | null;
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function groupsOf(profile: Pick<Profile, "source" | "skills" | "groups">): ProfileGroup[] {
  return profile.groups ?? [{ source: profile.source, skills: profile.skills }];
}

function repositoryName(reference: string): string {
  return reference.replace(/#.*$/, "").replace(/\.git$/, "").replace(/\/+$/, "").split(/[/:]/).filter(Boolean).pop() ?? reference;
}

export function originLabel(profile: Pick<Profile, "sourceNames">, source: string): string {
  if (source === LOCAL_SOURCE) return "This machine";
  if (source === UPLOADED_SOURCE) return "Uploaded";
  return profile.sourceNames?.[source] ?? repositoryName(source);
}

function exportBlock(profile: Profile): string | null {
  const sources = groupsOf(profile).map(group => group.source);
  if (sources.includes(UPLOADED_SOURCE)) return "It includes uploaded skills, which have no repository to publish.";
  if (sources.includes(LOCAL_SOURCE)) return "It uses skills from this machine, which have no repository to publish.";
  return null;
}

export function viewPack(profile: Profile, inventory: readonly SkillEntry[]): PackView {
  const installed = new Set(inventory.map(entry => entry.name));
  const members = groupsOf(profile).flatMap(group =>
    group.skills.map(name => ({ name, origin: originLabel(profile, group.source), here: installed.has(name) })),
  );
  const hereCount = members.filter(member => member.here).length;
  return {
    profile, members, hereCount, awayCount: members.length - hereCount,
    scopes: profile.enabled, on: profile.enabled.includes(GLOBAL), exportBlock: exportBlock(profile),
  };
}

export function viewPacks(state: PackState): PackView[] {
  const inventory = state.inventories[GLOBAL] ?? [];
  return state.settings.profiles.map(profile => viewPack(profile, inventory));
}

export interface Candidate {
  name: string;
  description: string;
  source: string;
  here: boolean;
}

/** Skills a pack can hold: everything on this machine except tool-written skills, plus members it already has that are not downloaded. */
export function candidatesFor(inventory: readonly SkillEntry[], members: readonly Member[]): Candidate[] {
  const byName = new Map<string, Candidate>();
  for (const entry of inventory) {
    if (entry.tool) continue;
    byName.set(entry.name, { name: entry.name, description: entry.description, source: entry.source ?? LOCAL_SOURCE, here: true });
  }
  for (const member of members) {
    if (!byName.has(member.name)) byName.set(member.name, { name: member.name, description: "", source: "", here: false });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Groups for pack/save: kept members stay in their saved source, newly chosen skills go with the source they were installed from. */
export function groupsFor(existing: Profile | null, selected: ReadonlySet<string>, candidates: readonly Candidate[]): ProfileGroup[] {
  const saved = existing ? groupsOf(existing) : [];
  const groups = saved.map(group => ({ source: group.source, skills: group.skills.filter(name => selected.has(name)) }));
  const placed = new Set(groups.flatMap(group => group.skills));
  for (const candidate of candidates) {
    if (!selected.has(candidate.name) || placed.has(candidate.name)) continue;
    const group = groups.find(item => item.source === candidate.source);
    if (group) group.skills.push(candidate.name);
    else groups.push({ source: candidate.source, skills: [candidate.name] });
  }
  return groups.filter(group => group.skills.length);
}
