import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ManagedSkillAgent, SkillsListScope } from "../types.js";
import { loadSkillManifest, localManifestDir, type SkillManifest, type SkillManifestItem } from "../manifest.js";

export const skillCatalogFileName = "skills.json";
export const retiredSkillCatalogFileName = "skill-catalog.json";
export const legacySkillCatalogFileName = "afk-skills.json";

export type SkillStorage = "active" | "disabled";
export type SkillRootKind = "global-library" | "project-agent" | "agent-library";
export type SkillAutoInvocationState = "enabled" | "disabled" | "mixed" | "default";

export type SkillRecord = {
  folder: string;
  name: string;
  originalName: string;
  description: string;
  rootLabel: string;
  rootPath: string;
  skillFilePath: string;
  storage: SkillStorage;
  rootKind: SkillRootKind;
  readOnly: boolean;
  agent: ManagedSkillAgent | undefined;
  category: string | undefined;
  categoryId: string | undefined;
  tags: string[];
  autoInvocation: SkillAutoInvocationState;
  autoInvocationSources: string[];
  autoInvocationDetails: string[];
};

export type SkillCatalogScope = {
  id: string;
  label: string;
  description?: string;
};

export type SkillCategorizationEntry = {
  folder: string;
  name?: string;
  scope: string;
  tags?: string[];
};

export type SkillCatalogDefinition = {
  version: number;
  defaultSource?: string;
  generatedAt?: string;
  description?: string;
  scopes: SkillCatalogScope[];
  skills: SkillCategorizationEntry[];
  items?: SkillManifestItem[];
};

export type SkillCategorizationState =
  | { state: "missing"; path: string; legacyPath: string }
  | { state: "invalid"; path: string; legacyPath: string; message: string; source: "canonical" | "legacy" }
  | { state: "loaded"; path: string; legacyPath: string; definition: SkillCatalogDefinition; source: "canonical" | "legacy" };

export type SkillCatalogSnapshot = {
  records: SkillRecord[];
  categorization: SkillCategorizationState;
};

export type SkillMovement = {
  folder: string;
  movement: string;
};

type ImportedCatalogPrunePlan = {
  path: string;
  removed: string[];
  content: string | null;
};

export type SkillCatalogManifestSyncResult = {
  path: string;
  added: string[];
};

type SkillRoot = {
  kind: SkillRootKind;
  label: string;
  path: string;
  storage: SkillStorage;
  readOnly: boolean;
  agent?: ManagedSkillAgent;
};

type FrontmatterMetadata = {
  name: string | undefined;
  description: string | undefined;
  disableModelInvocation: boolean | undefined;
};

export function loadSkillCatalog(options: {
  homeDir: string;
  cwd: string;
  scope: SkillsListScope;
  agent: ManagedSkillAgent | undefined;
}): SkillCatalogSnapshot {
  const categorization = loadCategorizationState(options.homeDir);
  const roots = skillRoots(options.homeDir, options.cwd)
    .filter((root) => rootMatchesScope(root, options.scope))
    .filter((root) => !options.agent || root.agent === options.agent);

  const records = roots.flatMap((root) => loadRootSkills(root, categorization));
  return {
    records: sortSkillRecords(records),
    categorization,
  };
}

export type SkillListFilters = {
  category?: string | undefined;
  tag?: string | undefined;
  uncategorized?: boolean | undefined;
};

export function filterSkillRecords(records: SkillRecord[], filters: SkillListFilters): SkillRecord[] {
  return records.filter((record) => {
    if (filters.uncategorized && record.categoryId) {
      return false;
    }

    if (filters.category) {
      const category = normalize(filters.category);
      const id = normalize(record.categoryId);
      const label = normalize(record.category);
      if (category !== id && category !== label) {
        return false;
      }
    }

    if (filters.tag) {
      const tag = normalize(filters.tag);
      if (!record.tags.some((item) => normalize(item) === tag)) {
        return false;
      }
    }

    return true;
  });
}

export function parseSkillFile(contents: string, fallbackName: string): FrontmatterMetadata {
  const lines = contents.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return {
      name: undefined,
      description: firstBodyParagraph(contents),
      disableModelInvocation: undefined,
    };
  }

  const frontmatterLines: string[] = [];
  const bodyLines: string[] = [];
  let inFrontmatter = true;
  let closed = false;

  for (const line of lines.slice(1)) {
    if (inFrontmatter && line.trim() === "---") {
      inFrontmatter = false;
      closed = true;
      continue;
    }

    if (inFrontmatter) {
      frontmatterLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  if (!closed) {
    return {
      name: undefined,
      description: firstBodyParagraph(contents),
      disableModelInvocation: undefined,
    };
  }

  const values = parseFrontmatterValues(frontmatterLines);

  const description = normalizeSkillDescription(values.get("description")) ?? firstBodyParagraph(bodyLines.join("\n"));
  return {
    name: nonEmpty(values.get("name")) ?? fallbackName,
    description,
    disableModelInvocation: parseBoolean(values.get("disable-model-invocation")),
  };
}

export function normalizeSkillDescription(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || isYamlBlockScalarMarker(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function loadCategorizationState(homeDir: string): SkillCategorizationState {
  const path = skillCatalogPath(homeDir);
  const legacyPath = legacySkillCatalogPath(homeDir);
  const retiredPath = retiredSkillCatalogPath(homeDir);
  const source = existsSync(path) ? "canonical" : existsSync(retiredPath) || existsSync(legacyPath) ? "legacy" : undefined;
  if (!source) {
    return { state: "missing", path, legacyPath };
  }

  const readPath = source === "canonical" ? path : existsSync(retiredPath) ? retiredPath : legacyPath;
  try {
    const parsed = JSON.parse(readFileSync(readPath, "utf8")) as unknown;
    const definition = source === "canonical"
      ? mergeLegacyDefinition(skillManifestToCatalogDefinition(parsed), readLegacyCatalogDefinition(retiredPath, legacyPath))
      : legacyCatalogDefinition(parsed);
    if (!definition) {
      return { state: "invalid", path, legacyPath, source, message: "Expected version, scopes, and skills fields." };
    }

    return { state: "loaded", path, legacyPath, source, definition };
  } catch (error) {
    return { state: "invalid", path, legacyPath, source, message: error instanceof Error ? error.message : String(error) };
  }
}

export function taxonomyPath(homeDir: string): string {
  return skillCatalogPath(homeDir);
}

export function skillCatalogPath(homeDir: string): string {
  return join(localManifestDir(homeDir), skillCatalogFileName);
}

export function retiredSkillCatalogPath(homeDir: string): string {
  return join(dirname(localManifestDir(homeDir)), retiredSkillCatalogFileName);
}

export function legacySkillCatalogPath(homeDir: string): string {
  return join(homeDir, ".agents", "skills", legacySkillCatalogFileName);
}

export function moveGlobalSkill(options: {
  homeDir: string;
  folder: string;
  enabled: boolean;
  dryRun: boolean;
}): string {
  const source = options.enabled
    ? join(disabledSkillsRoot(options.homeDir), options.folder)
    : join(globalSkillsRoot(options.homeDir), options.folder);
  const destination = options.enabled
    ? join(globalSkillsRoot(options.homeDir), options.folder)
    : join(disabledSkillsRoot(options.homeDir), options.folder);

  if (!existsSync(source)) {
    throw new Error(`Could not find ${options.enabled ? "disabled" : "active"} global skill: ${options.folder}`);
  }

  if (existsSync(destination)) {
    throw new Error(`Could not move ${options.folder}; destination already exists: ${destination}`);
  }

  if (!options.dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
  }

  return `${source} -> ${destination}`;
}

export function moveSkillRecord(options: {
  record: SkillRecord;
  enabled: boolean;
  dryRun: boolean;
}): string {
  if (options.enabled && options.record.storage !== "disabled") {
    throw new Error(`Could not enable ${options.record.folder}; skill is not disabled.`);
  }

  if (!options.enabled && options.record.storage !== "active") {
    throw new Error(`Could not disable ${options.record.folder}; skill is already disabled.`);
  }

  const source = join(options.record.rootPath, options.record.folder);
  const destinationRoot = options.enabled ? dirname(options.record.rootPath) : join(options.record.rootPath, ".disabled");
  const destination = join(destinationRoot, options.record.folder);

  if (!existsSync(source)) {
    throw new Error(`Could not find ${options.record.storage} skill: ${options.record.folder}`);
  }

  if (existsSync(destination)) {
    throw new Error(`Could not move ${options.record.folder}; destination already exists: ${destination}`);
  }

  if (!options.dryRun) {
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
  }

  return `${source} -> ${destination}`;
}

export function deleteGlobalSkill(options: {
  homeDir: string;
  folder: string;
  dryRun: boolean;
}): string {
  const movement = deleteGlobalSkills({
    homeDir: options.homeDir,
    folders: [options.folder],
    dryRun: options.dryRun,
  })[0];
  if (!movement) {
    throw new Error(`Could not find global skill: ${options.folder}`);
  }

  return movement.movement;
}

export function deleteGlobalSkills(options: {
  homeDir: string;
  folders: string[];
  dryRun: boolean;
}): SkillMovement[] {
  const movements = options.folders.map((folder) => {
    const source = resolveGlobalSkillPath(options.homeDir, folder);
    if (!source) {
      throw new Error(`Could not find global skill: ${folder}`);
    }

    return {
      folder,
      source,
      destination: "(deleted)",
    };
  });
  const catalogPrune = planImportedCatalogPrune(options.homeDir, options.folders);

  if (!options.dryRun) {
    for (const movement of movements) {
      rmSync(movement.source, { recursive: true, force: false });
    }
    writeImportedCatalogPrune(catalogPrune);
  }

  return movements.map((movement) => ({
    folder: movement.folder,
    movement: `${movement.source} -> ${movement.destination}`,
  }));
}

export function deleteSkillRecords(options: {
  homeDir: string;
  records: SkillRecord[];
  dryRun: boolean;
}): SkillMovement[] {
  const movements = options.records.map((record) => {
    const source = join(record.rootPath, record.folder);
    if (!existsSync(source)) {
      throw new Error(`Could not find skill: ${record.folder}`);
    }

    return {
      folder: record.folder,
      source,
      destination: "(deleted)",
    };
  });
  const catalogPrune = planImportedCatalogPrune(
    options.homeDir,
    options.records
      .filter((record) => record.rootKind === "global-library")
      .map((record) => record.folder),
  );

  if (!options.dryRun) {
    for (const movement of movements) {
      rmSync(movement.source, { recursive: true, force: false });
    }
    writeImportedCatalogPrune(catalogPrune);
  }

  return movements.map((movement) => ({
    folder: movement.folder,
    movement: `${movement.source} -> ${movement.destination}`,
  }));
}

export function syncSkillCatalogFromManifest(options: {
  homeDir: string;
  selectedSkillIds: string[];
  allSkills: boolean;
  dryRun: boolean;
}): SkillCatalogManifestSyncResult {
  const manifest = loadSkillManifest(options);
  const selected = options.selectedSkillIds.length > 0
    ? manifest.items.filter((item) => options.selectedSkillIds.includes(item.id))
    : manifest.items.filter((item) => item.default || options.allSkills);
  const folders = uniqueStrings(selected.map((item) => item.id.trim()).filter(Boolean));
  const path = skillCatalogPath(options.homeDir);
  const legacy = loadCategorizationState(options.homeDir);
  if (legacy.state === "invalid") {
    throw new Error(`Skill catalog sync requires a valid ${legacy.source === "legacy" ? legacy.legacyPath : legacy.path}. ${legacy.message}`);
  }

  const definition = legacy.state === "loaded" ? legacy.definition : skillManifestToDefinition(manifest);
  const uncategorized = ensureUncategorizedScope(definition);
  const existingFolders = new Set(definition.skills.map((skill) => skill.folder.toLowerCase()));
  const added = folders.filter((folder) => !existingFolders.has(folder.toLowerCase()));
  const syncedFolders = new Set(folders);
  const shouldMarkImported = (definition.items ?? manifest.items)
    .some((item) => syncedFolders.has(item.id) && item.imported !== true);

  if (added.length === 0 && !shouldMarkImported) {
    return { path, added };
  }

  const nextDefinition: SkillCatalogDefinition = {
    ...definition,
    generatedAt: new Date().toISOString(),
    scopes: ensureScope(definition.scopes, uncategorized),
    skills: [
      ...definition.skills,
      ...added.map((folder) => ({ folder, scope: uncategorized.id })),
    ],
  };

  if (!options.dryRun) {
    const nextManifest = catalogDefinitionToSkillManifest(nextDefinition, manifest);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify({
      ...nextManifest,
      items: nextManifest.items.map((item) => syncedFolders.has(item.id) ? { ...item, imported: true } : item),
    }, null, 2)}\n`);
  }

  return { path, added };
}

export function parseOpenAiImplicitInvocation(contents: string): boolean | undefined {
  const match = /^\s*allow_implicit_invocation:\s*(true|false)\s*$/m.exec(contents);
  if (!match) {
    return undefined;
  }

  return match[1] === "true";
}

function planImportedCatalogPrune(homeDir: string, folders: string[]): ImportedCatalogPrunePlan {
  const path = skillCatalogPath(homeDir);
  if (folders.length === 0 || !existsSync(path)) {
    return { path, removed: [], content: null };
  }

  let parsed: SkillManifest;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as SkillManifest;
  } catch {
    throw new Error(`Could not update AFK skill catalog before delete; invalid JSON at ${path}.`);
  }

  if (!Array.isArray(parsed.items)) {
    return { path, removed: [], content: null };
  }

  const folderIds = new Set(folders.map((folder) => folder.toLowerCase()));
  const removed = parsed.items
    .filter((item) => item.imported === true && folderIds.has(item.id.toLowerCase()))
    .map((item) => item.id);

  if (removed.length === 0) {
    return { path, removed, content: null };
  }

  return {
    path,
    removed,
    content: `${JSON.stringify({
      ...parsed,
      items: parsed.items.filter((item) => !(item.imported === true && folderIds.has(item.id.toLowerCase()))),
    }, null, 2)}\n`,
  };
}

function writeImportedCatalogPrune(plan: ImportedCatalogPrunePlan): void {
  if (!plan.content) {
    return;
  }

  writeFileSync(plan.path, plan.content);
}

export function sortSkillRecords(records: SkillRecord[]): SkillRecord[] {
  return [...records].sort((left, right) => {
    const rootOrder = rootSortOrder(left) - rootSortOrder(right);
    if (rootOrder !== 0) {
      return rootOrder;
    }

    if (left.storage !== right.storage) {
      return left.storage === "active" ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

function loadRootSkills(root: SkillRoot, categorization: SkillCategorizationState): SkillRecord[] {
  if (!existsSync(root.path)) {
    return [];
  }

  const entriesByFolder = categorization.state === "loaded"
    ? new Map(categorization.definition.skills.map((entry) => [entry.folder, entry]))
    : new Map<string, SkillCategorizationEntry>();
  const scopesById = categorization.state === "loaded"
    ? new Map(categorization.definition.scopes.map((scope) => [scope.id, scope]))
    : new Map<string, SkillCatalogScope>();

  return readdirSync(root.path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => root.storage === "disabled" || !entry.name.startsWith("."))
    .flatMap((entry) => {
      const skillFilePath = join(root.path, entry.name, "SKILL.md");
      if (!existsSync(skillFilePath)) {
        return [];
      }

      const metadata = parseSkillFile(readFileSync(skillFilePath, "utf8"), entry.name);
      const autoInvocation = resolveAutoInvocation({
        skillFile: metadata.disableModelInvocation === undefined ? undefined : !metadata.disableModelInvocation,
        openAi: readOpenAiImplicitInvocation(root.path, entry.name),
      });
      const taxonomyEntry = root.kind === "global-library" ? entriesByFolder.get(entry.name) : undefined;
      const scope = taxonomyEntry ? scopesById.get(taxonomyEntry.scope) : undefined;
      const originalName = metadata.name ?? entry.name;

      return [{
        folder: entry.name,
        name: nonEmpty(taxonomyEntry?.name) ?? originalName,
        originalName,
        description: metadata.description ?? "Installed skill",
        rootLabel: root.label,
        rootPath: root.path,
        skillFilePath,
        storage: root.storage,
        rootKind: root.kind,
        readOnly: root.readOnly,
        agent: root.agent,
        category: scope?.label,
        categoryId: scope?.id,
        tags: taxonomyEntry?.tags ?? [],
        autoInvocation: autoInvocation.state,
        autoInvocationSources: autoInvocation.sources,
        autoInvocationDetails: autoInvocation.details,
      } satisfies SkillRecord];
    });
}

function readOpenAiImplicitInvocation(rootPath: string, folder: string): boolean | undefined {
  const path = join(rootPath, folder, "agents", "openai.yaml");
  if (!existsSync(path)) {
    return undefined;
  }

  return parseOpenAiImplicitInvocation(readFileSync(path, "utf8"));
}

function resolveAutoInvocation(input: {
  skillFile?: boolean | undefined;
  openAi?: boolean | undefined;
}): { state: SkillAutoInvocationState; sources: string[]; details: string[] } {
  const signals = [
    input.skillFile === undefined
      ? undefined
      : {
        source: "SKILL.md",
        enabled: input.skillFile,
        detail: `SKILL.md ${input.skillFile ? "enables" : "disables"}`,
      },
    input.openAi === undefined
      ? undefined
      : {
        source: "agents/openai.yaml",
        enabled: input.openAi,
        detail: `agents/openai.yaml ${input.openAi ? "enables" : "disables"}`,
      },
  ].filter((signal): signal is { source: string; enabled: boolean; detail: string } => Boolean(signal));

  if (signals.length === 0) {
    return { state: "default", sources: [], details: [] };
  }

  const first = signals[0];
  const state = signals.every((signal) => signal.enabled === first?.enabled)
    ? first?.enabled ? "enabled" : "disabled"
    : "mixed";

  return {
    state,
    sources: signals.map((signal) => signal.source),
    details: signals.map((signal) => signal.detail),
  };
}

function emptySkillCatalogDefinition(): SkillCatalogDefinition {
  return {
    version: 1,
    defaultSource: "",
    generatedAt: new Date().toISOString(),
    description: "AFK skill catalog. Skills added by setup start uncategorized until afk skills categorize enriches them.",
    scopes: [],
    skills: [],
    items: [],
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function skillManifestToCatalogDefinition(value: unknown): SkillCatalogDefinition | null {
  if (!isSkillManifestLike(value)) {
    return null;
  }

  return skillManifestToDefinition(value);
}

function legacyCatalogDefinition(value: unknown): SkillCatalogDefinition | null {
  return isSkillCatalogDefinition(value) ? value : null;
}

function readLegacyCatalogDefinition(retiredPath: string, legacyPath: string): SkillCatalogDefinition | null {
  const readPath = existsSync(retiredPath) ? retiredPath : existsSync(legacyPath) ? legacyPath : undefined;
  if (!readPath) {
    return null;
  }

  try {
    return legacyCatalogDefinition(JSON.parse(readFileSync(readPath, "utf8")) as unknown);
  } catch {
    return null;
  }
}

function mergeLegacyDefinition(
  canonical: SkillCatalogDefinition | null,
  legacy: SkillCatalogDefinition | null,
): SkillCatalogDefinition | null {
  if (!canonical || !legacy) {
    return canonical;
  }

  const scopeIds = new Set(canonical.scopes.map((scope) => scope.id));
  const folders = new Set(canonical.skills.map((skill) => skill.folder));
  return {
    ...canonical,
    scopes: [
      ...canonical.scopes,
      ...legacy.scopes.filter((scope) => !scopeIds.has(scope.id)),
    ],
    skills: [
      ...canonical.skills,
      ...legacy.skills.filter((skill) => !folders.has(skill.folder)),
    ],
  };
}

function skillManifestToDefinition(manifest: SkillManifest): SkillCatalogDefinition {
  return {
    version: manifest.version,
    defaultSource: manifest.defaultSource,
    scopes: manifest.scopes ?? [],
    skills: manifest.items
      .filter((item) => item.catalog?.scope)
      .map((item) => {
        const catalog = item.catalog;
        return {
          folder: item.id,
          scope: catalog?.scope ?? "",
          ...(catalog?.tags ? { tags: catalog.tags } : {}),
        };
      }),
    items: manifest.items,
  };
}

function catalogDefinitionToSkillManifest(definition: SkillCatalogDefinition, baseManifest?: SkillManifest): SkillManifest {
  const entries = new Map(definition.skills.map((entry) => [entry.folder, entry]));
  const baseItems = baseManifest?.items ?? definition.items ?? [];
  const itemIds = new Set(baseItems.map((item) => item.id));
  const missingItems = definition.skills
    .filter((entry) => !itemIds.has(entry.folder))
    .map(skillCatalogEntryToManifestItem);

  return {
    version: Math.max(baseManifest?.version ?? definition.version, 1),
    defaultSource: baseManifest?.defaultSource ?? definition.defaultSource ?? "",
    scopes: definition.scopes,
    items: [
      ...baseItems.map((item) => mergeSkillCatalogEntry(item, entries.get(item.id))),
      ...missingItems,
    ],
  };
}

function mergeSkillCatalogEntry(item: SkillManifestItem, entry: SkillCategorizationEntry | undefined): SkillManifestItem {
  if (!entry) {
    return item;
  }

  return {
    ...item,
    catalog: {
      ...(item.catalog ?? {}),
      scope: entry.scope,
      ...(entry.tags ? { tags: entry.tags } : {}),
    },
  };
}

function skillCatalogEntryToManifestItem(entry: SkillCategorizationEntry): SkillManifestItem {
  return {
    id: entry.folder,
    label: entry.name ?? humanizeSkillId(entry.folder),
    source: "",
    args: ["--skill", entry.folder],
    default: false,
    autoInvocation: true,
    role: "utility",
    catalog: {
      scope: entry.scope,
      ...(entry.tags ? { tags: entry.tags } : {}),
    },
  };
}

function humanizeSkillId(id: string): string {
  return id
    .split(/[-_:]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function skillRoots(homeDir: string, cwd: string): SkillRoot[] {
  return [
    {
      kind: "global-library",
      label: "Global Library",
      path: globalSkillsRoot(homeDir),
      storage: "active",
      readOnly: false,
    },
    {
      kind: "global-library",
      label: "Global Library / Disabled",
      path: disabledSkillsRoot(homeDir),
      storage: "disabled",
      readOnly: false,
    },
    {
      kind: "project-agent",
      label: "Codex Project",
      path: join(cwd, ".codex", "skills"),
      storage: "active",
      readOnly: false,
      agent: "codex",
    },
    {
      kind: "project-agent",
      label: "Codex Project / Disabled",
      path: join(cwd, ".codex", "skills", ".disabled"),
      storage: "disabled",
      readOnly: false,
      agent: "codex",
    },
    {
      kind: "project-agent",
      label: "Claude Project",
      path: join(cwd, ".claude", "skills"),
      storage: "active",
      readOnly: false,
      agent: "claude",
    },
    {
      kind: "project-agent",
      label: "Claude Project / Disabled",
      path: join(cwd, ".claude", "skills", ".disabled"),
      storage: "disabled",
      readOnly: false,
      agent: "claude",
    },
    ...agentSkillRoots(homeDir),
  ];
}

export function managedSkillAgents(): ManagedSkillAgent[] {
  return knownAgentRoots.map((root) => root.agent);
}

const knownAgentRoots: Array<{
  agent: ManagedSkillAgent;
  label: string;
  path: string;
}> = [
  { agent: "codex", label: "Codex", path: ".codex/skills" },
  { agent: "claude", label: "Claude", path: ".claude/skills" },
  { agent: "gemini", label: "Gemini", path: ".gemini/skills" },
  { agent: "antigravity", label: "Gemini / Antigravity", path: ".gemini/antigravity/skills" },
  { agent: "opencode", label: "OpenCode", path: ".config/opencode/skills" },
  { agent: "cursor", label: "Cursor", path: ".cursor/skills" },
  { agent: "amp", label: "Amp", path: ".amp/skills" },
  { agent: "goose", label: "Goose", path: ".config/goose/skills" },
  { agent: "warp", label: "Warp", path: ".warp/skills" },
  { agent: "zed", label: "Zed", path: ".config/zed/skills" },
  { agent: "roo-code", label: "Roo Code", path: ".roo/skills" },
  { agent: "aider", label: "Aider", path: ".aider/skills" },
  { agent: "continue", label: "Continue", path: ".continue/skills" },
  { agent: "kiro", label: "Kiro", path: ".kiro/skills" },
  { agent: "jules", label: "Jules", path: ".jules/skills" },
  { agent: "openhands", label: "OpenHands", path: ".openhands/skills" },
];

function agentSkillRoots(homeDir: string): SkillRoot[] {
  return knownAgentRoots.flatMap((root) => [
    {
      kind: "agent-library",
      label: root.label,
      path: join(homeDir, root.path),
      storage: "active",
      readOnly: false,
      agent: root.agent,
    },
    {
      kind: "agent-library",
      label: `${root.label} / Disabled`,
      path: join(homeDir, root.path, ".disabled"),
      storage: "disabled",
      readOnly: false,
      agent: root.agent,
    },
  ] satisfies SkillRoot[]);
}

function rootMatchesScope(root: SkillRoot, scope: SkillsListScope): boolean {
  if (scope === "all") {
    return true;
  }

  if (scope === "global") {
    return root.kind === "global-library" || root.kind === "agent-library";
  }

  return root.kind === "project-agent";
}

function globalSkillsRoot(homeDir: string): string {
  return join(homeDir, ".agents", "skills");
}

function disabledSkillsRoot(homeDir: string): string {
  return join(globalSkillsRoot(homeDir), ".disabled");
}

function firstBodyParagraph(contents: string): string | undefined {
  return contents
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .find((paragraph) => paragraph.length > 0 && !paragraph.startsWith("#") && paragraph !== ">");
}

function resolveGlobalSkillPath(homeDir: string, folder: string): string | undefined {
  const active = join(globalSkillsRoot(homeDir), folder);
  if (existsSync(active)) {
    return active;
  }

  const disabled = join(disabledSkillsRoot(homeDir), folder);
  if (existsSync(disabled)) {
    return disabled;
  }

  return undefined;
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function parseFrontmatterValues(lines: string[]): Map<string, string> {
  const values = new Map<string, string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      continue;
    }

    const key = match[1] ?? "";
    const rawValue = (match[2] ?? "").trim();
    if (isYamlBlockScalarMarker(rawValue)) {
      const blockLines: string[] = [];
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1] ?? "";
        if (/^[A-Za-z0-9_-]+:\s*/.test(nextLine)) {
          break;
        }

        blockLines.push(nextLine.replace(/^\s{1,}/, ""));
        index += 1;
      }

      values.set(key, formatYamlBlockScalar(blockLines, rawValue.startsWith("|") ? "|" : ">"));
      continue;
    }

    values.set(key, rawValue.replace(/^["']|["']$/g, ""));
  }

  return values;
}

function formatYamlBlockScalar(lines: string[], style: ">" | "|"): string {
  const meaningfulLines = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (style === "|") {
    return meaningfulLines.join("\n");
  }

  return meaningfulLines.join(" ");
}

function isYamlBlockScalarMarker(value: string): boolean {
  return /^[>|][+-]?$/.test(value.trim());
}

function isSkillCatalogDefinition(value: unknown): value is SkillCatalogDefinition {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SkillCatalogDefinition;
  return typeof candidate.version === "number" && Array.isArray(candidate.scopes) && Array.isArray(candidate.skills);
}

function isSkillManifestLike(value: unknown): value is SkillManifest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SkillManifest;
  return typeof candidate.version === "number" &&
    typeof candidate.defaultSource === "string" &&
    Array.isArray(candidate.items);
}

function rootSortOrder(record: SkillRecord): number {
  if (record.rootKind === "global-library") {
    return 0;
  }

  if (record.rootKind === "project-agent") {
    return record.agent === "codex" ? 1 : 2;
  }

  return 10 + Math.max(0, managedSkillAgents().indexOf(record.agent ?? "codex"));
}

function ensureUncategorizedScope(definition: SkillCatalogDefinition): SkillCatalogScope {
  return definition.scopes.find((scope) => scope.id === "uncategorized") ?? {
    id: "uncategorized",
    label: "Uncategorized",
    description: "Skills managed by AFK that have not been assigned to a narrower category yet.",
  };
}

function ensureScope(scopes: SkillCatalogScope[], scope: SkillCatalogScope): SkillCatalogScope[] {
  return scopes.some((item) => item.id === scope.id) ? scopes : [...scopes, scope];
}
