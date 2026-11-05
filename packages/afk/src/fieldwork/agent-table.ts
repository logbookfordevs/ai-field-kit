export type InvocationMechanism = "claude" | "codex";

export interface AgentEntry {
  id: string;
  name: string;
  /** Global skills folder, `~`-relative. */
  global: string;
  /** Skills folder inside a project. */
  project: string;
  /** `~`-relative folders whose presence means the agent is installed on this machine. */
  detect: string[];
  /** The invocation mechanism the agent is known to follow; absent when unknown. */
  invocation?: InvocationMechanism;
  /** File in `web/assets/agent-icons/`. */
  icon?: string;
}

/** Skills CLI 1.7.6's agent table (global and project folders, detection folders), plus the invocation mechanisms AFK writes. */
export const AGENT_TABLE: readonly AgentEntry[] = [
  { id: "aider-desk", name: "AiderDesk", global: "~/.aider-desk/skills", project: ".aider-desk/skills", detect: ["~/.aider-desk"] },
  { id: "amp", name: "Amp", global: "~/.config/agents/skills", project: ".agents/skills", detect: ["~/.config/amp"], icon: "amp.svg" },
  { id: "antigravity", name: "Antigravity", global: "~/.gemini/antigravity/skills", project: ".agents/skills", detect: ["~/.gemini/antigravity"], icon: "antigravity.png" },
  { id: "antigravity-cli", name: "Antigravity CLI", global: "~/.gemini/antigravity-cli/skills", project: ".agents/skills", detect: ["~/.gemini/antigravity-cli"] },
  { id: "astrbot", name: "AstrBot", global: "~/.astrbot/data/skills", project: "data/skills", detect: ["~/.astrbot"] },
  { id: "autohand-code", name: "Autohand Code CLI", global: "~/.autohand/skills", project: ".autohand/skills", detect: ["~/.autohand"] },
  { id: "augment", name: "Augment", global: "~/.augment/skills", project: ".augment/skills", detect: ["~/.augment"], icon: "augment.svg" },
  { id: "bob", name: "IBM Bob", global: "~/.bob/skills", project: ".bob/skills", detect: ["~/.bob"], icon: "bob.png" },
  { id: "claude-code", name: "Claude Code", global: "~/.claude/skills", project: ".claude/skills", detect: ["~/.claude"], invocation: "claude", icon: "claude_code.svg" },
  { id: "openclaw", name: "OpenClaw", global: "~/.openclaw/skills", project: "skills", detect: ["~/.openclaw","~/.clawdbot","~/.moltbot"], icon: "openclaw.svg" },
  { id: "cline", name: "Cline", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.cline"], icon: "cline.png" },
  { id: "codearts-agent", name: "CodeArts Agent", global: "~/.codeartsdoer/skills", project: ".codeartsdoer/skills", detect: ["~/.codeartsdoer"] },
  { id: "codebuddy", name: "CodeBuddy", global: "~/.codebuddy/skills", project: ".codebuddy/skills", detect: ["~/.codebuddy"], icon: "codebuddy.svg" },
  { id: "codemaker", name: "Codemaker", global: "~/.codemaker/skills", project: ".codemaker/skills", detect: ["~/.codemaker"] },
  { id: "codestudio", name: "Code Studio", global: "~/.codestudio/skills", project: ".codestudio/skills", detect: ["~/.codestudio"] },
  { id: "codex", name: "Codex", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.codex"], invocation: "codex", icon: "codex.svg" },
  { id: "command-code", name: "Command Code", global: "~/.commandcode/skills", project: ".commandcode/skills", detect: ["~/.commandcode"], icon: "command_code.svg" },
  { id: "continue", name: "Continue", global: "~/.continue/skills", project: ".continue/skills", detect: ["~/.continue"], icon: "continue.png" },
  { id: "cortex", name: "Cortex Code", global: "~/.snowflake/cortex/skills", project: ".cortex/skills", detect: ["~/.snowflake/cortex"], icon: "cortex.png" },
  { id: "crush", name: "Crush", global: "~/.config/crush/skills", project: ".crush/skills", detect: ["~/.config/crush"], icon: "crush.png" },
  { id: "cursor", name: "Cursor", global: "~/.cursor/skills", project: ".agents/skills", detect: ["~/.cursor"], icon: "cursor.png" },
  { id: "deepagents", name: "Deep Agents", global: "~/.deepagents/agent/skills", project: ".agents/skills", detect: ["~/.deepagents"], icon: "deepagents.png" },
  { id: "devin", name: "Devin for Terminal", global: "~/.config/devin/skills", project: ".devin/skills", detect: ["~/.config/devin"] },
  { id: "dexto", name: "Dexto", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.dexto"] },
  { id: "droid", name: "Droid", global: "~/.factory/skills", project: ".agents/skills", detect: ["~/.factory"], icon: "droid.svg" },
  { id: "firebender", name: "Firebender", global: "~/.firebender/skills", project: ".agents/skills", detect: ["~/.firebender"], icon: "firebender.svg" },
  { id: "forgecode", name: "ForgeCode", global: "~/.forge/skills", project: ".forge/skills", detect: ["~/.forge"] },
  { id: "fx", name: "fx", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.fx"] },
  { id: "gemini-cli", name: "Gemini CLI", global: "~/.gemini/skills", project: ".agents/skills", detect: ["~/.gemini"], icon: "gemini_cli.svg" },
  { id: "github-copilot", name: "GitHub Copilot", global: "~/.copilot/skills", project: ".agents/skills", detect: ["~/.copilot"], icon: "github_copilot.png" },
  { id: "goose", name: "Goose", global: "~/.config/goose/skills", project: ".goose/skills", detect: ["~/.config/goose"], icon: "goose.png" },
  { id: "grok", name: "Grok Build", global: "~/.grok/skills", project: ".grok/skills", detect: ["~/.grok"], icon: "grok.svg" },
  { id: "hermes-agent", name: "Hermes Agent", global: "~/.hermes/skills", project: ".hermes/skills", detect: ["~/.hermes"], icon: "hermes.png" },
  { id: "inference-sh", name: "inference.sh", global: "~/.inferencesh/skills", project: ".inferencesh/skills", detect: ["~/.inferencesh"] },
  { id: "jazz", name: "Jazz", global: "~/.jazz/skills", project: ".jazz/skills", detect: ["~/.jazz"] },
  { id: "junie", name: "Junie", global: "~/.junie/skills", project: ".junie/skills", detect: ["~/.junie"], icon: "junie.png" },
  { id: "iflow-cli", name: "iFlow CLI", global: "~/.iflow/skills", project: ".iflow/skills", detect: ["~/.iflow"], icon: "iflow.png" },
  { id: "kilo", name: "Kilo Code", global: "~/.kilo/skills", project: ".agents/skills", detect: ["~/.kilo","~/.kilocode"], icon: "kilo_code.svg" },
  { id: "kimchi", name: "Kimchi", global: "~/.config/kimchi/harness/skills", project: ".kimchi/skills", detect: ["~/.config/kimchi"] },
  { id: "kimi-code-cli", name: "Kimi Code CLI", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.kimi-code","~/.kimi"], icon: "kimi.svg" },
  { id: "kiro-cli", name: "Kiro CLI", global: "~/.kiro/skills", project: ".kiro/skills", detect: ["~/.kiro"], icon: "kiro.svg" },
  { id: "kode", name: "Kode", global: "~/.kode/skills", project: ".kode/skills", detect: ["~/.kode"], icon: "kode.png" },
  { id: "lingma", name: "Lingma", global: "~/.lingma/skills", project: ".lingma/skills", detect: ["~/.lingma"] },
  { id: "loaf", name: "Loaf", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.loaf"] },
  { id: "mcpjam", name: "MCPJam", global: "~/.mcpjam/skills", project: ".mcpjam/skills", detect: ["~/.mcpjam"], icon: "mcpjam.png" },
  { id: "minimax-code", name: "MiniMax Code", global: "~/.minimax/skills", project: ".minimax/skills", detect: ["~/.minimax"], icon: "minimax_code.png" },
  { id: "mistral-vibe", name: "Mistral Vibe", global: "~/.vibe/skills", project: ".vibe/skills", detect: ["~/.vibe"], icon: "mistral_vibe.svg" },
  { id: "moxby", name: "Moxby", global: "~/.moxby/skills", project: ".moxby/skills", detect: ["~/.moxby"] },
  { id: "mux", name: "Mux", global: "~/.mux/skills", project: ".mux/skills", detect: ["~/.mux"], icon: "mux.png" },
  { id: "opencode", name: "OpenCode", global: "~/.config/opencode/skills", project: ".agents/skills", detect: ["~/.config/opencode"], icon: "opencode.png" },
  { id: "openhands", name: "OpenHands", global: "~/.openhands/skills", project: ".openhands/skills", detect: ["~/.openhands"], icon: "openhands.png" },
  { id: "ona", name: "Ona", global: "~/.ona/skills", project: ".ona/skills", detect: ["~/.ona"] },
  { id: "pi", name: "Pi", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.pi/agent"], invocation: "claude", icon: "pi.svg" },
  { id: "posit-assistant", name: "Posit Assistant", global: "~/.posit/assistant/skills", project: ".posit/assistant/skills", detect: ["~/.posit/assistant","~/.positai"] },
  { id: "qoder", name: "Qoder", global: "~/.qoder/skills", project: ".qoder/skills", detect: ["~/.qoder"], icon: "qoder.svg" },
  { id: "qoder-cn", name: "Qoder CN", global: "~/.qoder-cn/skills", project: ".qoder/skills", detect: ["~/.qoder-cn"] },
  { id: "qwen-code", name: "Qwen Code", global: "~/.qwen/skills", project: ".qwen/skills", detect: ["~/.qwen"], icon: "qwen_code.png" },
  { id: "replit", name: "Replit", global: "~/.config/agents/skills", project: ".agents/skills", detect: [], icon: "replit.png" },
  { id: "reasonix", name: "Reasonix", global: "~/.reasonix/skills", project: ".reasonix/skills", detect: ["~/.reasonix"] },
  { id: "rovodev", name: "Rovo Dev", global: "~/.rovodev/skills", project: ".rovodev/skills", detect: ["~/.rovodev"] },
  { id: "roo", name: "Roo Code", global: "~/.roo/skills", project: ".roo/skills", detect: ["~/.roo"], icon: "roo_code.svg" },
  { id: "sarvam-code", name: "Sarvam Code", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.sarvam"] },
  { id: "tabnine-cli", name: "Tabnine CLI", global: "~/.tabnine/agent/skills", project: ".tabnine/agent/skills", detect: ["~/.tabnine"] },
  { id: "terramind", name: "Terramind", global: "~/.terramind/skills", project: ".terramind/skills", detect: ["~/.terramind"] },
  { id: "tinycloud", name: "Tinycloud", global: "~/.tinycloud/skills", project: ".tinycloud/skills", detect: ["~/.tinycloud"] },
  { id: "trae", name: "Trae", global: "~/.trae/skills", project: ".trae/skills", detect: ["~/.trae"], icon: "trae.svg" },
  { id: "trae-cn", name: "Trae CN", global: "~/.trae-cn/skills", project: ".trae/skills", detect: ["~/.trae-cn"], icon: "trae_cn.svg" },
  { id: "warp", name: "Warp", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.warp"], icon: "warp.svg" },
  { id: "windsurf", name: "Windsurf", global: "~/.codeium/windsurf/skills", project: ".windsurf/skills", detect: ["~/.codeium/windsurf"], icon: "windsurf.svg" },
  { id: "zed", name: "Zed", global: "~/.agents/skills", project: ".agents/skills", detect: ["~/.config/zed"] },
  { id: "zcode", name: "ZCode", global: "~/.zcode/skills", project: ".zcode/skills", detect: ["~/.zcode"], icon: "zcode.svg" },
  { id: "zencoder", name: "Zencoder", global: "~/.zencoder/skills", project: ".zencoder/skills", detect: ["~/.zencoder"], icon: "zencoder.png" },
  { id: "zenflow", name: "Zenflow", global: "~/.zencoder/skills", project: ".zencoder/skills", detect: ["~/.zencoder"] },
  { id: "neovate", name: "Neovate", global: "~/.neovate/skills", project: ".neovate/skills", detect: ["~/.neovate"], icon: "neovate.png" },
  { id: "pochi", name: "Pochi", global: "~/.pochi/skills", project: ".pochi/skills", detect: ["~/.pochi"], icon: "pochi.png" },
  { id: "adal", name: "AdaL", global: "~/.adal/skills", project: ".adal/skills", detect: ["~/.adal"], icon: "adal.png" },
];
