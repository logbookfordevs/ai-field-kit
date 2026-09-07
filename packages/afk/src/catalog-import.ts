import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { sectionTitle, muted } from "./brand.js";
import { applyOperation, formatOperation, isDirectory, summarizeOperations } from "./fs-utils.js";
import { loadSkillManifest, localManifestDir, projectManifestDir, type SkillManifest, type SkillManifestItem } from "./manifest.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

type SkillLockEntry = {
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  skillPath?: string;
  skillFolderHash?: string;
};

type SkillLock = {
  skills?: Record<string, SkillLockEntry>;
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

export type CatalogSkillsImportStatus = {
  notImported: string[];
  catalogOnly: string[];
  installed: string[];
  cataloged: string[];
  sourceSkillsDir: string;
  targetCatalogPath: string;
};

type CatalogImportOptions = Pick<CliOptions, "homeDir" | "cwd" | "dryRun" | "manifestLocal"> & {
  startDisabled?: boolean;
};

export type SetupSourceCatalogImportPlan = {
  operation?: PathOperation;
  imported: SkillManifestItem[];
  missingLock: string[];
  targetCatalogPath: string;
};

export type SkillCatalogRecoveryPlan = {
  manifest: SkillManifest;
  operation?: PathOperation;
  recovered: SkillManifestItem[];
  targetCatalogPath: string;
};

export function planSkillCatalogRecovery(
  options: CatalogImportOptions,
  requestedIds: string[],
  upstreamAliases: Record<string, string> = {},
): SkillCatalogRecoveryPlan {
  const targetCatalogPath = join(options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir), "skills.json");
  const existing = readSkillCatalog(targetCatalogPath);
  const existingIds = new Set(existing.items.map((item) => item.id.toLowerCase()));
  const requested = new Set(requestedIds.map((id) => id.toLowerCase()));
  const lock = readSkillLock(sourceLockPathForOptions(options));
  const recovered = installedSkillsForImport(sourceSkillsDirForOptions(options))
    .filter((skill) => requested.has(skill.id.toLowerCase()) && !existingIds.has(skill.id.toLowerCase()))
    .flatMap((skill) => {
      const resolvedLock = resolveInstalledSkillLock(skill, lock, upstreamAliases[skill.id]);
      return resolvedLock?.entry.source
        ? [skillManifestItemFromInstalledSkill(skill.id, skill.root, resolvedLock.entry.source, skill.startDisabled, resolvedLock.id)]
        : [];
    });

  if (recovered.length === 0) {
    return { manifest: existing, recovered, targetCatalogPath };
  }

  const manifest = {
    ...existing,
    scopes: ensureUncategorizedScope(existing.scopes ?? []),
    items: [...existing.items, ...recovered],
  };

  return {
    manifest,
    recovered,
    targetCatalogPath,
    operation: {
      type: "write",
      path: targetCatalogPath,
      content: `${JSON.stringify(manifest, null, 2)}\n`,
    },
  };
}

export function snapshotSetupSourceLockedSkillIds(options: CatalogImportOptions & {
  manifestContents: NonNullable<CliOptions["manifestContents"]>;
  selectedSkillIds: string[];
  allSkills: boolean;
}): string[] {
  const sourceManifest = loadSkillManifest(options);
  const selectedIds = new Set(options.selectedSkillIds.map((id) => id.toLowerCase()));
  const wholeSourceEntries = sourceManifest.items.filter((item) => (
    (selectedIds.size > 0 ? selectedIds.has(item.id.toLowerCase()) : item.default || options.allSkills) &&
    !skillIdFromArgs(item.args)
  ));
  const sources = new Set(wholeSourceEntries.map((item) => item.source));
  const lock = readSkillLock(sourceLockPathForOptions(options));
  return Object.entries(lock.skills ?? {})
    .filter(([, entry]) => Boolean(entry.source && sources.has(entry.source)))
    .map(([id]) => id.toLowerCase());
}

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

export async function runCatalogImportStatus(runtime: Runtime, options: CliOptions): Promise<number> {
  runtime.io.stdout(renderImportStatus(planCatalogImportStatus(options), options.manifestLocal ? "project" : "global"));
  return 0;
}

export function planCatalogImport(options: CatalogImportOptions): ImportPlan {
  const sourceSkillsDir = sourceSkillsDirForOptions(options);
  const sourceLockPath = sourceLockPathForOptions(options);
  const targetCatalogPath = join(options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir), "skills.json");
  const existing = readSkillCatalog(targetCatalogPath);
  const existingIds = new Set(existing.items.map((item) => item.id));
  const lock = readSkillLock(sourceLockPath);
  const installedSkills = installedSkillsForImport(sourceSkillsDir);
  const imported: SkillManifestItem[] = [];
  const skippedNoLock: string[] = [];
  const skippedExisting: string[] = [];

  for (const installed of installedSkills) {
    const { id } = installed;
    if (existingIds.has(id)) {
      skippedExisting.push(id);
      continue;
    }

    const lockEntry = lock.skills?.[id];
    if (!lockEntry?.source) {
      skippedNoLock.push(id);
      continue;
    }

    imported.push(skillManifestItemFromInstalledSkill(
      id,
      installed.root,
      lockEntry.source,
      options.startDisabled === true || installed.startDisabled,
    ));
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

export function planSetupSourceCatalogImport(options: CatalogImportOptions & {
  manifestContents: NonNullable<CliOptions["manifestContents"]>;
  selectedSkillIds: string[];
  allSkills: boolean;
  preexistingWholeSourceSkillIds?: string[];
  preserveCatalogOwnership?: boolean;
}): SetupSourceCatalogImportPlan {
  const sourceManifest = loadSkillManifest(options);
  const selectedIds = new Set(options.selectedSkillIds.map((id) => id.toLowerCase()));
  const selected = sourceManifest.items.filter((item) => (
    selectedIds.size > 0 ? selectedIds.has(item.id.toLowerCase()) : item.default || options.allSkills
  ));
  const sourceSkillsDir = sourceSkillsDirForOptions(options);
  const installed = installedSkillsForImport(sourceSkillsDir);
  const installedById = new Map(installed.map((skill) => [skill.id.toLowerCase(), skill]));
  const lock = readSkillLock(sourceLockPathForOptions(options));
  const importedById = new Map<string, SkillManifestItem>();
  const missingLock: string[] = [];
  const preexistingWholeSourceSkillIds = new Set(options.preexistingWholeSourceSkillIds ?? []);
  const targetCatalogPath = join(options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir), "skills.json");
  const existing = readSkillCatalog(targetCatalogPath);
  const existingById = new Map(existing.items.map((item) => [item.id.toLowerCase(), item]));
  const isCatalogOwned = (id: string): boolean => {
    const existingItem = existingById.get(id.toLowerCase());
    return options.preserveCatalogOwnership === true && existingItem !== undefined && existingItem.imported !== true;
  };

  for (const item of selected) {
    const requestedId = skillIdFromArgs(item.args);
    if (requestedId) {
      const lockEntry = lock.skills?.[requestedId];
      const installedFolder = lockEntry?.skillPath ? basename(dirname(lockEntry.skillPath)) : requestedId;
      const installedSkill = installedById.get(installedFolder.toLowerCase()) ?? installedById.get(requestedId.toLowerCase());
      if (!installedSkill || lockEntry?.source !== item.source) {
        missingLock.push(requestedId);
        continue;
      }
      if (isCatalogOwned(installedSkill.id)) {
        continue;
      }
      const importedItem = options.preserveCatalogOwnership
        ? skillManifestItemFromInstalledSkill(installedSkill.id, installedSkill.root, lockEntry.source, item.startDisabled === true || installedSkill.startDisabled, requestedId)
        : { ...item, id: requestedId, imported: true };
      importedById.set(importedItem.id.toLowerCase(), importedItem);
      continue;
    }

    let sourceVerified = false;
    for (const installedSkill of installed) {
      const existingItem = existingById.get(installedSkill.id.toLowerCase());
      if (preexistingWholeSourceSkillIds.has(installedSkill.id.toLowerCase()) && !(options.preserveCatalogOwnership && existingItem?.imported === true)) {
        continue;
      }
      const resolvedLock = resolveInstalledSkillLock(installedSkill, lock);
      if (resolvedLock?.entry.source !== item.source) {
        continue;
      }
      sourceVerified = true;
      if (isCatalogOwned(installedSkill.id)) {
        continue;
      }
      importedById.set(installedSkill.id.toLowerCase(), skillManifestItemFromInstalledSkill(
        installedSkill.id,
        installedSkill.root,
        resolvedLock.entry.source,
        item.startDisabled === true || installedSkill.startDisabled,
        resolvedLock.id,
      ));
    }

    if (!sourceVerified) {
      missingLock.push(item.id);
    }
  }

  const imported = [...importedById.values()];
  if (imported.length === 0) {
    return { imported, missingLock: uniqueSorted(missingLock), targetCatalogPath };
  }

  const nextItems = [
    ...existing.items.map((item) => importedById.get(item.id.toLowerCase()) ?? item),
    ...imported.filter((item) => !existing.items.some((existingItem) => existingItem.id.toLowerCase() === item.id.toLowerCase())),
  ];
  const referencedScopeIds = new Set(imported.map((item) => item.catalog?.scope).filter((id): id is string => Boolean(id)));
  const existingScopeIds = new Set((existing.scopes ?? []).map((scope) => scope.id));
  const scopes = ensureUncategorizedScope([
    ...(existing.scopes ?? []),
    ...(sourceManifest.scopes ?? []).filter((scope) => referencedScopeIds.has(scope.id) && !existingScopeIds.has(scope.id)),
  ]);

  return {
    imported,
    missingLock: uniqueSorted(missingLock),
    targetCatalogPath,
    operation: {
      type: "write",
      path: targetCatalogPath,
      content: `${JSON.stringify({ ...existing, scopes, items: nextItems }, null, 2)}\n`,
    },
  };
}

export function planCatalogImportStatus(options: CatalogImportOptions): CatalogSkillsImportStatus {
  const sourceSkillsDir = sourceSkillsDirForOptions(options);
  const targetCatalogPath = join(options.manifestLocal ? projectManifestDir(options.cwd) : localManifestDir(options.homeDir), "skills.json");
  const catalog = readSkillCatalog(targetCatalogPath);
  const installed = installedSkillIdsWithDisabledFrom(sourceSkillsDir);
  const installedIds = new Set(installed);
  const cataloged = catalog.items.map((item) => item.id).filter(Boolean).sort((left, right) => left.localeCompare(right));
  const catalogedIds = new Set(cataloged);

  return {
    notImported: installed.filter((id) => !catalogedIds.has(id)),
    catalogOnly: cataloged.filter((id) => !installedIds.has(id)),
    installed,
    cataloged,
    sourceSkillsDir,
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

function installedSkillIdsWithDisabledFrom(skillsDir: string): string[] {
  return uniqueSorted([
    ...installedSkillIdsFrom(skillsDir),
    ...installedSkillIdsFrom(join(skillsDir, ".disabled")),
  ]);
}

function installedSkillsForImport(skillsDir: string): Array<{ id: string; root: string; startDisabled: boolean }> {
  const active = installedSkillIdsFrom(skillsDir);
  const activeIds = new Set(active);
  const disabledRoot = join(skillsDir, ".disabled");
  const disabled = installedSkillIdsFrom(disabledRoot).filter((id) => !activeIds.has(id));

  return [
    ...active.map((id) => ({ id, root: skillsDir, startDisabled: false })),
    ...disabled.map((id) => ({ id, root: disabledRoot, startDisabled: true })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function skillIdFromArgs(args: string[]): string | undefined {
  const index = args.indexOf("--skill");
  return index >= 0 ? args[index + 1] : undefined;
}

function skillManifestItemFromInstalledSkill(
  id: string,
  skillRoot: string,
  source: string,
  startDisabled: boolean,
  upstreamId = id,
): SkillManifestItem {
  const skillPath = join(skillRoot, id, "SKILL.md");
  const content = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
  const frontmatter = frontmatterFields(content);
  const item: SkillManifestItem = {
    id,
    label: frontmatter.name ?? humanizeSkillId(id),
    source,
    args: ["--skill", upstreamId],
    default: false,
    role: "utility",
    catalog: { scope: "uncategorized" },
    imported: true,
  };
  if (startDisabled) {
    item.startDisabled = true;
  }

  return item;
}

function resolveInstalledSkillLock(
  skill: { id: string; root: string },
  lock: SkillLock,
  declaredUpstreamId?: string,
): { id: string; entry: SkillLockEntry } | undefined {
  const entries = Object.entries(lock.skills ?? {}).filter((candidate): candidate is [string, SkillLockEntry] => Boolean(candidate[1]?.source));
  if (declaredUpstreamId) {
    const declared = lock.skills?.[declaredUpstreamId];
    return declared?.source ? { id: declaredUpstreamId, entry: declared } : undefined;
  }

  const exact = lock.skills?.[skill.id];
  if (exact?.source) {
    return { id: skill.id, entry: exact };
  }

  const skillDir = join(skill.root, skill.id);
  const skillContent = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const installedNames = uniqueSorted([
    normalizeSkillLockId(skill.id),
    normalizeSkillLockId(frontmatterFields(skillContent).name ?? ""),
  ].filter(Boolean));
  const normalizedMatch = uniqueLockMatch(entries.filter(([id]) => installedNames.includes(normalizeSkillLockId(id))));
  if (normalizedMatch) {
    return normalizedMatch;
  }

  const installedHash = computeSkillFolderHash(skillDir);
  const hashMatch = uniqueLockMatch(entries.filter(([, entry]) => Boolean(entry.skillFolderHash && entry.skillFolderHash === installedHash)));
  if (hashMatch) {
    return hashMatch;
  }

  return undefined;
}

function uniqueLockMatch(matches: Array<[string, SkillLockEntry]>): { id: string; entry: SkillLockEntry } | undefined {
  const match = matches[0];
  return matches.length === 1 && match ? { id: match[0], entry: match[1] } : undefined;
}

function normalizeSkillLockId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function computeSkillFolderHash(skillDir: string): string {
  const files: Array<{ path: string; content: Buffer }> = [];
  collectSkillFolderFiles(skillDir, skillDir, files);
  files.sort((left, right) => left.path.localeCompare(right.path));
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update(file.content);
  }
  return hash.digest("hex");
}

function collectSkillFolderFiles(baseDir: string, currentDir: string, files: Array<{ path: string; content: Buffer }>): void {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.isDirectory() && (entry.name === ".git" || entry.name === "node_modules")) {
      continue;
    }
    const path = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectSkillFolderFiles(baseDir, path, files);
    } else if (entry.isFile()) {
      files.push({ path: relative(baseDir, path).split("\\").join("/"), content: readFileSync(path) });
    }
  }
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

function renderImportStatus(status: CatalogSkillsImportStatus, scope: "global" | "project"): string {
  return [
    "",
    sectionTitle("Catalog Skills Status"),
    muted(`Compare installed shared skills with the ${scope} AFK skills catalog.`),
    "",
    renderPathRow("Scope", scope),
    renderPathRow("Skills", status.sourceSkillsDir),
    renderPathRow("Catalog", status.targetCatalogPath),
    "",
    sectionTitle("Import Status"),
    renderCountBlock("Installed", status.installed.length, [], terminalPalette.harbor),
    renderCountBlock("Cataloged", status.cataloged.length, [], terminalPalette.driftwood),
    renderCountBlock("Not imported yet", status.notImported.length, status.notImported, terminalPalette.ember),
    renderCountBlock("Catalog only", status.catalogOnly.length, status.catalogOnly, terminalPalette.brass),
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
