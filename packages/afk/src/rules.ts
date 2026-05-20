import { dirname, join } from "node:path";
import { applyOperation, backupTarget, formatOperation, isSymlink, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { filterAgents } from "./agents.js";
import { loadRulesManifest } from "./manifest.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

const afkRegionStart = "<!-- AFK:RULES:START -->";
const afkRegionEnd = "<!-- AFK:RULES:END -->";
const legacyImportStart = "<!-- AFK:IMPORT:START -->";
const legacyImportEnd = "<!-- AFK:IMPORT:END -->";
const linkedRulesAgents: AgentId[] = ["codex", "gemini", "opencode"];

type RulesContent = {
  afk: string;
};

export async function syncRules(runtime: Runtime, options: CliOptions): Promise<number> {
  const content = await loadRulesContent(options);
  const operations = planRulesSync(options, content);

  if (options.dryRun) {
    printOperations(runtime, "Rules sync plan", operations);
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nRules synced: ${summarizeOperations(operations)}.`);
  return 0;
}

export function planRulesSync(
  options: Pick<CliOptions, "agents" | "homeDir" | "cwd" | "setupScope">,
  content: RulesContent,
): PathOperation[] {
  const timestamp = compactTimestamp();
  const operations: PathOperation[] = [];
  const normalizedRules = normalizeAfkRules(content.afk);

  if (options.setupScope === "project") {
    return planProjectRules(options, normalizedRules, timestamp);
  }

  const agentsDir = join(options.homeDir, ".agents");
  const agentsHost = join(agentsDir, "AGENTS.md");

  operations.push({ type: "mkdir", path: agentsDir });
  operations.push(...removeLegacySidecars(agentsDir, timestamp));
  operations.push(...upsertManagedRulesRegion(agentsHost, normalizedRules, timestamp));

  for (const agent of filterAgents(options.agents, linkedRulesAgents)) {
    operations.push(...removeLegacySidecars(dirname(agentRulesDestination(options.homeDir, agent)), timestamp));
    operations.push(
      ...replaceWithSymlink(agentRulesDestination(options.homeDir, agent), agentsHost, timestamp),
    );
  }

  if (shouldConfigureClaude(options.agents)) {
    operations.push(...planClaudeRules(options.homeDir, { afk: normalizedRules }, timestamp));
  }

  return operations;
}

function planProjectRules(
  options: Pick<CliOptions, "agents" | "cwd">,
  normalizedRules: string,
  timestamp: string,
): PathOperation[] {
  const operations: PathOperation[] = [];
  const selected = filterAgents(options.agents, ["claude", "codex", "gemini", "opencode"]);
  const hostPaths = new Set<string>();

  for (const agent of selected) {
    hostPaths.add(projectRulesDestination(options.cwd, agent));
  }

  for (const path of hostPaths) {
    operations.push(...upsertManagedRulesRegion(path, normalizedRules, timestamp));
  }

  return operations;
}

async function loadRulesContent(options: Pick<CliOptions, "homeDir" | "repoDir" | "rulesRef" | "rulesSource">): Promise<RulesContent> {
  const manifest = loadRulesManifest(options);
  if (!manifest.url) {
    return { afk: "" };
  }

  const source = options.rulesSource === "manifest" ? manifest.source : options.rulesSource;
  const agents =
    source === "local"
      ? await readLocalRule(options.repoDir, localRulesPath(manifest.url))
      : await fetchGithubRule(manifest.url);

  return {
    afk: normalizeAfkRules(agents),
  };
}

async function readLocalRule(repoDir: string, file: string): Promise<string> {
  return readText(join(repoDir, file));
}

async function fetchGithubRule(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function localRulesPath(url: string): string {
  try {
    const parsed = new URL(url);
    const rawGithubMatch = parsed.hostname === "raw.githubusercontent.com" ? parsed.pathname.match(/^\/[^/]+\/[^/]+\/[^/]+\/(.+)$/) : null;
    if (rawGithubMatch?.[1]) {
      return rawGithubMatch[1];
    }
  } catch {
    return url;
  }

  return url.replace(/^\/+/, "");
}

function normalizeAfkRules(content: string): string {
  const withoutImports = content
    .split(/\r?\n/)
    .filter((line) => !isMarkdownImportLine(line))
    .join("\n");

  return ensureTrailingNewline(withoutImports);
}

function isMarkdownImportLine(line: string): boolean {
  return /^@[^\s]+\.md$/i.test(line.trim());
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function upsertManagedRulesRegion(path: string, afkRules: string, timestamp: string): PathOperation[] {
  const operations: PathOperation[] = [];
  const region = renderManagedRulesRegion(afkRules);

  if (isSymlink(path)) {
    operations.push({ type: "remove", path });
    operations.push({ type: "write", path, content: region });
    return operations;
  }

  if (!pathExists(path)) {
    operations.push({ type: "write", path, content: region });
    return operations;
  }

  const current = readText(path);
  const next = updateManagedRulesRegion(current, region);
  if (current === next) {
    operations.push({ type: "skip", path, reason: "AFK rules region already current" });
    return operations;
  }

  const backup = backupTarget(path, timestamp);
  if (backup) {
    operations.push(backup);
  }

  operations.push({ type: "write", path, content: next });
  return operations;
}

function planClaudeRules(homeDir: string, content: RulesContent, timestamp: string): PathOperation[] {
  const claudeDir = join(homeDir, ".claude");
  const operations: PathOperation[] = [{ type: "mkdir", path: claudeDir }];

  operations.push(...removeLegacySidecars(claudeDir, timestamp));
  operations.push(...upsertManagedRulesRegion(join(claudeDir, "CLAUDE.md"), content.afk, timestamp));

  return operations;
}

function shouldConfigureClaude(agents: AgentId[]): boolean {
  return agents.length === 0 || agents.includes("claude");
}

function replaceWithSymlink(destination: string, source: string, timestamp: string): PathOperation[] {
  const operations: PathOperation[] = [];
  const backup = backupTarget(destination, timestamp);
  if (backup) {
    operations.push(backup);
  }
  if (pathExists(destination) || isSymlink(destination)) {
    operations.push({ type: "remove", path: destination });
  }
  operations.push({ type: "symlink", source, target: destination });

  return operations;
}

function removeLegacySidecars(directory: string, timestamp: string): PathOperation[] {
  const operations: PathOperation[] = [];

  for (const filename of ["AFK.md", "AFK_WORKFLOW.md"]) {
    const path = join(directory, filename);
    if (!pathExists(path) && !isSymlink(path)) {
      continue;
    }

    const backup = backupTarget(path, timestamp);
    if (backup) {
      operations.push(backup);
    }
    operations.push({ type: "remove", path });
  }

  return operations;
}

function agentRulesDestination(homeDir: string, agent: AgentId): string {
  switch (agent) {
    case "codex":
      return join(homeDir, ".codex", "AGENTS.md");
    case "gemini":
      return join(homeDir, ".gemini", "GEMINI.md");
    case "opencode":
      return join(homeDir, ".config", "opencode", "AGENTS.md");
    default:
      throw new Error(`Unsupported linked rules agent: ${agent}`);
  }
}

function projectRulesDestination(cwd: string, agent: AgentId): string {
  switch (agent) {
    case "claude":
      return join(cwd, "CLAUDE.md");
    case "gemini":
      return join(cwd, "GEMINI.md");
    case "codex":
    case "opencode":
      return join(cwd, "AGENTS.md");
  }
}

function renderManagedRulesRegion(afkRules: string): string {
  return ensureTrailingNewline([afkRegionStart, ensureTrailingNewline(afkRules).trimEnd(), afkRegionEnd, ""].join("\n"));
}

function updateManagedRulesRegion(current: string, region: string): string {
  if (current.includes(afkRegionStart)) {
    const pattern = new RegExp(`${escapeRegExp(afkRegionStart)}[\\s\\S]*?${escapeRegExp(afkRegionEnd)}\\n?`);
    return ensureTrailingNewline(current.replace(pattern, region));
  }

  if (current.includes(legacyImportStart)) {
    const pattern = new RegExp(`${escapeRegExp(legacyImportStart)}[\\s\\S]*?${escapeRegExp(legacyImportEnd)}\\n?`);
    return ensureTrailingNewline(current.replace(pattern, region));
  }

  const lines = current.split(/\r?\n/);
  const firstLocalImportIndex = lines.findIndex((line) => line === "@RTK.md" || line === "<!-- OMC:IMPORT:START -->");
  if (firstLocalImportIndex >= 0) {
    const before = lines.slice(0, firstLocalImportIndex).join("\n").trimEnd();
    const after = lines.slice(firstLocalImportIndex).join("\n").trimStart();
    return ensureTrailingNewline([before, region, after].filter(Boolean).join("\n\n"));
  }

  return `${region}\n${current}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
}

function printOperations(runtime: Runtime, title: string, operations: PathOperation[]): void {
  runtime.io.stdout(`\n${title}`);
  for (const operation of operations) {
    runtime.io.stdout(`- ${formatOperation(operation)}`);
  }
}
