import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ManagedSkillAgent, SkillsListScope } from "../types.js";

export const afkSkillsTaxonomyFileName = "afk-skills.json";

export type SkillStorage = "active" | "disabled";
export type SkillRootKind = "global-library" | "project-agent" | "agent-library";

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
  platforms: string[];
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
  platforms?: string[];
  tags?: string[];
};

export type SkillCatalogDefinition = {
  version: number;
  generatedAt?: string;
  description?: string;
  scopes: SkillCatalogScope[];
  skills: SkillCategorizationEntry[];
};

export type SkillCategorizationState =
  | { state: "missing"; path: string }
  | { state: "invalid"; path: string; message: string }
  | { state: "loaded"; path: string; definition: SkillCatalogDefinition };

export type SkillCatalogSnapshot = {
  records: SkillRecord[];
  categorization: SkillCategorizationState;
};

export type SkillMovement = {
  folder: string;
  movement: string;
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
  platform?: string | undefined;
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

    if (filters.platform) {
      const platform = normalize(filters.platform);
      if (!record.platforms.some((item) => normalize(item) === platform)) {
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
    };
  }

  const values = parseFrontmatterValues(frontmatterLines);

  const description = normalizeSkillDescription(values.get("description")) ?? firstBodyParagraph(bodyLines.join("\n"));
  return {
    name: nonEmpty(values.get("name")) ?? fallbackName,
    description,
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
  const path = taxonomyPath(homeDir);
  if (!existsSync(path)) {
    return { state: "missing", path };
  }

  try {
    const definition = JSON.parse(readFileSync(path, "utf8")) as SkillCatalogDefinition;
    if (!isSkillCatalogDefinition(definition)) {
      return { state: "invalid", path, message: "Expected version, scopes, and skills fields." };
    }

    return { state: "loaded", path, definition };
  } catch (error) {
    return { state: "invalid", path, message: error instanceof Error ? error.message : String(error) };
  }
}

export function taxonomyPath(homeDir: string): string {
  return join(homeDir, ".agents", "skills", afkSkillsTaxonomyFileName);
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

export function trashGlobalSkill(options: {
  homeDir: string;
  folder: string;
  dryRun: boolean;
  platform?: NodeJS.Platform;
}): string {
  const movement = trashGlobalSkills({
    homeDir: options.homeDir,
    folders: [options.folder],
    dryRun: options.dryRun,
    ...(options.platform ? { platform: options.platform } : {}),
  })[0];
  if (!movement) {
    throw new Error(`Could not find global skill: ${options.folder}`);
  }

  return movement.movement;
}

export function trashGlobalSkills(options: {
  homeDir: string;
  folders: string[];
  dryRun: boolean;
  platform?: NodeJS.Platform;
}): SkillMovement[] {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    throw new Error("Trash is currently supported on macOS only.");
  }

  const trashRoot = join(options.homeDir, ".Trash");
  const reservedDestinations = new Set<string>();
  const movements = options.folders.map((folder) => {
    const source = resolveGlobalSkillPath(options.homeDir, folder);
    if (!source) {
      throw new Error(`Could not find global skill: ${folder}`);
    }

    const destination = uniqueTrashPath(trashRoot, folder, reservedDestinations);
    reservedDestinations.add(destination);

    return {
      folder,
      source,
      destination,
    };
  });

  if (!options.dryRun) {
    mkdirSync(trashRoot, { recursive: true });
    for (const movement of movements) {
      renameSync(movement.source, movement.destination);
    }
  }

  return movements.map((movement) => ({
    folder: movement.folder,
    movement: `${movement.source} -> ${movement.destination}`,
  }));
}

export function trashSkillRecords(options: {
  homeDir: string;
  records: SkillRecord[];
  dryRun: boolean;
  platform?: NodeJS.Platform;
}): SkillMovement[] {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") {
    throw new Error("Trash is currently supported on macOS only.");
  }

  const trashRoot = join(options.homeDir, ".Trash");
  const reservedDestinations = new Set<string>();
  const movements = options.records.map((record) => {
    const source = join(record.rootPath, record.folder);
    if (!existsSync(source)) {
      throw new Error(`Could not find skill: ${record.folder}`);
    }

    const destination = uniqueTrashPath(trashRoot, record.folder, reservedDestinations);
    reservedDestinations.add(destination);

    return {
      folder: record.folder,
      source,
      destination,
    };
  });

  if (!options.dryRun) {
    mkdirSync(trashRoot, { recursive: true });
    for (const movement of movements) {
      renameSync(movement.source, movement.destination);
    }
  }

  return movements.map((movement) => ({
    folder: movement.folder,
    movement: `${movement.source} -> ${movement.destination}`,
  }));
}

export function renameGlobalSkill(options: {
  homeDir: string;
  folder: string;
  displayName: string;
  dryRun: boolean;
}): string {
  const displayName = options.displayName.trim();
  if (!displayName) {
    throw new Error("Display name cannot be empty.");
  }

  if (/[\r\n]/.test(displayName)) {
    throw new Error("Display name must stay on a single line.");
  }

  const categorization = loadCategorizationState(options.homeDir);
  if (categorization.state === "missing") {
    throw new Error(`Rename labels require ${categorization.path}. Run afk skills categorize first.`);
  }

  if (categorization.state === "invalid") {
    throw new Error(`Rename labels require a valid ${categorization.path}. ${categorization.message}`);
  }

  const definition = categorization.definition;
  const skills = [...definition.skills];
  const existingIndex = skills.findIndex((skill) => skill.folder === options.folder);
  if (existingIndex >= 0) {
    const existing = skills[existingIndex];
    if (existing) {
      skills[existingIndex] = { ...existing, name: displayName };
    }
  } else {
    skills.push({
      folder: options.folder,
      name: displayName,
      scope: ensureUncategorizedScope(definition).id,
    });
  }

  const nextDefinition: SkillCatalogDefinition = {
    ...definition,
    scopes: ensureScope(definition.scopes, ensureUncategorizedScope(definition)),
    skills,
  };

  if (!options.dryRun) {
    writeFileSync(categorization.path, `${JSON.stringify(nextDefinition, null, 2)}\n`);
  }

  return categorization.path;
}

export function renameCodexSkillMetadata(options: {
  record: SkillRecord;
  displayName: string;
  dryRun: boolean;
}): string {
  const displayName = validateDisplayName(options.displayName);
  const path = join(options.record.rootPath, options.record.folder, "agents", "openai.yaml");

  if (options.dryRun) {
    return path;
  }

  mkdirSync(dirname(path), { recursive: true });
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, updateOpenAiMetadataDisplayName(current, displayName));

  return path;
}

export function updateOpenAiMetadataDisplayName(contents: string, displayName: string): string {
  const quotedName = quoteYamlString(validateDisplayName(displayName));
  if (!contents.trim()) {
    return [
      "interface:",
      `  display_name: ${quotedName}`,
      "",
    ].join("\n");
  }

  const lines = contents.split(/\r?\n/);
  const interfaceIndex = lines.findIndex((line) => /^interface:\s*$/.test(line));
  if (interfaceIndex < 0) {
    return [
      "interface:",
      `  display_name: ${quotedName}`,
      ...lines,
    ].join("\n").replace(/\n+$/, "\n");
  }

  let insertIndex = interfaceIndex + 1;
  for (let index = interfaceIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (/^\S/.test(line) && line.trim().length > 0) {
      break;
    }

    if (/^\s+display_name:\s*/.test(line)) {
      const indent = line.match(/^\s*/)?.[0] ?? "  ";
      lines[index] = `${indent}display_name: ${quotedName}`;
      return lines.join("\n").replace(/\n+$/, "\n");
    }

    insertIndex = index + 1;
  }

  lines.splice(insertIndex, 0, `  display_name: ${quotedName}`);
  return lines.join("\n").replace(/\n+$/, "\n");
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
        platforms: taxonomyEntry?.platforms ?? [],
      } satisfies SkillRecord];
    });
}

function validateDisplayName(value: string): string {
  const displayName = value.trim();
  if (!displayName) {
    throw new Error("Display name cannot be empty.");
  }

  if (/[\r\n]/.test(displayName)) {
    throw new Error("Display name must stay on a single line.");
  }

  return displayName;
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
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

function uniqueTrashPath(trashRoot: string, folder: string, reserved: Set<string> = new Set()): string {
  const first = join(trashRoot, folder);
  if (!existsSync(first) && !reserved.has(first)) {
    return first;
  }

  let index = 1;
  while (true) {
    const candidate = join(trashRoot, `${folder}-${index}`);
    if (!existsSync(candidate) && !reserved.has(candidate)) {
      return candidate;
    }
    index += 1;
  }
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
