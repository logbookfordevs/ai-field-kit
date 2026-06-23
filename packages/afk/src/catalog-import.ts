import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sectionTitle, muted } from "./brand.js";
import { applyOperation, formatOperation, isDirectory, summarizeOperations } from "./fs-utils.js";
import { localManifestDir, projectManifestDir, type SkillManifest, type SkillManifestItem } from "./manifest.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

type SkillLock = {
  skills?: Record<string, {
    source?: string;
    sourceType?: string;
    sourceUrl?: string;
    skillPath?: string;
  }>;
};

type ImportPlan = {
  operations: PathOperation[];
  imported: SkillManifestItem[];
  skippedNoLock: string[];
  skippedExisting: string[];
  sourceSkillsDir: string;
  sourceLockPath: string;
  targetCatalogPath: string;
};

type CatalogImportOptions = Pick<CliOptions, "homeDir" | "cwd" | "dryRun" | "manifestLocal"> & {
  startDisabled?: boolean;
};

export async function runCatalogImport(runtime: Runtime, options: CliOptions): Promise<number> {
  const plan = planCatalogImport(options);

  runtime.io.stdout(renderImportHeader(plan, options.manifestLocal ? "project" : "global"));

  if (plan.operations.length === 0) {
    runtime.io.stdout(renderImportComplete(plan, "No catalog changes planned."));
    return 0;
  }

  if (options.dryRun) {
    runtime.io.stdout(renderImportPlan(plan));
    runtime.io.stdout(renderImportSummary(plan));
    return 0;
  }

  for (const operation of plan.operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(renderImportComplete(plan, summarizeOperations(plan.operations)));
  return 0;
}

export function planCatalogImport(options: CatalogImportOptions): ImportPlan {
  const sourceSkillsDir = sourceSkillsDirForOptions(options);
  const sourceLockPath = sourceLockPathForOptions(options);
  const targetCatalogPath = join(options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir), "skills.json");
  const existing = readSkillCatalog(targetCatalogPath);
  const existingIds = new Set(existing.items.map((item) => item.id));
  const lock = readSkillLock(sourceLockPath);
  const installedSkillIds = installedSkillIdsFrom(sourceSkillsDir);
  const imported: SkillManifestItem[] = [];
  const skippedNoLock: string[] = [];
  const skippedExisting: string[] = [];

  for (const id of installedSkillIds) {
    if (existingIds.has(id)) {
      skippedExisting.push(id);
      continue;
    }

    const lockEntry = lock.skills?.[id];
    if (!lockEntry?.source) {
      skippedNoLock.push(id);
      continue;
    }

    imported.push(skillManifestItemFromInstalledSkill(id, sourceSkillsDir, lockEntry.source, options.startDisabled === true));
  }

  const operations: PathOperation[] = [];
  if (imported.length > 0) {
    const scopes = ensureUncategorizedScope(existing.scopes ?? []);
    operations.push({
      type: "write",
      path: targetCatalogPath,
      content: `${JSON.stringify({ ...existing, scopes, items: [...existing.items, ...imported] }, null, 2)}\n`,
    });
  }

  return {
    operations,
    imported,
    skippedNoLock,
    skippedExisting,
    sourceSkillsDir,
    sourceLockPath,
    targetCatalogPath,
  };
}

function sourceSkillsDirForOptions(options: CatalogImportOptions): string {
  const projectSkillsDir = join(options.cwd, ".agents", "skills");
  if (options.manifestLocal && isDirectory(projectSkillsDir)) {
    return projectSkillsDir;
  }

  return join(options.homeDir, ".agents", "skills");
}

function sourceLockPathForOptions(options: CatalogImportOptions): string {
  const projectLockPath = join(options.cwd, ".agents", ".skill-lock.json");
  if (options.manifestLocal && existsSync(projectLockPath)) {
    return projectLockPath;
  }

  return join(options.homeDir, ".agents", ".skill-lock.json");
}

function ensureUncategorizedScope(scopes: NonNullable<SkillManifest["scopes"]>): NonNullable<SkillManifest["scopes"]> {
  if (scopes.some((scope) => scope.id === "uncategorized")) {
    return scopes;
  }

  return [
    ...scopes,
    {
      id: "uncategorized",
      label: "Uncategorized",
      description: "Imported skills waiting for categorization.",
    },
  ];
}

function readSkillCatalog(path: string): SkillManifest {
  if (!existsSync(path)) {
    return { version: 1, defaultSource: "", items: [] };
  }

  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SkillManifest>;
  return {
    version: typeof parsed.version === "number" ? parsed.version : 1,
    defaultSource: typeof parsed.defaultSource === "string" ? parsed.defaultSource : "",
    scopes: Array.isArray(parsed.scopes) ? parsed.scopes : [],
    items: Array.isArray(parsed.items) ? parsed.items.filter(isSkillManifestItem) : [],
  };
}

function readSkillLock(path: string): SkillLock {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as SkillLock;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function installedSkillIdsFrom(skillsDir: string): string[] {
  if (!isDirectory(skillsDir)) {
    return [];
  }

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && existsSync(join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function skillManifestItemFromInstalledSkill(id: string, skillsDir: string, source: string, startDisabled: boolean): SkillManifestItem {
  const skillPath = join(skillsDir, id, "SKILL.md");
  const content = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
  const frontmatter = frontmatterFields(content);
  const item: SkillManifestItem = {
    id,
    label: frontmatter.name ?? humanizeSkillId(id),
    source,
    args: ["--skill", id],
    default: false,
    autoInvocation: frontmatter["disable-model-invocation"] !== "true",
    role: "utility",
    catalog: { scope: "uncategorized" },
    imported: true,
  };
  if (startDisabled) {
    item.startDisabled = true;
  }

  return item;
}

function frontmatterFields(markdown: string): Record<string, string> {
  if (!markdown.startsWith("---\n")) {
    return {};
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }

  const fields: Record<string, string> = {};
  for (const line of markdown.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key) {
      fields[key] = value;
    }
  }

  return fields;
}

function humanizeSkillId(id: string): string {
  return id
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function isSkillManifestItem(value: unknown): value is SkillManifestItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as SkillManifestItem).id === "string" &&
      typeof (value as SkillManifestItem).label === "string" &&
      typeof (value as SkillManifestItem).source === "string" &&
      Array.isArray((value as SkillManifestItem).args) &&
      typeof (value as SkillManifestItem).default === "boolean",
  );
}

function renderImportHeader(plan: ImportPlan, scope: "global" | "project"): string {
  return [
    "",
    sectionTitle("Catalog Import"),
    muted(`Backfill installed skills into the ${scope} AFK catalog.`),
    "",
    renderPathRow("Scope", scope),
    renderPathRow("Skills", plan.sourceSkillsDir),
    renderPathRow("Lock", plan.sourceLockPath),
    renderPathRow("Catalog", plan.targetCatalogPath),
  ].join("\n");
}

function renderImportPlan(plan: ImportPlan): string {
  return [
    "",
    sectionTitle("Import Preview"),
    ...plan.operations.map((operation) => `${bullet()} ${muted(formatOperation(operation))}`),
  ].join("\n");
}

function renderImportComplete(plan: ImportPlan, message: string): string {
  return [
    "",
    sectionTitle(plan.operations.length === 0 ? "Import Check" : "Import Complete"),
    `${label("Result")} ${message}`,
    renderImportSummary(plan),
  ].join("\n");
}

function renderImportSummary(plan: ImportPlan): string {
  return [
    "",
    sectionTitle("Import Summary"),
    renderCountBlock("Imported", plan.imported.length, plan.imported.map((item) => item.id), terminalPalette.harbor),
    renderCountBlock("Already cataloged", plan.skippedExisting.length, [], terminalPalette.driftwood),
    renderCountBlock("Missing lock metadata", plan.skippedNoLock.length, plan.skippedNoLock, terminalPalette.ember),
  ].join("\n");
}

function renderCountBlock(title: string, count: number, values: string[], color: typeof terminalPalette[keyof typeof terminalPalette]): string {
  return [
    `${paint(color, "●")} ${bold}${title.padEnd(22)}${reset} ${paint(color, String(count))}`,
    ...renderValueList(values),
  ].join("\n");
}

function renderValueList(values: string[]): string[] {
  if (values.length === 0) {
    return [];
  }

  return values.map((value) => `  ${bullet()} ${value}`);
}

function renderPathRow(name: string, value: string): string {
  return `${label(name.padEnd(8))} ${muted(value)}`;
}

function label(value: string): string {
  return paint(terminalPalette.brass, value);
}

function bullet(): string {
  return paint(terminalPalette.sienna, "•");
}
