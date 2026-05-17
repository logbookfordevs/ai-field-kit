import type { AgentId } from "./types.js";

export const agentIds: AgentId[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
];

export const addMcpAgentNames: Partial<Record<AgentId, string>> = {
  claude: "claude-code",
  codex: "codex",
  gemini: "gemini-cli",
  opencode: "opencode",
};

export function isAgentId(value: string): value is AgentId {
  return (agentIds as string[]).includes(value);
}

export function filterAgents(selected: AgentId[], supported: AgentId[]): AgentId[] {
  if (selected.length === 0) {
    return supported;
  }

  return selected.filter((agent) => supported.includes(agent));
}
