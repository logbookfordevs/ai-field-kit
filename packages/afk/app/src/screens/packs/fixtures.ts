import type { PackState, Profile, SkillEntry } from "@/screens/packs/types";

export function skillEntry(name: string, extra: Partial<SkillEntry> = {}): SkillEntry {
  return {
    name, path: `/home/.afk/library/${name}`, owners: [], stored: true, independent: false, available: false, shared: false,
    description: `${name} description.`, invocation: "auto", defaultInvocation: "auto", invocationInherited: true, ...extra,
  } as SkillEntry;
}

export function pack(id: string, name: string, skills: string[], extra: Partial<Profile> = {}): Profile {
  return { id, name, source: "acme/skills", skills, enabled: [], ready: true, ...extra };
}

export function packState(profiles: Profile[], inventory: SkillEntry[]): PackState {
  return { settings: { profiles }, inventories: { Global: inventory } };
}
