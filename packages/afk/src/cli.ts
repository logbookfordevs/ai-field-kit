import { spawn } from "node:child_process";
import { isAgentId } from "./agents.js";
import { runDoctor } from "./doctor.js";
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
    runtime.io.stdout(helpText());
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

  if (command === "doctor") {
    return runDoctor(runtime, options);
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

  if (!command || command === "--help" || command === "-h") {
    return { help: true };
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

function helpText(): string {
  return `AFK CLI

Usage:
  afk setup [--dry-run] [--yes] [--scope global|project] [--local] [--agent <agent>] [--ref <git-ref>] [--source github|local] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk rules sync [--dry-run] [--scope global|project] [--local] [--agent <agent>] [--ref <git-ref>] [--source github|local] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk workflows sync [--dry-run] [--scope global|project] [--local] [--agent <agent>] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk skills install [--dry-run] [--yes] [--scope global|project] [--local] [--agent <agent>] [--include-external] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk mcps install [--dry-run] [--yes] [--scope global|project] [--local] [--agent <agent>] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk utils install [--dry-run] [--yes] [--scope global|project] [--local] [--agent <agent>] [--init-only] [--empty] [--refresh-defaults] [--defaults-source <github-source>]
  afk doctor

Agents:
  claude, codex, gemini, opencode`;
}
