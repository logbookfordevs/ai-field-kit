import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative } from "node:path";
import { applyOperation, backupTarget, formatOperation, isDirectory, isFile, isSymlink, managedMarker, normalizeManagedRelativePath, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { loadRulesManifest } from "./manifest.js";
import { validateRulesFileDestinations } from "./rules-file-destinations.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

const afkRegionStart = "<!-- AFK:RULES:START -->";
const afkRegionEnd = "<!-- AFK:RULES:END -->";
const legacyImportStart = "<!-- AFK:IMPORT:START -->";
const legacyImportEnd = "<!-- AFK:IMPORT:END -->";
const rulesDirectoryPlaceholder = "{{AFK_RULES_DIR}}";
const globalRulesAgents: AgentId[] = ["antigravity", "codex", "opencode", "pi"];

type RulesContent = {
  afk: string;
  files?: Array<{
    destination: string;
    content: string;
  }>;
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
  const dependencyBase = rulesFilesBase(options);
  const dependencyRoot = rulesFilesDestination(options);
  const normalizedRules = normalizeAfkRules(content.afk).replaceAll(rulesDirectoryPlaceholder, dependencyRoot);
  const hostOperations: PathOperation[] = [];

  if (options.setupScope === "project") {
    hostOperations.push(...planProjectRules(options, normalizedRules, timestamp));
  } else {
    for (const agent of options.agents.filter((agent) => globalRulesAgents.includes(agent))) {
      hostOperations.push(...removeLegacySidecars(dirname(agentRulesDestination(options.homeDir, agent)), timestamp));
      hostOperations.push(...upsertManagedRulesRegion(agentRulesDestination(options.homeDir, agent), normalizedRules, timestamp));
    }

    if (shouldConfigureClaude(options.agents)) {
      hostOperations.push(...planClaudeRules(options.homeDir, { afk: normalizedRules }, timestamp));
    }
  }

  if (hostOperations.length === 0) {
    return [];
  }

  return [
    ...planRulesFiles(dependencyBase, dependencyRoot, content.files ?? []),
    ...hostOperations,
  ];
}

function planRulesFiles(base: string, root: string, files: NonNullable<RulesContent["files"]>): PathOperation[] {
  const operations: PathOperation[] = [];
  const destinations = new Map<string, string>();
  const inventoryPath = join(root, managedMarker);
  assertSafeRulesDirectory(base, root);
  assertSafeRulesFileDestination(root, managedMarker);
  const previousDestinations = readRulesFileInventory(inventoryPath);
  const validation = validateRulesFileDestinations(files.map((file) => file.destination));
  if (!validation.valid) {
    throw new Error(validation.errors[0]);
  }

  for (const [index, file] of files.entries()) {
    const destination = validation.normalized[index];
    if (!destination) {
      throw new Error(`Missing normalized rules file destination: ${file.destination}`);
    }
    destinations.set(destination, sha256(file.content));
    assertSafeRulesFileDestination(root, destination);

    const path = join(root, destination);
    if (pathExists(path) && readText(path) === file.content) {
      operations.push({ type: "skip", path, reason: "AFK rules file already current" });
      continue;
    }
    operations.push({ type: "write", path, content: file.content });
  }

  for (const [destination, installedHash] of previousDestinations) {
    if (destinations.has(destination)) {
      continue;
    }
    assertSafeRulesFileDestination(root, destination, false);
    const path = join(root, destination);
    if (!pathExists(path) && !isSymlink(path)) {
      continue;
    }
    if (!installedHash || !isFile(path) || isSymlink(path)) {
      operations.push({ type: "skip", path, reason: "stale AFK rules file is no longer an unchanged regular file" });
      continue;
    }
    if (sha256(readText(path)) !== installedHash) {
      operations.push({ type: "skip", path, reason: "stale AFK rules file was modified" });
      continue;
    }
    operations.push({ type: "remove", path });
  }

  if (destinations.size === 0) {
    if (pathExists(inventoryPath)) {
      operations.push({ type: "remove", path: inventoryPath });
    }
    return operations;
  }

  const inventoryContent = `${JSON.stringify({
    version: 1,
    files: [...destinations]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, fileHash]) => ({ path, sha256: fileHash })),
  }, null, 2)}\n`;
  if (pathExists(inventoryPath) && readText(inventoryPath) === inventoryContent) {
    operations.push({ type: "skip", path: inventoryPath, reason: "AFK rules file inventory already current" });
  } else {
    operations.push({ type: "write", path: inventoryPath, content: inventoryContent });
  }

  return operations;
}

function assertSafeRulesDirectory(base: string, root: string): void {
  let current = base;
  for (const segment of relative(base, root).split(/[\\/]+/).filter(Boolean)) {
    current = join(current, segment);
    if (isSymlink(current)) {
      throw new Error(`Rules files directory crosses a symlink: ${relative(base, current)}`);
    }
    if (pathExists(current) && !isDirectory(current)) {
      throw new Error(`Rules files directory is not a directory: ${relative(base, current)}`);
    }
  }
}

function assertSafeRulesFileDestination(
  root: string,
  destination: string,
  requireRegularDestination = true,
): void {
  let current = root;
  const segments = destination.split("/");
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment);
    if (isSymlink(current)) {
      throw new Error(`Rules file destination crosses a symlink: ${destination}`);
    }
    if (!pathExists(current)) {
      continue;
    }
    const isDestination = index === segments.length - 1;
    if (
      (!isDestination && !isDirectory(current)) ||
      (isDestination && requireRegularDestination && !isFile(current))
    ) {
      throw new Error(`Rules file destination is not a regular file path: ${destination}`);
    }
  }
}

function readRulesFileInventory(path: string): Map<string, string | null> {
  if (!pathExists(path)) {
    return new Map();
  }

  try {
    const parsed: unknown = JSON.parse(readText(path));
    if (!isRecord(parsed) || !Array.isArray(parsed.files)) {
      return new Map();
    }
    return new Map(parsed.files.flatMap((value): Array<[string, string | null]> => {
      if (typeof value === "string") {
        const normalized = normalizeManagedRelativePath(value);
        return normalized && normalized !== managedMarker ? [[normalized, null]] : [];
      }
      if (!isRecord(value) || typeof value.path !== "string" || typeof value.sha256 !== "string") {
        return [];
      }
      const normalized = normalizeManagedRelativePath(value.path);
      return normalized && normalized !== managedMarker && /^[a-f0-9]{64}$/i.test(value.sha256)
        ? [[normalized, value.sha256.toLowerCase()]]
        : [];
    }));
  } catch {
    return new Map();
  }
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rulesFilesDestination(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">): string {
  return join(rulesFilesBase(options), ".agents", "afk", "rules");
}

function rulesFilesBase(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">): string {
  return options.setupScope === "project" ? options.cwd : options.homeDir;
}

function planProjectRules(
  options: Pick<CliOptions, "agents" | "cwd">,
  normalizedRules: string,
  timestamp: string,
): PathOperation[] {
  const operations: PathOperation[] = [];
  const selected = options.agents.filter((agent) => ["antigravity", "claude", "codex", "opencode", "pi"].includes(agent));
  const hostPaths = new Set<string>();

  for (const agent of selected) {
    hostPaths.add(projectRulesDestination(options.cwd, agent));
  }

  for (const path of hostPaths) {
    operations.push(...upsertManagedRulesRegion(path, normalizedRules, timestamp));
  }

  return operations;
}

async function loadRulesContent(options: Pick<CliOptions, "homeDir" | "repoDir" | "rulesRef" | "rulesSource" | "manifestContents">): Promise<RulesContent> {
  const manifest = loadRulesManifest(options);
  if (!manifest.url) {
    return { afk: "" };
  }

  const source = options.rulesSource === "manifest" ? manifest.source : options.rulesSource;
  const [agents, ...files] = await Promise.all([
    loadRuleSource(manifest.url, options.repoDir, source === "local"),
    ...(manifest.files ?? []).map(async (file) => ({
      destination: file.destination,
      content: await loadRuleSource(file.source, options.repoDir, options.rulesSource === "local"),
    })),
  ]);

  return {
    afk: normalizeAfkRules(agents),
    files,
  };
}

async function loadRuleSource(source: string, repoDir: string, forceLocal: boolean): Promise<string> {
  if (forceLocal) {
    return readLocalRule(repoDir, localRulesPath(source));
  }
  if (/^https?:\/\//.test(source)) {
    return fetchGithubRule(source);
  }
  return readLocalRule(repoDir, source);
}

async function readLocalRule(repoDir: string, file: string): Promise<string> {
  return readText(isAbsolute(file) ? file : join(repoDir, file));
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
    const current = pathExists(path) ? readText(path) : "";
    const next = current ? updateManagedRulesRegion(current, region) : region;
    operations.push({ type: "remove", path });
    operations.push({ type: "write", path, content: next });
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
  return agents.includes("claude");
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
    case "antigravity":
      return join(homeDir, ".gemini", "GEMINI.md");
    case "opencode":
      return join(homeDir, ".config", "opencode", "AGENTS.md");
    case "pi":
      return join(homeDir, ".pi", "agent", "AGENTS.md");
    default:
      throw new Error(`Unsupported linked rules agent: ${agent}`);
  }
}

function projectRulesDestination(cwd: string, agent: AgentId): string {
  switch (agent) {
    case "claude":
      return join(cwd, "CLAUDE.md");
    case "antigravity":
      return join(cwd, "GEMINI.md");
    case "codex":
    case "opencode":
      return join(cwd, "AGENTS.md");
    case "pi":
      return join(cwd, ".pi", "agent", "AGENTS.md");
    case "cursor-local":
      return join(cwd, ".cursor", "rules", "afk.mdc");
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
