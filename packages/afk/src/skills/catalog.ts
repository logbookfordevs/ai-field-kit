import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ManagedSkillAgent, SkillsListScope } from "../types.js";

export const afkSkillsTaxonomyFileName = "afk-skills.json";

export type SkillStorage = "active" | "disabled";
export type SkillRootKind = "global-library" | "project-agent";

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

  const description = nonEmpty(values.get("description")) ?? firstBodyParagraph(bodyLines.join("\n"));
  return {
    name: nonEmpty(values.get("name")) ?? fallbackName,
    description,
  };
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
      readOnly: true,
      agent: "codex",
    },
    {
      kind: "project-agent",
      label: "Claude Project",
      path: join(cwd, ".claude", "skills"),
      storage: "active",
      readOnly: true,
      agent: "claude",
    },
  ];
}

function rootMatchesScope(root: SkillRoot, scope: SkillsListScope): boolean {
  if (scope === "all") {
    return true;
  }

  if (scope === "global") {
    return root.kind === "global-library";
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
    if (rawValue === ">" || rawValue === "|") {
      const blockLines: string[] = [];
      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1] ?? "";
        if (/^[A-Za-z0-9_-]+:\s*/.test(nextLine)) {
          break;
        }

        blockLines.push(nextLine.replace(/^\s{1,}/, ""));
        index += 1;
      }

      values.set(key, formatYamlBlockScalar(blockLines, rawValue));
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

  return record.agent === "codex" ? 1 : 2;
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
