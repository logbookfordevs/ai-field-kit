import type { Tool } from "../../../../src/fieldwork/settings.js";

export type ToolEntry = Tool;

/** What AFK remembers about a tool's latest command this session. `output` grows while `pending`. */
export interface ToolRun {
  pending: boolean;
  output: string;
  code?: number;
  reapplied?: string[];
  warnings?: string[];
}

export interface ToolState {
  tools: ToolEntry[];
  runs: Record<number, ToolRun>;
  /** The folder every command runs in. */
  home: string;
}

export interface ToolRunResult {
  output: string;
  code: number;
  reapplied: string[];
  warnings: string[];
}

declare module "@/api/operations" {
  interface OperationResults {
    "tool/state": ToolState;
    "tool/run": ToolRunResult;
  }
}

export type RunKind = "install" | "update";

/** The command a run executes: Update falls back to Install when no update command is saved. */
export function commandFor(tool: ToolEntry, kind: RunKind): string {
  return kind === "update" && tool.update ? tool.update : tool.install;
}

export const pollEvery = 600;
