import type { InstallCandidate, KitStatus } from "../../../../src/fieldwork/kit.js";
import type { InstallProgress } from "../../../../src/fieldwork/skill-install.js";
import type { FavoriteSource, Profile } from "../../../../src/fieldwork/settings.js";

export type { FavoriteSource, InstallCandidate, InstallProgress, KitStatus };

export type Destination = "core" | "pack" | "machine" | "later";

/** What the Sources screen and the install dialog read from the `state` operation. */
export interface SourcesState {
  /** The full settings object, so a bookmark change can be saved back whole. */
  settings: {
    favoriteSources: FavoriteSource[];
    profiles: Pick<Profile, "id" | "name">[];
    projects: { name: string; path: string }[];
    [key: string]: unknown;
  };
  kit: KitStatus;
}

export interface UploadCandidate extends InstallCandidate {
  files: number;
  bytes: number;
}

export interface UploadPreview {
  upload: string;
  candidates: UploadCandidate[];
}

export interface InstallOutcome {
  ok: boolean;
  to: string;
  install?: InstallProgress;
}

export interface UpdateResult {
  pending: boolean;
  cancelled?: boolean;
  phase: string;
  code?: number;
  updated?: number;
  lastLine?: string;
}
