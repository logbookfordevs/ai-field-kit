import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { applyOperation, backupTarget, formatOperation, isDirectory, isFile, isSymlink, managedMarker, normalizeManagedRelativePath, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { cloneGithubCatalogSource, githubSourceSpecForRepo, loadRulesManifest, rulesManifestLayers } from "./manifest.js";
import type { CloneGithubSource, GithubSourceCheckout } from "./manifest.js";
import { validateRulesFileDestinations } from "./rules-file-destinations.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

const afkRegionStart = "<!-- AFK:RULES:START -->";
const afkRegionEnd = "<!-- AFK:RULES:END -->";
const legacyImportStart = "<!-- AFK:IMPORT:START -->";
const legacyImportEnd = "<!-- AFK:IMPORT:END -->";
const rulesDirectoryPlaceholder = "{{AFK_RULES_DIR}}";
const privateGithubCheckoutReadError = "Could not read the private GitHub rule source from the credential-aware Git checkout.";
const globalRulesAgents: AgentId[] = ["antigravity", "codex", "opencode", "pi"];

type LegacyRulesContent = {
  afk: string;
  files?: Array<{
    destination: string;
    content: string;
  }>;
};

type LoadedRulesLayer = {
  id: string;
  label: string;
  content: string;
  files?: Array<{
    destination: string;
    content: string;
  }>;
  legacy?: true;
};

type RulesContent = LegacyRulesContent | {
  layers: LoadedRulesLayer[];
};

export type RuleSourceLoader = {
  load: (source: string, repoDir: string, forceLocal: boolean) => Promise<string>;
  cleanup: () => void;
};

export function createRuleSourceLoader(cloneGithubSource: CloneGithubSource = cloneGithubCatalogSource): RuleSourceLoader {
  const checkoutPromises = new Map<string, Promise<GithubSourceCheckout>>();
  const checkouts = new Map<string, GithubSourceCheckout>();

  return {
    load: async (source, repoDir, forceLocal) => {
      if (forceLocal || !/^https?:\/\//.test(source)) {
        return readLocalRule(repoDir, localRulesPath(source));
      }

      let response: Response | null = null;
      try {
        response = await fetch(source);
        if (response.ok) {
          return response.text();
        }
      } catch {}

      const privateSource = privateGithubRuleSource(source);
      if (!privateSource) {
        throw new Error(`Could not fetch ${source}: ${response?.status ?? "network error"} ${response?.statusText ?? ""}`.trim());
      }

      const key = `${privateSource.owner}/${privateSource.repo}@${privateSource.ref}`;
      let checkoutPromise = checkoutPromises.get(key);
      if (!checkoutPromise) {
        checkoutPromise = cloneGithubSource(githubSourceSpecForRepo(privateSource.owner, privateSource.repo, privateSource.ref));
        checkoutPromises.set(key, checkoutPromise);
      }
      const checkout = await checkoutPromise;
      checkouts.set(key, checkout);
      const path = resolve(checkout.rootDir, privateSource.path);
      const relativePath = relative(checkout.rootDir, path);
      if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
        throw new Error(privateGithubCheckoutReadError);
      }
      if (!pathExists(path) || !isFile(path)) {
        throw new Error(privateGithubCheckoutReadError);
      }
      return readText(path);
    },
    cleanup: () => {
      for (const checkout of checkouts.values()) {
        checkout.cleanup();
      }
      checkouts.clear();
      checkoutPromises.clear();
    },
  };
}

function privateGithubRuleSource(source: string): { owner: string; repo: string; ref: string; path: string } | null {
  try {
    const parsed = new URL(source);
    if (parsed.hostname !== "raw.githubusercontent.com") {
      return null;
    }
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    if (!match) {
      return null;
    }
    const [, owner, repo, encodedRef, encodedPath] = match;
    if (!owner || !repo || !encodedRef || !encodedPath) {
      return null;
    }
    return {
      owner,
      repo,
      ref: decodeURIComponent(encodedRef),
      path: decodeURIComponent(encodedPath),
    };
  } catch {
    return null;
  }
}

export async function syncRules(runtime: Runtime, options: CliOptions): Promise<number> {
  const content = await loadRulesContent(options);
  const operations = planRulesSync(options, content);

  if (options.dryRun) {
    printRulesLayerOrder(runtime, options, content);
    printOperations(runtime, "Rules sync plan", operations);
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nRules synced: ${summarizeOperations(operations)}.`);
  return 0;
}

function printRulesLayerOrder(
  runtime: Runtime,
  options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">,
  content: RulesContent,
): void {
  const root = rulesFilesDestination(options);
  const layers = "layers" in content
    ? content.layers
    : [{ id: "legacy", label: "Rules", content: content.afk, files: content.files, legacy: true as const }];
  runtime.io.stdout("\nRules layers");
  if (layers.length === 0) {
    runtime.io.stdout("- (none)");
    return;
  }
  for (const [index, layer] of layers.entries()) {
    const destination = layer.legacy ? root : join(root, layer.id);
    runtime.io.stdout(`- ${index + 1}. ${layer.label} (${layer.id}) -> ${destination}`);
  }
}

export function planRulesSync(
  options: Pick<CliOptions, "agents" | "homeDir" | "cwd" | "setupScope">,
  content: RulesContent,
): PathOperation[] {
  const timestamp = compactTimestamp();
  const dependencyBase = rulesFilesBase(options);
  const dependencyRoot = rulesFilesDestination(options);
  const layers = normalizeLoadedRulesLayers(content, dependencyRoot);
  const normalizedRules = renderRulesLayers(layers);
  const files = layers.flatMap((layer) => (layer.files ?? []).map((file) => ({
    ...file,
    destination: layer.legacy ? file.destination : `${layer.id}/${file.destination}`,
  })));
  const hostOperations: PathOperation[] = [];

  if (options.setupScope === "project") {
    hostOperations.push(...planProjectRules(options, normalizedRules, timestamp));
  } else {
    for (const agent of options.agents.filter((agent) => globalRulesAgents.includes(agent))) {
      hostOperations.push(...removeLegacySidecars(dirname(agentRulesDestination(options.homeDir, agent)), timestamp));
      hostOperations.push(...upsertManagedRulesRegion(agentRulesDestination(options.homeDir, agent), normalizedRules, timestamp));
    }

    if (shouldConfigureClaude(options.agents)) {
      hostOperations.push(...planClaudeRules(options.homeDir, normalizedRules, timestamp));
    }
  }

  if (hostOperations.length === 0) {
    return [];
  }

  return [
    ...planRulesFiles(dependencyBase, dependencyRoot, files),
    ...hostOperations,
  ];
}

function normalizeLoadedRulesLayers(content: RulesContent, dependencyRoot: string): LoadedRulesLayer[] {
  const layers: LoadedRulesLayer[] = "layers" in content
    ? content.layers
    : [{
        id: "legacy",
        label: "Rules",
        content: content.afk,
        ...(content.files === undefined ? {} : { files: content.files }),
        legacy: true,
      }];

  return layers.map((layer) => {
    if (!layer.legacy && !/^[a-z0-9][a-z0-9._-]*$/.test(layer.id)) {
      throw new Error(`Invalid rules layer id: ${layer.id}`);
    }
    const layerDirectory = layer.legacy ? dependencyRoot : join(dependencyRoot, layer.id);
    return {
      ...layer,
      content: normalizeAfkRules(layer.content).replaceAll(rulesDirectoryPlaceholder, layerDirectory),
      ...(layer.files === undefined ? {} : { files: layer.files.map((file) => ({ ...file })) }),
    };
  });
}

function renderRulesLayers(layers: LoadedRulesLayer[]): string {
  return layers.map((layer) => {
    if (layer.legacy) {
      return layer.content.trimEnd();
    }
    return [
      `<!-- AFK:RULE-LAYER:${layer.id}:START -->`,
      layer.content.trimEnd(),
      `<!-- AFK:RULE-LAYER:${layer.id}:END -->`,
    ].join("\n");
  }).filter(Boolean).join("\n\n");
}

function planRulesFiles(base: string, root: string, files: NonNullable<LoadedRulesLayer["files"]>): PathOperation[] {
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
  const layers = rulesManifestLayers(manifest);
  const legacyLocal = "source" in manifest && (options.rulesSource === "manifest" ? manifest.source === "local" : options.rulesSource === "local");
  const sourceLoader = createRuleSourceLoader();

  try {
    return {
      layers: await Promise.all(layers.map(async (layer) => {
        const [content, ...files] = await Promise.all([
          sourceLoader.load(layer.source, options.repoDir, legacyLocal),
          ...(layer.files ?? []).map(async (file) => ({
            destination: file.destination,
            content: await sourceLoader.load(file.source, options.repoDir, options.rulesSource === "local"),
          })),
        ]);
        return {
          id: layer.id,
          label: layer.label,
          content,
          files,
          ...(layer.legacy ? { legacy: true as const } : {}),
        };
      })),
    };
  } finally {
    sourceLoader.cleanup();
  }
}

async function readLocalRule(repoDir: string, file: string): Promise<string> {
  return readText(isAbsolute(file) ? file : join(repoDir, file));
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

function planClaudeRules(homeDir: string, rules: string, timestamp: string): PathOperation[] {
  const claudeDir = join(homeDir, ".claude");
  const operations: PathOperation[] = [{ type: "mkdir", path: claudeDir }];

  operations.push(...removeLegacySidecars(claudeDir, timestamp));
  operations.push(...upsertManagedRulesRegion(join(claudeDir, "CLAUDE.md"), rules, timestamp));

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
