import type { KitStatus } from "../../../../src/fieldwork/kit.js";
import type { Settings } from "../../../../src/fieldwork/settings.js";
import type { NestedSkillEntry, SkillEntry } from "../../../../src/fieldwork/skills.js";
import type { SkillEditorView } from "../../../../src/fieldwork/skill-editor.js";
import type { previewDeletion } from "../../../../src/fieldwork/deletion.js";
import { useOperation, type Read } from "@/api/hooks";

export type { NestedSkillEntry, SkillEntry, SkillEditorView };

export interface AppState {
  settings: Settings;
  kit: KitStatus;
  inventories: Record<string, SkillEntry[]>;
  nestedInventories: Record<string, NestedSkillEntry[]>;
  skillSharing: Record<string, SharingState>;
  projectStatuses: Record<string, string>;
}

export interface SharingState {
  scope: string;
  /** connected, missing or conflict. */
  status: string;
  source: string;
  destination: string;
  reason?: string;
}

export type DeletionPreview = Awaited<ReturnType<typeof previewDeletion>>;

export interface BulkDeletionReview {
  names: string[];
  scope: string;
  items: { name: string; preview?: DeletionPreview; error?: string }[];
}

export interface BulkResult {
  items: { name: string; ok: boolean; error?: string }[];
  completed: number;
  failed: number;
}

export interface SkillFile {
  path: string;
  files: string[];
  file: string;
  content: string;
}

export type InvocationMode = "Manual only" | "Automatic allowed";

declare module "@/api/operations" {
  interface OperationResults {
    "skill/editor": SkillEditorView;
    "skill/edit": unknown;
    "skill/read": SkillFile;
    "skill/delete-preview": DeletionPreview;
    "skills/delete-preview": BulkDeletionReview;
    "skills/bulk": BulkResult;
    "skills-sharing/state": SharingState;
  }
}

/**
 * The `state` operation as Skills reads it. Other screens type the same operation
 * for what they need, so each keeps its own view instead of sharing one declaration.
 */
export function useSkillsState(): Read<AppState> {
  return useOperation("state") as unknown as Read<AppState>;
}
