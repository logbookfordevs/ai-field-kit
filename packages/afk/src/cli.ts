import { spawn } from "node:child_process";
import { isAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { runManifestConfigure } from "./manifest-configure.js";
import { runSkillsCommand } from "./skills/commands.js";
import { resolve } from "node:path";
import { resolveHome, resolveRepoDir } from "./paths.js";
import type {
  AgentId,
  Area,
  CliOptions,
  CommandResult,
  ManagedSkillAgent,
  Runtime,
  SetupScope,
  SkillCategorizationMode,
  SkillCategorizationRunner,
  SkillsListScope,
} from "./types.js";

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const runtime: Runtime = {
    io: {
      stdout: (message) => console.log(message),
      stderr: (message) => console.error(message),
    },
    spawn: spawnCommand,
  };

  try {
    return await runCliWithRuntime(argv, env, runtime);
  } catch (error) {
    if (isPromptExit(error)) {
      runtime.io.stdout("\nAFK setup cancelled. Nothing else was changed from this prompt.");
      return 130;
    }

    throw error;
  }
}

async function runCliWithRuntime(argv: string[], env: NodeJS.ProcessEnv, runtime: Runtime): Promise<number> {
  const parsed = parseArgs(argv, env);

  if (parsed.help) {
    runtime.io.stdout(helpText(parsed.commandPath));
    return 0;
  }

  if (parsed.kind === "error") {
    runtime.io.stderr(parsed.error);
    runtime.io.stderr(helpText());
    return 1;
  }

  const { commandPath, options } = parsed;
  const key = commandKey(commandPath);

  if (key === "setup") {
    return runSetup(runtime, options);
  }

  if (key === "manifests configure") {
    return runManifestConfigure(runtime, options);
  }

  if (commandPath[0] === "skills") {
    return runSkillsCommand(commandPath, runtime, options);
  }

  const area = commandToArea(commandPath);
  if (area) {
    return runArea(area, runtime, options);
  }

  runtime.io.stderr(`Unknown command: ${key || "(none)"}`);
  runtime.io.stderr(helpText());
  return 1;
}

export function isPromptExit(error: unknown): boolean {
  return error instanceof Error && error.name === "ExitPromptError";
}

type ParseResult =
  | {
      help: true;
      commandPath?: string[];
    }
  | {
      help: false;
      kind: "error";
      error: string;
    }
  | {
      help: false;
      kind: "command";
      commandPath: string[];
      options: CliOptions;
    };

type CommandHelp = {
  title: string;
  summary: string;
  usage: string;
  options: string[];
  examples: string[];
};

const commandHelps: Record<string, CommandHelp> = {
  setup: {
    title: "AFK setup",
    summary: "Guided setup for rules, workflows, skills, MCPs, and utilities.",
    usage: "afk setup [options]",
    options: [
      "--dry-run                         Preview changes without applying them",
      "--yes, -y                         Accept defaults and skip prompts",
      "--scope global|project            Choose machine-wide or current-project setup",
      "--local                           Alias for --scope project",
      "--agent <agent>                   Limit agent targets; repeatable",
      "--source github|local             Load rules/workflows from GitHub or this checkout",
      "--ref <git-ref>                   Git ref for default AFK manifest URLs",
      "--init-only                       Create/update local manifests only",
      "--empty                           Create empty manifests with --init-only",
      "--refresh-defaults                Refresh local manifests from remembered defaults",
      "--defaults-source <github-source> Use and remember a custom defaults source",
    ],
    examples: [
      "afk setup",
      "afk setup --dry-run",
      "afk setup --local",
      "afk setup --refresh-defaults",
      "afk setup --defaults-source your-org/dev-kit",
    ],
  },
  "setup rules sync": {
    title: "AFK setup rules sync",
    summary: "Sync AFK rules into managed rule regions.",
    usage: "afk setup rules sync [options]",
    options: [
      "--dry-run",
      "--scope global|project",
      "--local",
      "--agent <agent>",
      "--source github|local",
      "--ref <git-ref>",
      "--init-only",
      "--empty",
      "--refresh-defaults",
      "--defaults-source <github-source>",
    ],
    examples: [
      "afk setup rules sync --dry-run",
      "afk setup rules sync --local",
      "afk setup rules sync --source local",
    ],
  },
  "setup workflows sync": {
    title: "AFK setup workflows sync",
    summary: "Install AFK workflows as managed commands, Gemini TOML commands, and Codex skills.",
    usage: "afk setup workflows sync [options]",
    options: [
      "--dry-run",
      "--scope global|project",
      "--local",
      "--agent <agent>",
      "--source github|local",
      "--init-only",
      "--empty",
      "--refresh-defaults",
      "--defaults-source <github-source>",
    ],
    examples: [
      "afk setup workflows sync --dry-run",
      "afk setup workflows sync --local",
      "afk setup workflows sync --agent codex",
    ],
  },
  "setup skills install": {
    title: "AFK setup skills install",
    summary: "Delegate selected skills to the official skills CLI.",
    usage: "afk setup skills install [options]",
    options: [
      "--dry-run",
      "--yes, -y",
      "--scope global|project",
      "--local",
      "--agent <agent>",
      "--include-external",
      "--init-only",
      "--empty",
      "--refresh-defaults",
      "--defaults-source <github-source>",
    ],
    examples: [
      "afk setup skills install --dry-run",
      "afk setup skills install --yes",
      "afk setup skills install --local --agent claude",
    ],
  },
  "setup mcps install": {
    title: "AFK setup MCPs install",
    summary: "Delegate selected MCP recommendations to add-mcp.",
    usage: "afk setup mcps install [options]",
    options: [
      "--dry-run",
      "--yes, -y",
      "--scope global|project",
      "--local",
      "--agent <agent>",
      "--init-only",
      "--empty",
      "--refresh-defaults",
      "--defaults-source <github-source>",
    ],
    examples: [
      "afk setup mcps install --dry-run",
      "afk setup mcps install --yes",
      "afk setup mcps install --local --agent codex",
    ],
  },
  "setup utils install": {
    title: "AFK setup utils install",
    summary: "Install optional developer utilities and run supported post-install setup.",
    usage: "afk setup utils install [options]",
    options: [
      "--dry-run",
      "--yes, -y",
      "--scope global|project",
      "--local",
      "--agent <agent>",
      "--init-only",
      "--empty",
      "--refresh-defaults",
      "--defaults-source <github-source>",
    ],
    examples: [
      "afk setup utils install --dry-run",
      "afk setup utils install --yes",
      "afk setup utils install --local --agent opencode",
    ],
  },
  "manifests configure": {
    title: "AFK manifests configure",
    summary: "Interactively author AFK manifest JSON files.",
    usage: "afk manifests configure [options]",
    options: [
      "--local                          Write to ./afk/manifests for a defaults repo",
      "--from-current                   Start from existing manifests when present",
      "--dry-run                        Preview generated files without writing",
    ],
    examples: [
      "afk manifests configure",
      "afk manifests configure --local",
      "afk manifests configure --from-current",
    ],
  },
  skills: {
    title: "AFK skills",
    summary: "Inspect and manage local AFK skill libraries.",
    usage: "afk skills <command> [options]",
    options: [
      "list                              List global and project skills",
      "show <folder>                     Show one skill",
      "disable <folder>                  Move a global skill into .disabled",
      "enable <folder>                   Move a disabled global skill back to active",
      "rename <folder> <display-name>    Store an AFK display name in afk-skills.json",
      "categorize                        Create or update afk-skills.json with Codex",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global --json",
      "afk skills disable old-skill --dry-run",
      "afk skills categorize --mode append-missing --dry-run",
    ],
  },
  "skills list": {
    title: "AFK skills list",
    summary: "List global AFK skills and read-only current-project Codex/Claude skills.",
    usage: "afk skills list [options]",
    options: [
      "--scope global|project|all        Choose which skill roots to list",
      "--agent codex|claude              Limit project roots to one agent",
      "--json                            Print JSON records",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global",
      "afk skills list --scope project --agent codex",
    ],
  },
  "skills show": {
    title: "AFK skills show",
    summary: "Show details for one discovered skill.",
    usage: "afk skills show <folder> [options]",
    options: [
      "--agent codex|claude              Limit project lookup to one agent",
      "--json                            Print JSON record",
    ],
    examples: [
      "afk skills show afk-note",
      "afk skills show afk-note --json",
    ],
  },
  "skills disable": {
    title: "AFK skills disable",
    summary: "Disable a global skill by moving it to ~/.agents/skills/.disabled.",
    usage: "afk skills disable <folder> [options]",
    options: ["--dry-run                         Preview the move without applying it"],
    examples: ["afk skills disable old-skill --dry-run", "afk skills disable old-skill"],
  },
  "skills enable": {
    title: "AFK skills enable",
    summary: "Enable a global skill by moving it out of ~/.agents/skills/.disabled.",
    usage: "afk skills enable <folder> [options]",
    options: ["--dry-run                         Preview the move without applying it"],
    examples: ["afk skills enable old-skill --dry-run", "afk skills enable old-skill"],
  },
  "skills rename": {
    title: "AFK skills rename",
    summary: "Store a display name override in ~/.agents/skills/afk-skills.json.",
    usage: "afk skills rename <folder> <display-name> [options]",
    options: ["--dry-run                         Preview the taxonomy update without applying it"],
    examples: ["afk skills rename afk-note \"AFK Note\" --dry-run", "afk skills rename afk-note \"AFK Note\""],
  },
  "skills categorize": {
    title: "AFK skills categorize",
    summary: "Create or update ~/.agents/skills/afk-skills.json with Codex exec.",
    usage: "afk skills categorize [options]",
    options: [
      "--mode append-missing|recategorize-all",
      "--instruction <text>              Add guidance to the Codex prompt",
      "--runner codex-exec               Categorization runner; v1 supports codex-exec",
      "--dry-run                         Print command and prompt without running Codex",
    ],
    examples: [
      "afk skills categorize --dry-run",
      "afk skills categorize --mode recategorize-all --instruction \"Prefer workflow-oriented categories\"",
    ],
  },
};

function parseArgs(argv: string[], env: NodeJS.ProcessEnv): ParseResult {
  const args = [...argv];
  const commandPath = readCommandPath(args);
  const key = commandKey(commandPath);
  const agents: AgentId[] = [];
  let dryRun = false;
  let yes = false;
  let setupScope: SetupScope = "global";
  let scopeExplicit = false;
  let includeExternal = false;
  let rulesRef = "main";
  let rulesSource: "manifest" | "github" | "local" = "manifest";
  let initOnly = false;
  let empty = false;
  let refreshDefaults = false;
  let defaultsSource = "";
  let manifestConfigureLocal = false;
  let manifestConfigureFromCurrent = false;
  let skillsListScope: SkillsListScope = "all";
  let skillsAgent: ManagedSkillAgent | undefined;
  let skillsJson = false;
  let skillCategorizationMode: SkillCategorizationMode | undefined;
  let skillCategorizationRunner: SkillCategorizationRunner = "codex-exec";
  let skillCategorizationInstruction = "";
  const homeDir = resolveHome(env);
  const repoDir = resolveRepoDir(env);
  const cwd = resolve(process.cwd());
  const isSkillsCommand = commandPath[0] === "skills";

  if (commandPath.length === 0 || key === "--help" || key === "-h" || key === "help") {
    return { help: true };
  }

  if (args.includes("--help") || args.includes("-h")) {
    return { help: true, commandPath };
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (key === "manifests configure" && arg === "--from-current") {
      manifestConfigureFromCurrent = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (isSkillsCommand && arg === "--json") {
      skillsJson = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      yes = true;
      continue;
    }

    if (arg === "--local") {
      if (key === "manifests configure") {
        manifestConfigureLocal = true;
        continue;
      }

      setupScope = "project";
      scopeExplicit = true;
      continue;
    }

    if (arg === "--scope") {
      const value = args[index + 1];
      if (isSkillsCommand) {
        if (value !== "global" && value !== "project" && value !== "all") {
          return { help: false, kind: "error", error: `Invalid --scope value: ${value ?? "(missing)"}` };
        }
        skillsListScope = value;
        index += 1;
        continue;
      }

      if (value !== "global" && value !== "project") {
        return { help: false, kind: "error", error: `Invalid --scope value: ${value ?? "(missing)"}` };
      }
      setupScope = value;
      scopeExplicit = true;
      index += 1;
      continue;
    }

    if (arg === "--include-external") {
      includeExternal = true;
      continue;
    }

    if (arg === "--init-only") {
      initOnly = true;
      continue;
    }

    if (arg === "--empty") {
      empty = true;
      continue;
    }

    if (arg === "--refresh-defaults") {
      refreshDefaults = true;
      continue;
    }

    if (arg === "--defaults-source") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --defaults-source value" };
      }
      defaultsSource = value;
      index += 1;
      continue;
    }

    if (arg === "--ref") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --ref value" };
      }
      rulesRef = value;
      index += 1;
      continue;
    }

    if (arg === "--source") {
      const value = args[index + 1];
      if (value !== "github" && value !== "local") {
        return { help: false, kind: "error", error: `Invalid --source value: ${value ?? "(missing)"}` };
      }
      rulesSource = value;
      index += 1;
      continue;
    }

    if (arg === "--agent") {
      const value = args[index + 1];
      if (isSkillsCommand) {
        if (value !== "codex" && value !== "claude") {
          return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
        }
        skillsAgent = value;
        index += 1;
        continue;
      }

      if (!value || !isAgentId(value)) {
        return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
      }
      agents.push(value);
      index += 1;
      continue;
    }

    if (isSkillsCommand && arg === "--mode") {
      const value = args[index + 1];
      if (value !== "append-missing" && value !== "recategorize-all") {
        return { help: false, kind: "error", error: `Invalid --mode value: ${value ?? "(missing)"}` };
      }
      skillCategorizationMode = value;
      index += 1;
      continue;
    }

    if (isSkillsCommand && arg === "--runner") {
      const value = args[index + 1];
      if (value !== "codex-exec") {
        return { help: false, kind: "error", error: `Invalid --runner value: ${value ?? "(missing)"}` };
      }
      skillCategorizationRunner = value;
      index += 1;
      continue;
    }

    if (isSkillsCommand && arg === "--instruction") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --instruction value" };
      }
      skillCategorizationInstruction = value;
      index += 1;
      continue;
    }

    return { help: false, kind: "error", error: `Unknown option: ${arg}` };
  }

  return {
    help: false,
    kind: "command",
    commandPath,
    options: {
      agents,
      setupScope,
      scopeExplicit,
      dryRun,
      yes,
      includeExternal,
      selectedSkillIds: [],
      selectedWorkflowIds: [],
      selectedMcpIds: [],
      selectedUtilIds: [],
      rulesRef,
      rulesSource,
      initOnly,
      empty,
      refreshDefaults,
      defaultsSource,
      manifestConfigureLocal,
      manifestConfigureFromCurrent,
      skillsListScope,
      skillsAgent,
      skillsJson,
      skillCategorizationMode,
      skillCategorizationRunner,
      skillCategorizationInstruction,
      homeDir,
      repoDir,
      cwd,
    },
  };
}

function readCommandPath(args: string[]): string[] {
  const commandPath: string[] = [];
  while (args[0] && !args[0].startsWith("-")) {
    commandPath.push(args.shift() ?? "");
  }

  return commandPath.filter(Boolean);
}

function commandToArea(commandPath: string[]): Area | null {
  const key = commandKey(commandPath);
  if (key === "setup rules sync") {
    return "rules";
  }

  if (key === "setup workflows sync") {
    return "workflows";
  }

  if (key === "setup skills install") {
    return "skills";
  }

  if (key === "setup mcps install") {
    return "mcps";
  }

  if (key === "setup utils install") {
    return "utils";
  }

  return null;
}

function spawnCommand(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: false,
    });

    child.on("close", (code) => resolve({ code: code ?? 1 }));
    child.on("error", () => resolve({ code: 1 }));
  });
}

function helpText(commandPath?: string[]): string {
  const commandHelp = commandPath ? commandHelps[helpKey(commandPath)] : undefined;
  if (commandHelp) {
    return renderCommandHelp(commandHelp);
  }

  return `AFK CLI

Guided setup router for AI Field Kit.

Usage:
  afk setup [options]
  afk setup rules sync [options]
  afk setup workflows sync [options]
  afk setup skills install [options]
  afk setup mcps install [options]
  afk setup utils install [options]
  afk skills <command> [options]
  afk manifests configure [options]

Run "afk <command> --help" for command-specific options.

Agents:
  claude, codex, gemini, opencode`;
}

function commandKey(commandPath: string[] = []): string {
  return commandPath.join(" ");
}

function helpKey(commandPath: string[] = []): string {
  if (commandPath[0] === "skills" && commandPath[1]) {
    return commandPath.slice(0, 2).join(" ");
  }

  return commandKey(commandPath);
}

function renderCommandHelp(help: CommandHelp): string {
  return [
    help.title,
    "",
    help.summary,
    "",
    "Usage:",
    `  ${help.usage}`,
    "",
    "Options:",
    ...help.options.map((option) => `  ${option}`),
    "",
    "Examples:",
    ...help.examples.map((example) => `  ${example}`),
  ].join("\n");
}
