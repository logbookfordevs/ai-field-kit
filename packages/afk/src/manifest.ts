import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { manifestPath } from "./paths.js";
import type { CliOptions, PathOperation } from "./types.js";

const manifestNames = ["skills.json", "mcps.json", "presets.json", "rules.json", "utils.json"] as const;
const rawBaseUrl = "https://raw.githubusercontent.com/logbookfordevs/ai-field-kit";

export type ManifestName = (typeof manifestNames)[number];

export type SkillManifest = {
  version: number;
  defaultSource: string;
  items: SkillManifestItem[];
};

export type SkillManifestItem = {
  id: string;
  label: string;
  source: string;
  args: string[];
  default: boolean;
};

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

export type UtilityManifest = {
  version: number;
  items: UtilityManifestItem[];
};

export type UtilityManifestItem = {
  id: string;
  label: string;
  description: string;
  install: {
    command: string;
    args: string[];
  };
  postInstall?: "rtk-init";
  default: boolean;
};

export function localAfkDir(homeDir: string): string {
  return join(homeDir, ".agents", "afk");
}

export function localManifestDir(homeDir: string): string {
  return join(localAfkDir(homeDir), "manifests");
}

export async function ensureLocalManifests(options: Pick<CliOptions, "homeDir" | "repoDir" | "rulesRef" | "rulesSource" | "empty" | "refreshDefaults" | "defaultsSource" | "dryRun">): Promise<PathOperation[]> {
  const operations: PathOperation[] = [];
  const manifestDir = localManifestDir(options.homeDir);
  if (!existsSync(manifestDir)) {
    operations.push({ type: "mkdir", path: manifestDir });
  }

  for (const name of manifestNames) {
    const target = join(manifestDir, name);
    if (!options.refreshDefaults && existsSync(target)) {
      const migrated = migrateLocalManifest(name, readFileSync(target, "utf8"));
      if (migrated) {
        operations.push({ type: "write", path: target, content: migrated });
      }
      continue;
    }

    const content = options.empty
      ? emptyManifestContent(name, options)
      : await defaultManifestContent(name, options);
    operations.push({ type: "write", path: target, content });
  }

  return operations;
}

export function loadSkillManifest(options: Pick<CliOptions, "homeDir">): SkillManifest {
  return parseLocalManifest<SkillManifest>(options.homeDir, "skills.json", isSkillManifest);
}

export function loadMcpManifest(options: Pick<CliOptions, "homeDir">): McpManifest {
  return parseLocalManifest<McpManifest>(options.homeDir, "mcps.json", isMcpManifest);
}

export function loadRulesManifest(options: Pick<CliOptions, "homeDir">): RulesManifest {
  return parseLocalManifest<RulesManifest>(options.homeDir, "rules.json", isRulesManifest);
}

export function loadUtilityManifest(options: Pick<CliOptions, "homeDir">): UtilityManifest {
  return parseLocalManifest<UtilityManifest>(options.homeDir, "utils.json", isUtilityManifest);
}

function parseLocalManifest<T>(homeDir: string, name: ManifestName, guard: (value: unknown) => value is T): T {
  const path = join(localManifestDir(homeDir), name);
  const sourcePath = existsSync(path) ? path : manifestPath(name);
  const parsed: unknown = JSON.parse(readFileSync(sourcePath, "utf8"));

  if (!guard(parsed)) {
    throw new Error(`Invalid AFK manifest: ${sourcePath}`);
  }

  return parsed;
}

async function defaultManifestContent(name: ManifestName, options: Pick<CliOptions, "repoDir" | "rulesRef" | "rulesSource" | "defaultsSource">): Promise<string> {
  if (name === "rules.json" && !options.defaultsSource) {
    return `${JSON.stringify(defaultRulesManifest(options), null, 2)}\n`;
  }

  if (options.rulesSource === "local") {
    return readFileSync(manifestPath(name), "utf8");
  }

  try {
    for (const baseUrl of defaultsManifestBaseUrls(options.defaultsSource, options.rulesRef)) {
      const url = `${baseUrl}/${name}`;
      const response = await fetch(url);
      if (response.ok) {
        return ensureTrailingNewline(await response.text());
      }
    }
  } catch {
    return readFileSync(manifestPath(name), "utf8");
  }

  return readFileSync(manifestPath(name), "utf8");
}

export function defaultsManifestBaseUrl(source: string, ref: string): string {
  return defaultsManifestBaseUrls(source, ref)[0] ?? `${rawBaseUrl}/${encodeURIComponent(ref)}/packages/afk/manifests`;
}

export function defaultsManifestBaseUrls(source: string, ref: string): string[] {
  const normalized = source.trim().replace(/\/$/, "");
  if (!normalized) {
    return [`${rawBaseUrl}/${encodeURIComponent(ref)}/packages/afk/manifests`];
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
    `${base}/afk/manifests`,
    `${base}/packages/afk/manifests`,
  ];
}

function defaultRulesManifest(options: Pick<CliOptions, "rulesRef" | "rulesSource">): RulesManifest {
  return {
    version: 1,
    source: options.rulesSource === "manifest" ? "github" : options.rulesSource,
    url: `${rawBaseUrl}/${encodeURIComponent(options.rulesRef)}/rules/AGENTS.md`,
  };
}

function emptyManifestContent(name: ManifestName, options: Pick<CliOptions, "rulesRef" | "rulesSource">): string {
  if (name === "skills.json") {
    return `${JSON.stringify({ version: 1, defaultSource: "", items: [] }, null, 2)}\n`;
  }

  if (name === "mcps.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  if (name === "rules.json") {
    return `${JSON.stringify({ version: 1, source: "github", url: "" }, null, 2)}\n`;
  }

  if (name === "utils.json") {
    return `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`;
  }

  return `${JSON.stringify({ version: 1, presets: [] }, null, 2)}\n`;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function migrateLocalManifest(name: ManifestName, content: string): string | null {
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

function isUtilityManifest(value: unknown): value is UtilityManifest {
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
      (item.postInstall === undefined || item.postInstall === "rtk-init") &&
      typeof item.default === "boolean"
    );
  });
}
