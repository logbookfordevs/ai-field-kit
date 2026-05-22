import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { runManifestConfigure } from "./manifest-configure.js";
import { runManifestShow } from "./manifest-show.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import type { AgentId, Area, CliOptions, CommandResult, ManifestCategory, Runtime, SetupScope } from "./types.js";

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

  if (parsed.version) {
    runtime.io.stdout(`afk ${packageVersion()}`);
    return 0;
  }

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

  if (key === "manifests show" || key === "manifest show") {
    return runManifestShow(runtime, options);
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
      version: true;
      help: false;
    }
  | {
      version?: false;
      help: true;
      commandPath?: string[];
    }
  | {
      version?: false;
      help: false;
      kind: "error";
      error: string;
    }
  | {
      version?: false;
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
    summary: "Guided setup for rules, skills, MCPs, and utilities.",
    usage: "afk setup [options]",
    options: [
      "--dry-run                         Preview changes without applying them",
      "--yes, -y                         Accept defaults and skip prompts",
      "--scope global|project            Choose machine-wide or current-project setup",
      "--local                           Alias for --scope project",
      "--agent <agent>                   Limit agent targets; repeatable",
      "--source github|local             Load manifests from remote sources or this checkout for development",
      "--ref <git-ref>                   Git ref for default AFK manifest URLs",
      "--init-only                       Create/update local manifests only",
      "--empty                           Create empty manifests with --init-only",
      "--refresh-defaults                Refresh local manifests from remembered defaults and exit",
      "--defaults-source <source>        Use and remember a custom remote or local defaults source",
    ],
    examples: [
      "afk setup",
      "afk setup --dry-run",
      "afk setup --local",
      "afk setup --refresh-defaults",
      "afk setup --defaults-source your-org/dev-kit",
      "afk setup --defaults-source ./afk/manifests",
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
      "--defaults-source <source>",
    ],
    examples: [
      "afk setup rules sync --dry-run",
      "afk setup rules sync --local",
      "afk setup rules sync --source local",
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
      "--defaults-source <source>",
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
      "--defaults-source <source>",
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
      "--defaults-source <source>",
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
  "manifests show": {
    title: "AFK manifests show",
    summary: "Show the current local AFK manifest configuration.",
    usage: "afk manifests show [options]",
    options: [
      "--local                          Show ./afk/manifests instead of global manifests",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--utils                          Show utilities manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk manifests show",
      "afk manifests show --local",
      "afk manifests show --rules --skills",
      "afk manifest show --mcp --utils",
    ],
  },
  "manifest show": {
    title: "AFK manifest show",
    summary: "Alias for afk manifests show.",
    usage: "afk manifest show [options]",
    options: [
      "--local                          Show ./afk/manifests instead of global manifests",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--utils                          Show utilities manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk manifest show",
      "afk manifest show --local",
      "afk manifest show --rules --skills",
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
  const selectedManifestCategories: ManifestCategory[] = [];
  const homeDir = resolveHome(env);
  const repoDir = resolveRepoDir(env);
  const cwd = resolve(process.cwd());

  if (args.includes("--version") || args.includes("-v")) {
    return { version: true, help: false };
  }

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

    if ((key === "manifests show" || key === "manifest show") && manifestCategoryFlag(arg)) {
      const category = manifestCategoryFlag(arg);
      if (category && !selectedManifestCategories.includes(category)) {
        selectedManifestCategories.push(category);
      }
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
      const agent = value ? normalizeAgentId(value) : null;
      if (!agent) {
        return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
      }
      agents.push(agent);
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
      selectedManifestCategories,
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
  const commandHelp = commandPath ? commandHelps[commandKey(commandPath)] : undefined;
  if (commandHelp) {
    return renderCommandHelp(commandHelp);
  }

  return `AFK CLI

Guided setup router for AI Field Kit.

Usage:
  afk --version
  afk setup [options]
  afk setup rules sync [options]
  afk setup skills install [options]
  afk setup mcps install [options]
  afk setup utils install [options]
  afk manifests configure [options]
  afk manifests show [options]

Run "afk <command> --help" for command-specific options.

Agents:
  antigravity, claude, codex, opencode

Aliases:
  agy, gemini -> antigravity`;
}

function commandKey(commandPath: string[] = []): string {
  return commandPath.join(" ");
}

function packageVersion(): string {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  return typeof packageJson.version === "string" ? packageJson.version : "unknown";
}

function manifestCategoryFlag(arg: string): ManifestCategory | null {
  switch (arg) {
    case "--rules":
      return "rules";
    case "--skill":
    case "--skills":
      return "skills";
    case "--mcp":
    case "--mcps":
      return "mcps";
    case "--util":
    case "--utils":
      return "utils";
    case "--preset":
    case "--presets":
      return "presets";
    default:
      return null;
  }
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
