import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { normalizeAgentId } from "./agents.js";
import { runCatalogImport, runCatalogImportStatus } from "./catalog-import.js";
import { runSetup, runArea } from "./setup.js";
import { runRefresh } from "./refresh.js";
import { runManifestShow } from "./manifest-show.js";
import { runManifestConfigureArea, runManifestConfigureAreaAction, type ManifestAction, type ManifestArea } from "./manifest-configure.js";
import { runCatalogProfilesCommand, runSkillsCommand } from "./skills/commands.js";
import { runCatalogDoctor } from "./catalog-doctor.js";
import { managedSkillAgents } from "./skills/catalog.js";
import { runUiCommand } from "./ui.js";
import { selectCatalogSkillsLobbyRoute, selectCompassLobbyRoute, shouldOpenCompassLobby } from "./lobby.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import { packageVersion, runUpdateCommand } from "./update-check.js";
import { runAfkOpen } from "./open.js";
import { isPromptExit } from "./menu.js";
import { buildToolUpdateCommands, runDelegateCommands } from "./delegates.js";
import { selectToolUpdates } from "./interactive.js";
import type {
  AgentId,
  Area,
  CliOptions,
  CommandResult,
  ManifestCategory,
  SkillAgentFilter,
  Runtime,
  SetupScope,
  SkillAgentId,
  SkillCategorizationMode,
  SkillCategorizationRunner,
  SkillOpenApp,
  SkillProfileMode,
  SkillsListAutoInvocation,
  SkillsListScope,
  SkillsListStorage,
  SkillsUpdateScope,
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

    runtime.io.stderr(`AFK could not complete the command:\n${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

export async function runCliWithRuntime(argv: string[], env: NodeJS.ProcessEnv, runtime: Runtime): Promise<number> {
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
    if (parsed.commandPath && !commandHelps[helpKey(parsed.commandPath)]) {
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

  if (key === "open") {
    return runAfkOpen(runtime, options);
  }

  if (key === "doctor") {
    return runCatalogDoctor(runtime, options);
  }
  if (isCatalogAreaCommand(commandPath)) {
    return runCatalogAreaCommand(commandPath, runtime, options);
  }

  if (key === "skills catalog") {
    const route = await selectCatalogSkillsLobbyRoute(runtime);
    if (!route) {
      return 0;
    }

    return runCatalogAreaCommand(["skills", "catalog", ...route.slice(2)], runtime, options);
  }

  if (commandPath[0] === "skills" && commandPath[1] === "catalog") {
    return runCatalogAreaCommand(commandPath, runtime, options);
  }

  if (commandPath[0] === "profiles" && commandPath[1] === "catalog" && ["set-mode", "toggle-always-on"].includes(commandPath[2] ?? "")) {
    return runCatalogAreaCommand(commandPath, runtime, options);
  }

  if (isCatalogProfilesCommand(key)) {
    return runCatalogProfilesCommand(commandPath.slice(2), runtime, options);
  }

  if (isCliUpdateCommand(key)) {
    return runUpdateCommand(runtime, options);
  }

  if (options.defaultSourceUpdate) {
    runtime.io.stderr("--default-source is only supported with afk refresh.");
    runtime.io.stderr("Use --source for one command, or run afk refresh --default-source <source> to save and refresh.");
    return 1;
  }

  if (key === "setup" || isPresetSetupCommand(commandPath)) {
    return runSetupCommand(commandPath, runtime, options);
  }

  if (commandPath[0] === "skills") {
    return runSkillsCommand(commandPath, runtime, options);
  }

  if (commandPath[0] === "tools" && commandPath[1] === "update") {
    const requestedToolIds = commandPath.slice(2);
    const selectedToolIds = requestedToolIds.length > 0
      ? requestedToolIds
      : await selectToolUpdates(options);
    const commands = buildToolUpdateCommands(options, selectedToolIds);
    if (commands.length === 0) {
      runtime.io.stdout("No updateable tools selected. No changes planned.");
      return 0;
    }

    return runDelegateCommands(runtime, commands, {
      ...options,
      continueOnError: true,
    });
  }

  if (commandPath[0] === "ui") {
    return runUiCommand(commandPath, runtime, options);
  }

  if (isManifestShowCommand(key)) {
    return runManifestShow(runtime, options);
  }

  const area = commandToArea(commandPath);
  if (area) {
    return runSetupCommand(commandPath, runtime, options);
  }

  runtime.io.stderr(`Unknown command: ${key || "(none)"}`);
  runtime.io.stderr(helpText());
  return 1;
}

export { isPromptExit };

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
  notes?: string[];
  options: string[];
  subcommands?: string[];
  examples: string[];
};

const setupOptions = {
  refresh: "--refresh                         Refresh the matching catalog scope before setup",
  dryRun: "--dry-run                         Preview changes without applying them",
  verbose: "--verbose                         Show delegated installer output",
  catalogVerbose: "--verbose                         Show complete JSON for catalog editor previews",
  yes: "--yes, -y                         Accept defaults and skip prompts",
  scope: "--scope global|project            Choose machine-wide or current-project setup",
  localScope: "--local                           Alias for --scope project",
  localManifest: "--local                           Refresh ./afk/catalog instead of the global catalog",
  localCatalog: "--local                           Write ./afk/catalog and prefer ./.agents/skills when available",
  agent: "--agent <agent>                   Override detected targets; repeatable",
  source: "--source <source>                 Merge applied source entries, without remembering the source",
  preset: "--preset <id>                     Install one catalog preset as a required bundle",
  ref: "--ref <git-ref>                   Git ref for default AFK catalog URLs",
  initOnly: "--init-only                       Create/update the local catalog only, then exit",
  empty: "--empty                           Create empty catalog files with --init-only or refresh",
  defaultSource: "--default-source <source>         Save the default source and refresh the cache",
  overrideRefresh: "--override                        Replace targeted catalog files instead of merging",
  allSkills: "--all                            Include imported skills when installing skills",
  customAgent: "--custom-agent <id>             Select a Custom Agent; repeatable",
  allCustomAgents: "--all                            Select every cataloged Custom Agent",
};

const setupAreaOptions = [
  setupOptions.refresh,
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
  open: {
    title: "AFK open",
    summary: "Open the user AFK folder.",
    usage: "afk open",
    options: ["--code                            Open in VS Code instead of Finder"],
    examples: ["afk open", "afk open --code"],
  },
  doctor: {
    title: "AFK doctor",
    summary: "Validate the attributes and structure of every local AFK catalog file.",
    usage: "afk doctor [options]",
    notes: ["Checks the global catalog by default. Pass --local to check ./afk/catalog."],
    options: ["--local                           Validate ./afk/catalog instead of the global catalog"],
    examples: ["afk doctor", "afk doctor --local"],
  },
  setup: {
    title: "AFK setup",
    summary: "Guided setup for rules, skills, profiles, Custom Agents, MCPs, tools, and hooks.",
    usage: "afk setup [options]",
    notes: [
      "Use this when you want AFK to prepare agent-facing surfaces on this machine or in the current project.",
      "Pass --source to merge and apply selected source entries without changing the remembered source.",
      "Use afk setup --all --yes to install every cataloged item non-interactively for detected harnesses.",
    ],
    options: [
      setupOptions.refresh,
      setupOptions.dryRun,
      setupOptions.verbose,
      setupOptions.yes,
      setupOptions.scope,
      setupOptions.localScope,
      setupOptions.agent,
      setupOptions.source,
      setupOptions.preset,
      setupOptions.ref,
      setupOptions.initOnly,
      setupOptions.empty,
      setupOptions.allSkills,
      setupOptions.customAgent,
    ],
    subcommands: [
      "afk setup rules                   Sync AFK rules into managed agent rule regions",
      "afk setup skills                  Delegate skill installation to the official skills CLI",
      "afk setup profiles                Install skills from Skills Profiles",
      "afk setup agents                  Provision portable Custom Agents",
      "afk setup mcps                    Delegate MCP installation to add-mcp",
      "afk setup tools                   Install optional developer tools",
      "afk setup hooks                   Merge AFK lifecycle hooks into agent hook configs",
    ],
    examples: [
      "afk setup",
      "afk setup --dry-run",
      "afk setup --local",
      "afk setup --source your-org/dev-kit",
      "afk setup --preset afk-architect",
      "afk setup --all --yes",
    ],
  },
  preset: {
    title: "AFK preset",
    summary: "Choose and apply a preset from the cached or selected AFK catalog.",
    usage: "afk preset [id] [options]",
    notes: [
      "Without an id, AFK opens a menu of presets from the current cache or --source.",
      "This is a shortcut for afk setup preset.",
    ],
    options: setupAreaOptions,
    examples: [
      "afk preset",
      "afk preset daily-routine",
      "afk preset afk-architect",
      "afk preset --source your-org/dev-kit",
    ],
  },
  "setup preset": {
    title: "AFK setup preset",
    summary: "Choose and apply a preset from the cached or selected AFK catalog.",
    usage: "afk setup preset [id] [options]",
    notes: [
      "Without an id, AFK opens a menu of presets from the current cache or --source.",
      "The --preset <id> setup flag remains available for compatibility.",
    ],
    options: setupAreaOptions,
    examples: [
      "afk setup preset",
      "afk setup preset daily-routine",
      "afk setup preset afk-architect",
      "afk setup preset --source your-org/dev-kit",
    ],
  },
  refresh: {
    title: "AFK refresh",
    summary: "Refresh cached AFK catalog files from the remembered or selected source.",
    usage: "afk refresh [category...] [options]",
    notes: [
      "Use refresh when you want the local catalog cache to change.",
      "Use --source for a one-off refresh source; use --default-source to save the source for future setup/show runs.",
      "Override removes local-only entries from targeted files and requires two confirmations unless --dry-run is active.",
    ],
    options: [
      setupOptions.dryRun,
      setupOptions.localManifest,
      setupOptions.source,
      setupOptions.ref,
      setupOptions.empty,
      setupOptions.defaultSource,
      setupOptions.overrideRefresh,
    ],
    examples: [
      "afk refresh",
      "afk refresh skills",
      "afk refresh --local",
      "afk refresh --source your-org/dev-kit",
      "afk refresh --default-source your-org/dev-kit",
      "afk refresh --override",
    ],
  },
  update: {
    title: "AFK update",
    summary: "Update the AFK CLI from the latest GitHub release.",
    usage: "afk update [options]",
    notes: [
      "Runs the hosted AFK installer so the same release asset flow handles fresh installs and updates.",
    ],
    options: [
      setupOptions.dryRun,
    ],
    examples: [
      "afk update",
      "afk update --dry-run",
    ],
  },
  tools: {
    title: "AFK tools",
    summary: "Manage cataloged developer tools.",
    usage: "afk tools <command> [options]",
    options: [],
    subcommands: [
      "afk tools update                  Select and run cataloged tool update commands",
    ],
    examples: ["afk tools update"],
  },
  "tools update": {
    title: "AFK tools update",
    summary: "Select cataloged tools and run their update commands.",
    usage: "afk tools update [tool...] [options]",
    notes: ["Only tools with an update command in tools.json are available."],
    options: [setupOptions.dryRun, setupOptions.verbose],
    examples: [
      "afk tools update",
      "afk tools update --dry-run",
      "afk tools update plannotator yggtree",
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
    summary: "Sync AFK rules and dependency files into managed locations.",
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
    summary: "Sync AFK rules and dependency files into managed locations.",
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
    notes: [
      "Setup considers source-owned catalog skills by default; imported skills are excluded.",
      "--all includes imported skills and makes non-interactive installs include every catalog skill.",
    ],
    options: [
      ...setupAreaOptions,
      setupOptions.allSkills,
    ],
    examples: [
      "afk setup skills --dry-run",
      "afk setup skills --yes",
      "afk setup skills --local --agent claude-code",
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
      "afk setup skills --local --agent claude-code",
    ],
  },
  "setup profiles": {
    title: "AFK setup profiles",
    summary: "Install skills from selected profiles in profiles.json.",
    usage: "afk setup profiles [options]",
    notes: [
      "Setup refreshes profiles.json, offers its profiles for selection, and installs the selected profile skills.",
      "When a selected skill composes other skills, setup warns and automatically includes their composed dependencies.",
      "If referenced skills are unavailable, setup offers lock-backed recovery, then asks before installing the available skills; --yes accepts.",
      "Use afk skills profiles enable to apply an installed profile at runtime.",
    ],
    options: setupAreaOptions,
    examples: [
      "afk setup profiles --dry-run",
      "afk setup profiles --yes",
      "afk setup profiles --local",
    ],
  },
  "setup agents": {
    title: "AFK setup agents",
    summary: "Provision selected portable Custom Agents into Codex, Claude Code, or Pi.",
    usage: "afk setup agents [options]",
    notes: [
      "Custom Agents start unselected. Use --custom-agent repeatedly or --all for non-interactive setup.",
      "--yes confirms the operation; it never selects Custom Agents.",
      "Pi requires pi-subagents. AFK suggests its install command but does not install it.",
    ],
    options: [
      ...setupAreaOptions,
      setupOptions.customAgent,
      setupOptions.allCustomAgents,
    ],
    examples: [
      "afk setup agents",
      "afk setup agents --custom-agent notion-assistant --agent codex --yes",
      "afk setup agents --all --agent claude --agent pi --yes",
      "afk setup agents --local --all",
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
  "setup tools": {
    title: "AFK setup tools",
    summary: "Install optional developer tools and run supported post-install setup.",
    usage: "afk setup tools [options]",
    options: setupAreaOptions,
    examples: [
      "afk setup tools --dry-run",
      "afk setup tools --yes",
      "afk setup tools --local --agent opencode",
    ],
  },
  show: {
    title: "AFK show",
    summary: "Show the cached AFK catalog, or inspect a source with --source.",
    usage: "afk show [category...] [options]",
    notes: [
      "Use show when you want to inspect catalog data without installing or refreshing it.",
      "Without --source, show reads the local cache. With --source, it inspects that source for this run only.",
    ],
    options: [
      "--source <source>                Show catalog files from this source",
      "--local                          Show ./afk/catalog instead of the global cache",
      "--react                          Show skills as a React-style composition tree",
      "--visualize                      Write a self-contained skills composition HTML file",
    ],
    examples: [
      "afk show",
      "afk show skills",
      "afk show profiles",
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
      "list                              List shared global skills or an explicit agent root",
      "show <folder>                     Show one skill",
      "get <folder>                      Print one local skill as agent context",
      "open <folder>                     Open SKILL.md or the skill folder",
      "add <source> [flags...]           Delegate to skills add, then sync the AFK catalog",
      "disable <folder>                  Move a global skill into .disabled",
      "enable <folder>                   Move a disabled global skill back to active",
      "invocation [disable|enable] [folder] Toggle auto invocation metadata",
      "delete [folder]                   Permanently delete one or more skills",
      "update [skills...]                Update selected or all cataloged tracked skills",
      "profiles <command>                Manage skill focus profiles",
      "categorize                        Create or update skills.json categories with Codex",
    ],
    examples: [
      "afk skills list",
      "afk skills add logbookfordevs/ai-field-kit --skill afk-compass --yes",
      "afk skills list --scope global --json",
      "afk skills list --disabled",
      "afk skills disable old-skill --dry-run",
      "afk skills invocation disable afk-doc-craft",
      "afk skills update --all",
      "afk skills categorize --mode append-missing --dry-run",
    ],
  },
  "skills add": {
    title: "AFK skills add",
    summary: "Install into the shared global library, optionally fan out to registered agents, then sync AFK's catalog.",
    usage: "afk skills add <source> [skills add flags...]",
    notes: [
      "AFK always adds the shared global target before forwarding supported flags to the official skills CLI.",
      "After a successful install, AFK imports new shared skills into ~/.agents/afk/catalog/skills.json as imported and uncategorized.",
      "Custom agent paths apply to AFK-owned inspection and mutation commands, not skills add.",
    ],
    options: [
      "--skill <skill>                   Forwarded to skills add",
      "--global                          Accepted as an explicit form of AFK's default",
      "--yes, -y                         Forwarded to skills add",
      "--agent <agent>                   Forwarded to skills add when supported upstream",
      "--profile <profile>               AFK: add imported skills to a new or existing profile",
      "--profile-only <profile>          AFK: add imported skills to a profile and disabled storage",
      "--start-disabled                  AFK: import new skills as disabled and move shared folders into .disabled",
    ],
    examples: [
      "afk skills add logbookfordevs/ai-field-kit --skill afk-compass --yes",
      "afk skills add https://github.com/mattpocock/skills --skill tdd --agent codex",
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
    summary: "List enabled shared global skills by default or one explicit agent root.",
    usage: "afk skills list [options]",
    options: [
      "--scope global|project|all        Choose a preset agent scope; shared defaults to global",
      "--agent <agent>|custom            Select one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--enabled                         Show enabled skills only (default)",
      "--disabled                        Show disabled skills only",
      "--auto-invocation <state>         Filter by enabled, disabled, mixed, or default",
      "--category <id-or-label>          Filter by AFK category",
      "--tag <tag>                       Filter by AFK tag",
      "--uncategorized                   Show records without an AFK category",
      "--json                            Print JSON records",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global",
      "afk skills list --enabled",
      "afk skills list --disabled",
      "afk skills list --auto-invocation disabled",
      "afk skills list --scope global --agent codex",
      "afk skills list --scope project --agent codex",
      "afk skills list --agent custom --agent-path ~/.my-agent/skills",
    ],
  },
  "skills show": {
    title: "AFK skills show",
    summary: "Show details for one enabled skill by default.",
    usage: "afk skills show <folder> [options]",
    options: [
      "--scope global|project|all        Choose the preset agent scope",
      "--agent <agent>|custom            Select one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--enabled                         Show enabled skills only (default)",
      "--disabled                        Show disabled skills only",
      "--json                            Print JSON record",
    ],
    examples: [
      "afk skills show afk-note",
      "afk skills show afk-note --json",
    ],
  },
  "skills get": {
    title: "AFK skills get",
    summary: "Print one local skill as agent context, including disabled skills.",
    usage: "afk skills get <folder> [options]",
    options: [
      "--scope global|project|all        Choose which skill roots to search",
      "--agent <agent>|custom            Select one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
    ],
    examples: [
      "afk skills get motion-graphics",
      "afk skills get afk-note --agent custom --agent-path ~/.my-agent/skills",
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
      "--scope global|project|all        Choose the preset agent scope",
      "--agent <agent>|custom            Select one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
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
      "--agent <agent>|custom            Target one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
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
      "--agent <agent>|custom            Target one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--dry-run                         Preview the move without applying it",
    ],
    examples: [
      "afk skills enable old-skill --dry-run",
      "afk skills enable old-skill",
      "afk skills enable --scope global --agent codex",
      "afk skills enable --scope project --agent claude",
    ],
  },
  "skills invocation": {
    title: "AFK skills invocation",
    summary: "Bare command opens the batch editor; enable or disable one skill explicitly.",
    usage: "afk skills invocation [disable|enable] [folder] [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent <agent>|custom            Target one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
      "--dry-run                         Preview catalog and metadata writes",
    ],
    examples: [
      "afk skills invocation",
      "afk skills invocation disable afk-doc-craft",
      "afk skills invocation enable afk-doc-craft --dry-run",
      "afk skills invocation disable --scope global --agent codex",
    ],
  },
  "skills delete": {
    title: "AFK skills delete",
    summary: "Permanently delete one or more shared or agent-specific skill folders.",
    usage: "afk skills delete [folder] [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent <agent>|custom            Target one explicit agent root",
      "--agent-path <folder>             Required with --agent custom",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
      "--dry-run                         Preview the delete without applying it",
      "--yes, -y                         Skip confirmation",
      "--catalog-only                    Limit deletion to skills present in AFK's skills catalog",
      "--profile                         Choose a profile and select installed skills to delete",
    ],
    examples: [
      "afk skills delete",
      "afk skills delete --scope global --agent codex",
      "afk skills delete --scope project --agent claude",
      "afk skills delete --catalog-only",
      "afk skills delete --profile",
      "afk skills delete video --profile",
      "afk skills delete old-skill --dry-run",
      "afk skills delete old-skill --yes",
    ],
  },
  "skills update": {
    title: "AFK skills update",
    summary: "Choose cataloged skills with AFK, then use their lock metadata to delegate updates.",
    usage: "afk skills update [skills...] [options]",
    options: [
      "--scope global|project|all        Choose cataloged tracked skills (default: global)",
      "--all                             Update every cataloged tracked skill in scope",
      "--profile                         Update cataloged tracked skills in a global profile",
      "--yes, -y                         Forward non-interactive confirmation to skills update",
    ],
    examples: [
      "afk skills update",
      "afk skills update --all",
      "afk skills update --profile",
      "afk skills update video --profile",
      "afk skills update --scope project",
      "afk skills update frontend-design web-design-guidelines",
    ],
  },
  "skills categorize": {
    title: "AFK skills categorize",
    summary: "Create or update ~/.agents/afk/catalog/skills.json categorization with Codex exec.",
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
  "skills profiles": {
    title: "AFK skills profiles",
    summary: "Apply profile definitions to temporarily focus the global skill library.",
    usage: "afk skills profiles <command> [options]",
    notes: [
      "Use afk profiles catalog to manage profile definitions.",
    ],
    options: [
      "use <profile>                     Print the profile skill list as agent context",
      "enable <profile>                  Enable a profile and apply filtering",
      "disable <profile>                 Disable a profile and restore eligible skills",
      "status                            Show enabled profiles and state",
      "--all                             Include every profile skill's full content with use",
      "--additive                        Enable profile skills without filtering unrelated active skills",
      "--local                           Use ./afk/catalog and ./afk/state for profile runtime data",
      "--dry-run                         Preview filesystem-changing operations",
    ],
    examples: [
      "afk skills profiles use video",
      "afk skills profiles use video --all",
      "afk skills profiles enable video --dry-run",
      "afk skills profiles enable video --additive",
      "afk skills profiles status --local",
      "afk profiles catalog create video --name Video --skill hyperframes --skill tailwind",
    ],
  },
  "profiles catalog": {
    title: "AFK profiles catalog",
    summary: "Edit profiles.json, including profile definitions and profile-wide settings.",
    usage: "afk profiles catalog <command> [options]",
    notes: [
      "Catalog profile commands edit profile definitions and profile-wide catalog settings.",
      "Use afk skills profiles enable|disable|status for runtime profile state and filesystem effects.",
    ],
    options: [
      "set-mode                         Set strict/context profile reconciliation mode",
      "toggle-always-on                 Choose skills that stay active across profiles",
      "list                              List profile definitions",
      "show [profile]                    Show one profile definition",
      "create <profile>                  Create a profile definition",
      "edit <profile>                    Update a profile definition",
      "delete <profile>                  Remove a profile definition",
      "--local                           Use ./afk/catalog for profile data",
      "--name <name>                     Set profile name for create/edit",
      "--skill <skill>                   Add profile skill; repeatable",
      "--enabled                         Choose from enabled skills in the interactive picker",
      "--disabled                        Choose from disabled skills in the interactive picker",
      "--always-on <skill>               Add global always-on skill; repeatable",
      "--profile-only                    Mark added profile skills start-disabled and move active folders to .disabled",
      "--mode strict|context             Set profile reconciliation mode",
      "--json                            Print JSON for list/show",
    ],
    examples: [
      "afk profiles catalog list",
      "afk profiles catalog set-mode",
      "afk profiles catalog toggle-always-on",
      "afk profiles catalog create video --name Video --skill hyperframes --skill tailwind",
      "afk profiles catalog edit video --skill hyperframes --profile-only",
      "afk profiles catalog edit video --mode context",
      "afk profiles catalog edit video --skill hyperframes-cli",
      "afk profiles catalog show video --json",
    ],
  },
  "rules catalog": {
    title: "AFK rules catalog",
    summary: "Manage ordered rules layers in rules.json.",
    usage: "afk rules catalog [command] [options]",
    options: [
      "add                               Append a named rules layer",
      "edit                              Edit an existing rules layer",
      "remove                            Remove a rules layer",
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
      setupOptions.catalogVerbose,
    ],
    examples: [
      "afk rules catalog",
      "afk rules catalog add",
      "afk rules catalog edit --local",
      "afk rules catalog remove",
    ],
  },
  "mcps catalog": catalogItemAreaHelp("AFK mcps catalog", "mcps", "MCP recommendations"),
  "agents catalog": {
    title: "AFK agents catalog",
    summary: "Edit agents.json portable Custom Agent sources.",
    usage: "afk agents catalog [command] [options]",
    options: [
      "add                               Add a Custom Agent source",
      "edit                              Edit a Custom Agent source",
      "remove                            Remove a Custom Agent source",
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
      setupOptions.catalogVerbose,
    ],
    examples: [
      "afk agents catalog",
      "afk agents catalog add",
      "afk agents catalog remove --local",
    ],
  },
  "tools catalog": catalogItemAreaHelp("AFK tools catalog", "tools", "tool installers"),
  "hooks catalog": catalogItemAreaHelp("AFK hooks catalog", "hooks", "lifecycle hooks"),
  "show skills": {
    title: "AFK show skills",
    summary: "Inspect the skills catalog as a list, a React-style composition tree, or an HTML visual map.",
    usage: "afk show skills [options]",
    notes: [
      "--react is a terminal view for AFK's primitive/wrapper/workflow analogy.",
      "--visualize writes and opens a self-contained HTML diagram for a more spatial view.",
    ],
    options: [
      "--source <source>                Show skills from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
      "--react                          Show skills as a React-style composition tree",
      "--visualize                      Write and open a skills composition HTML file",
    ],
    examples: [
      "afk show skills",
      "afk show skills --react",
      "afk show skills --visualize",
      "afk show skills --source logbookfordevs/ai-field-kit --ref main",
      "afk show skills --local",
    ],
  },
  "show rules": {
    title: "AFK show rules",
    summary: "Inspect the rules catalog AFK would sync into managed rule regions.",
    usage: "afk show rules [options]",
    options: [
      "--source <source>                Show rules from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show rules",
      "afk show rules --source logbookfordevs/ai-field-kit",
      "afk show rules --local",
    ],
  },
  "show mcps": {
    title: "AFK show MCPs",
    summary: "Inspect MCP recommendations before delegating installation to add-mcp.",
    usage: "afk show mcps [options]",
    options: [
      "--source <source>                Show MCPs from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show mcps",
      "afk show mcps --source logbookfordevs/ai-field-kit",
      "afk show mcps --local",
    ],
  },
  "show agents": {
    title: "AFK show agents",
    summary: "Inspect portable Custom Agent catalog entries before provisioning.",
    usage: "afk show agents [options]",
    options: [
      "--source <source>                Show Custom Agents from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show agents",
      "afk show agents --source logbookfordevs/ai-field-kit",
      "afk show agents --local",
    ],
  },
  "show tools": {
    title: "AFK show tools",
    summary: "Inspect optional tool installers and post-install commands.",
    usage: "afk show tools [options]",
    options: [
      "--source <source>                Show tools from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show tools",
      "afk show tools --source logbookfordevs/ai-field-kit",
      "afk show tools --local",
    ],
  },
  "show hooks": {
    title: "AFK show hooks",
    summary: "Inspect lifecycle hooks AFK can merge into supported agent hook configs.",
    usage: "afk show hooks [options]",
    options: [
      "--source <source>                Show hooks from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show hooks",
      "afk show hooks --source logbookfordevs/ai-field-kit",
      "afk show hooks --local",
    ],
  },
  "show presets": {
    title: "AFK show presets",
    summary: "Inspect catalog presets such as remembered default source metadata.",
    usage: "afk show presets [options]",
    options: [
      "--source <source>                Show presets from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show presets",
      "afk show presets --source logbookfordevs/ai-field-kit",
      "afk show presets --local",
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
  "skills catalog": {
    title: "AFK skills catalog",
    summary: "Edit skills.json and sync installed skills into the catalog.",
    usage: "afk skills catalog <command> [options]",
    options: [
      "add                               Add a skill catalog item",
      "edit                              Edit a skill catalog item",
      "bulk-edit                         Set invocation and always-on policy for multiple skills",
      "remove                            Remove a skill catalog item",
      "toggle-default                    Toggle default skills",
      "toggle-auto                       Toggle skill autoInvocation",
      "import                            Backfill missing skills catalog entries",
      "status                            Compare installed skills with catalog entries",
    ],
    examples: [
      "afk skills catalog",
      "afk skills catalog add",
      "afk skills catalog bulk-edit",
      "afk skills catalog toggle-auto",
      "afk skills catalog status",
      "afk skills catalog import --dry-run",
    ],
  },
  "skills catalog import": {
    title: "AFK skills catalog import",
    summary: "Backfill missing skills catalog entries from installed skills with skills CLI lock metadata.",
    usage: "afk skills catalog import [options]",
    notes: [
      "Use this when skills already exist in .agents/skills but are missing from the AFK catalog.",
      "AFK imports only skills whose original source can be recovered from the official skills CLI lockfile.",
    ],
    options: [
      setupOptions.dryRun,
      setupOptions.localCatalog,
    ],
    examples: [
      "afk skills catalog import",
      "afk skills catalog import --dry-run",
      "afk skills catalog import --local",
    ],
  },
  "skills catalog status": {
    title: "AFK skills catalog status",
    summary: "Compare installed shared skills with skills catalog entries.",
    usage: "afk skills catalog status [options]",
    options: [
      setupOptions.localCatalog,
    ],
    examples: [
      "afk skills catalog status",
      "afk skills catalog status --local",
    ],
  },
};

function catalogItemAreaHelp(title: string, area: "mcps" | "tools" | "hooks", label: string): CommandHelp {
  return {
    title,
    summary: `Edit ${area}.json ${label}.`,
    usage: `afk ${area} catalog [command] [options]`,
    options: [
      `add                               Add ${label}`,
      `edit                              Edit ${label}`,
      `remove                            Remove ${label}`,
      "toggle-default                    Toggle defaults",
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
      setupOptions.catalogVerbose,
    ],
    examples: [
      `afk ${area} catalog`,
      `afk ${area} catalog add`,
      `afk ${area} catalog toggle-default --local`,
    ],
  };
}

function parseArgs(argv: string[], env: NodeJS.ProcessEnv): ParseResult {
  const args = [...argv];
  const commandPath = readCommandPath(args);
  const key = commandKey(commandPath);
  const agents: AgentId[] = [];
  const selectedSkillAgentIds: SkillAgentId[] = [];
  let dryRun = false;
  let verbose = false;
  let yes = false;
  const presetRoute = presetRouteFromCommandPath(commandPath);
  if (presetRoute.kind === "error") {
    return { help: false, kind: "error", error: presetRoute.error };
  }
  let presetId = presetRoute.presetId;
  const presetPrompt = presetRoute.prompt;
  let setupScope: SetupScope = "global";
  let scopeExplicit = false;
  let allSkills = false;
  let allCustomAgents = false;
  const selectedCustomAgentIds: string[] = [];
  let rulesRef = "main";
  let rulesSource: "manifest" | "github" | "local" = "manifest";
  let initOnly = false;
  let empty = false;
  let overrideRefresh = false;
  const refreshDefaults = isRefreshCommand(key);
  let refreshBeforeSetup = false;
  let defaultsSource = "";
  let defaultsSourceExplicit = false;
  let defaultSourceUpdate = "";
  let manifestLocal = false;
  let manifestConfigureLocal = false;
  let manifestConfigureFromCurrent = false;
  let skillsListScope: SkillsListScope = "global";
  let skillsListStorage: SkillsListStorage | undefined;
  let skillsListAutoInvocation: SkillsListAutoInvocation | undefined;
  let skillsUpdateScope: SkillsUpdateScope = "global";
  let skillsUpdateAll = false;
  let skillsUpdateByProfile = false;
  let skillsDeleteCatalogOnly = false;
  let skillsDeleteByProfile = false;
  let skillsAgent: SkillAgentFilter | undefined;
  let skillsAgentPath: string | undefined;
  let skillsJson = false;
  let skillsCategory = "";
  let skillsTag = "";
  let skillsUncategorized = false;
  let skillOpenApp: SkillOpenApp = "finder";
  let skillOpenTarget: "file" | "folder" = "file";
  let afkOpenApp: "finder" | "code" = "finder";
  let skillCategorizationMode: SkillCategorizationMode | undefined;
  let skillCategorizationRunner: SkillCategorizationRunner = "codex-exec";
  let skillCategorizationInstruction = "";
  let skillProfileName: string | undefined;
  const skillProfileSkills: string[] = [];
  const skillProfileAlwaysOn: string[] = [];
  let skillProfileMode: SkillProfileMode | undefined;
  let skillProfileAdditive = false;
  let skillProfileOnly = false;
  let skillProfileUseAll = false;
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
  const isAfkSkillsAddCommand = commandPath[0] === "skills" && commandPath[1] === "add";
  const isAfkSkillsProfilesCommand = commandPath[0] === "skills" && commandPath[1] === "profiles";
  const isAfkCatalogProfilesCommand = commandPath[0] === "profiles" && commandPath[1] === "catalog";
  const acceptsSkillStorageFilter =
    (isAfkSkillsCommand && ["list", "show", "open", "delete", "invocation"].includes(commandPath[1] ?? "")) ||
    (isAfkCatalogProfilesCommand && ["create", "edit"].includes(commandPath[2] ?? ""));
  const isAfkProfileCommand = isAfkSkillsProfilesCommand || isAfkCatalogProfilesCommand;
  const isAfkUiCommand = commandPath[0] === "ui";
  let skillAddArgs: string[] = [];
  const skillAddProfileIds: string[] = [];
  const skillAddProfileOnlyIds: string[] = [];
  let skillAddStartDisabled = false;

  if (args.includes("--version") || args.includes("-v")) {
    return { version: true, help: false };
  }

  if (commandPath.length === 0 || key === "--help" || key === "-h" || key === "help") {
    return { help: true };
  }

  if (args.includes("--help") || args.includes("-h")) {
    return { help: true, commandPath: helpCommandPath(commandPath, key) };
  }

  if (isAfkSkillsAddCommand) {
    skillAddArgs = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (!arg) {
        continue;
      }

      if (arg === "--start-disabled") {
        skillAddStartDisabled = true;
        continue;
      }

      if (arg === "--profile") {
        const value = args[index + 1]?.trim();
        if (!value) {
          return { help: false, kind: "error", error: "Missing --profile value" };
        }
        skillAddProfileIds.push(value);
        index += 1;
        continue;
      }

      if (arg === "--profile-only") {
        const value = args[index + 1]?.trim();
        if (!value) {
          return { help: false, kind: "error", error: "Missing --profile-only value" };
        }
        skillAddProfileOnlyIds.push(value);
        index += 1;
        continue;
      }

      skillAddArgs.push(arg);
    }
    args.length = 0;
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

    if (arg === "--refresh") {
      if (key !== "setup" && !commandToArea(commandPath) && !isPresetSetupCommand(commandPath)) {
        return { help: false, kind: "error", error: "--refresh is only supported with afk setup commands" };
      }
      refreshBeforeSetup = true;
      continue;
    }

    if ((isAfkSkillsCommand || isAfkCatalogProfilesCommand) && arg === "--json") {
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
      if (key === "doctor") {
        manifestLocal = true;
        continue;
      }

      if (isAfkProfileCommand) {
        manifestLocal = true;
        manifestConfigureLocal = true;
        continue;
      }

      if (isRefreshCommand(key)) {
        manifestLocal = true;
        continue;
      }

      if (isManifestShowCommand(key) || isCatalogSkillsCommand(key)) {
        manifestLocal = true;
        if (isCatalogSkillsCommand(key)) {
          manifestConfigureLocal = true;
        }
        continue;
      }

      if (isCatalogCommand(key)) {
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
        if (commandPath[1] === "update") {
          if (value !== "global" && value !== "project" && value !== "all") {
            return { help: false, kind: "error", error: `Invalid --scope value: ${value ?? "(missing)"}` };
          }
          skillsUpdateScope = value;
          index += 1;
          continue;
        }

        if (!isSkillRootCommand(commandPath)) {
          return { help: false, kind: "error", error: "Unknown option: --scope" };
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
      if (commandPath[1] === "update") {
        skillsUpdateAll = true;
        continue;
      }
      if (commandPath[1] === "profiles" && commandPath[2] === "use") {
        skillProfileUseAll = true;
        continue;
      }
      return { help: false, kind: "error", error: "Unknown option: --all" };
    }

    if (arg === "--all") {
      if (key === "setup agents") {
        allCustomAgents = true;
      } else if (isSetupSkillsCommand(key)) {
        allSkills = true;
      } else {
        allSkills = true;
        allCustomAgents = true;
      }
      continue;
    }

    if (arg === "--preset") {
      if (key !== "setup") {
        return { help: false, kind: "error", error: "--preset is only supported with afk setup" };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --preset value" };
      }
      presetId = value;
      index += 1;
      continue;
    }

    if (arg === "--custom-agent") {
      if (key !== "setup" && key !== "setup agents") {
        return { help: false, kind: "error", error: "--custom-agent is only supported with afk setup or afk setup agents" };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --custom-agent value" };
      }
      selectedCustomAgentIds.push(value);
      index += 1;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--catalog-only") {
      if (commandPath[1] !== "delete") {
        return { help: false, kind: "error", error: "Unknown option: --catalog-only" };
      }
      skillsDeleteCatalogOnly = true;
      continue;
    }

    if (isAfkSkillsCommand && arg === "--profile") {
      if (commandPath[1] === "update") {
        skillsUpdateByProfile = true;
        continue;
      }
      if (commandPath[1] !== "delete") {
        return { help: false, kind: "error", error: "Unknown option: --profile" };
      }
      skillsDeleteByProfile = true;
      continue;
    }

    if ((isAfkSkillsCommand || isAfkCatalogProfilesCommand) && arg === "--enabled") {
      if (!acceptsSkillStorageFilter) {
        return { help: false, kind: "error", error: "Unknown option: --enabled" };
      }

      const value = args[index + 1];
      if (value === "true" || value === "false") {
        return { help: false, kind: "error", error: "Use --enabled or --disabled without a value" };
      }

      const nextStorage: SkillsListStorage = "active";
      if (skillsListStorage && skillsListStorage !== nextStorage) {
        return { help: false, kind: "error", error: "Use only one of --enabled or --disabled" };
      }

      skillsListStorage = nextStorage;
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

    if (arg === "--override") {
      if (commandPath[0] !== "refresh") {
        return { help: false, kind: "error", error: "--override is only supported with afk refresh" };
      }
      overrideRefresh = true;
      continue;
    }

    if (arg === "--code") {
      if (key !== "open") {
        return { help: false, kind: "error", error: "Unknown option: --code" };
      }

      afkOpenApp = "code";
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
        if (!isSkillRootCommand(commandPath)) {
          return { help: false, kind: "error", error: "Unknown option: --agent" };
        }
        if (!value || !isSkillAgentFilter(value)) {
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

    if (isAfkSkillsCommand && arg === "--agent-path") {
      if (!isSkillRootCommand(commandPath)) {
        return { help: false, kind: "error", error: "Unknown option: --agent-path" };
      }
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --agent-path value" };
      }
      skillsAgentPath = resolveAgentPath(value, homeDir, cwd);
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

    if (isAfkSkillsCommand && arg === "--auto-invocation") {
      if (commandPath[1] !== "list") {
        return { help: false, kind: "error", error: "Unknown option: --auto-invocation" };
      }

      const value = args[index + 1];
      if (value !== "enabled" && value !== "disabled" && value !== "mixed" && value !== "default") {
        return { help: false, kind: "error", error: `Invalid --auto-invocation value: ${value ?? "(missing)"}` };
      }

      skillsListAutoInvocation = value;
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

    if (isAfkSkillsCommand && arg === "--uncategorized") {
      skillsUncategorized = true;
      continue;
    }

    if ((isAfkSkillsCommand || isAfkCatalogProfilesCommand) && arg === "--disabled") {
      if (!acceptsSkillStorageFilter) {
        return { help: false, kind: "error", error: `Unknown option: ${arg}` };
      }

      const nextStorage: SkillsListStorage = "disabled";
      if (skillsListStorage && skillsListStorage !== nextStorage) {
        return { help: false, kind: "error", error: "Use only one of --enabled or --disabled" };
      }

      skillsListStorage = nextStorage;
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

    if (isAfkCatalogProfilesCommand && arg === "--mode") {
      const value = args[index + 1];
      if (value !== "strict" && value !== "context") {
        return { help: false, kind: "error", error: `Invalid --mode value: ${value ?? "(missing)"}` };
      }
      skillProfileMode = value;
      index += 1;
      continue;
    }

    if (isAfkCatalogProfilesCommand && arg === "--profile-only") {
      if (commandPath[2] !== "create" && commandPath[2] !== "edit") {
        return { help: false, kind: "error", error: "Unknown option: --profile-only" };
      }
      skillProfileOnly = true;
      continue;
    }

    if (isAfkSkillsProfilesCommand && arg === "--additive") {
      if (commandPath[2] !== "enable") {
        return { help: false, kind: "error", error: "--additive is only available for afk skills profiles enable" };
      }
      skillProfileAdditive = true;
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

    if (isAfkProfileCommand && arg === "--name") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --name value" };
      }
      skillProfileName = value;
      index += 1;
      continue;
    }

    if (isAfkProfileCommand && arg === "--skill") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --skill value" };
      }
      skillProfileSkills.push(value);
      index += 1;
      continue;
    }

    if (isAfkProfileCommand && arg === "--always-on") {
      const value = args[index + 1]?.trim();
      if (!value) {
        return { help: false, kind: "error", error: "Missing --always-on value" };
      }
      skillProfileAlwaysOn.push(value);
      index += 1;
      continue;
    }

    return { help: false, kind: "error", error: `Unknown option: ${arg}` };
  }

  if (isAfkSkillsCommand && !isAfkSkillsAddCommand) {
    if (skillsAgent === "custom" && !skillsAgentPath) {
      return { help: false, kind: "error", error: "--agent custom requires --agent-path <folder>" };
    }
    if (skillsAgent !== "custom" && skillsAgentPath) {
      return { help: false, kind: "error", error: "--agent-path requires --agent custom" };
    }
    if (skillsAgent === "custom" && scopeExplicit) {
      return { help: false, kind: "error", error: "Do not combine --scope with --agent custom; --agent-path already selects the root" };
    }
    if (!skillsAgent && scopeExplicit && skillsListScope !== "global" && commandPath[1] !== "update") {
      return { help: false, kind: "error", error: `--scope ${skillsListScope} requires --agent <agent>` };
    }
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
      ...(presetId ? { presetId } : {}),
      ...(presetPrompt ? { presetPrompt: true } : {}),
      allSkills,
      allCustomAgents,
      selectedSkillIds: [],
      selectedCustomAgentIds,
      selectedSkillAgentIds,
      skillAddArgs,
      skillAddProfileIds,
      skillAddProfileOnlyIds,
      skillAddStartDisabled,
      selectedMcpIds: [],
      selectedToolIds: [],
      selectedHookIds: [],
      rulesRef,
      rulesSource,
      initOnly,
      empty,
      refreshDefaults,
      overrideRefresh,
      refreshBeforeSetup,
      defaultsSource,
      defaultsSourceExplicit,
      defaultSourceUpdate,
      manifestLocal,
      manifestConfigureLocal,
      manifestConfigureFromCurrent,
      skillsListScope,
      skillsListStorage,
      skillsListAutoInvocation,
      skillsUpdateAll,
      skillsUpdateScope,
      skillsUpdateByProfile,
      skillsDeleteCatalogOnly,
      skillsDeleteByProfile,
      skillsAgent,
      skillsAgentPath,
      skillsJson,
      skillsCategory,
      skillsTag,
      skillsUncategorized,
      skillOpenApp,
      skillOpenTarget,
      afkOpenApp,
      skillCategorizationMode,
      skillCategorizationRunner,
      skillCategorizationInstruction,
      skillProfileName,
      skillProfileSkills,
      skillProfileAlwaysOn,
      skillProfileMode,
      skillProfileAdditive,
      skillProfileOnly,
      skillProfileUseAll,
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

function isSkillAgentFilter(value: string): value is SkillAgentFilter {
  return managedSkillAgents().includes(value as SkillAgentFilter);
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

  if (key === "setup profiles") {
    return "profiles";
  }

  if (key === "setup agents") {
    return "agents";
  }

  if (key === "setup mcps" || key === "setup mcps install") {
    return "mcps";
  }

  if (key === "setup tools") {
    return "tools";
  }

  if (key === "setup hooks" || key === "setup hooks install") {
    return "hooks";
  }

  return null;
}

function isPresetSetupCommand(commandPath: string[]): boolean {
  return commandPath[0] === "preset" || (commandPath[0] === "setup" && commandPath[1] === "preset");
}

function presetRouteFromCommandPath(commandPath: string[]): { kind: "ok"; presetId: string; prompt: boolean } | { kind: "error"; error: string } {
  if (!isPresetSetupCommand(commandPath)) {
    return { kind: "ok", presetId: "", prompt: false };
  }

  const idIndex = commandPath[0] === "preset" ? 1 : 2;
  const presetId = commandPath[idIndex] ?? "";
  if (commandPath.length > idIndex + 1) {
    return { kind: "error", error: `Unexpected preset argument: ${commandPath[idIndex + 1]}` };
  }

  return { kind: "ok", presetId, prompt: presetId.length === 0 };
}

async function runSetupCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const area = commandToArea(commandPath);
  if (options.refreshBeforeSetup) {
    const refreshCode = await runRefresh(runtime, {
      ...options,
      refreshBeforeSetup: false,
      manifestLocal: options.setupScope === "project",
      selectedManifestCategories: area ? [area] : [],
    });
    if (refreshCode !== 0) {
      return refreshCode;
    }
  }

  return area ? runArea(area, runtime, options) : runSetup(runtime, options);
}

function isSetupSkillsCommand(key: string): boolean {
  return key === "setup skills" || key === "setup skills install";
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

function isCatalogSkillsCommand(key: string): boolean {
  return key === "skills catalog" ||
    key.startsWith("skills catalog ");
}

function isCatalogSkillsImportCommand(key: string): boolean {
  return key === "skills catalog import";
}

function isCatalogProfilesCommand(key: string): boolean {
  return key === "profiles catalog" || key.startsWith("profiles catalog ");
}

function isCatalogCommand(key: string): boolean {
  return /^(rules|skills|profiles|agents|mcps|tools|hooks) catalog(?: |$)/.test(key);
}

function isCatalogAreaCommand(commandPath: string[]): boolean {
  return commandPath[1] === "catalog" && ["rules", "agents", "mcps", "tools", "hooks"].includes(commandPath[0] ?? "");
}

async function runCatalogAreaCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const area = catalogAreaFromCommand(commandPath[0]);
  if (!area) {
    runtime.io.stderr(`Unknown catalog command: ${commandPath.join(" ") || "(none)"}`);
    return 1;
  }

  const action = catalogActionFromCommand(area, commandPath[2]);
  if (action.kind === "error") {
    runtime.io.stderr(action.error);
    return 1;
  }

  if (area === "skills") {
    if (commandPath[2] === "import") {
      return runCatalogImport(runtime, options);
    }
    if (commandPath[2] === "status") {
      return runCatalogImportStatus(runtime, options);
    }
  }

  if (!action.action) {
    return runManifestConfigureArea(runtime, options, area);
  }

  return runManifestConfigureAreaAction(runtime, options, area, action.action);
}

function catalogAreaFromCommand(value: string | undefined): ManifestArea | null {
  switch (value) {
    case "rules":
    case "skills":
    case "profiles":
    case "agents":
    case "mcps":
    case "tools":
    case "hooks":
      return value;
    default:
      return null;
  }
}

function catalogActionFromCommand(area: ManifestArea, value: string | undefined): { kind: "ok"; action?: ManifestAction } | { kind: "error"; error: string } {
  if (!value) {
    return { kind: "ok" };
  }

  if (area === "rules") {
    switch (value) {
      case "add":
      case "edit":
      case "remove":
        return { kind: "ok", action: value };
      default:
        return { kind: "error", error: `Unknown catalog rules command: ${value}` };
    }
  }

  if (area === "profiles") {
    switch (value) {
      case "set-mode":
        return { kind: "ok", action: "set-profile-mode" };
      case "toggle-always-on":
        return { kind: "ok", action: "toggle-always-on" };
      case "list":
      case "show":
      case "create":
      case "edit":
      case "delete":
        return { kind: "ok" };
      default:
        return { kind: "error", error: `Unknown catalog profiles command: ${value}` };
    }
  }

  if (area === "agents") {
    return value === "add" || value === "edit" || value === "remove"
      ? { kind: "ok", action: value }
      : { kind: "error", error: `Unknown catalog agents command: ${value}` };
  }

  switch (value) {
    case "add":
    case "edit":
    case "remove":
      return { kind: "ok", action: value };
    case "bulk-edit":
      return area === "skills"
        ? { kind: "ok", action: "bulk-edit" }
        : { kind: "error", error: `Unknown catalog ${area} command: ${value}` };
    case "toggle-default":
      return { kind: "ok", action: "toggle-default" };
    case "toggle-auto":
      return area === "skills"
        ? { kind: "ok", action: "toggle-auto" }
        : { kind: "error", error: `Unknown catalog ${area} command: ${value}` };
    case "import":
    case "status":
      return area === "skills"
        ? { kind: "ok" }
        : { kind: "error", error: `Unknown catalog ${area} command: ${value}` };
    default:
      return { kind: "error", error: `Unknown catalog ${area} command: ${value}` };
  }
}

function isCliUpdateCommand(key: string): boolean {
  return key === "update";
}

function helpCommandPath(commandPath: string[], key: string): string[] {
  if (key === "preset" || key.startsWith("preset ")) {
    return ["preset"];
  }

  if (key === "setup preset" || key.startsWith("setup preset ")) {
    return ["setup", "preset"];
  }
  if (key === "skills add" || key.startsWith("skills add ")) {
    return ["skills", "add"];
  }

  if (key === "skills profiles" || key.startsWith("skills profiles ")) {
    return ["skills", "profiles"];
  }

  if (key === "profiles catalog" || key.startsWith("profiles catalog ")) {
    return ["profiles", "catalog"];
  }

  if (key === "skills catalog" || key.startsWith("skills catalog ")) {
    const detailed = commandPath.slice(0, 3);
    return commandHelps[commandKey(detailed)] ? detailed : ["skills", "catalog"];
  }

  if (isCatalogCommand(key)) {
    const area = commandPath.slice(0, 2);
    return commandHelps[commandKey(area)] ? area : commandPath;
  }

  if (isRefreshCommand(key)) {
    return ["refresh"];
  }

  if (isManifestShowCommand(key)) {
    const canonical = canonicalShowHelpPath(commandPath);
    return commandHelps[commandKey(canonical)] ? canonical : ["show"];
  }

  return commandPath;
}

function canonicalShowHelpPath(commandPath: string[]): string[] {
  if (commandPath[0] === "show") {
    return commandPath.slice(0, 2);
  }

  if ((commandPath[0] === "manifests" || commandPath[0] === "manifest") && commandPath[1] === "show") {
    return ["show", ...(commandPath[2] ? [commandPath[2]] : [])];
  }

  return ["show"];
}

function isSkillAgentId(value: string): value is SkillAgentId {
  return value === "claude-code" || value === "kiro-cli" || value === "kilo" || value === "pi" || value === "droid";
}

function isSkillRootCommand(commandPath: string[]): boolean {
  return commandPath[0] === "skills" && [
    "list",
    "show",
    "get",
    "open",
    "disable",
    "enable",
    "invocation",
    "delete",
  ].includes(commandPath[1] ?? "");
}

function resolveAgentPath(value: string, homeDir: string, cwd: string): string {
  if (value === "~") {
    return homeDir;
  }
  if (value.startsWith("~/")) {
    return resolve(homeDir, value.slice(2));
  }
  return resolve(cwd, value);
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
  afk                         Open the interactive lobby when your terminal supports prompts
  afk open                    Open the user AFK folder
  afk doctor [options]        Validate every local AFK catalog file
  afk refresh [category...] [options]               Update the local catalog cache
  afk setup [options]         Prepare rules, skills, Custom Agents, MCPs, tools, and hooks
  afk setup preset [id] [options]                   Choose and apply a catalog preset
  afk setup rules [options]   Sync AFK rules into managed agent rule regions
  afk setup skills [options]  Install and reconcile shared skills
  afk setup profiles [options] Prepare focus profile definitions
  afk setup agents [options]  Provision portable Custom Agents
  afk setup mcps [options]    Install cataloged MCP servers
  afk setup tools [options]   Install cataloged developer tools
  afk setup hooks [options]   Merge lifecycle hooks into agent configs
  afk rules catalog [command] [options]              Manage ordered rules catalog layers
  afk skills <command> [options]                     Inspect and manage local skill libraries
  afk skills catalog <command> [options]             Manage skills catalog definitions
  afk profiles catalog <command> [options]           Edit profile catalog data
  afk agents catalog [command] [options]             Manage portable Custom Agent sources
  afk mcps catalog [command] [options]               Manage MCP catalog entries
  afk tools catalog [command] [options]              Manage tool catalog entries
  afk tools update [tool...] [options]               Update selected cataloged tools
  afk hooks catalog [command] [options]              Manage lifecycle hook catalog entries
  afk show [category...] [options]                   Inspect cached catalog data without changing it
  afk preset [id] [options]   Choose and apply a catalog preset
  afk ui <command> [options]  Delegate UI-focused skill routing to UI Skills
  afk update [options]        Update AFK from the latest GitHub release

Run "afk <command> --help" for command-specific options.

Agents:
  antigravity, claude, codex, cursor-local, opencode, pi

Aliases:
  agy, gemini -> antigravity
  cursor, cursor-ide, cursor-cli -> cursor-local`;
}

function commandKey(commandPath: string[] = []): string {
  return commandPath.join(" ");
}

function helpKey(commandPath: string[] = []): string {
  if (commandPath[0] === "skills" && commandPath[1] === "profiles") {
    const contextualKey = commandPath.slice(0, 3).join(" ");
    if (commandPath[2] && commandHelps[contextualKey]) {
      return contextualKey;
    }

    return "skills profiles";
  }

  if (commandPath[0] === "profiles" && commandPath[1] === "catalog") {
    return "profiles catalog";
  }

  if (commandPath[0] === "skills" && commandPath[1] === "catalog") {
    const contextualKey = commandPath.slice(0, 3).join(" ");
    return commandPath[2] && commandHelps[contextualKey] ? contextualKey : "skills catalog";
  }

  if (commandPath[1] === "catalog" && commandHelps[commandPath.slice(0, 2).join(" ")]) {
    return commandPath.slice(0, 2).join(" ");
  }

  if (commandPath[0] === "skills" && commandPath[1] && commandPath[1] !== "catalog") {
    return commandPath.slice(0, 2).join(" ");
  }

  if (commandPath[0] === "tools" && commandPath[1]) {
    return commandPath.slice(0, 2).join(" ");
  }

  if (commandPath[0] === "ui" && commandPath[1]) {
    return commandPath.slice(0, 2).join(" ");
  }

  if (commandPath[0] === "show") {
    const contextualKey = commandPath.slice(0, 2).join(" ");
    if (commandPath[1] && commandHelps[contextualKey]) {
      return contextualKey;
    }

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
    case "profile":
    case "profiles":
      return "profiles";
    case "agent":
    case "agents":
      return "agents";
    case "mcp":
    case "mcps":
      return "mcps";
    case "tool":
    case "tools":
      return "tools";
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
  ];

  if (help.notes && help.notes.length > 0) {
    parts.push("", "Notes:", ...help.notes.map((note) => `  ${note}`));
  }

  if (help.options.length > 0) {
    parts.push("", "Options:", ...help.options.map((option) => `  ${option}`));
  }

  if (help.subcommands && help.subcommands.length > 0) {
    parts.push("", "Subcommands:", ...help.subcommands.map((subcommand) => `  ${subcommand}`));
  }

  parts.push("", "Examples:", ...help.examples.map((example) => `  ${example}`));

  return parts.join("\n");
}
