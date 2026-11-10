import type { SkillEntry } from "../../../../src/fieldwork/skills.js";
import type { Profile, Tool, FavoriteSource } from "../../../../src/fieldwork/settings.js";

declare module "@/api/operations" {
  interface OperationResults {
    state: {
      settings: { profiles: Profile[]; tools: Tool[]; favoriteSources: FavoriteSource[] };
      inventories: Record<string, SkillEntry[]>;
    };
  }
}
