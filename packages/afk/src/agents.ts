import type { AgentId, SkillAgentId } from "./types.js";

export const agentIds: AgentId[] = [
  "antigravity",
  "claude",
  "codex",
  "opencode",
];

export const universalSkillAgentLabels = [
  "Amp",
  "Antigravity",
  "Cline",
  "Codex",
  "Cursor",
  "Deep Agents",
  "Dexto",
  "Firebender",
  "Gemini CLI",
  "GitHub Copilot",
  "Kimi Code CLI",
  "OpenCode",
  "Warp",
  "Zed",
];

export type SkillAgentChoice = {
  id: SkillAgentId;
  label: string;
  path: string;
};

export const skillAgentChoices: SkillAgentChoice[] = [
  { id: "claude-code", label: "Claude Code", path: ".claude/skills" },
  { id: "kiro-cli", label: "Kiro CLI", path: ".kiro/skills" },
  { id: "kilo", label: "Kilo Code", path: ".kilocode/skills" },
  { id: "pi", label: "Pi", path: ".pi/agent/skills" },
  { id: "droid", label: "Droid", path: ".factory/skills" },
];

export const skillAgentIds = skillAgentChoices.map((agent) => agent.id);

export const hookAgentIds: AgentId[] = [
  "codex",
  "claude",
  "cursor-local",
];

export const addMcpAgentNames: Partial<Record<AgentId, string>> = {
  antigravity: "antigravity",
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
};

export function isAgentId(value: string): value is AgentId {
  return ([...agentIds, ...hookAgentIds] as string[]).includes(value);
}

export function normalizeAgentId(value: string): AgentId | null {
  if (value === "agy" || value === "gemini") {
    return "antigravity";
  }

  if (value === "cursor" || value === "cursor-ide" || value === "cursor-cli") {
    return "cursor-local";
  }

  return isAgentId(value) ? value : null;
}
