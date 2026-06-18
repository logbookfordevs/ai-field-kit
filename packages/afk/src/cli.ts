import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { normalizeAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { runManifestShow } from "./manifest-show.js";
import { runSkillsCommand } from "./skills/commands.js";
import { managedSkillAgents } from "./skills/catalog.js";
import { runUiCommand } from "./ui.js";
import { selectCompassLobbyRoute, shouldOpenCompassLobby } from "./lobby.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import { packageVersion } from "./update-check.js";
import type {
  AgentId,
  Area,
  CliOptions,
  CommandResult,
  ManifestCategory,
  ManagedSkillAgent,
  Runtime,
  SetupScope,
  SkillAgentId,
  SkillCategorizationMode,
  SkillCategorizationRunner,
  SkillOpenApp,
  SkillsListScope,
  SkillsUpgradeScope,
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
      runtime.io.stdout("\nAFK prompt cancelled. Nothing else was changed from this prompt.");
      return 130;
    }

    throw error;
  }
}

async function runCliWithRuntime(argv: string[], env: NodeJS.ProcessEnv, runtime: Runtime): Promise<number> {
  if (shouldOpenCompassLobby(argv, env)) {
    const route = await selectCompassLobbyRoute(runtime);
    return runCliWithRuntime(route, env, runtime);
  }

  const parsed = parseArgs(argv, env);

  if (parsed.version) {
    runtime.io.stdout(`afk ${packageVersion()}`);
    return 0;
  }

  if (parsed.help) {
    const key = commandKey(parsed.commandPath);
    if (isManifestConfigureCommand(key)) {
      return unavailableManifestConfigure(runtime);
    }
    if (parsed.commandPath && !commandHelps[key]) {
      runtime.io.stderr(`Unknown command: ${key}`);
      runtime.io.stderr(helpText());
      return 1;
    }
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
    return unavailableManifestConfigure(runtime);
  }

  if (commandPath[0] === "skills") {
    return runSkillsCommand(commandPath, runtime, options);
  }

  if (commandPath[0] === "ui") {
    return runUiCommand(commandPath, runtime, options);
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
  verbose: "--verbose                         Show delegated installer output",
  yes: "--yes, -y                         Accept defaults and skip prompts",
  scope: "--scope global|project            Choose machine-wide or current-project setup",
  localScope: "--local                           Alias for --scope project",
  localManifest: "--local                           Refresh ./afk/manifests instead of global manifests",
  agent: "--agent <agent>                   Override detected targets; repeatable",
  source: "--source <source>                 Use a setup source for this run only",
  ref: "--ref <git-ref>                   Git ref for default AFK manifest URLs",
  initOnly: "--init-only                       Create/update local manifests only, then exit",
  empty: "--empty                           Create empty manifests with --init-only or refresh",
  defaultSource: "--default-source <source>         Save a default setup source and exit",
  allSkills: "--all                            Include all skills when installing skills",
};

const setupAreaOptions = [
  setupOptions.dryRun,
  setupOptions.verbose,
  setupOptions.yes,
  setupOptions.scope,
  setupOptions.localScope,
  setupOptions.agent,
  setupOptions.source,
  setupOptions.ref,
  setupOptions.initOnly,
  setupOptions.empty,
  setupOptions.defaultSource,
];

const commandHelps: Record<string, CommandHelp> = {
  setup: {
    title: "AFK setup",
    summary: "Guided setup for rules, skills, MCPs, plugins, and hooks.",
    usage: "afk setup [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.verbose,
      setupOptions.yes,
      setupOptions.scope,
      setupOptions.localScope,
      setupOptions.agent,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.initOnly,
      setupOptions.empty,
      setupOptions.defaultSource,
      setupOptions.allSkills,
    ],
    subcommands: [
      "afk setup refresh                 Refresh global or project-local AFK manifests",
      "afk setup rules                   Sync AFK rules into managed agent rule regions",
      "afk setup skills                  Delegate skill installation to the official skills CLI",
      "afk setup mcps                    Delegate MCP installation to add-mcp",
      "afk setup plugins                   Install optional developer plugins",
      "afk setup hooks                   Merge AFK lifecycle hooks into agent hook configs",
    ],
    examples: [
      "afk setup",
      "afk setup --dry-run",
      "afk setup --local",
      "afk setup --source your-org/dev-kit",
      "afk setup --default-source your-org/dev-kit",
      "afk setup --default-source ./afk/manifests",
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
      setupOptions.defaultSource,
    ],
    examples: [
      "afk setup refresh",
      "afk setup refresh --local",
      "afk setup refresh --source your-org/dev-kit",
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
      setupOptions.allSkills,
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
      setupOptions.allSkills,
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
  "setup plugins": {
    title: "AFK setup plugins",
    summary: "Install optional developer plugins and run supported post-install setup.",
    usage: "afk setup plugins [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup plugins --dry-run",
      "afk setup plugins --yes",
      "afk setup plugins --local --agent opencode",
    ],
  },
  show: {
    title: "AFK show",
    summary: "Show the active AFK setup source manifests.",
    usage: "afk show [options]",
    options: [
      "--source <source>                Show manifests from this setup source",
      "--local                          Show ./afk/manifests instead of the setup source",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--plugins                          Show plugins manifest",
      "--hooks                          Show hooks manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk show",
      "afk show --local",
      "afk show --rules --skills",
      "afk show --mcp --plugins",
    ],
  },
  skills: {
    title: "AFK skills",
    summary: "Inspect and manage local AFK skill libraries.",
    usage: "afk skills <command> [options]",
    options: [
      "list                              List global and project skills",
      "show <folder>                     Show one skill",
      "open <folder>                     Open SKILL.md or the skill folder",
      "disable <folder>                  Move a global skill into .disabled",
      "enable <folder>                   Move a disabled global skill back to active",
      "trash [folder]                    Move one or more global skills to Trash",
      "upgrade [skills...]               Upgrade selected or all tracked skills",
      "categorize                        Create or update skill-catalog.json with Codex",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global --json",
      "afk skills disable old-skill --dry-run",
      "afk skills upgrade --all",
      "afk skills categorize --mode append-missing --dry-run",
    ],
  },
  ui: {
    title: "AFK UI",
    summary: "Delegate UI-focused skill routing to UI Skills.",
    usage: "afk ui [command] [options]",
    options: [
      "start                             Print the UI Skills routing skill",
      "categories                        List UI Skills categories",
      "list [--category <category>]      List UI Skills entries",
      "get <skill>                       Print full skill markdown",
      "--dry-run                         Print the delegated npx command",
    ],
    examples: [
      "afk ui start",
      "afk ui categories",
      "afk ui list --category motion",
      "afk ui get baseline-ui",
    ],
  },
  "ui start": {
    title: "AFK UI start",
    summary: "Delegate to UI Skills and print the routing skill.",
    usage: "afk ui start [options]",
    options: ["--dry-run                         Print the delegated npx command"],
    examples: ["afk ui start", "afk ui start --dry-run"],
  },
  "ui categories": {
    title: "AFK UI categories",
    summary: "Delegate to UI Skills and list available categories.",
    usage: "afk ui categories [options]",
    options: ["--dry-run                         Print the delegated npx command"],
    examples: ["afk ui categories"],
  },
  "ui list": {
    title: "AFK UI list",
    summary: "Delegate to UI Skills and list available UI skills.",
    usage: "afk ui list [options]",
    options: [
      "--category <category>             Limit UI Skills entries by category",
      "--dry-run                         Print the delegated npx command",
    ],
    examples: ["afk ui list", "afk ui list --category motion"],
  },
  "ui get": {
    title: "AFK UI get",
    summary: "Delegate to UI Skills and print full skill markdown.",
    usage: "afk ui get <skill> [options]",
    options: ["--dry-run                         Print the delegated npx command"],
    examples: ["afk ui get baseline-ui"],
  },
  "skills list": {
    title: "AFK skills list",
    summary: "List shared, project, and agent-specific skill roots.",
    usage: "afk skills list [options]",
    options: [
      "--scope global|project|all        Choose which skill roots to list",
      "--agent <agent>                   Limit project or agent roots",
      "--category <id-or-label>          Filter by AFK category",
      "--tag <tag>                       Filter by AFK tag",
      "--platform <platform>             Filter by AFK platform",
      "--uncategorized                   Show records without an AFK category",
      "--json                            Print JSON records",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global",
      "afk skills list --scope global --agent codex",
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
  "skills open": {
    title: "AFK skills open",
    summary: "Open a skill file or folder in Finder or a supported editor.",
    usage: "afk skills open <folder> [options]",
    options: [
      "--file                            Open SKILL.md (default)",
      "--folder                          Open the skill folder",
      "--app finder|code|cursor|zed|agy  Choose the app command",
      "--agent <agent>                   Limit lookup to one agent",
    ],
    examples: [
      "afk skills open afk-note",
      "afk skills open afk-note --folder --app cursor",
    ],
  },
  "skills disable": {
    title: "AFK skills disable",
    summary: "Disable a shared or agent-specific skill by moving it into .disabled.",
    usage: "afk skills disable <folder> [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent <agent>                   Target one agent-specific root",
      "--dry-run                         Preview the move without applying it",
    ],
    examples: [
      "afk skills disable old-skill --dry-run",
      "afk skills disable old-skill",
      "afk skills disable --scope global --agent codex",
      "afk skills disable --scope project --agent claude",
    ],
  },
  "skills enable": {
    title: "AFK skills enable",
    summary: "Enable a shared or agent-specific skill by moving it out of .disabled.",
    usage: "afk skills enable <folder> [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent <agent>                   Target one agent-specific root",
      "--dry-run                         Preview the move without applying it",
    ],
    examples: [
      "afk skills enable old-skill --dry-run",
      "afk skills enable old-skill",
      "afk skills enable --scope global --agent codex",
      "afk skills enable --scope project --agent claude",
    ],
  },
  "skills trash": {
    title: "AFK skills trash",
    summary: "Move one or more shared or agent-specific skill folders to the macOS Trash.",
    usage: "afk skills trash [folder] [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent <agent>                   Target one agent-specific root",
      "--dry-run                         Preview the Trash move without applying it",
      "--yes, -y                         Skip confirmation",
      "--manifest-only                   Show only skills from AFK's setup skills manifest",
    ],
    examples: [
      "afk skills trash",
      "afk skills trash --scope global --agent codex",
      "afk skills trash --scope project --agent claude",
      "afk skills trash --manifest-only",
      "afk skills trash old-skill --dry-run",
      "afk skills trash old-skill --yes",
    ],
  },
  "skills upgrade": {
    title: "AFK skills upgrade",
    summary: "Choose tracked skills with AFK, then delegate updates to the official skills CLI.",
    usage: "afk skills upgrade [skills...] [options]",
    options: [
      "--scope global|project|all        Choose tracked skills to upgrade (default: global)",
      "--all                             Upgrade every tracked skill in the selected scope",
      "--yes, -y                         Forward non-interactive confirmation to skills update",
    ],
    examples: [
      "afk skills upgrade",
      "afk skills upgrade --all",
      "afk skills upgrade --scope project",
      "afk skills upgrade frontend-design web-design-guidelines",
    ],
  },
  "skills categorize": {
    title: "AFK skills categorize",
    summary: "Create or update ~/.agents/afk/skill-catalog.json with Codex exec.",
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
  "manifests show": {
    title: "AFK show",
    summary: "Alias for afk show.",
    usage: "afk show [options]",
    options: [
      "--source <source>                Show manifests from this setup source",
      "--local                          Show ./afk/manifests instead of the setup source",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--plugins                          Show plugins manifest",
      "--hooks                          Show hooks manifest",
      "--presets                        Show presets manifest",
    ],
    examples: [
      "afk show",
      "afk show --local",
      "afk show --rules --skills",
      "afk show --mcp --plugins",
    ],
  },
  "manifest show": {
    title: "AFK show",
    summary: "Alias for afk show.",
    usage: "afk show [options]",
    options: [
      "--source <source>                Show manifests from this setup source",
      "--local                          Show ./afk/manifests instead of the setup source",
      "--rules                          Show rules manifest",
      "--skills                         Show skills manifest",
      "--mcp, --mcps                    Show MCP manifest",
      "--plugins                          Show plugins manifest",
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
  let verbose = false;
  let yes = false;
  let setupScope: SetupScope = "global";
  let scopeExplicit = false;
  let allSkills = false;
  let rulesRef = "main";
  let rulesSource: "manifest" | "github" | "local" = "manifest";
  let initOnly = false;
  let empty = false;
  const refreshDefaults = key === "setup refresh";
  let defaultsSource = "";
  let defaultsSourceExplicit = false;
  let defaultSourceUpdate = "";
  let manifestLocal = false;
  let manifestConfigureLocal = false;
  let manifestConfigureFromCurrent = false;
  let skillsListScope: SkillsListScope = "all";
  let skillsUpgradeScope: SkillsUpgradeScope = "global";
  let skillsUpgradeAll = false;
  let skillsTrashManifestOnly = false;
  let skillsAgent: ManagedSkillAgent | undefined;
  let skillsJson = false;
  let skillsCategory = "";
  let skillsTag = "";
  let skillsPlatform = "";
  let skillsUncategorized = false;
  let skillOpenApp: SkillOpenApp = "finder";
  let skillOpenTarget: "file" | "folder" = "file";
  let skillCategorizationMode: SkillCategorizationMode | undefined;
  let skillCategorizationRunner: SkillCategorizationRunner = "codex-exec";
  let skillCategorizationInstruction = "";
  let uiCategory = "";
  const selectedManifestCategories: ManifestCategory[] = [];
  const homeDir = resolveHome(env);
  const repoDir = resolveRepoDir(env);
  const cwd = resolve(process.cwd());
  const isAfkSkillsCommand = commandPath[0] === "skills";
  const isAfkUiCommand = commandPath[0] === "ui";

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

    if (isAfkSkillsCommand && arg === "--json") {
      skillsJson = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
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

      if (isManifestShowCommand(key)) {
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
      if (isAfkSkillsCommand) {
        if (commandPath[1] === "upgrade") {
          if (value !== "global" && value !== "project" && value !== "all") {
            return { help: false, kind: "error", error: `Invalid --scope value: ${value ?? "(missing)"}` };
          }
          skillsUpgradeScope = value;
          index += 1;
          continue;
        }

        if (value !== "global" && value !== "project" && value !== "all") {
          return { help: false, kind: "error", error: `Invalid --scope value: ${value ?? "(missing)"}` };
        }
        skillsListScope = value;
        scopeExplicit = true;
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

    if (isAfkSkillsCommand && arg === "--all") {
      if (commandPath[1] !== "upgrade") {
        return { help: false, kind: "error", error: "Unknown option: --all" };
      }
      skillsUpgradeAll = true;
      continue;
    }

    if (arg === "--all") {
      allSkills = true;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--manifest-only") {
      if (commandPath[1] !== "trash") {
        return { help: false, kind: "error", error: "Unknown option: --manifest-only" };
      }
      skillsTrashManifestOnly = true;
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

    if (arg === "--default-source" || arg === "--defaults-source") {
      const value = args[index + 1];
      const trimmedValue = value?.trim();
      if (!trimmedValue) {
        return { help: false, kind: "error", error: `Missing ${arg} value` };
      }
      defaultSourceUpdate = trimmedValue;
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
      const trimmedValue = value?.trim();
      if (!trimmedValue) {
        return { help: false, kind: "error", error: "Missing --source value" };
      }
      defaultsSource = trimmedValue;
      defaultsSourceExplicit = true;
      if (trimmedValue === "github" || trimmedValue === "local") {
        rulesSource = trimmedValue;
        if (trimmedValue === "github") {
          defaultsSource = "";
        }
      }
      index += 1;
      continue;
    }

    if (arg === "--agent" || arg === "-a") {
      if (isSetupSkillsCommand(key)) {
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
      if (isAfkSkillsCommand) {
        if (!value || !isManagedSkillAgent(value)) {
          return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
        }
        skillsAgent = value;
        index += 1;
        continue;
      }

      const agent = value ? normalizeAgentId(value) : null;
      if (!agent) {
        return { help: false, kind: "error", error: `Invalid --agent value: ${value ?? "(missing)"}` };
      }
      agents.push(agent);
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--category") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --category value" };
      }
      skillsCategory = value;
      index += 1;
      continue;
    }

    if (isAfkUiCommand && arg === "--category") {
      if (commandPath[1] !== "list") {
        return { help: false, kind: "error", error: "Unknown option: --category" };
      }

      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --category value" };
      }
      uiCategory = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--tag") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --tag value" };
      }
      skillsTag = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--platform") {
      const value = args[index + 1];
      if (!value) {
        return { help: false, kind: "error", error: "Missing --platform value" };
      }
      skillsPlatform = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--uncategorized") {
      skillsUncategorized = true;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--file") {
      skillOpenTarget = "file";
      continue;
    }

    if (isAfkSkillsCommand && arg === "--folder") {
      skillOpenTarget = "folder";
      continue;
    }

    if (isAfkSkillsCommand && arg === "--app") {
      const value = args[index + 1];
      if (!value || !isSkillOpenApp(value)) {
        return { help: false, kind: "error", error: `Invalid --app value: ${value ?? "(missing)"}` };
      }
      skillOpenApp = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--mode") {
      const value = args[index + 1];
      if (value !== "append-missing" && value !== "recategorize-all") {
        return { help: false, kind: "error", error: `Invalid --mode value: ${value ?? "(missing)"}` };
      }
      skillCategorizationMode = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--runner") {
      const value = args[index + 1];
      if (value !== "codex-exec") {
        return { help: false, kind: "error", error: `Invalid --runner value: ${value ?? "(missing)"}` };
      }
      skillCategorizationRunner = value;
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--instruction") {
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
      verbose,
      yes,
      allSkills,
      selectedSkillIds: [],
      selectedSkillAgentIds,
      selectedMcpIds: [],
      selectedPluginIds: [],
      selectedHookIds: [],
      rulesRef,
      rulesSource,
      initOnly,
      empty,
      refreshDefaults,
      defaultsSource,
      defaultsSourceExplicit,
      defaultSourceUpdate,
      manifestLocal,
      manifestConfigureLocal,
      manifestConfigureFromCurrent,
      skillsListScope,
      skillsUpgradeAll,
      skillsUpgradeScope,
      skillsTrashManifestOnly,
      skillsAgent,
      skillsJson,
      skillsCategory,
      skillsTag,
      skillsPlatform,
      skillsUncategorized,
      skillOpenApp,
      skillOpenTarget,
      skillCategorizationMode,
      skillCategorizationRunner,
      skillCategorizationInstruction,
      uiCategory,
      selectedManifestCategories,
      homeDir,
      repoDir,
      cwd,
    },
  };
}

function isManagedSkillAgent(value: string): value is ManagedSkillAgent {
  return managedSkillAgents().includes(value as ManagedSkillAgent);
}

function isSkillOpenApp(value: string): value is SkillOpenApp {
  return value === "finder" || value === "code" || value === "cursor" || value === "zed" || value === "agy";
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

  if (key === "setup plugins") {
    return "plugins";
  }

  if (key === "setup hooks" || key === "setup hooks install") {
    return "hooks";
  }

  return null;
}

function isSetupSkillsCommand(key: string): boolean {
  return key === "setup skills" || key === "setup skills install";
}

function isManifestConfigureCommand(key: string): boolean {
  return key === "configure" || key === "manifests configure";
}

function isManifestShowCommand(key: string): boolean {
  return key === "show" || key === "manifests show" || key === "manifest show";
}

function unavailableManifestConfigure(runtime: Runtime): number {
  runtime.io.stderr("AFK configure is not available for source-backed setup yet.");
  runtime.io.stderr("Use afk show to inspect the active setup source. To change manifests, edit the configured source repository directly for now.");
  return 1;
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

function spawnCommand(command: string, args: string[], cwd?: string, behavior: { verbose: boolean } = { verbose: false }): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio: behavior.verbose ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: false,
    });

    child.stdout?.resume();
    child.stderr?.resume();
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
  afk --version
  afk setup [options]
  afk setup refresh [options]
  afk setup rules [options]
  afk setup skills [options]
  afk setup mcps [options]
  afk setup plugins [options]
  afk setup hooks [options]
  afk skills <command> [options]
  afk ui <command> [options]
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

function helpKey(commandPath: string[] = []): string {
  if (commandPath[0] === "skills" && commandPath[1]) {
    return commandPath.slice(0, 2).join(" ");
  }

  if (commandPath[0] === "ui" && commandPath[1]) {
    return commandPath.slice(0, 2).join(" ");
  }

  return commandKey(commandPath);
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
    case "--plugins":
      return "plugins";
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
