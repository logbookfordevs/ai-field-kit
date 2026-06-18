import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { manifestPath } from "./paths.js";
import type { CliOptions, ManifestCategory, ManifestFilename, PathOperation } from "./types.js";

export const manifestNames = ["skills.json", "mcps.json", "presets.json", "rules.json", "plugins.json", "hooks.json"] as const;
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
  role?: SkillManifestItemRole;
  composes?: string[];
  profiles?: string[];
  catalog?: SkillManifestItemCatalog;
};

export type SkillManifestItemRole = "primitive" | "wrapper" | "flow" | "utility" | "reference" | "router";

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

export type RulesManifest = {
  version: number;
  source: "github" | "local";
  url: string;
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
  postInstall?: "rtk-init" | PluginPostInstallCommand;
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

export type PresetsManifest = {
  version: number;
  defaultsSource: string;
  presets: Array<{
    id: string;
    label: string;
    areas: string[];
  }>;
};

type ManifestOptions = Pick<
  CliOptions,
  "homeDir" | "repoDir" | "rulesRef" | "rulesSource" | "empty" | "refreshDefaults" | "defaultsSource" | "dryRun" | "manifestLocal"
> & {
  cwd?: string;
  defaultsSourceExplicit?: boolean;
  rememberDefaultsSource?: boolean;
  selectedManifestCategories?: ManifestCategory[];
};

type ManifestDirOptions = Pick<CliOptions, "homeDir" | "manifestLocal"> & {
  cwd?: string;
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

  for (const name of selectedNames) {
    const target = join(manifestDir, name);
    if (!shouldRefreshDefaults && existsSync(target)) {
      const migrated = migrateLocalManifest(name, readFileSync(target, "utf8"));
      if (migrated) {
        operations.push({ type: "write", path: target, content: migrated });
      }
      continue;
    }

    const content = options.empty
      ? emptyManifestContent(name, options, effectiveDefaultsSource)
      : await defaultManifestContent(name, options, effectiveDefaultsSource, rememberedSourceForWrite);
    if (content) {
      operations.push({ type: "write", path: target, content });
    } else if (existsSync(target)) {
      operations.push({ type: "skip", path: target, reason: "not provided by defaults source" });
    } else {
      operations.push({ type: "write", path: target, content: emptyManifestContent(name, options, effectiveDefaultsSource) });
    }
  }

  return operations;
}

export async function loadDefaultManifestContent(name: ManifestName, options: ManifestOptions): Promise<string | null> {
  const manifestDir = manifestDirForOptions(options);
  const rememberedSource = rememberedDefaultsSource(manifestDir);
  const effectiveDefaultsSource = options.defaultsSource || rememberedSource || builtInDefaultsSource;
  const rememberedSourceForWrite = options.rememberDefaultsSource === false ? rememberedSource : effectiveDefaultsSource;
  return defaultManifestContent(name, options, effectiveDefaultsSource, rememberedSourceForWrite);
}

export async function loadSourceManifestContents(options: ManifestOptions): Promise<Partial<Record<ManifestFilename, string>>> {
  const contents: Partial<Record<ManifestFilename, string>> = {};
  const manifestDir = manifestDirForOptions(options);
  const rememberedSource = rememberedDefaultsSource(manifestDir);
  const effectiveDefaultsSource = options.defaultsSource || rememberedSource || builtInDefaultsSource;

  for (const name of manifestNamesForCategories(options.selectedManifestCategories ?? [])) {
    contents[name] = await loadDefaultManifestContent(name, options) ?? emptyManifestContent(name, options, effectiveDefaultsSource);
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

export function loadSkillManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): SkillManifest {
  return parseManifest<SkillManifest>(options, "skills.json", isSkillManifest);
}

export function loadMcpManifest(options: Pick<CliOptions, "homeDir" | "manifestContents">): McpManifest {
  return parseManifest<McpManifest>(options, "mcps.json", isMcpManifest);
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
): Promise<string | null> {
  if (name === "presets.json") {
    const content = await fetchDefaultManifest(name, options, defaultsSource);
    return content ? withRememberedDefaultsSource(content, rememberedSourceForWrite) : null;
  }

  return fetchDefaultManifest(name, options, defaultsSource);
}

async function fetchDefaultManifest(name: ManifestName, options: ManifestOptions, defaultsSource: string): Promise<string | null> {
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
        return ensureTrailingNewline(await response.text());
      }
    }
  } catch {
    return null;
  }

  return null;
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
  ];

  for (const candidate of unique(candidates)) {
    if (existsSync(candidate)) {
      return ensureTrailingNewline(readFileSync(candidate, "utf8"));
    }
  }

  return null;
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
    value.areas.every((area) => typeof area === "string")
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

function emptyManifestContent(name: ManifestName, options: Pick<CliOptions, "rulesRef" | "rulesSource">, defaultsSource: string): string {
  if (name === "skills.json") {
    return `${JSON.stringify({ version: 1, defaultSource: "", scopes: [], items: [] }, null, 2)}\n`;
  }

  if (name === "mcps.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  if (name === "rules.json") {
    return `${JSON.stringify({ version: 1, source: "github", url: "" }, null, 2)}\n`;
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
    const next = { ...item };
    if (next.autoInvocation === undefined) {
      next.autoInvocation = true;
      changed = true;
    }

    if (next.profiles === undefined) {
      next.profiles = [];
      changed = true;
    }

    return next;
  });

  if (!changed) {
    return null;
  }

  return `${JSON.stringify({ ...parsed, items }, null, 2)}\n`;
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
      (item.role === undefined || isSkillManifestItemRole(item.role)) &&
      (item.composes === undefined || isStringArray(item.composes)) &&
      (item.profiles === undefined || isStringArray(item.profiles)) &&
      (item.catalog === undefined || isSkillManifestItemCatalog(item.catalog))
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
  return value === "primitive" || value === "wrapper" || value === "flow" || value === "utility" || value === "reference" || value === "router";
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

function isRulesManifest(value: unknown): value is RulesManifest {
  if (!isRecord(value) || typeof value.version !== "number" || (value.source !== "github" && value.source !== "local")) {
    return false;
  }

  return typeof value.url === "string";
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
      typeof item.install.command === "string" &&
      isStringArray(item.install.args) &&
      (item.postInstall === undefined || item.postInstall === "rtk-init" || isPluginPostInstallCommand(item.postInstall)) &&
      typeof item.default === "boolean"
    );
  });
}

function isPluginPostInstallCommand(value: unknown): value is PluginPostInstallCommand {
  return (
    isRecord(value) &&
    (value.label === undefined || typeof value.label === "string") &&
    typeof value.command === "string" &&
    isStringArray(value.args)
  );
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
