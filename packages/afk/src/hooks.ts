import { existsSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { applyOperation, formatOperation, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { loadHookManifest, type HookManifestItem } from "./manifest.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

type HookAgentId = "codex" | "claude" | "cursor-local";

const hookAgents: HookAgentId[] = ["codex", "claude", "cursor-local"];

export async function syncHooks(runtime: Runtime, options: CliOptions): Promise<number> {
  const operations = await planHooksSync(options);

  if (options.dryRun) {
    runtime.io.stdout("\nHooks install plan");
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nHooks installed: ${summarizeOperations(operations)}.`);
  return 0;
}

export async function planHooksSync(options: Pick<CliOptions, "agents" | "homeDir" | "cwd" | "repoDir" | "selectedHookIds" | "setupScope">): Promise<PathOperation[]> {
  const manifest = loadHookManifest(options);
  const selected = selectHookItems(manifest.items, options.selectedHookIds);
  const operations: PathOperation[] = [];

  for (const item of selected) {
    const sourceContent = await loadHookSource(item.source, options);
    for (const agent of selectedHookAgents(options.agents, item.agents)) {
      operations.push(...planAgentHook(agent, options, item, sourceContent));
    }
  }

  return operations;
}

function selectHookItems(items: HookManifestItem[], selectedHookIds: string[]): HookManifestItem[] {
  if (selectedHookIds.length > 0) {
    return items.filter((item) => selectedHookIds.includes(item.id));
  }

  return items.filter((item) => item.default);
}

function selectedHookAgents(selected: AgentId[], supported: HookAgentId[]): HookAgentId[] {
  return selected.filter((agent): agent is HookAgentId => hookAgents.includes(agent as HookAgentId) && supported.includes(agent as HookAgentId));
}

function planAgentHook(
  agent: HookAgentId,
  options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">,
  item: HookManifestItem,
  sourceContent: string,
): PathOperation[] {
  const scriptPath = agentScriptPath(agent, options, item);
  const configPath = agentConfigPath(agent, options);
  const current = pathExists(configPath) ? readText(configPath) : "";
  const command = buildHookCommand(item, scriptPath, agent);
  const config = mergeAgentHookConfig(agent, current, command, item);
  return [
    {
      type: "write",
      path: scriptPath,
      content: sourceContent,
    },
    { type: "write", path: configPath, content: `${JSON.stringify(config, null, 2)}\n` },
  ];
}

function agentScriptPath(agent: HookAgentId, options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, item: HookManifestItem): string {
  const base = options.setupScope === "project" ? options.cwd : options.homeDir;
  const filename = safeHookFilename(item);

  switch (agent) {
    case "codex":
      return join(base, ".codex", "hooks", filename);
    case "claude":
      return join(base, ".claude", "hooks", filename);
    case "cursor-local":
      return join(base, ".cursor", "hooks", filename);
  }
}

function agentConfigPath(agent: HookAgentId, options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">): string {
  const base = options.setupScope === "project" ? options.cwd : options.homeDir;

  switch (agent) {
    case "codex":
      return join(base, ".codex", "hooks.json");
    case "claude":
      return join(base, ".claude", "settings.json");
    case "cursor-local":
      return join(base, ".cursor", "hooks.json");
  }
}

function mergeAgentHookConfig(agent: HookAgentId, current: string, command: string, item: HookManifestItem): Record<string, unknown> {
  const config = parseJsonObject(current);
  const hooks = getOrCreateRecord(config, "hooks");

  if (agent === "cursor-local") {
    config.version = typeof config.version === "number" ? config.version : 1;
    mergeCursorStopHook(hooks, command, item);
    return config;
  }

  mergeCodexClaudeStopHook(hooks, command, item);
  return config;
}

function mergeCodexClaudeStopHook(hooks: Record<string, unknown>, command: string, item: HookManifestItem): void {
  const entries = getOrCreateArray(hooks, "Stop");
  const handler = {
    type: "command",
    command,
    statusMessage: "Checking AFK tracking",
  };

  upsertMatcherHook(entries, "", handler, command, item);
}

function mergeCursorStopHook(hooks: Record<string, unknown>, command: string, item: HookManifestItem): void {
  const entries = getOrCreateArray(hooks, "stop");
  const hook = { command };

  if (entries.some((entry) => isRecord(entry) && entry.command === command)) {
    return;
  }

  const filtered = entries.filter((entry) => !isRecord(entry) || !isManagedHookCommand(entry.command, item));
  filtered.push(hook);
  hooks.stop = filtered;
}

function upsertMatcherHook(
  entries: unknown[],
  matcher: string,
  handler: Record<string, unknown>,
  command: string,
  item: HookManifestItem,
): void {
  const existingGroup = entries.find((entry) => isRecord(entry) && entry.matcher === matcher);
  const group: Record<string, unknown> = isRecord(existingGroup) ? existingGroup : { matcher, hooks: [] };
  if (!isRecord(existingGroup)) {
    entries.push(group);
  }

  const hooks = Array.isArray(group.hooks) ? group.hooks : [];
  const filtered = hooks.filter((hook) => !isRecord(hook) || (!isManagedHookCommand(hook.command, item) && hook.command !== command));
  filtered.push(handler);
  group.hooks = filtered;
}

function buildHookCommand(item: HookManifestItem, hookFile: string, agent: HookAgentId): string {
  const args = item.args.map((arg) => replaceHookPlaceholders(arg, hookFile, agent));
  return [item.command, ...args].map(quoteArg).join(" ");
}

function replaceHookPlaceholders(value: string, hookFile: string, agent: HookAgentId): string {
  return value
    .replaceAll("${HOOK_FILE}", hookFile)
    .replaceAll("${AGENT}", agent);
}

function safeHookFilename(item: HookManifestItem): string {
  const sourceName = filenameFromSource(item.source);
  if (sourceName) {
    return sourceName;
  }

  return `${item.id.replace(/[^a-z0-9._-]+/gi, "-")}.js`;
}

function filenameFromSource(source: string): string {
  try {
    const parsed = new URL(source);
    return basename(parsed.pathname);
  } catch {
    return basename(source);
  }
}

async function loadHookSource(source: string, options: Pick<CliOptions, "cwd" | "repoDir">): Promise<string> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Could not fetch hook source ${source}: ${response.status} ${response.statusText}`);
    }

    return ensureTrailingNewline(await response.text());
  }

  const path = resolveHookSourcePath(source, options);
  return ensureTrailingNewline(readFileSync(path, "utf8"));
}

function resolveHookSourcePath(source: string, options: Pick<CliOptions, "cwd" | "repoDir">): string {
  const candidates = [
    isAbsolute(source) ? source : resolve(options.cwd, source),
    isAbsolute(source) ? source : resolve(options.repoDir, source),
  ];

  for (const candidate of unique(candidates)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing hook source: ${source}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function isManagedHookCommand(value: unknown, item: HookManifestItem): boolean {
  const filename = safeHookFilename(item);
  return typeof value === "string" && filename.length > 0 && value.includes(filename);
}

function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_./:=@-]+$/.test(value)) {
    return value;
  }

  return JSON.stringify(value);
}

function parseJsonObject(content: string): Record<string, unknown> {
  if (!content.trim()) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getOrCreateRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  record[key] = next;
  return next;
}

function getOrCreateArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];
  if (Array.isArray(value)) {
    return value;
  }

  const next: unknown[] = [];
  record[key] = next;
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
