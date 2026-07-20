import { isAbsolute, join } from "node:path";
import { agentIds, hookAgentIds, skillAgentChoices, skillAgentIds } from "./agents.js";
import { pathExists, readText } from "./fs-utils.js";
import { localAfkDir } from "./manifest.js";
import type { AgentId, SetupScope, SkillAgentId } from "./types.js";

export type TargetSelectionSource = "explicit" | "detected" | "manual" | "none";

export type DetectedSetupTargets = {
  agents: AgentId[];
  hookAgents: AgentId[];
  skillAgents: SkillAgentId[];
};

type DetectSetupTargetsOptions = {
  homeDir: string;
  cwd: string;
  setupScope: SetupScope;
};

type SetupTargetsConfig = {
  version: number;
  customAgentPaths: Partial<Record<AgentId | SkillAgentId, string[]>>;
};

const globalAgentEvidence: Record<AgentId, string[]> = {
  antigravity: [".gemini/GEMINI.md", ".gemini"],
  claude: [".claude/CLAUDE.md", ".claude/settings.json", ".claude"],
  codex: [".codex/AGENTS.md", ".codex/config.toml", ".codex"],
  "cursor-local": [],
  opencode: [".config/opencode/opencode.json", ".config/opencode/AGENTS.md", ".config/opencode"],
  pi: [".pi/AGENTS.md", ".pi/agents", ".pi", ".pi/agent/AGENTS.md", ".pi/agent"],
};

const projectAgentEvidence: Record<AgentId, string[]> = {
  antigravity: ["GEMINI.md", ".gemini/GEMINI.md", ".gemini"],
  claude: ["CLAUDE.md", ".claude/settings.json", ".claude"],
  codex: ["AGENTS.md", ".codex/AGENTS.md", ".codex/config.toml", ".codex"],
  "cursor-local": [],
  opencode: ["AGENTS.md", ".config/opencode/opencode.json", ".config/opencode/AGENTS.md", ".config/opencode"],
  pi: [".pi/AGENTS.md", ".pi/agents", ".pi", ".pi/agent/AGENTS.md", ".pi/agent"],
};

const globalHookEvidence: Record<AgentId, string[]> = {
  antigravity: [],
  claude: [".claude/settings.json", ".claude"],
  codex: [".codex/hooks.json", ".codex/config.toml", ".codex"],
  "cursor-local": [".cursor/hooks.json", ".cursor"],
  opencode: [],
  pi: [],
};

const projectHookEvidence: Record<AgentId, string[]> = {
  antigravity: [],
  claude: [".claude/settings.json", ".claude"],
  codex: [".codex/hooks.json", ".codex/config.toml", ".codex"],
  "cursor-local": [".cursor/hooks.json", ".cursor"],
  opencode: [],
  pi: [],
};

const skillAgentEvidence: Record<SkillAgentId, string[]> = {
  "claude-code": [".claude/skills", ".claude"],
  "kiro-cli": [".kiro/skills", ".kiro"],
  kilo: [".kilocode/skills", ".kilocode"],
  pi: [".pi/agent/skills", ".pi"],
  droid: [".factory/skills", ".factory"],
};

export function detectSetupTargets(options: DetectSetupTargetsOptions): DetectedSetupTargets {
  const base = options.setupScope === "project" ? options.cwd : options.homeDir;
  const agentEvidence = options.setupScope === "project" ? projectAgentEvidence : globalAgentEvidence;
  const hookEvidence = options.setupScope === "project" ? projectHookEvidence : globalHookEvidence;
  const config = readSetupTargetsConfig(options.homeDir);

  const agents = agentIds.filter((agent) => (
    hasEvidence(base, agentEvidence[agent]) ||
    hasCustomEvidence(options.homeDir, config, agent)
  ));
  const hookAgents = hookAgentIds.filter((agent) => (
    hasEvidence(base, hookEvidence[agent]) ||
    hasCustomEvidence(options.homeDir, config, agent)
  ));
  const skillAgents = skillAgentChoices
    .map((choice) => choice.id)
    .filter((agent) => (
      hasEvidence(base, skillAgentEvidence[agent]) ||
      hasCustomEvidence(options.homeDir, config, agent)
    ));

  return { agents, hookAgents, skillAgents };
}

function hasEvidence(base: string, evidencePaths: string[]): boolean {
  return evidencePaths.some((path) => pathExists(join(base, path)));
}

function hasCustomEvidence(homeDir: string, config: SetupTargetsConfig | null, target: AgentId | SkillAgentId): boolean {
  const paths = config?.customAgentPaths[target] ?? [];
  return paths.some((path) => pathExists(isAbsolute(path) ? path : join(homeDir, path)));
}

function readSetupTargetsConfig(homeDir: string): SetupTargetsConfig | null {
  const path = join(localAfkDir(homeDir), "setup-targets.json");
  if (!pathExists(path)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readText(path));
  } catch {
    return null;
  }

  if (!isSetupTargetsConfig(parsed)) {
    return null;
  }

  return parsed;
}

function isSetupTargetsConfig(value: unknown): value is SetupTargetsConfig {
  if (!isRecord(value) || typeof value.version !== "number" || !isRecord(value.customAgentPaths)) {
    return false;
  }

  return Object.entries(value.customAgentPaths).every(([target, paths]) => (
    isTargetId(target) &&
    Array.isArray(paths) &&
    paths.every((path) => typeof path === "string")
  ));
}

function isTargetId(value: string): value is AgentId | SkillAgentId {
  return ([...agentIds, ...hookAgentIds, ...skillAgentIds] as string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
