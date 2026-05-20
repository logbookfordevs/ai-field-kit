import type { AgentId } from "./types.js";

export const agentIds: AgentId[] = [
  "antigravity",
  "claude",
  "codex",
  "opencode",
];

export const addMcpAgentNames: Partial<Record<AgentId, string>> = {
  antigravity: "antigravity",
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
};

export function isAgentId(value: string): value is AgentId {
  return (agentIds as string[]).includes(value);
}

export function normalizeAgentId(value: string): AgentId | null {
  if (value === "agy" || value === "gemini") {
    return "antigravity";
  }

  return isAgentId(value) ? value : null;
}

export function filterAgents(selected: AgentId[], supported: AgentId[]): AgentId[] {
  if (selected.length === 0) {
    return supported;
  }

  return selected.filter((agent) => supported.includes(agent));
}
