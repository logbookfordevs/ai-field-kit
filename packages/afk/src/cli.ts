import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { runManifestConfigure } from "./manifest-configure.js";
import { runManifestShow } from "./manifest-show.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import type { AgentId, Area, CliOptions, CommandResult, ManifestCategory, Runtime, SetupScope, SkillAgentId } from "./types.js";

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

  if (key === "setup" || key === "setup refresh") {
    return runSetup(runtime, options);
  }

  if (isManifestConfigureCommand(key)) {
    return runManifestConfigure(runtime, options);
  }

  if (isManifestShowCommand(key)) {
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
  subcommands?: string[];
  examples: string[];
};

const setupOptions = {
  dryRun: "--dry-run                         Preview changes without applying them",
  yes: "--yes, -y                         Accept defaults and skip prompts",
  scope: "--scope global|project            Choose machine-wide or current-project setup",
  localScope: "--local                           Alias for --scope project",
  localManifest: "--local                           Refresh ./afk/manifests instead of global manifests",
  agent: "--agent <agent>                   Limit agent targets; repeatable",
  source: "--source github|local             Load default manifests from GitHub or this checkout",
  ref: "--ref <git-ref>                   Git ref for default AFK manifest URLs",
  initOnly: "--init-only                       Create/update local manifests only, then exit",
  empty: "--empty                           Create empty manifests with --init-only or refresh",
  defaultsSource: "--defaults-source <source>        Use and remember a custom remote or local defaults source",
  includeExternal: "--include-external                Include external recommended skills when installing skills",
};

const setupAreaOptions = [
  setupOptions.dryRun,
  setupOptions.yes,
  setupOptions.scope,
  setupOptions.localScope,
  setupOptions.agent,
  setupOptions.source,
  setupOptions.ref,
  setupOptions.initOnly,
  setupOptions.empty,
  setupOptions.defaultsSource,
];

const commandHelps: Record<string, CommandHelp> = {
  setup: {
    title: "AFK setup",
    summary: "Guided setup for rules, skills, MCPs, utilities, and hooks.",
    usage: "afk setup [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.yes,
      setupOptions.scope,
      setupOptions.localScope,
      setupOptions.agent,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.initOnly,
      setupOptions.empty,
      setupOptions.defaultsSource,
    ],
    subcommands: [
      "afk setup refresh                 Refresh global or project-local AFK manifests",
      "afk setup rules                   Sync AFK rules into managed agent rule regions",
      "afk setup skills                  Delegate skill installation to the official skills CLI",
      "afk setup mcps                    Delegate MCP installation to add-mcp",
      "afk setup utils                   Install optional developer utilities",
      "afk setup hooks                   Merge AFK lifecycle hooks into agent hook configs",
    ],
    examples: [
      "afk setup",
      "afk setup --dry-run",
      "afk setup --local",
      "afk setup refresh --defaults-source your-org/dev-kit",
      "afk setup --defaults-source your-org/dev-kit",
      "afk setup --defaults-source ./afk/manifests",
    ],
  },
  "setup refresh": {
    title: "AFK setup refresh",
    summary: "Refresh AFK manifests from the remembered or selected defaults source.",
    usage: "afk setup refresh [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.localManifest,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.empty,
      setupOptions.defaultsSource,
    ],
    examples: [
      "afk setup refresh",
      "afk setup refresh --local",
      "afk setup refresh --defaults-source your-org/dev-kit",
      "afk setup refresh --source local",
    ],
  },
  "setup hooks": {
    title: "AFK setup hooks",
    summary: "Merge selected AFK lifecycle hooks into supported agent hook configs.",
    usage: "afk setup hooks [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup hooks --dry-run",
      "afk setup hooks --yes --agent codex",
      "afk setup hooks --local --agent cursor-local",
    ],
  },
  "setup hooks install": {
    title: "AFK setup hooks",
    summary: "Merge selected AFK lifecycle hooks into supported agent hook configs.",
    usage: "afk setup hooks [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup hooks --dry-run",
      "afk setup hooks --yes --agent codex",
      "afk setup hooks --local --agent cursor-local",
    ],
  },
  "setup rules": {
    title: "AFK setup rules",
    summary: "Sync AFK rules into managed rule regions.",
    usage: "afk setup rules [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup rules --dry-run",
      "afk setup rules --local",
      "afk setup rules --source local",
    ],
  },
  "setup rules sync": {
    title: "AFK setup rules",
    summary: "Sync AFK rules into managed rule regions.",
    usage: "afk setup rules [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup rules --dry-run",
      "afk setup rules --local",
      "afk setup rules --source local",
    ],
  },
  "setup skills": {
    title: "AFK setup skills",
    summary: "Delegate selected skills to the official skills CLI.",
    usage: "afk setup skills [options]",
    options: [
      ...setupAreaOptions,
      setupOptions.includeExternal,
    ],
    examples: [
      "afk setup skills --dry-run",
      "afk setup skills --yes",
      "afk setup skills --local --agent claude",
    ],
  },
  "setup skills install": {
    title: "AFK setup skills",
    summary: "Delegate selected skills to the official skills CLI.",
    usage: "afk setup skills [options]",
    options: [
      ...setupAreaOptions,
      setupOptions.includeExternal,
    ],
    examples: [
      "afk setup skills --dry-run",
      "afk setup skills --yes",
      "afk setup skills --local --agent claude",
    ],
  },
  "setup mcps": {
    title: "AFK setup MCPs",
    summary: "Delegate selected MCP recommendations to add-mcp.",
    usage: "afk setup mcps [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup mcps --dry-run",
      "afk setup mcps --yes",
      "afk setup mcps --local --agent codex",
    ],
  },
  "setup mcps install": {
    title: "AFK setup MCPs",
    summary: "Delegate selected MCP recommendations to add-mcp.",
    usage: "afk setup mcps [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup mcps --dry-run",
      "afk setup mcps --yes",
      "afk setup mcps --local --agent codex",
    ],
  },
  "setup utils": {
    title: "AFK setup utils",
    summary: "Install optional developer utilities and run supported post-install setup.",
    usage: "afk setup utils [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup utils --dry-run",
      "afk setup utils --yes",
      "afk setup utils --local --agent opencode",
    ],
  },
  "setup utils install": {
    title: "AFK setup utils",
    summary: "Install optional developer utilities and run supported post-install setup.",
    usage: "afk setup utils [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup utils --dry-run",
      "afk setup utils --yes",
      "afk setup utils --local --agent opencode",
    ],
  },
  configure: {
    title: "AFK configure",
    summary: "Interactively author AFK manifest JSON files.",
    usage: "afk configure [options]",
    options: [
      "--local                          Write to ./afk/manifests for a defaults repo",
      "--from-current                   Start from existing manifests when present",
      "--dry-run                        Preview generated files without writing",
    ],
    examples: [
      "afk configure",
      "afk configure --local",
      "afk configure --from-current",
    ],
  },
  "manifests configure": {
    title: "AFK configure",
    summary: "Alias for afk configure.",
    usage: "afk configure [options]",
    options: [
      "--local                          Write to ./afk/manifests for a defaults repo",
      "--from-current                   Start from existing manifests when present",
      "--dry-run                        Preview generated files without writing",
    ],
    examples: [
      "afk configure",
      "afk configure --local",
      "afk configure --from-current",
    ],
  },
  show: {
    title: "AFK show",
    summary: "Show the current local AFK manifest configuration.",
    usage: "afk show [options]",
    options: [
      "--local                          Show ./afk/manifests instead of global manifests",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--utils                          Show utilities manifest",
      "--hooks                          Show hooks manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk show",
      "afk show --local",
      "afk show --rules --skills",
      "afk show --mcp --utils",
    ],
  },
  "manifests show": {
    title: "AFK show",
    summary: "Alias for afk show.",
    usage: "afk show [options]",
    options: [
      "--local                          Show ./afk/manifests instead of global manifests",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--utils                          Show utilities manifest",
      "--hooks                          Show hooks manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk show",
      "afk show --local",
      "afk show --rules --skills",
      "afk show --mcp --utils",
    ],
  },
  "manifest show": {
    title: "AFK show",
    summary: "Alias for afk show.",
    usage: "afk show [options]",
    options: [
      "--local                          Show ./afk/manifests instead of global manifests",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--utils                          Show utilities manifest",
      "--hooks                          Show hooks manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk show",
      "afk show --local",
      "afk show --rules --skills",
    ],
  },
};

function parseArgs(argv: string[], env: NodeJS.ProcessEnv): ParseResult {
  const args = [...argv];
  const commandPath = readCommandPath(args);
  const key = commandKey(commandPath);
  const agents: AgentId[] = [];
  const selectedSkillAgentIds: SkillAgentId[] = [];
  let dryRun = false;
  let yes = false;
  let setupScope: SetupScope = "global";
  let scopeExplicit = false;
  let includeExternal = false;
  let rulesRef = "main";
  let rulesSource: "manifest" | "github" | "local" = "manifest";
  let initOnly = false;
  let empty = false;
  const refreshDefaults = key === "setup refresh";
  let defaultsSource = "";
  let manifestLocal = false;
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

    if (isManifestConfigureCommand(key) && arg === "--from-current") {
      manifestConfigureFromCurrent = true;
      continue;
    }

    if (isManifestShowCommand(key) && manifestCategoryFlag(arg)) {
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
      if (key === "setup refresh") {
        manifestLocal = true;
        continue;
      }

      if (isManifestConfigureCommand(key)) {
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

    if (arg === "--agent" || arg === "-a") {
      if (isSkillsCommand(key)) {
        const values = readOptionValues(args, index + 1);
        if (values.length === 0) {
          return { help: false, kind: "error", error: "Missing --agent value" };
        }

        for (const value of values) {
          if (!isSkillAgentId(value)) {
            return { help: false, kind: "error", error: `Invalid --agent value for skills: ${value}` };
          }
          selectedSkillAgentIds.push(value);
        }

        index += values.length;
        continue;
      }

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
      selectedSkillAgentIds,
      selectedMcpIds: [],
      selectedUtilIds: [],
      selectedHookIds: [],
      rulesRef,
      rulesSource,
      initOnly,
      empty,
      refreshDefaults,
      defaultsSource,
      manifestLocal,
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
  if (key === "setup rules" || key === "setup rules sync") {
    return "rules";
  }

  if (key === "setup skills" || key === "setup skills install") {
    return "skills";
  }

  if (key === "setup mcps" || key === "setup mcps install") {
    return "mcps";
  }

  if (key === "setup utils" || key === "setup utils install") {
    return "utils";
  }

  if (key === "setup hooks" || key === "setup hooks install") {
    return "hooks";
  }

  return null;
}

function isSkillsCommand(key: string): boolean {
  return key === "setup skills" || key === "setup skills install";
}

function isManifestConfigureCommand(key: string): boolean {
  return key === "configure" || key === "manifests configure";
}

function isManifestShowCommand(key: string): boolean {
  return key === "show" || key === "manifests show" || key === "manifest show";
}

function isSkillAgentId(value: string): value is SkillAgentId {
  return value === "claude-code" || value === "kiro-cli" || value === "kilo" || value === "pi" || value === "droid";
}

function readOptionValues(args: string[], startIndex: number): string[] {
  const values: string[] = [];
  for (let index = startIndex; index < args.length; index += 1) {
    const value = args[index];
    if (!value || value.startsWith("-")) {
      break;
    }
    values.push(value);
  }

  return values;
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
  afk setup refresh [options]
  afk setup rules [options]
  afk setup skills [options]
  afk setup mcps [options]
  afk setup utils [options]
  afk setup hooks [options]
  afk configure [options]
  afk show [options]

Run "afk <command> --help" for command-specific options.

Agents:
  antigravity, claude, codex, cursor-local, opencode

Aliases:
  agy, gemini -> antigravity
  cursor, cursor-ide, cursor-cli -> cursor-local`;
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
    case "--hook":
    case "--hooks":
      return "hooks";
    case "--preset":
    case "--presets":
      return "presets";
    default:
      return null;
  }
}

function renderCommandHelp(help: CommandHelp): string {
  const parts = [
    help.title,
    "",
    help.summary,
    "",
    "Usage:",
    `  ${help.usage}`,
    "",
    "Options:",
    ...help.options.map((option) => `  ${option}`),
  ];

  if (help.subcommands && help.subcommands.length > 0) {
    parts.push("", "Subcommands:", ...help.subcommands.map((subcommand) => `  ${subcommand}`));
  }

  parts.push("", "Examples:", ...help.examples.map((example) => `  ${example}`));

  return parts.join("\n");
}
