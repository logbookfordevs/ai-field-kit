import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { normalizeAgentId } from "./agents.js";
import { runCatalogImport } from "./catalog-import.js";
import { runSetup, runArea } from "./setup.js";
import { runRefresh } from "./refresh.js";
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

  if (isRefreshCommand(key)) {
    return runRefresh(runtime, options);
  }

  if (isCatalogImportCommand(key)) {
    return runCatalogImport(runtime, options);
  }

  if (options.defaultSourceUpdate) {
    runtime.io.stderr("--default-source is only supported with afk refresh.");
    runtime.io.stderr("Use --source for one command, or run afk refresh --default-source <source> to save and refresh.");
    return 1;
  }

  if (key === "setup") {
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
  localManifest: "--local                           Refresh ./afk/catalog instead of the global catalog",
  localCatalog: "--local                           Write ./afk/catalog and prefer ./.agents/skills when available",
  agent: "--agent <agent>                   Override detected targets; repeatable",
  source: "--source <source>                 Use a catalog source for this run only",
  ref: "--ref <git-ref>                   Git ref for default AFK catalog URLs",
  initOnly: "--init-only                       Create/update the local catalog only, then exit",
  empty: "--empty                           Create empty catalog files with --init-only or refresh",
  defaultSource: "--default-source <source>         Save the default source and refresh the cache",
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
      setupOptions.allSkills,
    ],
    subcommands: [
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
    ],
  },
  refresh: {
    title: "AFK refresh",
    summary: "Refresh cached AFK catalog files from the remembered or selected source.",
    usage: "afk refresh [category...] [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.localManifest,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.empty,
      setupOptions.defaultSource,
    ],
    examples: [
      "afk refresh",
      "afk refresh skills",
      "afk refresh --local",
      "afk refresh --source your-org/dev-kit",
      "afk refresh --default-source your-org/dev-kit",
    ],
  },
  "setup refresh": {
    title: "AFK refresh",
    summary: "Deprecated alias for afk refresh.",
    usage: "afk refresh [category...] [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.localManifest,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.empty,
      setupOptions.defaultSource,
    ],
    examples: [
      "afk refresh",
      "afk refresh skills",
      "afk refresh --source your-org/dev-kit",
      "afk refresh --default-source your-org/dev-kit",
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
    summary: "Show the cached AFK catalog, or inspect a source with --source.",
    usage: "afk show [category...] [options]",
    options: [
      "--source <source>                Show catalog files from this source",
      "--local                          Show ./afk/catalog instead of the global cache",
      "--react                          Show skills as a React-style composition tree",
      "--visualize                      Write a self-contained skills composition HTML file",
    ],
    examples: [
      "afk show",
      "afk show skills",
      "afk show skills --react",
      "afk show skills --visualize",
      "afk show skills mcps",
      "afk show --local",
      "afk show skills --source your-org/dev-kit",
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
    usage: "afk show [category...] [options]",
    options: [
      "--source <source>                Show catalog files from this source",
      "--local                          Show ./afk/catalog instead of the global cache",
      "--react                          Show skills as a React-style composition tree",
      "--visualize                      Write a self-contained skills composition HTML file",
    ],
    examples: [
      "afk show",
      "afk show skills",
      "afk show skills --react",
      "afk show skills --visualize",
      "afk show skills mcps",
      "afk show --local",
      "afk show skills --source your-org/dev-kit",
    ],
  },
  "manifest show": {
    title: "AFK show",
    summary: "Alias for afk show.",
    usage: "afk show [category...] [options]",
    options: [
      "--source <source>                Show catalog files from this source",
      "--local                          Show ./afk/catalog instead of the global cache",
      "--react                          Show skills as a React-style composition tree",
      "--visualize                      Write a self-contained skills composition HTML file",
    ],
    examples: [
      "afk show",
      "afk show skills",
      "afk show skills --react",
      "afk show skills --visualize",
      "afk show skills mcps",
      "afk show --local",
      "afk show skills --source your-org/dev-kit",
    ],
  },
  "catalog import": {
    title: "AFK catalog import",
    summary: "Backfill missing skills catalog entries from installed skills with skills CLI lock metadata.",
    usage: "afk catalog import [options]",
    options: [
      setupOptions.dryRun,
      setupOptions.localCatalog,
    ],
    examples: [
      "afk catalog import",
      "afk catalog import --dry-run",
      "afk catalog import --local",
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
  const refreshDefaults = isRefreshCommand(key);
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
  let manifestShowReact = false;
  let manifestShowVisualize = false;
  const manifestCategories = manifestCategoriesFromCommandPath(commandPath);
  if (manifestCategories.kind === "error") {
    return { help: false, kind: "error", error: manifestCategories.error };
  }
  const selectedManifestCategories: ManifestCategory[] = manifestCategories.categories;
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
    return { help: true, commandPath: isManifestShowCommand(key) ? ["show"] : isRefreshCommand(key) ? ["refresh"] : commandPath };
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
      if (isRefreshCommand(key)) {
        manifestLocal = true;
        continue;
      }

      if (isManifestShowCommand(key) || isCatalogImportCommand(key)) {
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

    if (arg === "--react") {
      if (!isManifestShowCommand(key)) {
        return { help: false, kind: "error", error: "Unknown option: --react" };
      }

      manifestShowReact = true;
      continue;
    }

    if (arg === "--visualize") {
      if (!isManifestShowCommand(key)) {
        return { help: false, kind: "error", error: "Unknown option: --visualize" };
      }

      manifestShowVisualize = true;
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
      manifestShowReact,
      manifestShowVisualize,
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
  return key === "show" ||
    key.startsWith("show ") ||
    key === "manifests show" ||
    key.startsWith("manifests show ") ||
    key === "manifest show" ||
    key.startsWith("manifest show ");
}

function isRefreshCommand(key: string): boolean {
  return key === "refresh" || key.startsWith("refresh ") || key === "setup refresh";
}

function isCatalogImportCommand(key: string): boolean {
  return key === "catalog import";
}

function unavailableManifestConfigure(runtime: Runtime): number {
  runtime.io.stderr("AFK configure is not available for source-backed setup yet.");
  runtime.io.stderr("Use afk show to inspect the local catalog, or afk show --source <source> to inspect a source directly.");
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
  afk refresh [category...] [options]
  afk setup [options]
  afk setup rules [options]
  afk setup skills [options]
  afk setup mcps [options]
  afk setup plugins [options]
  afk setup hooks [options]
  afk skills <command> [options]
  afk ui <command> [options]
  afk catalog import [options]
  afk show [category...] [options]

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

  if (commandPath[0] === "show") {
    return "show";
  }

  if (commandPath[0] === "refresh") {
    return "refresh";
  }

  if (commandPath[0] === "manifests" && commandPath[1] === "show") {
    return "manifests show";
  }

  if (commandPath[0] === "manifest" && commandPath[1] === "show") {
    return "manifest show";
  }

  return commandKey(commandPath);
}

function manifestCategoriesFromCommandPath(commandPath: string[]): { kind: "ok"; categories: ManifestCategory[] } | { kind: "error"; error: string } {
  const args = manifestCategoryArgs(commandPath);
  if (!args) {
    return { kind: "ok", categories: [] };
  }

  const categories: ManifestCategory[] = [];
  for (const arg of args) {
    const category = manifestCategory(arg);
    if (!category) {
      return { kind: "error", error: `Unknown catalog category: ${arg}` };
    }
    if (!categories.includes(category)) {
      categories.push(category);
    }
  }

  return { kind: "ok", categories };
}

function manifestCategoryArgs(commandPath: string[]): string[] | null {
  if (commandPath[0] === "show") {
    return commandPath.slice(1);
  }

  if (commandPath[0] === "refresh") {
    return commandPath.slice(1);
  }

  if (commandPath[0] === "manifests" && commandPath[1] === "show") {
    return commandPath.slice(2);
  }

  if (commandPath[0] === "manifest" && commandPath[1] === "show") {
    return commandPath.slice(2);
  }

  return null;
}

function manifestCategory(arg: string): ManifestCategory | null {
  switch (arg) {
    case "rule":
    case "rules":
      return "rules";
    case "skill":
    case "skills":
      return "skills";
    case "mcp":
    case "mcps":
      return "mcps";
    case "plugin":
    case "plugins":
      return "plugins";
    case "hook":
    case "hooks":
      return "hooks";
    case "preset":
    case "presets":
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
