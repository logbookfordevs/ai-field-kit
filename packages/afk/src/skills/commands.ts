import { confirm, input, search } from "@inquirer/prompts";
import { join } from "node:path";
import { applyOperation, pathExists, readText, summarizeOperations } from "../fs-utils.js";
import { afkPromptTheme, afkSearchableCheckboxTheme, afkSearchTheme, renderPromptStep } from "../prompt-ui.js";
import { searchableCheckbox } from "../searchable-checkbox.js";
import { bold, paint, reset, terminalPalette } from "../terminal-theme.js";
import type { CliOptions, Runtime, SkillOpenApp } from "../types.js";
import { quoteArg } from "../delegates.js";
import { selectCatalogProfilesLobbyRoute, selectSkillProfilesLobbyRoute, selectSkillsLobbyRoute } from "../lobby.js";
import { loadSkillManifest } from "../manifest.js";
import { planCatalogImport } from "../catalog-import.js";
import {
  filterSkillRecords,
  loadSkillCatalog,
  moveSkillRecord,
  deleteSkillRecords,
  type SkillRecord,
} from "./catalog.js";
import { runCodexCategorization } from "./categorization.js";
import {
  appendSkillsToSkillProfile,
  deleteSkillProfile,
  disableSkillProfile,
  enableSkillProfile,
  listSkillProfiles,
  loadSkillProfileState,
  skillProfileStatus,
  upsertSkillProfile,
  type SkillProfileContext,
  type SkillProfileItem,
} from "./profiles.js";
import {
  renderSkillProfileApply,
  renderSkillProfileDelete,
  renderSkillProfileDetail,
  renderSkillProfileList,
  renderSkillProfileStatus,
  renderSkillProfileWrite,
  renderSkillChoice,
  renderSkillChoiceDescription,
  renderSkillDetails,
  renderSkillList,
  renderSkillMove,
  renderSkillOpen,
  renderSkillDeleteBatch,
  renderSkillInvocationPolicy,
} from "./render.js";
import {
  buildSkillUpgradeCommands,
  loadLockedSkills,
  runSkillUpgradeCommands,
  type LockedSkillRecord,
} from "./upgrade.js";
import { planSkillStartupStorageForItems, upsertFrontmatterBoolean, upsertOpenAiImplicitInvocation } from "../skills.js";

type SkillCommandName = "list" | "show" | "open" | "add" | "disable" | "enable" | "invocation" | "delete" | "upgrade" | "categorize" | "profiles";

export async function runSkillsCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const command = commandPath[1] as SkillCommandName | undefined;
  const operands = commandPath.slice(2);

  try {
    if (!command) {
      const route = await selectSkillsLobbyRoute(runtime);
      return runSkillsCommand(route, runtime, options);
    }

    switch (command) {
      case "list":
        return runSkillsList(runtime, options);
      case "show":
        return runSkillsShow(operands[0], runtime, options);
      case "open":
        return runSkillsOpen(operands[0], runtime, options);
      case "add":
        return runSkillsAdd(operands, runtime, options);
      case "disable":
        return runSkillsMove(operands[0], false, runtime, options);
      case "enable":
        return runSkillsMove(operands[0], true, runtime, options);
      case "invocation":
        return runSkillsInvocation(operands, runtime, options);
      case "delete":
        return runSkillsDelete(operands[0], runtime, options);
      case "upgrade":
        return runSkillsUpgrade(operands, runtime, options);
      case "categorize":
        return runCodexCategorization(runtime, {
          homeDir: options.homeDir,
          cwd: options.cwd,
          dryRun: options.dryRun,
          mode: options.skillCategorizationMode,
          instruction: options.skillCategorizationInstruction,
        });
      case "profiles":
        return runSkillProfilesCommand(operands, runtime, options);
      default:
        runtime.io.stderr(`Unknown skills command: ${command ?? "(none)"}`);
        return 1;
    }
  } catch (error) {
    runtime.io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runSkillsAdd(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const source = operands[0];
  if (!source) {
    runtime.io.stderr("Missing skills source. Usage: afk skills add <source> [skills add flags...]");
    return 1;
  }

  const upstreamArgs = ["skills", "add", source, ...operands.slice(1), ...(options.skillAddArgs ?? [])];
  runtime.io.stdout([
    section("Skill Add"),
    `${accent("Route")} npx ${upstreamArgs.map(quoteArg).join(" ")}`,
  ].join("\n"));

  const result = await runtime.spawn("npx", upstreamArgs, options.cwd, { verbose: true });
  if (result.code !== 0) {
    return result.code;
  }

  const plan = planCatalogImport({
    homeDir: options.homeDir,
    cwd: options.cwd,
    dryRun: false,
    manifestLocal: false,
    startDisabled: options.skillAddStartDisabled || options.skillAddProfileOnlyIds.length > 0,
  });

  for (const operation of plan.operations) {
    applyOperation(operation);
  }

  const startupOperations = planSkillStartupStorageForItems(
    { homeDir: options.homeDir, cwd: options.cwd, setupScope: "global" },
    plan.imported,
  ).filter((operation) => operation.type !== "skip");
  for (const operation of startupOperations) {
    applyOperation(operation);
  }

  const profileResults = (options.skillAddProfileIds.length > 0 || options.skillAddProfileOnlyIds.length > 0) && plan.imported.length > 0
    ? syncAddedSkillsToProfiles(options, plan.imported.map((item) => item.id))
    : [];

  runtime.io.stdout([
    "",
    section("Skill Catalog"),
    plan.operations.length > 0
      ? `${accent("Synced")} ${summarizeOperations(plan.operations)}`
      : `${accent("Synced")} AFK catalog already up to date.`,
    startupOperations.length > 0
      ? `${accent("Storage")} ${summarizeOperations(startupOperations)}`
      : "",
    ...profileResults.map((result) => `${accent("Profile")} ${result.profile.id} ${result.created ? "created with" : "updated with"} ${plan.imported.length} skill${plan.imported.length === 1 ? "" : "s"}.`),
    plan.imported.length > 0
      ? `${accent("Imported")} ${plan.imported.map((item) => item.id).join(", ")}`
      : muted("No new shared skills found to import."),
  ].filter(Boolean).join("\n"));
  return 0;
}

function syncAddedSkillsToProfiles(options: CliOptions, skillIds: string[]): Array<{ profile: { id: string }; created: boolean }> {
  const context = skillProfileContext(options);
  const state = loadSkillProfileState(context);
  const results: Array<{ profile: { id: string }; created: boolean }> = [];

  for (const profileId of uniqueProfileIds([...options.skillAddProfileIds, ...options.skillAddProfileOnlyIds])) {
    const result = appendSkillsToSkillProfile(context, {
      id: profileId,
      skills: skillIds,
      dryRun: false,
    });
    results.push({ profile: result.profile, created: result.created });
  }

  if (state.enabledProfileIds[0]) {
    enableSkillProfile(context, state.enabledProfileIds[0], false);
  }

  return results;
}

function uniqueProfileIds(ids: string[]): string[] {
  const unique = new Map<string, string>();
  for (const id of ids) {
    const trimmed = id.trim();
    if (trimmed) {
      unique.set(trimmed.toLowerCase(), trimmed);
    }
  }
  return [...unique.values()];
}

export async function runCatalogProfilesCommand(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  if (operands.length === 0) {
    const route = await selectCatalogProfilesLobbyRoute(runtime);
    return runCatalogProfilesCommand(route.slice(2), runtime, options);
  }

  const command = operands[0] ?? "list";
  if (command === "enable" || command === "disable" || command === "status") {
    runtime.io.stderr(`afk catalog profiles ${command} is a runtime profile operation. Use afk skills profiles ${command} instead.`);
    return 1;
  }

  return runSkillProfileDefinitionsCommand(operands, runtime, options);
}

async function runSkillProfilesCommand(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  if (operands.length === 0) {
    const route = await selectSkillProfilesLobbyRoute(runtime);
    if (route[0] === "catalog" && route[1] === "profiles") {
      return runCatalogProfilesCommand(route.slice(2), runtime, options);
    }

    return runSkillsCommand(route, runtime, options);
  }

  const command = operands[0] ?? "list";
  if (command === "list" || command === "show" || command === "create" || command === "edit" || command === "delete") {
    runtime.io.stderr(`afk skills profiles ${command} is a profile definition operation. Use afk catalog profiles ${command} instead.`);
    return 1;
  }

  return runSkillProfileRuntimeCommand(operands, runtime, options);
}

async function runSkillProfileDefinitionsCommand(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const command = operands[0] ?? "list";
  const id = operands[1];
  const context = skillProfileContext(options);

  switch (command) {
    case "list": {
      const result = listSkillProfiles(context);
      if (options.skillsJson) {
        runtime.io.stdout(JSON.stringify(result.catalog, null, 2));
        return 0;
      }
      runtime.io.stdout(renderSkillProfileList({
        catalog: result.catalog,
        state: result.state,
        catalogPath: result.paths.catalogPath,
      }));
      return 0;
    }
    case "show": {
      const result = listSkillProfiles(context);
      const profile = id
        ? findSkillProfile(result.catalog.items, id)
        : await promptSkillProfile(result.catalog.items, "Select a profile to show:");
      if (!profile) {
        runtime.io.stderr(id ? `Skill profile not found: ${id}` : "No skill profiles found.");
        return 1;
      }
      if (options.skillsJson) {
        runtime.io.stdout(JSON.stringify(profile, null, 2));
        return 0;
      }
      runtime.io.stdout(renderSkillProfileDetail({
        profile,
        catalog: result.catalog,
        state: result.state,
        catalogPath: result.paths.catalogPath,
      }));
      return 0;
    }
    case "create":
    case "edit": {
      const profiles = listSkillProfiles(context).catalog.items;
      const selectedId = id ?? (command === "create"
        ? await promptNewSkillProfileId()
        : (await promptSkillProfile(profiles, "Select a profile to edit:"))?.id);
      if (!selectedId) {
        runtime.io.stderr(command === "create" ? "Profile id is required." : "No skill profiles found.");
        return 1;
      }
      if (command === "edit" && !findSkillProfile(profiles, selectedId)) {
        runtime.io.stderr(`Skill profile not found: ${selectedId}`);
        return 1;
      }
      const profileName = options.skillProfileName ?? (command === "create" ? await promptOptionalSkillProfileName(selectedId) : undefined);
      const skills = options.skillProfileSkills && options.skillProfileSkills.length > 0
        ? options.skillProfileSkills
        : (await promptSkillRecords(loadMutationSkillRecords(options), `Select skills for ${selectedId}:`)).map((record) => record.folder);
      const result = upsertSkillProfile(context, {
        id: selectedId,
        skills,
        alwaysOn: options.skillProfileAlwaysOn ?? [],
        ...(options.skillProfileMode ? { mode: options.skillProfileMode } : {}),
        dryRun: options.dryRun,
        ...(profileName ? { name: profileName } : {}),
      });
      runtime.io.stdout(renderSkillProfileWrite({
        profile: result.profile,
        mode: result.catalog.mode,
        catalogPath: result.paths.catalogPath,
        dryRun: result.dryRun,
        created: result.created,
      }));
      return 0;
    }
    case "delete": {
      const profiles = listSkillProfiles(context).catalog.items;
      const selectedId = id ?? (await promptSkillProfile(profiles, "Select a profile to delete:"))?.id;
      if (!selectedId) {
        runtime.io.stderr("No skill profiles found.");
        return 1;
      }
      const result = deleteSkillProfile(context, selectedId, options.dryRun);
      runtime.io.stdout(renderSkillProfileDelete({
        profile: result.removed,
        catalogPath: result.paths.catalogPath,
        dryRun: result.dryRun,
      }));
      return 0;
    }
    default:
      runtime.io.stderr(`Unknown catalog profiles command: ${command}`);
      return 1;
  }
}

async function runSkillProfileRuntimeCommand(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const command = operands[0] ?? "status";
  const id = operands[1];
  const context = skillProfileContext(options);

  switch (command) {
    case "enable": {
      const profiles = listSkillProfiles(context).catalog.items;
      const selectedId = id ?? (await promptSkillProfile(profiles, "Select a profile to enable:"))?.id;
      if (!selectedId) {
        runtime.io.stderr("No skill profiles found.");
        return 1;
      }
      runtime.io.stdout(renderSkillProfileApply(enableSkillProfile(context, selectedId, options.dryRun)));
      return 0;
    }
    case "disable": {
      const profiles = listSkillProfiles(context).catalog.items;
      const selectedId = id ?? (await promptSkillProfile(profiles, "Select a profile to disable:"))?.id;
      if (!selectedId) {
        runtime.io.stderr("No skill profiles found.");
        return 1;
      }
      runtime.io.stdout(renderSkillProfileApply(disableSkillProfile(context, selectedId, options.dryRun)));
      return 0;
    }
    case "status":
      runtime.io.stdout(renderSkillProfileStatus(skillProfileStatus(context)));
      return 0;
    default:
      runtime.io.stderr(`Unknown skills profiles command: ${command}`);
      return 1;
  }
}

async function runSkillsUpgrade(skillNames: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const scope = options.skillsUpgradeScope ?? "global";
  if (scope === "all" && skillNames.length > 0) {
    runtime.io.stderr("Use --scope global or --scope project when passing explicit skill names.");
    return 1;
  }

  const lockedSkills = loadLockedSkills({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope,
  });
  const selectedNames = skillNames.length > 0
    ? skillNames
    : options.skillsUpgradeAll
      ? []
      : await promptLockedSkills(lockedSkills, scope);

  if (!options.skillsUpgradeAll && selectedNames.length === 0) {
    runtime.io.stderr(`No ${scope === "all" ? "" : `${scope} `}tracked skills selected.`);
    return 1;
  }

  if (options.skillsUpgradeAll && lockedSkills.length === 0) {
    runtime.io.stderr(`No ${scope === "all" ? "" : `${scope} `}tracked skills found.`);
    return 1;
  }

  const commands = buildSkillUpgradeCommands({
    cwd: options.cwd,
    scope,
    skills: selectedNames,
    yes: options.yes,
  });

  return runSkillUpgradeCommands(runtime, commands);
}

function runSkillsList(runtime: Runtime, options: CliOptions): number {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: options.skillsListScope ?? "all",
    agent: options.skillsAgent,
  });

  const records = filterSkillRecords(snapshot.records, {
    category: options.skillsCategory,
    tag: options.skillsTag,
    uncategorized: options.skillsUncategorized,
    storage: options.skillsListStorage,
  });

  if (options.skillsJson) {
    runtime.io.stdout(JSON.stringify(records, null, 2));
    return 0;
  }

  if (records.length === 0) {
    runtime.io.stdout(renderSkillList(records, snapshot.categorization));
    return 0;
  }

  runtime.io.stdout(renderSkillList(records, snapshot.categorization));

  return 0;
}

async function promptLockedSkills(
  records: LockedSkillRecord[],
  scope: string,
): Promise<string[]> {
  if (records.length === 0) {
    return [];
  }

  console.log(renderPromptStep("Skill Upgrade", "Type to filter, use space to select one or more skills, then enter to continue."));
  return searchableCheckbox<string>({
    message: scope === "all" ? "Select skills to upgrade:" : `Select ${scope} skills to upgrade:`,
    choices: records.map((record) => ({
      name: formatLockedSkillChoice(record),
      value: record.name,
      description: [record.scope, record.source, record.skillPath].filter(Boolean).join(" · "),
      short: record.name,
    })),
    pageSize: 12,
    required: true,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkSearchableCheckboxTheme,
  });
}

async function runSkillsOpen(folder: string | undefined, runtime: Runtime, options: CliOptions): Promise<number> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "all",
    agent: options.skillsAgent,
  });
  const records = filterSkillRecords(snapshot.records, { storage: options.skillsListStorage });
  const record = folder
    ? findSkillRecord(records, folder)
    : await promptSkillRecord(records, "Select a skill to open:");

  if (!record) {
    runtime.io.stderr(folder ? `Skill not found: ${folder}` : "No skills found.");
    return 1;
  }

  const command = buildSkillOpenCommand(record, {
    app: options.skillOpenApp ?? "finder",
    target: options.skillOpenTarget ?? "file",
  });
  runtime.io.stdout(renderSkillOpen({
    folder: record.folder,
    app: options.skillOpenApp ?? "finder",
    target: command.targetPath,
    commandLine: `${command.command} ${command.args.map(quoteArg).join(" ")}`,
  }));

  const result = await runtime.spawn(command.command, command.args, options.cwd);
  if (result.code !== 0) {
    runtime.io.stderr(`Could not open ${command.targetPath} with ${options.skillOpenApp ?? "finder"}.`);
  }

  return result.code;
}

async function runSkillsShow(folder: string | undefined, runtime: Runtime, options: CliOptions): Promise<number> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "all",
    agent: options.skillsAgent,
  });
  const records = filterSkillRecords(snapshot.records, { storage: options.skillsListStorage });
  const record = folder
    ? findSkillRecord(records, folder)
    : await promptSkillRecord(records, "Select a skill to show:");

  if (!record) {
    runtime.io.stderr(folder ? `Skill not found: ${folder}` : "No skills found.");
    return 1;
  }

  if (options.skillsJson) {
    runtime.io.stdout(JSON.stringify(record, null, 2));
    return 0;
  }

  runtime.io.stdout(renderSkillDetails(record));
  return 0;
}

async function runSkillsMove(folder: string | undefined, enabled: boolean, runtime: Runtime, options: CliOptions): Promise<number> {
  const candidates = loadMutationSkillRecords(options)
    .filter((record) => record.storage === (enabled ? "disabled" : "active"));
  const record = folder
    ? findSkillRecord(candidates, folder)
    : await promptSkillRecord(candidates, enabled
      ? `Select ${mutationTargetLabel(options)} skill to enable:`
      : `Select ${mutationTargetLabel(options)} skill to disable:`);

  if (!record) {
    runtime.io.stderr(folder
      ? `Skill not found: ${folder}`
      : `No ${enabled ? "disabled" : "active"} ${mutationTargetLabel(options)} skills found.`);
    return 1;
  }

  const movement = moveSkillRecord({
    record,
    enabled,
    dryRun: options.dryRun,
  });

  runtime.io.stdout(renderSkillMove({
    folder: record.folder,
    enabled,
    dryRun: options.dryRun,
    movement,
  }));
  return 0;
}

async function runSkillsInvocation(operands: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const action = operands[0] === "enable" || operands[0] === "disable" ? operands[0] : "disable";
  const folder = operands[0] === "enable" || operands[0] === "disable" ? operands[1] : operands[0];
  const allowInvocation = action === "enable";
  const candidates = loadMutationSkillRecords(options);
  const record = folder
    ? findSkillRecord(candidates, folder)
    : await promptSkillRecord(candidates, allowInvocation
      ? `Select ${mutationTargetLabel(options)} skill to enable auto invocation:`
      : `Select ${mutationTargetLabel(options)} skill to disable auto invocation:`);

  if (!record) {
    runtime.io.stderr(folder ? `Skill not found: ${folder}` : `No ${mutationTargetLabel(options)} skills found.`);
    return 1;
  }

  const result = setSkillInvocationPolicy({
    record,
    allowInvocation,
    dryRun: options.dryRun,
  });

  runtime.io.stdout(renderSkillInvocationPolicy(result));
  return 0;
}

async function runSkillsDelete(folder: string | undefined, runtime: Runtime, options: CliOptions): Promise<number> {
  const globalCandidates = loadMutationSkillRecords(options);
  const candidates = options.skillsDeleteManifestOnly
    ? filterManifestSkillRecords(globalCandidates, options)
    : globalCandidates;
  const records = folder
    ? [findSkillRecord(candidates, folder)].filter((record): record is SkillRecord => Boolean(record))
    : await promptSkillRecords(candidates, `Select ${mutationTargetLabel(options)} skill to delete:`);

  if (records.length === 0) {
    runtime.io.stderr(folder
      ? options.skillsDeleteManifestOnly ? `Skill not found in skills.json manifest: ${folder}` : `Skill not found: ${folder}`
      : options.skillsDeleteManifestOnly
        ? `No ${mutationTargetLabel(options)} skills from skills.json manifest found.`
        : `No ${mutationTargetLabel(options)} skills found.`);
    return 1;
  }

  const readOnlyRecord = records.find((record) => record.readOnly);
  if (readOnlyRecord) {
    runtime.io.stderr(`Cannot delete ${readOnlyRecord.folder}; ${readOnlyRecord.rootLabel} is read-only.`);
    return 1;
  }

  if (!options.yes && !options.dryRun) {
    const count = records.length;
    const accepted = await confirm({
      message: count === 1 ? `Permanently delete ${records[0]?.folder ?? "skill"}?` : `Permanently delete ${count} skills?`,
      default: false,
      theme: afkPromptTheme,
    });
    if (!accepted) {
      runtime.io.stdout("Delete cancelled. Nothing was changed.");
      return 0;
    }
  }

  const movements = deleteSkillRecords({
    homeDir: options.homeDir,
    records,
    dryRun: options.dryRun,
  });
  runtime.io.stdout(renderSkillDeleteBatch({
    items: movements,
    dryRun: options.dryRun,
  }));
  return 0;
}

function setSkillInvocationPolicy(options: {
  record: SkillRecord;
  allowInvocation: boolean;
  dryRun: boolean;
}): {
  folder: string;
  allowInvocation: boolean;
  dryRun: boolean;
  operations: ReturnType<typeof buildSkillInvocationPolicyOperations>;
} {
  const operations = buildSkillInvocationPolicyOperations(options.record, options.allowInvocation);

  if (!options.dryRun) {
    for (const operation of operations) {
      applyOperation(operation);
    }
  }

  return {
    folder: options.record.folder,
    allowInvocation: options.allowInvocation,
    dryRun: options.dryRun,
    operations,
  };
}

function buildSkillInvocationPolicyOperations(record: SkillRecord, allowInvocation: boolean) {
  const skillDir = join(record.rootPath, record.folder);
  const openaiYaml = join(skillDir, "agents", "openai.yaml");
  const currentSkillMd = readText(record.skillFilePath);
  const nextSkillMd = upsertFrontmatterBoolean(currentSkillMd, "disable-model-invocation", !allowInvocation);
  const currentOpenAiYaml = pathExists(openaiYaml) ? readText(openaiYaml) : "";
  const nextOpenAiYaml = upsertOpenAiImplicitInvocation(currentOpenAiYaml, allowInvocation);

  return [
    nextSkillMd === currentSkillMd ? undefined : {
      type: "write" as const,
      path: record.skillFilePath,
      content: nextSkillMd,
    },
    nextOpenAiYaml === currentOpenAiYaml ? undefined : {
      type: "write" as const,
      path: openaiYaml,
      content: nextOpenAiYaml,
    },
  ].filter((operation): operation is NonNullable<typeof operation> => Boolean(operation));
}

export function buildSkillOpenCommand(record: SkillRecord, options: {
  app: SkillOpenApp;
  target: "file" | "folder";
}): { command: string; args: string[]; targetPath: string } {
  const targetPath = options.target === "folder" ? join(record.rootPath, record.folder) : record.skillFilePath;
  if (options.app === "finder") {
    return { command: "open", args: [targetPath], targetPath };
  }

  return { command: options.app, args: [targetPath], targetPath };
}

export function filterSkillChoices(records: SkillRecord[], term: string | undefined): SkillRecord[] {
  const tokens = term?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return records;
  }

  return records.filter((record) => {
    const searchable = [
      record.folder,
      record.name,
      record.originalName,
      record.description,
      record.rootLabel,
      record.category ?? "",
      record.agent ?? "",
      record.storage,
      ...record.tags,
    ].join(" ").toLowerCase();

    return tokens.every((token) => searchable.includes(token));
  });
}

export function filterManifestSkillRecords(records: SkillRecord[], options: Pick<CliOptions, "homeDir">): SkillRecord[] {
  const manifest = loadSkillManifest(options);
  const manifestIds = new Set(manifest.items.map((item) => item.id.trim().toLowerCase()).filter(Boolean));

  return records.filter((record) =>
    manifestIds.has(record.folder.toLowerCase()) ||
    manifestIds.has(record.name.toLowerCase()) ||
    manifestIds.has(record.originalName.toLowerCase())
  );
}

function loadMutationSkillRecords(options: CliOptions): SkillRecord[] {
  const scope = options.scopeExplicit ? options.skillsListScope ?? "global" : "global";
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope,
    agent: options.skillsAgent,
  });

  const records = options.skillsAgent
    ? snapshot.records
    : snapshot.records.filter((record) => record.rootKind === "global-library");

  return filterSkillRecords(records, { storage: options.skillsListStorage });
}

function mutationTargetLabel(options: CliOptions): string {
  if (options.skillsAgent) {
    if (options.skillsAgent === "shared") {
      return "shared";
    }

    const scope = options.scopeExplicit ? options.skillsListScope ?? "global" : "global";
    return `${scope} ${options.skillsAgent}`;
  }

  return "global";
}

function skillProfileContext(options: CliOptions): SkillProfileContext {
  return {
    homeDir: options.homeDir,
    cwd: options.cwd,
    local: options.manifestLocal,
  };
}

async function promptNewSkillProfileId(): Promise<string> {
  console.log(renderPromptStep("Skill Profile", "Create a profile id, then choose the skills that belong to it."));
  return input({
    message: "Profile id:",
    required: true,
    theme: afkPromptTheme,
  });
}

async function promptOptionalSkillProfileName(id: string): Promise<string | undefined> {
  const value = await input({
    message: "Profile name:",
    default: humanizeProfileId(id),
    theme: afkPromptTheme,
  });
  return value.trim() || undefined;
}

async function promptSkillProfile(profiles: SkillProfileItem[], message: string): Promise<SkillProfileItem | undefined> {
  if (profiles.length === 0) {
    return undefined;
  }

  console.log(renderPromptStep("Skill Profile", "Type to filter by profile id, name, or skill."));
  return search<SkillProfileItem>({
    message,
    source: async (term) => filterSkillProfiles(profiles, term).map((profile) => ({
      name: `${strong(accent(profile.name))} ${muted(`[${profile.id}]`)}`,
      value: profile,
      description: profile.skills.join(", "),
    })),
    pageSize: 12,
    instructions: {
      navigation: "Use arrow keys to move.",
      pager: "Type to filter; use arrow keys to reveal more choices.",
    },
    theme: afkSearchTheme,
  });
}

async function promptSkillRecord(records: SkillRecord[], message: string): Promise<SkillRecord | undefined> {
  if (records.length === 0) {
    return undefined;
  }

  console.log(renderPromptStep("Skill", "Type to filter by name, folder, category, tag, or source."));
  return search<SkillRecord>({
    message,
    source: async (term) => filterSkillChoices(records, term).map((record) => ({
      name: renderSkillChoice(record),
      value: record,
      description: renderSkillChoiceDescription(record),
    })),
    pageSize: 12,
    instructions: {
      navigation: "Use arrow keys to move.",
      pager: "Type to filter; use arrow keys to reveal more choices.",
    },
    theme: afkSearchTheme,
  });
}

async function promptSkillRecords(records: SkillRecord[], message: string): Promise<SkillRecord[]> {
  if (records.length === 0) {
    return [];
  }

  console.log(renderPromptStep("Skill", "Type to filter, use space to select one or more skills, then enter to continue."));
  return searchableCheckbox<SkillRecord>({
    message,
    choices: records.map((record) => ({
      name: renderSkillChoice(record),
      value: record,
      description: renderSkillChoiceDescription(record),
      short: record.folder,
    })),
    pageSize: 12,
    required: true,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkSearchableCheckboxTheme,
  });
}

function findSkillRecord(records: SkillRecord[], value: string): SkillRecord | undefined {
  const normalized = value.trim().toLowerCase();
  return records.find((record) =>
    record.folder.toLowerCase() === normalized ||
    record.name.toLowerCase() === normalized ||
    record.originalName.toLowerCase() === normalized
  );
}

function findSkillProfile(profiles: SkillProfileItem[], value: string): SkillProfileItem | undefined {
  const normalized = value.trim().toLowerCase();
  return profiles.find((profile) => profile.id.toLowerCase() === normalized || profile.name.toLowerCase() === normalized);
}

function filterSkillProfiles(profiles: SkillProfileItem[], term: string | undefined): SkillProfileItem[] {
  const tokens = term?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  if (tokens.length === 0) {
    return profiles;
  }

  return profiles.filter((profile) => {
    const searchable = [profile.id, profile.name, ...profile.skills].join(" ").toLowerCase();
    return tokens.every((token) => searchable.includes(token));
  });
}

function humanizeProfileId(id: string): string {
  return id
    .trim()
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatLockedSkillChoice(record: LockedSkillRecord): string {
  return [
    strong(record.name),
    badge(record.scope),
    muted(record.source),
  ].join(" ");
}

function strong(value: string): string {
  return `${bold}${paint(terminalPalette.brass, value)}${reset}`;
}

function section(value: string): string {
  return `${paint(terminalPalette.rust, "◆")} ${bold}${value}${reset}`;
}

function accent(value: string): string {
  return paint(terminalPalette.brass, value);
}

function badge(value: string): string {
  return paint(terminalPalette.harbor, `[${value}]`);
}

function muted(value: string): string {
  return paint(terminalPalette.driftwood, value);
}
