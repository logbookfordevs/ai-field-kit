import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAgentId } from "./agents.js";
import { runSetup, runArea } from "./setup.js";
import { runManifestConfigure } from "./manifest-configure.js";
import { runManifestShow } from "./manifest-show.js";
import { runSkillsCommand } from "./skills/commands.js";
import { managedSkillAgents } from "./skills/catalog.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import type {
  AgentId,
  Area,
  CliOptions,
  CommandResult,
  ManifestCategory,
  ManagedSkillAgent,
  Runtime,
  SetupScope,
  SkillAgentMetadata,
  SkillCategorizationMode,
  SkillCategorizationRunner,
  SkillOpenApp,
  SkillsListScope,
  SkillsUpgradeScope,
  SkillAgentId,
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

  if (key === "manifests configure") {
    return runManifestConfigure(runtime, options);
  }

  if (commandPath[0] === "skills") {
    return runSkillsCommand(commandPath, runtime, options);
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
      "open <folder>                     Open SKILL.md or the skill folder",
      "disable <folder>                  Move a global skill into .disabled",
      "enable <folder>                   Move a disabled global skill back to active",
      "rename <folder> <display-name>    Store an AFK display name in afk-skills.json",
      "trash [folder]                    Move one or more global skills to Trash",
      "upgrade [skills...]               Upgrade selected or all tracked skills",
      "categorize                        Create or update afk-skills.json with Codex",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global --json",
      "afk skills disable old-skill --dry-run",
      "afk skills upgrade --all",
      "afk skills categorize --mode append-missing --dry-run",
    ],
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
  "skills rename": {
    title: "AFK skills rename",
    summary: "Store a display name override in ~/.agents/skills/afk-skills.json.",
    usage: "afk skills rename <folder> <display-name> [options]",
    options: [
      "--agent-metadata codex            Also update agents/openai.yaml display_name",
      "--dry-run                         Preview the metadata update without applying it",
    ],
    examples: [
      "afk skills rename afk-note \"AFK Note\" --dry-run",
      "afk skills rename afk-note \"AFK Note\" --agent-metadata codex",
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
      "--manifest-only                   Show only skills from AFK skills.json",
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
      "--hooks                          Show hooks manifest",
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
      "--hooks                          Show hooks manifest",
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
  let skillAgentMetadata: SkillAgentMetadata | undefined;
  let skillCategorizationMode: SkillCategorizationMode | undefined;
  let skillCategorizationRunner: SkillCategorizationRunner = "codex-exec";
  let skillCategorizationInstruction = "";
  const selectedManifestCategories: ManifestCategory[] = [];
  const homeDir = resolveHome(env);
  const repoDir = resolveRepoDir(env);
  const cwd = resolve(process.cwd());
  const isAfkSkillsCommand = commandPath[0] === "skills";

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

    if (isAfkSkillsCommand && arg === "--json") {
      skillsJson = true;
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

    if (arg === "--include-external") {
      includeExternal = true;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--all") {
      if (commandPath[1] !== "upgrade") {
        return { help: false, kind: "error", error: "Unknown option: --all" };
      }
      skillsUpgradeAll = true;
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

    if (isAfkSkillsCommand && arg === "--agent-metadata") {
      const value = args[index + 1];
      if (value !== "codex") {
        return { help: false, kind: "error", error: `Invalid --agent-metadata value: ${value ?? "(missing)"}` };
      }
      skillAgentMetadata = value;
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
      skillAgentMetadata,
      skillCategorizationMode,
      skillCategorizationRunner,
      skillCategorizationInstruction,
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

  if (key === "setup utils" || key === "setup utils install") {
    return "utils";
  }

  if (key === "setup hooks" || key === "setup hooks install") {
    return "hooks";
  }

  return null;
}

function isSetupSkillsCommand(key: string): boolean {
  return key === "setup skills" || key === "setup skills install";
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
  afk setup utils [options]
  afk setup hooks [options]
  afk skills <command> [options]
  afk manifests configure [options]
  afk manifests show [options]

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

  return commandKey(commandPath);
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
