import type { AgentFolderState } from "../../../../src/fieldwork/agent-folder-operations.js";

declare module "@/api/operations" {
  interface OperationResults {
    "agent-folders/state": AgentFolderState;
    "agent-folders/enable": AgentFolderState;
    "agent-folders/disable": AgentFolderState;
    "agent-folders/add": AgentFolderState;
    "agent-folders/remove": AgentFolderState;
    folders: FolderListing;
  }
}

export interface FolderListing {
  path: string;
  parent: string;
  folders: string[];
  files: string[];
  settings: boolean;
}

export type ProjectStatus = "present" | "missing" | "not-folder" | "unreadable";

/** The parts of the `state` read that Settings uses. */
export interface SettingsSnapshot {
  home: string;
  settings: { projects: { name: string; path: string }[]; preferences: Record<string, string> };
  projectStatuses: Record<string, ProjectStatus>;
}
