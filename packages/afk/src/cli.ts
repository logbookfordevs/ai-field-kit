import { spawn } from "node:child_process";
import { isAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { resolve } from "node:path";
import { resolveHome, resolveRepoDir } from "./paths.js";
import type { AgentId, Area, CliOptions, CommandResult, Runtime, SetupScope } from "./types.js";

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const parsed = parseArgs(argv, env);
  const runtime: Runtime = {
    io: {
      stdout: (message) => console.log(message),
      stderr: (message) => console.error(message),
    },
    spawn: spawnCommand,
  };

  if (parsed.help) {
    runtime.io.stdout(helpText(parsed.command, parsed.subcommand));
    return 0;
  }

  if (parsed.kind === "error") {
    runtime.io.stderr(parsed.error);
    runtime.io.stderr(helpText());
    return 1;
  }

  const { command, subcommand, options } = parsed;

  if (command === "setup") {
    return runSetup(runtime, options);
  }

  const area = commandToArea(command, subcommand);
  if (area) {
    return runArea(area, runtime, options);
  }

  runtime.io.stderr(`Unknown command: ${command ?? "(none)"}`);
  runtime.io.stderr(helpText());
  return 1;
}

type ParseResult =
  | {
      help: true;
      command?: string;
      subcommand?: string | null;
    }
  | {
      help: false;
      kind: "error";
      error: string;
    }
  | {
      help: false;
      kind: "command";
      command: string;
      subcommand: string | null;
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
  "rules sync": {
    title: "AFK rules sync",
    summary: "Sync AFK rules into managed rule regions.",
    usage: "afk rules sync [options]",
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
      "afk rules sync --dry-run",
      "afk rules sync --local",
      "afk rules sync --source local",
    ],
  },
  "workflows sync": {
    title: "AFK workflows sync",
    summary: "Install AFK workflows as managed commands, Gemini TOML commands, and Codex skills.",
    usage: "afk workflows sync [options]",
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
      "afk workflows sync --dry-run",
      "afk workflows sync --local",
      "afk workflows sync --agent codex",
    ],
  },
  "skills install": {
    title: "AFK skills install",
    summary: "Delegate selected skills to the official skills CLI.",
    usage: "afk skills install [options]",
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
      "afk skills install --dry-run",
      "afk skills install --yes",
      "afk skills install --local --agent claude",
    ],
  },
  "mcps install": {
    title: "AFK MCPs install",
    summary: "Delegate selected MCP recommendations to add-mcp.",
    usage: "afk mcps install [options]",
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
      "afk mcps install --dry-run",
      "afk mcps install --yes",
      "afk mcps install --local --agent codex",
    ],
  },
  "utils install": {
    title: "AFK utils install",
    summary: "Install optional developer utilities and run supported post-install setup.",
    usage: "afk utils install [options]",
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
      "afk utils install --dry-run",
      "afk utils install --yes",
      "afk utils install --local --agent opencode",
    ],
  },
};

function parseArgs(argv: string[], env: NodeJS.ProcessEnv): ParseResult {
  const args = [...argv];
  const command = args.shift();
  const subcommand = args[0] && !args[0].startsWith("-") ? args.shift() ?? null : null;
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
  const homeDir = resolveHome(env);
  const repoDir = resolveRepoDir(env);
  const cwd = resolve(process.cwd());

  if (!command || command === "--help" || command === "-h" || command === "help") {
    return { help: true };
  }

  if (args.includes("--help") || args.includes("-h")) {
    return { help: true, command, subcommand };
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) {
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      yes = true;
      continue;
    }

    if (arg === "--local") {
      setupScope = "project";
      scopeExplicit = true;
      continue;
    }

    if (arg === "--scope") {
      const value = args[index + 1];
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
      if (!value || !isAgentId(value)) {
        return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
      }
      agents.push(value);
      index += 1;
      continue;
    }

    return { help: false, kind: "error", error: `Unknown option: ${arg}` };
  }

  return {
    help: false,
    kind: "command",
    command,
    subcommand,
    options: {
      agents,
      setupScope,
      scopeExplicit,
      dryRun,
      yes,
      includeExternal,
      selectedSkillIds: [],
      selectedMcpIds: [],
      selectedUtilIds: [],
      rulesRef,
      rulesSource,
      initOnly,
      empty,
      refreshDefaults,
      defaultsSource,
      homeDir,
      repoDir,
      cwd,
    },
  };
}

function commandToArea(command: string | undefined, subcommand: string | null): Area | null {
  if (command === "rules" && subcommand === "sync") {
    return "rules";
  }

  if (command === "workflows" && subcommand === "sync") {
    return "workflows";
  }

  if (command === "skills" && subcommand === "install") {
    return "skills";
  }

  if (command === "mcps" && subcommand === "install") {
    return "mcps";
  }

  if (command === "utils" && subcommand === "install") {
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

function helpText(command?: string, subcommand?: string | null): string {
  const commandHelp = command ? commandHelps[commandKey(command, subcommand)] : undefined;
  if (commandHelp) {
    return renderCommandHelp(commandHelp);
  }

  return `AFK CLI

Guided setup router for AI Field Kit.

Usage:
  afk setup [options]
  afk rules sync [options]
  afk workflows sync [options]
  afk skills install [options]
  afk mcps install [options]
  afk utils install [options]

Run "afk <command> --help" for command-specific options.

Agents:
  claude, codex, gemini, opencode`;
}

function commandKey(command: string, subcommand?: string | null): string {
  return [command, subcommand].filter(Boolean).join(" ");
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
