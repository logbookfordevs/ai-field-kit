import type { PathLike } from "node:fs";

export type AgentId =
  | "antigravity"
  | "claude"
  | "codex"
  | "cursor-local"
  | "opencode";

export type SkillAgentId = "claude-code" | "kiro-cli" | "kilo" | "pi" | "droid";

export type Area = "rules" | "skills" | "mcps" | "utils" | "hooks";
export type SetupScope = "global" | "project";
export type SkillsListScope = "global" | "project" | "all";
export type SkillsUpgradeScope = "global" | "project" | "all";
export type ManagedSkillAgent =
  | "codex"
  | "claude"
  | "gemini"
  | "antigravity"
  | "opencode"
  | "cursor"
  | "amp"
  | "goose"
  | "warp"
  | "zed"
  | "roo-code"
  | "aider"
  | "continue"
  | "kiro"
  | "jules"
  | "openhands";
export type SkillCategorizationMode = "append-missing" | "recategorize-all";
export type SkillCategorizationRunner = "codex-exec";
export type SkillOpenApp = "finder" | "code" | "cursor" | "zed" | "agy";
export type SkillAgentMetadata = "codex";
export type ManifestCategory = "rules" | "skills" | "mcps" | "utils" | "hooks" | "presets";

export type CliOptions = {
  agents: AgentId[];
  setupScope: SetupScope;
  scopeExplicit: boolean;
  dryRun: boolean;
  yes: boolean;
  includeExternal: boolean;
  selectedSkillIds: string[];
  selectedSkillAgentIds: SkillAgentId[];
  selectedMcpIds: string[];
  selectedUtilIds: string[];
  selectedHookIds: string[];
  rulesRef: string;
  rulesSource: "manifest" | "github" | "local";
  initOnly: boolean;
  empty: boolean;
  refreshDefaults: boolean;
  defaultsSource: string;
  manifestLocal: boolean;
  manifestConfigureLocal: boolean;
  manifestConfigureFromCurrent: boolean;
  skillsListScope?: SkillsListScope;
  skillsUpgradeAll?: boolean;
  skillsUpgradeScope?: SkillsUpgradeScope;
  skillsTrashManifestOnly?: boolean;
  skillsAgent?: ManagedSkillAgent | undefined;
  skillsJson?: boolean;
  skillsCategory?: string;
  skillsTag?: string;
  skillsPlatform?: string;
  skillsUncategorized?: boolean;
  skillOpenApp?: SkillOpenApp;
  skillOpenTarget?: "file" | "folder";
  skillAgentMetadata?: SkillAgentMetadata | undefined;
  skillCategorizationMode?: SkillCategorizationMode | undefined;
  skillCategorizationRunner?: SkillCategorizationRunner;
  skillCategorizationInstruction?: string;
  selectedManifestCategories: ManifestCategory[];
  homeDir: string;
  repoDir: string;
  cwd: string;
};

export type CommandResult = {
  code: number;
};

export type Io = {
  stdout: (message: string) => void;
  stderr: (message: string) => void;
};

export type Runtime = {
  io: Io;
  spawn: (command: string, args: string[], cwd?: string) => Promise<CommandResult>;
};

export type PathOperation =
  | {
      type: "mkdir";
      path: string;
    }
  | {
      type: "remove";
      path: string;
    }
  | {
      type: "symlink";
      source: string;
      target: string;
    }
  | {
      type: "copy";
      source: string;
      target: string;
    }
  | {
      type: "write";
      path: string;
      content: string;
    }
  | {
      type: "backup";
      source: string;
      target: string;
    }
  | {
      type: "skip";
      path: string;
      reason: string;
    };

export type FileSystem = {
  exists: (path: PathLike) => boolean;
  isFile: (path: PathLike) => boolean;
  isDirectory: (path: PathLike) => boolean;
  isSymlink: (path: PathLike) => boolean;
};
