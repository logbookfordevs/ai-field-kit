import { confirm, input, search } from "@inquirer/prompts";
import { join } from "node:path";
import { afkPromptTheme, afkSearchTheme, renderPromptStep } from "../prompt-ui.js";
import type { CliOptions, Runtime, SkillOpenApp } from "../types.js";
import { quoteArg } from "../delegates.js";
import {
  filterSkillRecords,
  loadSkillCatalog,
  moveGlobalSkill,
  renameCodexSkillMetadata,
  renameGlobalSkill,
  trashGlobalSkill,
  type SkillRecord,
} from "./catalog.js";
import { runCodexCategorization } from "./categorization.js";
import {
  renderSkillChoice,
  renderSkillDetails,
  renderSkillList,
  renderSkillMove,
  renderSkillOpen,
  renderSkillRename,
  renderSkillTrash,
} from "./render.js";

type SkillCommandName = "list" | "show" | "open" | "disable" | "enable" | "rename" | "trash" | "categorize";

export async function runSkillsCommand(commandPath: string[], runtime: Runtime, options: CliOptions): Promise<number> {
  const command = commandPath[1] as SkillCommandName | undefined;
  const operands = commandPath.slice(2);

  try {
    switch (command) {
      case "list":
        return runSkillsList(runtime, options);
      case "show":
        return runSkillsShow(operands[0], runtime, options);
      case "open":
        return runSkillsOpen(operands[0], runtime, options);
      case "disable":
        return runSkillsMove(operands[0], false, runtime, options);
      case "enable":
        return runSkillsMove(operands[0], true, runtime, options);
      case "rename":
        return runSkillsRename(operands[0], operands.slice(1).join(" "), runtime, options);
      case "trash":
        return runSkillsTrash(operands[0], runtime, options);
      case "categorize":
        return runCodexCategorization(runtime, {
          homeDir: options.homeDir,
          cwd: options.cwd,
          dryRun: options.dryRun,
          mode: options.skillCategorizationMode,
          instruction: options.skillCategorizationInstruction,
        });
      default:
        runtime.io.stderr(`Unknown skills command: ${command ?? "(none)"}`);
        return 1;
    }
  } catch (error) {
    runtime.io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
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
    platform: options.skillsPlatform,
    uncategorized: options.skillsUncategorized,
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

async function runSkillsOpen(folder: string | undefined, runtime: Runtime, options: CliOptions): Promise<number> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "all",
    agent: options.skillsAgent,
  });
  const record = folder
    ? findSkillRecord(snapshot.records, folder)
    : await promptSkillRecord(snapshot.records, "Select a skill to open:");

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
  const record = folder
    ? findSkillRecord(snapshot.records, folder)
    : await promptSkillRecord(snapshot.records, "Select a skill to show:");

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
  const resolvedFolder = folder ?? await promptGlobalSkillFolder({
    homeDir: options.homeDir,
    cwd: options.cwd,
    enabled,
  });

  if (!resolvedFolder) {
    runtime.io.stderr(`No ${enabled ? "disabled" : "active"} global skills found.`);
    return 1;
  }

  const movement = moveGlobalSkill({
    homeDir: options.homeDir,
    folder: resolvedFolder,
    enabled,
    dryRun: options.dryRun,
  });

  runtime.io.stdout(renderSkillMove({
    folder: resolvedFolder,
    enabled,
    dryRun: options.dryRun,
    movement,
  }));
  return 0;
}

async function runSkillsRename(folder: string | undefined, displayName: string, runtime: Runtime, options: CliOptions): Promise<number> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: options.skillAgentMetadata ? "all" : "global",
    agent: options.skillsAgent,
  });
  const candidates = options.skillAgentMetadata ? snapshot.records : snapshot.records.filter((record) => record.rootKind === "global-library");
  const record = folder
    ? findRenameSkillRecord(candidates, folder, Boolean(options.skillAgentMetadata))
    : await promptSkillRecord(candidates, options.skillAgentMetadata
      ? "Select a skill to rename:"
      : "Select a global skill to rename:");

  if (!record) {
    runtime.io.stderr(folder ? `Skill not found: ${folder}` : "No global skills found.");
    return 1;
  }

  const resolvedDisplayName = displayName.trim() || await input({
    message: "Display name:",
    default: record.name,
    validate: (value) => {
      if (!value.trim()) {
        return "Display name cannot be empty.";
      }
      if (/[\r\n]/.test(value)) {
        return "Display name must stay on a single line.";
      }
      return true;
    },
    theme: afkPromptTheme,
  });

  const path = record.rootKind === "global-library"
    ? renameGlobalSkill({
      homeDir: options.homeDir,
      folder: record.folder,
      displayName: resolvedDisplayName,
      dryRun: options.dryRun,
    })
    : undefined;
  const metadataPath = options.skillAgentMetadata === "codex"
    ? renameCodexSkillMetadata({
      record,
      displayName: resolvedDisplayName,
      dryRun: options.dryRun,
    })
    : undefined;

  runtime.io.stdout(renderSkillRename({
    folder: record.folder,
    displayName: resolvedDisplayName,
    path,
    metadataPath,
    dryRun: options.dryRun,
  }));
  return 0;
}

async function runSkillsTrash(folder: string | undefined, runtime: Runtime, options: CliOptions): Promise<number> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "all",
    agent: options.skillsAgent,
  });
  const candidates = snapshot.records.filter((record) => record.rootKind === "global-library");
  const record = folder
    ? findSkillRecord(snapshot.records, folder)
    : await promptSkillRecord(candidates, "Select a global skill to move to Trash:");

  if (!record) {
    runtime.io.stderr(folder ? `Skill not found: ${folder}` : "No global skills found.");
    return 1;
  }

  if (record.rootKind !== "global-library") {
    runtime.io.stderr(`Cannot trash ${record.folder}; ${record.rootLabel} is read-only.`);
    return 1;
  }

  if (!options.yes && !options.dryRun) {
    const accepted = await confirm({
      message: `Move ${record.folder} to Trash?`,
      default: false,
      theme: afkPromptTheme,
    });
    if (!accepted) {
      runtime.io.stdout("Trash cancelled. Nothing was changed.");
      return 0;
    }
  }

  const movement = trashGlobalSkill({
    homeDir: options.homeDir,
    folder: record.folder,
    dryRun: options.dryRun,
  });
  runtime.io.stdout(renderSkillTrash({
    folder: record.folder,
    movement,
    dryRun: options.dryRun,
  }));
  return 0;
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
      ...record.platforms,
    ].join(" ").toLowerCase();

    return tokens.every((token) => searchable.includes(token));
  });
}

async function promptGlobalSkillFolder(options: {
  homeDir: string;
  cwd: string;
  enabled: boolean;
}): Promise<string | undefined> {
  const snapshot = loadSkillCatalog({
    homeDir: options.homeDir,
    cwd: options.cwd,
    scope: "global",
    agent: undefined,
  });
  const records = snapshot.records.filter((record) => record.storage === (options.enabled ? "disabled" : "active"));
  const record = await promptSkillRecord(records, options.enabled
    ? "Select a disabled global skill to enable:"
    : "Select an active global skill to disable:");

  return record?.folder;
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
      description: record.description,
    })),
    pageSize: 10,
    instructions: {
      navigation: "Use arrow keys to move.",
      pager: "Type to filter; use arrow keys to reveal more choices.",
    },
    theme: afkSearchTheme,
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

function findRenameSkillRecord(records: SkillRecord[], value: string, allowAgentFolderTarget: boolean): SkillRecord | undefined {
  const normalized = value.trim().toLowerCase();
  if (allowAgentFolderTarget) {
    const byFolder = records.find((record) => record.folder.toLowerCase() === normalized);
    if (byFolder) {
      return byFolder;
    }
  }

  return records.find((record) =>
    record.rootKind === "global-library" && (
      record.folder.toLowerCase() === normalized ||
      record.name.toLowerCase() === normalized ||
      record.originalName.toLowerCase() === normalized
    )
  );
}

function formatSkillChoice(record: SkillRecord): string {
  const markers = [
    record.rootLabel,
    record.storage === "disabled" ? "disabled" : undefined,
    record.category,
  ].filter(Boolean);

  return `${record.name} [${record.folder}] (${markers.join(", ")})`;
}
