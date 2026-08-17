import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { manifestPath } from "./paths.js";
import type { CliOptions, ManifestCategory, ManifestFilename, PathOperation } from "./types.js";

export const manifestNames = ["skills.json", "profiles.json", "agents.json", "mcps.json", "presets.json", "rules.json", "plugins.json", "hooks.json"] as const;
const rawBaseUrl = "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit";
export const builtInDefaultsSource = "logbookfordevs/ai-field-kit";

export type ManifestName = (typeof manifestNames)[number];

export type SkillManifest = {
  version: number;
  defaultSource: string;
  scopes?: SkillManifestScope[];
  items: SkillManifestItem[];
};

export type SkillManifestScope = {
  id: string;
  label: string;
  description?: string;
};

export type SkillManifestItemCatalog = {
  scope?: string;
  tags?: string[];
};

export type SkillManifestItem = {
  id: string;
  label: string;
  source: string;
  args: string[];
  default: boolean;
  autoInvocation?: boolean;
  startDisabled?: boolean;
  role?: SkillManifestItemRole;
  composes?: string[];
  catalog?: SkillManifestItemCatalog;
  imported?: boolean;
};

export type SkillManifestItemRole = "primitive" | "wrapper" | "workflow" | "utility" | "reference" | "router";

export function expandComposedSkillIds(items: SkillManifestItem[], selectedIds: string[]): string[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const expanded = new Set(selectedIds);
  const queue = [...selectedIds];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    for (const dependencyId of byId.get(id)?.composes ?? []) {
      if (expanded.has(dependencyId)) continue;
      expanded.add(dependencyId);
      queue.push(dependencyId);
    }
  }

  return [...expanded];
}

export type McpManifest = {
  version: number;
  items: McpManifestItem[];
};

export type McpManifestItem = {
  id: string;
  label: string;
  source: string;
  args: string[];
  default: boolean;
};

export type CustomAgentManifest = {
  version: number;
  items: CustomAgentManifestItem[];
};

export type CustomAgentManifestItem = {
  id: string;
  label: string;
  source: string;
  default?: never;
};

export type LegacyRulesManifest = {
  version: number;
  source: "github" | "local";
  url: string;
  files?: RulesManifestFile[];
};

export type LayeredRulesManifest = {
  version: number;
  layers: RulesManifestLayer[];
};

export type RulesManifest = LegacyRulesManifest | LayeredRulesManifest;

export type RulesManifestLayer = {
  id: string;
  label: string;
  source: string;
  files?: RulesManifestFile[];
};

export type ResolvedRulesManifestLayer = RulesManifestLayer & {
  legacy?: true;
};

export type RulesManifestFile = {
  source: string;
  destination: string;
};

export type PluginManifest = {
  version: number;
  items: PluginManifestItem[];
};

export type PluginManifestItem = {
  id: string;
  label: string;
  description: string;
  install: {
    command: string;
    args: string[];
  };
  postInstall?: PluginPostInstallCommand;
  default: boolean;
};

export type PluginPostInstallCommand = {
  label?: string;
  command: string;
  args: string[];
};

export type HookManifest = {
  version: number;
  items: HookManifestItem[];
};

export type HookManifestItem = {
  id: string;
  label: string;
  description: string;
  source: string;
  command: string;
  args: string[];
  events: Array<"stop">;
  agents: Array<"codex" | "claude" | "cursor-local">;
  default: boolean;
};

export type PresetSelections = {
  skills?: string[];
  customAgents?: string[];
  mcps?: string[];
  plugins?: string[];
  hooks?: string[];
};

export type PresetManifestItem = {
  id: string;
  label: string;
  areas: string[];
  all?: boolean;
  selections?: PresetSelections;
};

export type PresetsManifest = {
  version: number;
  defaultsSource: string;
  presets: PresetManifestItem[];
};

type ManifestOptions = Pick<
  CliOptions,
  "homeDir" | "repoDir" | "rulesRef" | "rulesSource" | "empty" | "refreshDefaults" | "overrideRefresh" | "defaultsSource" | "dryRun" | "manifestLocal"
> & {
  cwd?: string;
  defaultsSourceExplicit?: boolean;
  rememberDefaultsSource?: boolean;
  selectedManifestCategories?: ManifestCategory[];
  cloneGithubSource?: CloneGithubSource;
};

type ManifestDirOptions = Pick<CliOptions, "homeDir" | "manifestLocal"> & {
  cwd?: string;
};

export type GithubSourceCheckout = {
  rootDir: string;
  cleanup: () => void;
};

export type GithubSourceSpec = {
  cloneUrl: string;
  ref: string;
  catalogDirs: string[];
};

export type CloneGithubSource = (source: GithubSourceSpec) => Promise<GithubSourceCheckout>;

type ManifestSourceSession = {
  markPublic: () => void;
  read: (name: ManifestName) => Promise<string | null>;
  cleanup: () => void;
};

export function localAfkDir(homeDir: string): string {
  return join(homeDir, ".agents", "afk");
}

export function localManifestDir(homeDir: string): string {
  return join(localAfkDir(homeDir), "catalog");
}

export function projectManifestDir(cwd: string): string {
  return join(cwd, "afk", "catalog");
}

export function readRememberedDefaultsSource(options: ManifestDirOptions): string {
  return rememberedDefaultsSource(manifestDirForOptions(options));
}

export function planRememberedDefaultsSourceUpdate(options: ManifestDirOptions, defaultsSource: string): PathOperation[] {
  const manifestDir = manifestDirForOptions(options);
  const presetsPath = join(manifestDir, "presets.json");
  const operations: PathOperation[] = [];

  if (!existsSync(manifestDir)) {
    operations.push({ type: "mkdir", path: manifestDir });
  }

  const trimmedSource = defaultsSource.trim();
  const existing = readExistingPresetsManifest(presetsPath);
  const next = {
    version: existing.version,
    defaultsSource: trimmedSource,
    presets: existing.presets,
  };

  operations.push({ type: "write", path: presetsPath, content: `${JSON.stringify(next, null, 2)}\n` });
  return operations;
}

export async function ensureLocalManifests(options: ManifestOptions): Promise<PathOperation[]> {
  const operations: PathOperation[] = [];
  const manifestDir = manifestDirForOptions(options);
  const rememberedSource = rememberedDefaultsSource(manifestDir);
  const effectiveDefaultsSource = options.defaultsSource || rememberedSource || builtInDefaultsSource;
  const rememberedSourceForWrite = options.rememberDefaultsSource === false ? rememberedSource : effectiveDefaultsSource;
  const shouldRefreshDefaults = options.refreshDefaults || options.defaultsSourceExplicit || Boolean(options.defaultsSource);
  const selectedNames = manifestNamesForCategories(options.selectedManifestCategories ?? []);

  if (!existsSync(manifestDir)) {
    operations.push({ type: "mkdir", path: manifestDir });
  }

  const sourceSession = createManifestSourceSession(options, effectiveDefaultsSource);
  try {
    for (const name of selectedNames) {
      const target = join(manifestDir, name);
      if (!shouldRefreshDefaults && existsSync(target)) {
        const migrated = migrateLocalManifest(name, readFileSync(target, "utf8"));
        if (migrated) {
          operations.push({ type: "write", path: target, content: migrated });
        }
        continue;
      }

      const rawContent = options.empty
        ? emptyManifestContent(name, options, effectiveDefaultsSource)
        : await defaultManifestContent(name, options, effectiveDefaultsSource, rememberedSourceForWrite, sourceSession);
      const content = rawContent ? mergedManifestContent(name, rawContent, target, options.overrideRefresh) : rawContent;
      if (content) {
        operations.push({ type: "write", path: target, content });
      } else if (options.overrideRefresh) {
        operations.push({ type: "write", path: target, content: emptyManifestContent(name, options, effectiveDefaultsSource) });
      } else if (existsSync(target)) {
        operations.push({ type: "skip", path: target, reason: "not provided by defaults source" });
      } else {
        operations.push({ type: "write", path: target, content: emptyManifestContent(name, options, effectiveDefaultsSource) });
      }
    }
  } finally {
    sourceSession.cleanup();
  }

  return operations;
}

function mergedManifestContent(name: ManifestName, content: string, targetPath: string, overrideRefresh = false): string {
  if (name === "skills.json") {
    return mergedSkillsManifestContent(content, targetPath, !overrideRefresh);
  }

  if (name === "profiles.json") {
    return mergedProfilesManifestContent(content, targetPath, !overrideRefresh);
  }

  if (name === "agents.json") {
    return mergedCustomAgentManifestContent(content, targetPath, !overrideRefresh);
  }

  if (name === "rules.json") {
    return mergedRulesManifestContent(content, targetPath, !overrideRefresh);
  }

  return content;
}

export async function loadDefaultManifestContent(name: ManifestName, options: ManifestOptions): Promise<string | null> {
  const manifestDir = manifestDirForOptions(options);
  const rememberedSource = rememberedDefaultsSource(manifestDir);
  const effectiveDefaultsSource = options.defaultsSource || rememberedSource || builtInDefaultsSource;
  const rememberedSourceForWrite = options.rememberDefaultsSource === false ? rememberedSource : effectiveDefaultsSource;
  const sourceSession = createManifestSourceSession(options, effectiveDefaultsSource);
  try {
    return await defaultManifestContent(name, options, effectiveDefaultsSource, rememberedSourceForWrite, sourceSession);
  } finally {
    sourceSession.cleanup();
  }
}

export async function loadSourceManifestContents(options: ManifestOptions): Promise<Partial<Record<ManifestFilename, string>>> {
  const contents: Partial<Record<ManifestFilename, string>> = {};
  const manifestDir = manifestDirForOptions(options);
  const rememberedSource = rememberedDefaultsSource(manifestDir);
  const effectiveDefaultsSource = options.defaultsSource || rememberedSource || builtInDefaultsSource;
  const rememberedSourceForWrite = options.rememberDefaultsSource === false ? rememberedSource : effectiveDefaultsSource;
  const sourceSession = createManifestSourceSession(options, effectiveDefaultsSource);

  try {
    for (const name of manifestNamesForCategories(options.selectedManifestCategories ?? [])) {
      contents[name] = await defaultManifestContent(name, options, effectiveDefaultsSource, rememberedSourceForWrite, sourceSession)
        ?? emptyManifestContent(name, options, effectiveDefaultsSource);
    }
  } finally {
    sourceSession.cleanup();
  }

  return contents;
}

export function manifestNamesForCategories(categories: ManifestCategory[]): ManifestName[] {
  if (categories.length === 0) {
    return [...manifestNames];
  }

  return categories.map(manifestNameForCategory);
}

export function manifestNameForCategory(category: ManifestCategory): ManifestName {
  switch (category) {
    case "rules":
      return "rules.json";
    case "skills":
      return "skills.json";
    case "profiles":
      return "profiles.json";
    case "agents":
      return "agents.json";
    case "mcps":
      return "mcps.json";
    case "plugins":
      return "plugins.json";
    case "hooks":
      return "hooks.json";
    case "presets":
      return "presets.json";
  }
}

export function isManifestValue(name: ManifestName, value: unknown): boolean {
  switch (name) {
    case "skills.json":
      return isSkillManifest(value);
    case "profiles.json":
      return isProfilesManifest(value);
    case "agents.json":
      return isCustomAgentManifest(value);
    case "mcps.json":
      return isMcpManifest(value);
    case "presets.json":
      return isPresetsManifest(value);
    case "rules.json":
      return isRulesManifest(value);
    case "plugins.json":
      return isPluginManifest(value);
    case "hooks.json":
      return isHookManifest(value);
  }
}

export function loadSkillManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): SkillManifest {
  return parseManifest<SkillManifest>(options, "skills.json", isSkillManifest);
}

export function loadMcpManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): McpManifest {
  return parseManifest<McpManifest>(options, "mcps.json", isMcpManifest);
}

export function loadCustomAgentManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): CustomAgentManifest {
  return parseManifest<CustomAgentManifest>(options, "agents.json", isCustomAgentManifest);
}

export function loadRulesManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): RulesManifest {
  return parseManifest<RulesManifest>(options, "rules.json", isRulesManifest);
}

export function loadPluginManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): PluginManifest {
  return parseManifest<PluginManifest>(options, "plugins.json", isPluginManifest);
}

export function loadHookManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): HookManifest {
  return parseManifest<HookManifest>(options, "hooks.json", isHookManifest);
}

export function loadPresetsManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): PresetsManifest {
  return parseManifest<PresetsManifest>(options, "presets.json", isPresetsManifest);
}

function parseManifest<T>(
  options: Pick<CliOptions, "homeDir" | "manifestContents">,
  name: ManifestName,
  guard: (value: unknown) => value is T,
): T {
  const content = options.manifestContents?.[name as ManifestFilename];
  if (content !== undefined) {
    const parsed: unknown = JSON.parse(content);
    if (!guard(parsed)) {
      throw new Error(`Invalid AFK catalog file from setup source: ${name}`);
    }

    return parsed;
  }

  const path = join(localManifestDir(options.homeDir), name);
  if (!existsSync(path)) {
    throw new Error(`Missing AFK catalog file: ${path}. Run "afk refresh" to prepare the local catalog.`);
  }

  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));

  if (!guard(parsed)) {
    throw new Error(`Invalid AFK catalog file: ${path}`);
  }

  return parsed;
}

async function defaultManifestContent(
  name: ManifestName,
  options: ManifestOptions,
  defaultsSource: string,
  rememberedSourceForWrite: string,
  sourceSession: ManifestSourceSession,
): Promise<string | null> {
  if (name === "presets.json") {
    const content = await fetchDefaultManifest(name, options, defaultsSource, sourceSession);
    return content ? withRememberedDefaultsSource(content, rememberedSourceForWrite) : null;
  }

  const content = await fetchDefaultManifest(name, options, defaultsSource, sourceSession);
  if (!content) {
    return content;
  }

  const sourceRoot = options.rulesSource === "local" ? options.repoDir : defaultsSource;
  if (name === "agents.json") {
    return resolvedCustomAgentManifestContent(content, sourceRoot, options.rulesRef, options.cwd ?? process.cwd());
  }
  if (name === "rules.json") {
    return resolvedRulesManifestContent(content, sourceRoot, options.rulesRef, options.cwd ?? process.cwd());
  }
  return content;
}

export function resolvedCustomAgentManifestContent(content: string, sourceRoot: string, ref: string, cwd: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (!isCustomAgentManifest(parsed)) {
    return content;
  }

  const base = catalogSourceBase(sourceRoot, ref, cwd);
  const items = parsed.items.map((item) => ({
    ...item,
    source: resolvedCatalogSource(item.source, base),
  }));
  return `${JSON.stringify({ ...parsed, items }, null, 2)}\n`;
}

export function resolvedRulesManifestContent(content: string, sourceRoot: string, ref: string, cwd: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (!isRulesManifest(parsed)) {
    return content;
  }

  const base = catalogSourceBase(sourceRoot, ref, cwd);
  if ("layers" in parsed) {
    return `${JSON.stringify({
      ...parsed,
      layers: parsed.layers.map((layer) => ({
        ...layer,
        source: resolvedCatalogSource(layer.source, base),
        ...(layer.files === undefined
          ? {}
          : {
              files: layer.files.map((file) => ({
                ...file,
                source: resolvedCatalogSource(file.source, base),
              })),
            }),
      })),
    }, null, 2)}\n`;
  }

  return `${JSON.stringify({
    ...parsed,
    url: parsed.url ? resolvedCatalogSource(parsed.url, base) : "",
    ...(parsed.files === undefined
      ? {}
      : {
          files: parsed.files.map((file) => ({
            ...file,
            source: resolvedCatalogSource(file.source, base),
          })),
        }),
  }, null, 2)}\n`;
}

export function rulesManifestLayers(manifest: RulesManifest): ResolvedRulesManifestLayer[] {
  if ("layers" in manifest) {
    return manifest.layers.map((layer) => ({
      ...layer,
      ...(layer.files === undefined ? {} : { files: layer.files.map((file) => ({ ...file })) }),
    }));
  }

  if (!manifest.url) {
    return [];
  }

  return [{
    id: "legacy",
    label: "Rules",
    source: manifest.url,
    ...(manifest.files === undefined ? {} : { files: manifest.files.map((file) => ({ ...file })) }),
    legacy: true,
  }];
}

async function fetchDefaultManifest(
  name: ManifestName,
  options: ManifestOptions,
  defaultsSource: string,
  sourceSession: ManifestSourceSession,
): Promise<string | null> {
  if (options.rulesSource === "local") {
    return readLocalPackageManifest(name, options);
  }

  const localContent = readLocalDefaultManifest(name, options, defaultsSource);
  if (localContent) {
    return localContent;
  }

  try {
    for (const baseUrl of defaultsManifestBaseUrls(defaultsSource, options.rulesRef)) {
      const url = `${baseUrl}/${name}`;
      const response = await fetch(url);
      if (response.ok) {
        sourceSession.markPublic();
        return ensureTrailingNewline(await response.text());
      }
    }
  } catch {}

  return sourceSession.read(name);
}

function readLocalPackageManifest(name: ManifestName, options: ManifestOptions): string | null {
  const cwd = options.cwd ?? process.cwd();
  const candidates = [
    join(cwd, "packages", "afk", "catalog", name),
    join(cwd, "catalog", name),
    join(options.repoDir, "packages", "afk", "catalog", name),
    manifestPath(name),
  ];

  for (const candidate of unique(candidates)) {
    if (existsSync(candidate)) {
      return ensureTrailingNewline(readFileSync(candidate, "utf8"));
    }
  }

  return null;
}

function readLocalDefaultManifest(name: ManifestName, options: ManifestOptions, defaultsSource: string): string | null {
  const normalized = defaultsSource.trim().replace(/\/$/, "");
  if (!normalized || normalized.startsWith("http://") || normalized.startsWith("https://") || normalized.includes("github.com")) {
    return null;
  }

  if (/^[^/\s]+\/[^/\s]+$/.test(normalized)) {
    return null;
  }

  const basePath = isAbsolute(normalized) ? normalized : resolve(options.cwd ?? process.cwd(), normalized);
  const candidates = [
    join(basePath, name),
    join(basePath, "afk", "catalog", name),
    join(basePath, "packages", "afk", "catalog", name),
  ];

  for (const candidate of unique(candidates)) {
    if (existsSync(candidate)) {
      return ensureTrailingNewline(readFileSync(candidate, "utf8"));
    }
  }

  return null;
}

function createManifestSourceSession(options: ManifestOptions, source: string): ManifestSourceSession {
  const sourceSpec = githubSourceSpec(source, options.rulesRef);
  const cloneGithubSource = options.cloneGithubSource ?? cloneGithubCatalogSource;
  let checkoutPromise: Promise<GithubSourceCheckout> | null = null;
  let checkout: GithubSourceCheckout | null = null;
  let publicSourceReached = false;

  return {
    markPublic: () => {
      publicSourceReached = true;
    },
    read: async (name) => {
      if (!sourceSpec || publicSourceReached) {
        return null;
      }

      checkoutPromise ??= cloneGithubSource(sourceSpec);
      checkout = await checkoutPromise;
      for (const catalogDir of sourceSpec.catalogDirs) {
        const candidate = join(checkout.rootDir, catalogDir, name);
        if (existsSync(candidate)) {
          return ensureTrailingNewline(readFileSync(candidate, "utf8"));
        }
      }

      return null;
    },
    cleanup: () => {
      checkout?.cleanup();
      checkout = null;
    },
  };
}

function githubSourceSpec(source: string, fallbackRef: string): GithubSourceSpec | null {
  const normalized = source.trim().replace(/\/$/, "");
  const rawMatch = normalized.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (rawMatch) {
    const [, owner, repo, ref, path] = rawMatch;
    return githubSourceSpecForRepo(owner ?? "", repo ?? "", ref ?? fallbackRef, [path?.replace(/\/$/, "") ?? ""]);
  }

  const treeMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
  if (treeMatch) {
    const [, owner, repo, ref, path] = treeMatch;
    return githubSourceSpecForRepo(owner ?? "", repo ?? "", ref ?? fallbackRef, [path?.replace(/\/$/, "") ?? ""]);
  }

  const repoMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)$/);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    return githubSourceSpecForRepo(owner ?? "", repo ?? "", fallbackRef);
  }

  const shorthandMatch = normalized.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthandMatch) {
    const [, owner, repo] = shorthandMatch;
    return githubSourceSpecForRepo(owner ?? "", repo ?? "", fallbackRef);
  }

  return null;
}

export function githubSourceSpecForRepo(
  owner: string,
  repo: string,
  ref: string,
  catalogDirs = ["afk/catalog", "packages/afk/catalog"],
): GithubSourceSpec {
  return {
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    ref,
    catalogDirs,
  };
}

export async function cloneGithubCatalogSource(source: GithubSourceSpec): Promise<GithubSourceCheckout> {
  const tempRoot = mkdtempSync(join(tmpdir(), "afk-catalog-source-"));
  const rootDir = join(tempRoot, "repo");
  const status = startCatalogCloneStatus();

  try {
    await runGit(["init", rootDir], source);
    await runGit(["-C", rootDir, "remote", "add", "origin", source.cloneUrl], source);
    await runGit(["-C", rootDir, "fetch", "--depth", "1", "origin", source.ref], source);
    await runGit(["-C", rootDir, "checkout", "--detach", "FETCH_HEAD"], source);
    status.stop(true);
  } catch (error) {
    status.stop(false);
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }

  return {
    rootDir,
    cleanup: () => {
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

function runGit(args: string[], source: GithubSourceSpec): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("git", args, {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      rejectPromise(catalogCloneError(source, error.message));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(catalogCloneError(source, stderr.trim() || `git exited with code ${code ?? "unknown"}`));
    });
  });
}

function catalogCloneError(source: GithubSourceSpec, detail: string): Error {
  return new Error(`Unable to read AFK catalog from ${source.cloneUrl} at ${source.ref}: ${detail}`);
}

function startCatalogCloneStatus(): { stop: (success: boolean) => void } {
  if (!process.stdout.isTTY || process.env.CI === "true") {
    return { stop: () => {} };
  }

  const start = "- Catalog source: fetching with Git...";
  const done = "- Catalog source: ready";
  const failed = "- Catalog source: needs attention";
  const frames = ["-", "\\", "|", "/"];
  let index = 0;

  process.stdout.write(`${start} `);
  const timer = setInterval(() => {
    process.stdout.write(`\r${start} ${frames[index % frames.length]}`);
    index += 1;
  }, 80);

  return {
    stop: (success) => {
      clearInterval(timer);
      process.stdout.write(`\r${success ? done : failed}${" ".repeat(24)}\n`);
    },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function manifestDirForOptions(options: ManifestDirOptions): string {
  return options.manifestLocal ? projectManifestDir(options.cwd ?? process.cwd()) : localManifestDir(options.homeDir);
}

function readExistingPresetsManifest(path: string): PresetsManifest {
  if (!existsSync(path)) {
    return { version: 1, defaultsSource: "", presets: [] };
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (isRecord(parsed)) {
      return {
        version: typeof parsed.version === "number" ? parsed.version : 1,
        defaultsSource: typeof parsed.defaultsSource === "string" ? parsed.defaultsSource : "",
        presets: Array.isArray(parsed.presets) ? parsed.presets.filter(isPresetManifestItem) : [],
      };
    }
  } catch {
    return { version: 1, defaultsSource: "", presets: [] };
  }

  return { version: 1, defaultsSource: "", presets: [] };
}

function isPresetManifestItem(value: unknown): value is PresetsManifest["presets"][number] {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.areas) &&
    value.areas.every((area) => typeof area === "string") &&
    (value.all === undefined || typeof value.all === "boolean") &&
    !(value.all === true && value.selections !== undefined) &&
    (value.selections === undefined || (
      isRecord(value.selections) &&
      (value.selections.skills === undefined || isStringArray(value.selections.skills)) &&
      (value.selections.customAgents === undefined || isStringArray(value.selections.customAgents)) &&
      (value.selections.mcps === undefined || isStringArray(value.selections.mcps)) &&
      (value.selections.plugins === undefined || isStringArray(value.selections.plugins)) &&
      (value.selections.hooks === undefined || isStringArray(value.selections.hooks))
    ))
  );
}

function rememberedDefaultsSource(manifestDir: string): string {
  const path = join(manifestDir, "presets.json");
  if (!existsSync(path)) {
    return "";
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (isRecord(parsed) && typeof parsed.defaultsSource === "string") {
      return parsed.defaultsSource.trim();
    }
  } catch {
    return "";
  }

  return "";
}

export function defaultsManifestBaseUrl(source: string, ref: string): string {
  return defaultsManifestBaseUrls(source, ref)[0] ?? `${rawBaseUrl}/${encodeURIComponent(ref)}/packages/afk/catalog`;
}

export function defaultsManifestBaseUrls(source: string, ref: string): string[] {
  const normalized = source.trim().replace(/\/$/, "");
  if (!normalized) {
    return [`${rawBaseUrl}/${encodeURIComponent(ref)}/packages/afk/catalog`];
  }

  const rawMatch = normalized.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (rawMatch) {
    const [, owner, repo, sourceRef, path] = rawMatch;
    return [`https://raw.githubusercontent.com/${owner}/${repo}/${sourceRef}/${path?.replace(/\/$/, "")}`];
  }

  const githubTreeMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
  if (githubTreeMatch) {
    const [, owner, repo, sourceRef, path] = githubTreeMatch;
    return [`https://raw.githubusercontent.com/${owner}/${repo}/${sourceRef}/${path?.replace(/\/$/, "")}`];
  }

  const githubRepoMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)$/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    return defaultRepoManifestUrls(owner ?? "", repo ?? "", ref);
  }

  const shorthandMatch = normalized.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthandMatch) {
    const [, owner, repo] = shorthandMatch;
    return defaultRepoManifestUrls(owner ?? "", repo ?? "", ref);
  }

  return [normalized];
}

function defaultRepoManifestUrls(owner: string, repo: string, ref: string): string[] {
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}`;
  return [
    `${base}/afk/catalog`,
    `${base}/packages/afk/catalog`,
  ];
}

function catalogSourceBase(source: string, ref: string, cwd: string): string {
  const normalized = source.trim().replace(/\/$/, "");

  const rawMatch = normalized.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(.*))?$/);
  if (rawMatch) {
    const [, owner, repo, sourceRef] = rawMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${sourceRef}`;
  }

  const githubTreeMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.*))?$/);
  if (githubTreeMatch) {
    const [, owner, repo, sourceRef] = githubTreeMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${sourceRef}`;
  }

  const githubRepoMatch = normalized.match(/^(?:https:\/\/)?github\.com\/([^/]+)\/([^/]+)$/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}`;
  }

  const shorthandMatch = normalized.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthandMatch) {
    const [, owner, repo] = shorthandMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}`;
  }

  if (/^https?:\/\//.test(normalized)) {
    return normalized;
  }

  const localSource = isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
  return localCatalogRepositoryRoot(localSource);
}

function localCatalogRepositoryRoot(source: string): string {
  let current = source;
  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  for (const suffix of [join("packages", "afk", "catalog"), join("afk", "catalog")]) {
    if (source.endsWith(suffix)) {
      return source.slice(0, -suffix.length).replace(/[\\/]$/, "");
    }
  }

  return source;
}

function resolvedCatalogSource(source: string, base: string): string {
  if (/^https?:\/\//.test(source) || isAbsolute(source)) {
    return source;
  }

  if (/^https?:\/\//.test(base)) {
    return new URL(source, `${base.replace(/\/$/, "")}/`).toString();
  }

  return resolve(base, source);
}

function emptyManifestContent(name: ManifestName, options: Pick<CliOptions, "rulesRef" | "rulesSource">, defaultsSource: string): string {
  if (name === "skills.json") {
    return `${JSON.stringify({ version: 1, defaultSource: "", scopes: [], items: [] }, null, 2)}\n`;
  }

  if (name === "profiles.json") {
    return `${JSON.stringify({ version: 1, mode: "strict", alwaysOn: [], items: [] }, null, 2)}\n`;
  }

  if (name === "agents.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  if (name === "mcps.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  if (name === "rules.json") {
    return `${JSON.stringify({ version: 2, layers: [] }, null, 2)}\n`;
  }

  if (name === "plugins.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  if (name === "hooks.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  return `${JSON.stringify({ version: 1, defaultsSource, presets: [] }, null, 2)}\n`;
}

function withRememberedDefaultsSource(content: string, defaultsSource: string): string {
  try {
    const parsed: unknown = JSON.parse(content);
    if (isRecord(parsed)) {
      return `${JSON.stringify({ ...parsed, defaultsSource }, null, 2)}\n`;
    }
  } catch {
    return content;
  }

  return content;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function migrateLocalManifest(name: ManifestName, content: string): string | null {
  if (name === "skills.json") {
    return migrateSkillsManifest(content);
  }

  if (name === "presets.json") {
    return migratePresetsManifest(content);
  }

  if (name !== "mcps.json") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isMcpManifest(parsed)) {
    return null;
  }

  let changed = false;
  const items = parsed.items.map((item) => {
    if (item.id !== "stitch" || item.source !== "https://stitch.googleapis.com/mcp") {
      return item;
    }

    const args = removeArgPair(item.args, "--header", "X-Goog-Api-Key: KEY_STITCH");
    if (args.length === item.args.length) {
      return item;
    }

    changed = true;
    return { ...item, args };
  });

  if (!changed) {
    return null;
  }

  return `${JSON.stringify({ ...parsed, version: Math.max(parsed.version, 2), items }, null, 2)}\n`;
}

function migrateSkillsManifest(content: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isSkillManifest(parsed)) {
    return null;
  }

  let changed = false;
  const items = parsed.items.map((item) => {
    const next = { ...item } as SkillManifestItem & { profiles?: unknown };
    if (next.autoInvocation === undefined) {
      next.autoInvocation = true;
      changed = true;
    }

    if (next.profiles !== undefined) {
      delete next.profiles;
      changed = true;
    }

    if (next.imported === undefined) {
      next.imported = false;
      changed = true;
    }

    return next;
  });

  if (!changed) {
    return null;
  }

  return `${JSON.stringify({ ...parsed, items }, null, 2)}\n`;
}

function mergedSkillsManifestContent(content: string, targetPath: string, preserveImported = true): string {
  let refreshed: unknown;
  try {
    refreshed = JSON.parse(content);
  } catch {
    return content;
  }

  if (!isSkillManifest(refreshed)) {
    return content;
  }

  const refreshedIds = new Set(refreshed.items.map((item) => item.id));
  const importedItems = preserveImported
    ? readExistingImportedSkillItems(targetPath).filter((item) => !refreshedIds.has(item.id))
    : [];
  const items = [
    ...refreshed.items.map((item) => ({ ...stripRetiredSkillManifestFields(item), imported: false })),
    ...importedItems.map((item) => ({ ...stripRetiredSkillManifestFields(item), imported: true })),
  ];

  return `${JSON.stringify({ ...refreshed, items }, null, 2)}\n`;
}

export function mergedCustomAgentManifestContent(content: string, targetPath: string, mergeExisting = true): string {
  let refreshed: unknown;
  try {
    refreshed = JSON.parse(content);
  } catch {
    return content;
  }

  if (!isCustomAgentManifest(refreshed)) {
    return content;
  }

  const existing = mergeExisting ? readExistingCustomAgentManifest(targetPath) : null;
  if (!existing) {
    return `${JSON.stringify(refreshed, null, 2)}\n`;
  }

  const incomingById = new Map(refreshed.items.map((item) => [item.id, item]));
  const existingIds = new Set(existing.items.map((item) => item.id));
  const items = [
    ...existing.items.map((item) => incomingById.get(item.id) ?? item),
    ...refreshed.items.filter((item) => !existingIds.has(item.id)),
  ];
  return `${JSON.stringify({ ...refreshed, items }, null, 2)}\n`;
}

export function mergedRulesManifestContent(content: string, targetPath: string, mergeExisting = true): string {
  let refreshed: unknown;
  try {
    refreshed = JSON.parse(content);
  } catch {
    return content;
  }

  if (!isRulesManifest(refreshed) || !("layers" in refreshed) || !mergeExisting || !existsSync(targetPath)) {
    return content;
  }

  let existing: unknown;
  try {
    existing = JSON.parse(readFileSync(targetPath, "utf8"));
  } catch {
    return content;
  }

  if (!isRulesManifest(existing)) {
    return content;
  }

  if (!("layers" in existing)) {
    return `${JSON.stringify(refreshed, null, 2)}\n`;
  }

  const existingLayers = rulesManifestLayers(existing);
  const incomingById = new Map(refreshed.layers.map((layer) => [layer.id, layer]));
  const existingIds = new Set(existingLayers.map((layer) => layer.id));
  const layers = [
    ...existingLayers.map((layer) => incomingById.get(layer.id) ?? stripResolvedRulesLayer(layer)),
    ...refreshed.layers.filter((layer) => !existingIds.has(layer.id)),
  ];

  return `${JSON.stringify({ version: refreshed.version, layers }, null, 2)}\n`;
}

function stripResolvedRulesLayer(layer: ResolvedRulesManifestLayer): RulesManifestLayer {
  const { legacy: _legacy, ...manifestLayer } = layer;
  return manifestLayer;
}

function readExistingCustomAgentManifest(path: string): CustomAgentManifest | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return isCustomAgentManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mergedProfilesManifestContent(content: string, targetPath: string, preserveLocal = true): string {
  const refreshed = parseProfilesManifest(content);
  const existing = preserveLocal ? readProfilesManifest(targetPath) : undefined;
  if (!refreshed || !existing) {
    return content;
  }

  const refreshedIds = new Set(refreshed.items.map((item) => item.id));
  const localItems = existing.items
    .filter((item) => !refreshedIds.has(item.id))
    .map((item) => migrateProfileManifestItem(item, refreshed.version));
  return `${JSON.stringify({ ...refreshed, items: [...refreshed.items, ...localItems] }, null, 2)}\n`;
}

function migrateProfileManifestItem(item: ProfilesManifest["items"][number], targetVersion: number): ProfilesManifest["items"][number] {
  if (targetVersion >= 2) {
    return {
      id: item.id,
      name: item.name,
      catalogSkills: item.catalogSkills ?? item.skills ?? [],
      packages: item.packages ?? [],
    };
  }
  return { id: item.id, name: item.name, skills: item.skills ?? item.catalogSkills ?? [] };
}

type ProfilesManifest = {
  version: number;
  mode?: "strict" | "context";
  alwaysOn: string[];
  skillAliases?: Record<string, string>;
  items: Array<{
    id: string;
    name: string;
    catalogSkills?: string[];
    skills?: string[];
    packages?: Array<{ source: string; skills?: string[] }>;
  }>;
};

function readProfilesManifest(path: string): ProfilesManifest | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  try {
    return parseProfilesManifest(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function parseProfilesManifest(content: string): ProfilesManifest | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isProfilesManifest(parsed)) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
}

function isProfilesManifest(value: unknown): value is ProfilesManifest {
  return isRecord(value) &&
    typeof value.version === "number" &&
    (value.mode === undefined || value.mode === "strict" || value.mode === "context") &&
    Array.isArray(value.alwaysOn) &&
    value.alwaysOn.every((item) => typeof item === "string") &&
    (value.skillAliases === undefined || (
      isRecord(value.skillAliases) &&
      Object.values(value.skillAliases).every((upstreamId) => typeof upstreamId === "string")
    )) &&
    Array.isArray(value.items) &&
    value.items.every((item) => isProfileManifestItem(item, value.version as number));
}

function isProfileManifestItem(value: unknown, version: number): value is ProfilesManifest["items"][number] {
  return isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (version >= 2
      ? isStringArray(value.catalogSkills) && value.skills === undefined &&
        (value.packages === undefined || isProfilePackages(value.packages))
      : isStringArray(value.skills) && value.catalogSkills === undefined && value.packages === undefined);
}

function isProfilePackages(value: unknown): boolean {
  return Array.isArray(value) && value.every((profilePackage) =>
    isRecord(profilePackage) &&
    typeof profilePackage.source === "string" &&
    (profilePackage.skills === undefined || isStringArray(profilePackage.skills))
  );
}
function stripRetiredSkillManifestFields(item: SkillManifestItem): SkillManifestItem {
  const next = { ...item } as SkillManifestItem & { profiles?: unknown };
  delete next.profiles;
  return next;
}

function readExistingImportedSkillItems(path: string): SkillManifestItem[] {
  if (!existsSync(path)) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isSkillManifest(parsed)) {
      return [];
    }

    return parsed.items.filter((item) => item.imported === true);
  } catch {
    return [];
  }
}

function migratePresetsManifest(content: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || typeof parsed.version !== "number" || !Array.isArray(parsed.presets) || typeof parsed.defaultsSource === "string") {
    return null;
  }

  return `${JSON.stringify({ ...parsed, defaultsSource: builtInDefaultsSource }, null, 2)}\n`;
}

function removeArgPair(args: string[], flag: string, value: string): string[] {
  const next: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1] === value) {
      index += 1;
      continue;
    }

    const arg = args[index];
    if (arg) {
      next.push(arg);
    }
  }

  return next;
}

export function writeLocalManifestNow(homeDir: string, name: ManifestName, content: string): void {
  const path = join(localManifestDir(homeDir), name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSkillManifest(value: unknown): value is SkillManifest {
  if (!isRecord(value) || typeof value.version !== "number" || typeof value.defaultSource !== "string" || !Array.isArray(value.items)) {
    return false;
  }

  if (value.scopes !== undefined && (!Array.isArray(value.scopes) || !value.scopes.every(isSkillManifestScope))) {
    return false;
  }

  return value.items.every((item) => {
    if (!isRecord(item)) {
      return false;
    }

    return (
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.source === "string" &&
      isStringArray(item.args) &&
      typeof item.default === "boolean" &&
      (item.autoInvocation === undefined || typeof item.autoInvocation === "boolean") &&
      (item.startDisabled === undefined || typeof item.startDisabled === "boolean") &&
      (item.role === undefined || isSkillManifestItemRole(item.role)) &&
      (item.composes === undefined || isStringArray(item.composes)) &&
      (item.catalog === undefined || isSkillManifestItemCatalog(item.catalog)) &&
      (item.imported === undefined || typeof item.imported === "boolean")
    );
  });
}

function isSkillManifestScope(value: unknown): value is SkillManifestScope {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    (value.description === undefined || typeof value.description === "string")
  );
}

function isSkillManifestItemCatalog(value: unknown): value is SkillManifestItemCatalog {
  return (
    isRecord(value) &&
    (value.scope === undefined || typeof value.scope === "string") &&
    (value.tags === undefined || isStringArray(value.tags))
  );
}

function isSkillManifestItemRole(value: unknown): value is SkillManifestItemRole {
  return value === "primitive" || value === "wrapper" || value === "workflow" || value === "utility" || value === "reference" || value === "router";
}

function isMcpManifest(value: unknown): value is McpManifest {
  if (!isRecord(value) || typeof value.version !== "number" || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => {
    if (!isRecord(item)) {
      return false;
    }

    return (
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.source === "string" &&
      isStringArray(item.args) &&
      typeof item.default === "boolean"
    );
  });
}

export function isCustomAgentManifest(value: unknown): value is CustomAgentManifest {
  if (!isRecord(value) || typeof value.version !== "number" || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => (
    isRecord(item) &&
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    typeof item.source === "string" &&
    item.default === undefined
  ));
}

export function isRulesManifest(value: unknown): value is RulesManifest {
  if (!isRecord(value) || typeof value.version !== "number") {
    return false;
  }

  if (Array.isArray(value.layers)) {
    const ids = new Set<string>();
    return value.version >= 2 && value.layers.every((layer) => {
      if (
        !isRecord(layer) ||
        typeof layer.id !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*$/.test(layer.id) ||
        ids.has(layer.id) ||
        typeof layer.label !== "string" ||
        typeof layer.source !== "string"
      ) {
        return false;
      }
      ids.add(layer.id);
      return layer.files === undefined || (
        Array.isArray(layer.files) &&
        layer.files.every((file) => (
          isRecord(file) &&
          typeof file.source === "string" &&
          typeof file.destination === "string"
        ))
      );
    });
  }

  if (value.source !== "github" && value.source !== "local") {
    return false;
  }

  return (
    typeof value.url === "string" &&
    (value.files === undefined || (
      Array.isArray(value.files) &&
      value.files.every((file) => (
        isRecord(file) &&
        typeof file.source === "string" &&
        typeof file.destination === "string"
      ))
    ))
  );
}

function isPluginManifest(value: unknown): value is PluginManifest {
  if (!isRecord(value) || typeof value.version !== "number" || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => {
    if (!isRecord(item) || !isRecord(item.install)) {
      return false;
    }

    return (
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.description === "string" &&
      isPluginCommand(item.install) &&
      (item.postInstall === undefined || isPluginPostInstallCommand(item.postInstall)) &&
      typeof item.default === "boolean"
    );
  });
}

function isPresetsManifest(value: unknown): value is PresetsManifest {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    typeof value.defaultsSource === "string" &&
    Array.isArray(value.presets) &&
    value.presets.every(isPresetManifestItem)
  );
}

function isPluginPostInstallCommand(value: unknown): value is PluginPostInstallCommand {
  return isRecord(value) && (value.label === undefined || typeof value.label === "string") && isPluginCommand(value);
}

function isPluginCommand(value: unknown): value is { command: string; args: string[] } {
  if (!isRecord(value) || typeof value.command !== "string" || !isStringArray(value.args)) {
    return false;
  }

  return isShellCommand(value.command) || !value.args.some(isShellControlToken);
}

function isShellCommand(command: string): boolean {
  const executable = command.split("/").pop();
  return executable === "sh" || executable === "bash" || executable === "zsh";
}

function isShellControlToken(value: string): boolean {
  return value === "&&" || value === "||" || value === "|" || value === ";";
}

export function isHookManifest(value: unknown): value is HookManifest {
  if (!isRecord(value) || typeof value.version !== "number" || !Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => {
    if (!isRecord(item)) {
      return false;
    }

    return (
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      typeof item.description === "string" &&
      typeof item.source === "string" &&
      typeof item.command === "string" &&
      isStringArray(item.args) &&
      Array.isArray(item.events) &&
      item.events.every((event) => event === "stop") &&
      Array.isArray(item.agents) &&
      item.agents.every((agent) => agent === "codex" || agent === "claude" || agent === "cursor-local") &&
      typeof item.default === "boolean"
    );
  });
}
