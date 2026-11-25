import type { FavoriteSource, Profile, ProfileGroup } from "../../../../src/fieldwork/settings.js";
import type { SkillEntry } from "../../../../src/fieldwork/skills.js";
import type { InstallProgress } from "../../../../src/fieldwork/skill-install.js";

export type { FavoriteSource, Profile, ProfileGroup, SkillEntry, InstallProgress };

/** The parts of the `state` read that Packs uses. */
export interface PackState {
  settings: { profiles: Profile[]; favoriteSources?: FavoriteSource[] };
  inventories: Record<string, SkillEntry[]>;
}

export interface PackManifest {
  version: number;
  id: string;
  name: string;
  description?: string;
  sources: { name: string; source: string; skills: string[] }[];
}

export interface ImportProposal {
  pack: Profile;
  expected: Profile | null;
}

declare module "@/api/operations" {
  interface OperationResults {
    "pack/manifest": { manifest: PackManifest };
    "pack/import-preview": ImportProposal;
    discover: { names: string[]; descriptions?: Record<string, string> };
  }
}
