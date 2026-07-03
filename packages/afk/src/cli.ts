import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { normalizeAgentId } from "./agents.js";
import { runCatalogImport, runCatalogImportStatus } from "./catalog-import.js";
import { runSetup, runArea } from "./setup.js";
import { runRefresh } from "./refresh.js";
import { runManifestShow } from "./manifest-show.js";
import { runManifestConfigure, runManifestConfigureArea, runManifestConfigureAreaAction, type ManifestAction, type ManifestArea } from "./manifest-configure.js";
import { runCatalogProfilesCommand, runSkillsCommand } from "./skills/commands.js";
import { managedSkillAgents } from "./skills/catalog.js";
import { runUiCommand } from "./ui.js";
import { selectCatalogSkillsLobbyRoute, selectCompassLobbyRoute, shouldOpenCompassLobby } from "./lobby.js";
import { resolveHome, resolveRepoDir } from "./paths.js";
import { packageVersion, runUpdateCommand } from "./update-check.js";
import { isPromptExit } from "./menu.js";
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
  SkillsListScope,
  SkillsListStorage,
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

  if (key === "catalog") {
    return runManifestConfigure(runtime, options);
  }

  if (isCatalogAreaCommand(commandPath)) {
    return runCatalogAreaCommand(commandPath, runtime, options);
  }

  if (key === "catalog skills") {
    const route = await selectCatalogSkillsLobbyRoute(runtime);
    if (!route) {
      return 0;
    }

    return runCatalogAreaCommand(route, runtime, options);
  }

  if (commandPath[0] === "catalog" && commandPath[1] === "skills") {
    return runCatalogAreaCommand(commandPath, runtime, options);
  }

  if (commandPath[0] === "catalog" && commandPath[1] === "profiles" && ["set-mode", "toggle-always-on"].includes(commandPath[2] ?? "")) {
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

  if (key === "setup") {
    return runSetup(runtime, options);
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
    summary: "Guided setup for rules, skills, profiles, MCPs, plugins, and hooks.",
    usage: "afk setup [options]",
    notes: [
      "Use this when you want AFK to prepare agent-facing surfaces on this machine or in the current project.",
      "Pass --source for a one-run catalog source; use afk refresh --default-source to change the remembered source.",
    ],
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
      "afk setup profiles                Prepare AFK focus profile definitions",
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
    notes: [
      "Use refresh when you want the local catalog cache to change.",
      "Use --source for a one-off refresh source; use --default-source to save the source for future setup/show runs.",
    ],
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
  catalog: {
    title: "AFK catalog",
    summary: "Interactively edit writable AFK catalog files.",
    usage: "afk catalog [options]",
    notes: [
      "Edits the local AFK catalog cache by default.",
      "Use --local to edit ./afk/catalog for project-local setup.",
      "Use this for small catalog tweaks; edit the source repository directly when maintaining a shared defaults source.",
    ],
    options: [
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
    ],
    examples: [
      "afk catalog",
      "afk catalog --local",
      "afk catalog --dry-run",
      "afk catalog rules",
      "afk catalog skills",
      "afk catalog profiles",
    ],
    subcommands: [
      "afk catalog rules                 Edit rules.json",
      "afk catalog skills                Edit skills.json and import installed skills",
      "afk catalog profiles              Edit profiles.json and profile definitions",
      "afk catalog mcps                  Edit mcps.json",
      "afk catalog plugins               Edit plugins.json",
      "afk catalog hooks                 Edit hooks.json",
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
    notes: [
      "Interactive runs let you choose skills from the catalog.",
      "--all makes non-interactive installs include every catalog skill, not just defaults.",
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
    summary: "Prepare focus profile definitions from profiles.json.",
    usage: "afk setup profiles [options]",
    notes: [
      "Profiles are catalog definitions, so setup refreshes or creates profiles.json without installing skills.",
      "Use afk skills profiles enable to apply a profile after the skills exist.",
    ],
    options: setupAreaOptions,
    examples: [
      "afk setup profiles --dry-run",
      "afk setup profiles --yes",
      "afk setup profiles --local",
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
      "list                              List global and project skills",
      "show <folder>                     Show one skill",
      "open <folder>                     Open SKILL.md or the skill folder",
      "add <source> [flags...]           Delegate to skills add, then sync the AFK catalog",
      "disable <folder>                  Move a global skill into .disabled",
      "enable <folder>                   Move a disabled global skill back to active",
      "invocation [disable|enable] [folder] Toggle auto invocation metadata",
      "delete [folder]                   Permanently delete one or more skills",
      "upgrade [skills...]               Upgrade selected or all tracked skills",
      "profiles <command>                Manage skill focus profiles",
      "categorize                        Create or update skills.json categories with Codex",
    ],
    examples: [
      "afk skills list",
      "afk skills add logbookfordevs/ai-field-kit --skill afk-compass --global --yes",
      "afk skills list --scope global --json",
      "afk skills list --agent shared --disabled",
      "afk skills disable old-skill --dry-run",
      "afk skills invocation disable afk-doc-craft",
      "afk skills upgrade --all",
      "afk skills categorize --mode append-missing --dry-run",
    ],
  },
  "skills add": {
    title: "AFK skills add",
    summary: "Delegate to the official skills add command, then sync AFK's skills catalog.",
    usage: "afk skills add <source> [skills add flags...]",
    notes: [
      "AFK forwards flags after <source> to the official skills CLI.",
      "After a successful install, AFK imports new shared skills into ~/.agents/afk/catalog/skills.json as imported and uncategorized.",
    ],
    options: [
      "--skill <skill>                   Forwarded to skills add",
      "--global                          Forwarded to skills add",
      "--yes, -y                         Forwarded to skills add",
      "--agent <agent>                   Forwarded to skills add when supported upstream",
      "--profile <profile>               AFK: add imported skills to a new or existing profile",
      "--profile-only <profile>          AFK: add imported skills to a profile and disabled storage",
      "--start-disabled                  AFK: import new skills as disabled and move shared folders into .disabled",
    ],
    examples: [
      "afk skills add logbookfordevs/ai-field-kit --skill afk-compass --global --yes",
      "afk skills add https://github.com/mattpocock/skills --skill tdd --global",
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
      "--agent shared|<agent>            Limit shared, project, or agent roots",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
      "--category <id-or-label>          Filter by AFK category",
      "--tag <tag>                       Filter by AFK tag",
      "--uncategorized                   Show records without an AFK category",
      "--json                            Print JSON records",
    ],
    examples: [
      "afk skills list",
      "afk skills list --scope global",
      "afk skills list --agent shared --enabled",
      "afk skills list --agent shared",
      "afk skills list --agent shared --disabled",
      "afk skills list --scope global --agent codex",
      "afk skills list --scope project --agent codex",
    ],
  },
  "skills show": {
    title: "AFK skills show",
    summary: "Show details for one discovered skill.",
    usage: "afk skills show <folder> [options]",
    options: [
      "--agent shared|<agent>            Limit lookup to shared or agent roots",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
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
      "--agent shared|<agent>            Limit lookup to shared or agent roots",
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
      "--agent shared|<agent>            Target shared or one agent-specific root",
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
      "--agent shared|<agent>            Target shared or one agent-specific root",
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
    summary: "Enable or disable auto invocation metadata for one skill.",
    usage: "afk skills invocation [disable|enable] [folder] [options]",
    options: [
      "--scope global|project|all        Choose the target roots when --agent is set",
      "--agent shared|<agent>            Target shared or one agent-specific root",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
      "--dry-run                         Preview metadata writes without applying them",
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
      "--agent shared|<agent>            Target shared or one agent-specific root",
      "--enabled                         Show enabled skills only",
      "--disabled                        Show disabled skills only",
      "--dry-run                         Preview the delete without applying it",
      "--yes, -y                         Skip confirmation",
      "--manifest-only                   Show only skills from AFK's setup skills manifest",
    ],
    examples: [
      "afk skills delete",
      "afk skills delete --scope global --agent codex",
      "afk skills delete --scope project --agent claude",
      "afk skills delete --manifest-only",
      "afk skills delete old-skill --dry-run",
      "afk skills delete old-skill --yes",
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
      "Use afk catalog profiles to manage profile definitions.",
    ],
    options: [
      "enable <profile>                  Enable a profile and apply filtering",
      "disable <profile>                 Disable a profile and restore eligible skills",
      "status                            Show enabled profiles and state",
      "--local                           Use ./afk/catalog and ./afk/state for profile runtime data",
      "--dry-run                         Preview filesystem-changing operations",
    ],
    examples: [
      "afk skills profiles enable video --dry-run",
      "afk skills profiles status --local",
      "afk catalog profiles create video --name Video --skill hyperframes --skill tailwind",
    ],
  },
  "catalog profiles": {
    title: "AFK catalog profiles",
    summary: "Edit profiles.json, including profile definitions and profile-wide settings.",
    usage: "afk catalog profiles <command> [options]",
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
      "afk catalog profiles list",
      "afk catalog profiles set-mode",
      "afk catalog profiles toggle-always-on",
      "afk catalog profiles create video --name Video --skill hyperframes --skill tailwind",
      "afk catalog profiles edit video --skill hyperframes --profile-only",
      "afk catalog profiles edit video --mode context",
      "afk catalog profiles edit video --skill hyperframes-cli",
      "afk catalog profiles show video --json",
    ],
  },
  "catalog rules": {
    title: "AFK catalog rules",
    summary: "Edit rules.json.",
    usage: "afk catalog rules [edit] [options]",
    options: [
      "edit                              Edit the rules source URL/path",
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
    ],
    examples: [
      "afk catalog rules",
      "afk catalog rules edit --local",
    ],
  },
  "catalog mcps": catalogItemAreaHelp("AFK catalog MCPs", "mcps", "MCP recommendations"),
  "catalog plugins": catalogItemAreaHelp("AFK catalog plugins", "plugins", "plugin installers"),
  "catalog hooks": catalogItemAreaHelp("AFK catalog hooks", "hooks", "lifecycle hooks"),
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
  "show plugins": {
    title: "AFK show plugins",
    summary: "Inspect optional plugin installers and post-install commands.",
    usage: "afk show plugins [options]",
    options: [
      "--source <source>                Show plugins from this source for this run only",
      "--ref <git-ref>                  Git ref for GitHub catalog sources",
      "--local                          Show ./afk/catalog instead of the global cache",
    ],
    examples: [
      "afk show plugins",
      "afk show plugins --source logbookfordevs/ai-field-kit",
      "afk show plugins --local",
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
  "catalog skills": {
    title: "AFK catalog skills",
    summary: "Edit skills.json and sync installed skills into the catalog.",
    usage: "afk catalog skills <command> [options]",
    options: [
      "add                               Add a skill catalog item",
      "edit                              Edit a skill catalog item",
      "remove                            Remove a skill catalog item",
      "toggle-default                    Toggle default skills",
      "toggle-auto                       Toggle skill autoInvocation",
      "import                            Backfill missing skills catalog entries",
      "import-status                     Compare installed skills with catalog entries",
    ],
    examples: [
      "afk catalog skills",
      "afk catalog skills add",
      "afk catalog skills toggle-auto",
      "afk catalog skills import-status",
      "afk catalog skills import --dry-run",
    ],
  },
  "catalog skills import": {
    title: "AFK catalog skills import",
    summary: "Backfill missing skills catalog entries from installed skills with skills CLI lock metadata.",
    usage: "afk catalog skills import [options]",
    notes: [
      "Use this when skills already exist in .agents/skills but are missing from the AFK catalog.",
      "AFK imports only skills whose original source can be recovered from the official skills CLI lockfile.",
    ],
    options: [
      setupOptions.dryRun,
      setupOptions.localCatalog,
    ],
    examples: [
      "afk catalog skills import",
      "afk catalog skills import --dry-run",
      "afk catalog skills import --local",
    ],
  },
  "catalog skills import-status": {
    title: "AFK catalog skills import-status",
    summary: "Compare installed shared skills with skills catalog entries.",
    usage: "afk catalog skills import-status [options]",
    options: [
      setupOptions.localCatalog,
    ],
    examples: [
      "afk catalog skills import-status",
      "afk catalog skills import-status --local",
    ],
  },
};

function catalogItemAreaHelp(title: string, area: "mcps" | "plugins" | "hooks", label: string): CommandHelp {
  return {
    title,
    summary: `Edit ${area}.json ${label}.`,
    usage: `afk catalog ${area} [command] [options]`,
    options: [
      `add                               Add ${label}`,
      `edit                              Edit ${label}`,
      `remove                            Remove ${label}`,
      "toggle-default                    Toggle defaults",
      "--local                          Edit ./afk/catalog instead of the global cache",
      setupOptions.dryRun,
    ],
    examples: [
      `afk catalog ${area}`,
      `afk catalog ${area} add`,
      `afk catalog ${area} toggle-default --local`,
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
  let skillsListStorage: SkillsListStorage | undefined;
  let skillsUpgradeScope: SkillsUpgradeScope = "global";
  let skillsUpgradeAll = false;
  let skillsDeleteManifestOnly = false;
  let skillsAgent: SkillAgentFilter | undefined;
  let skillsJson = false;
  let skillsCategory = "";
  let skillsTag = "";
  let skillsUncategorized = false;
  let skillOpenApp: SkillOpenApp = "finder";
  let skillOpenTarget: "file" | "folder" = "file";
  let skillCategorizationMode: SkillCategorizationMode | undefined;
  let skillCategorizationRunner: SkillCategorizationRunner = "codex-exec";
  let skillCategorizationInstruction = "";
  let skillProfileName: string | undefined;
  const skillProfileSkills: string[] = [];
  const skillProfileAlwaysOn: string[] = [];
  let skillProfileMode: SkillProfileMode | undefined;
  let skillProfileOnly = false;
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
  const isAfkCatalogProfilesCommand = commandPath[0] === "catalog" && commandPath[1] === "profiles";
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
      if (commandPath[1] !== "delete") {
        return { help: false, kind: "error", error: "Unknown option: --manifest-only" };
      }
      skillsDeleteManifestOnly = true;
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
      skillAddArgs,
      skillAddProfileIds,
      skillAddProfileOnlyIds,
      skillAddStartDisabled,
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
      skillsListStorage,
      skillsUpgradeAll,
      skillsUpgradeScope,
      skillsDeleteManifestOnly,
      skillsAgent,
      skillsJson,
      skillsCategory,
      skillsTag,
      skillsUncategorized,
      skillOpenApp,
      skillOpenTarget,
      skillCategorizationMode,
      skillCategorizationRunner,
      skillCategorizationInstruction,
      skillProfileName,
      skillProfileSkills,
      skillProfileAlwaysOn,
      skillProfileMode,
      skillProfileOnly,
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
  return key === "catalog skills" ||
    key.startsWith("catalog skills ");
}

function isCatalogSkillsImportCommand(key: string): boolean {
  return key === "catalog skills import";
}

function isCatalogSkillsImportStatusCommand(key: string): boolean {
  return key === "catalog skills import-status";
}

function isCatalogProfilesCommand(key: string): boolean {
  return key === "catalog profiles" || key.startsWith("catalog profiles ");
}

function isCatalogCommand(key: string): boolean {
  return key === "catalog" || key.startsWith("catalog ");
}

function isCatalogAreaCommand(commandPath: string[]): boolean {
  return commandPath[0] === "catalog" && ["rules", "mcps", "plugins", "hooks"].includes(commandPath[1] ?? "");
}

async function runCatalogAreaCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const area = catalogAreaFromCommand(commandPath[1]);
  if (!area) {
    runtime.io.stderr(`Unknown catalog command: ${commandPath.slice(1).join(" ") || "(none)"}`);
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
    if (commandPath[2] === "import-status") {
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
    case "mcps":
    case "plugins":
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
    return value === "edit"
      ? { kind: "ok", action: "edit-rules" }
      : { kind: "error", error: `Unknown catalog rules command: ${value}` };
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

  switch (value) {
    case "add":
    case "edit":
    case "remove":
      return { kind: "ok", action: value };
    case "toggle-default":
      return { kind: "ok", action: "toggle-default" };
    case "toggle-auto":
      return area === "skills"
        ? { kind: "ok", action: "toggle-auto" }
        : { kind: "error", error: `Unknown catalog ${area} command: ${value}` };
    case "import":
    case "import-status":
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
  if (key === "skills add" || key.startsWith("skills add ")) {
    return ["skills", "add"];
  }

  if (key === "skills profiles" || key.startsWith("skills profiles ")) {
    return ["skills", "profiles"];
  }

  if (key === "catalog profiles" || key.startsWith("catalog profiles ")) {
    return ["catalog", "profiles"];
  }

  if (key === "catalog skills" || key.startsWith("catalog skills ")) {
    const detailed = commandPath.slice(0, 3);
    return commandHelps[commandKey(detailed)] ? detailed : ["catalog", "skills"];
  }

  if (key === "catalog" || key.startsWith("catalog ")) {
    const area = commandPath.slice(0, 2);
    if (commandPath.length === 1) {
      return ["catalog"];
    }

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
  afk
  afk refresh [category...] [options]
  afk catalog [options]
  afk setup [options]
  afk setup rules [options]
  afk setup skills [options]
  afk setup mcps [options]
  afk setup plugins [options]
  afk setup hooks [options]
  afk skills <command> [options]
  afk ui <command> [options]
  afk update [options]
  afk catalog rules [options]
  afk catalog skills <command> [options]
  afk catalog profiles <command> [options]
  afk catalog mcps [options]
  afk catalog plugins [options]
  afk catalog hooks [options]
  afk show [category...] [options]

Common paths:
  afk                         Open the interactive lobby when your terminal supports prompts
  afk setup                   Prepare rules, skills, MCPs, plugins, and hooks
  afk refresh                 Update the local catalog cache
  afk catalog                 Edit writable local catalog files
  afk update                  Update AFK from the latest GitHub release
  afk show skills --react     Print the skills catalog as a React-style composition tree
  afk show skills --visualize Write and open the skills composition map
  afk catalog skills          Manage skills catalog definitions
  afk catalog profiles        Edit profile catalog data

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
  if (commandPath[0] === "skills" && commandPath[1] === "profiles") {
    const contextualKey = commandPath.slice(0, 3).join(" ");
    if (commandPath[2] && commandHelps[contextualKey]) {
      return contextualKey;
    }

    return "skills profiles";
  }

  if (commandPath[0] === "catalog" && commandPath[1] === "profiles") {
    return "catalog profiles";
  }

  if (commandPath[0] === "skills" && commandPath[1]) {
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
