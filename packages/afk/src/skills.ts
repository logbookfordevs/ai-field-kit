import { realpathSync } from "node:fs";
import { join } from "node:path";
import { applyOperation, formatOperation, isDirectory, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { loadSkillManifest, type SkillManifestItem } from "./manifest.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

export function planSkillInvocationPolicy(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "selectedSkillIds" | "manifestContents"> & { allSkills?: boolean }): PathOperation[] {
  const manifest = loadSkillManifest(options);
  const selected = selectedSkillManifestItems(manifest.items, options);
  const operations: PathOperation[] = [];
  const plannedRealPaths = new Set<string>();

  for (const item of selected) {
    const allowInvocation = item.autoInvocation !== false;
    for (const skillDir of skillDirectories(options, item)) {
      operations.push(...planSkillInvocation(skillDir, plannedRealPaths, allowInvocation));
    }
  }

  return operations;
}

export function syncSkillInvocationPolicy(runtime: Runtime, options: CliOptions): void {
  const operations = planSkillInvocationPolicy(options);

  if (operations.length === 0) {
    return;
  }

  if (options.dryRun) {
    runtime.io.stdout("\nSkill invocation policy plan");
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nSkill invocation policies synced: ${summarizeOperations(operations)}.`);
}

export function planSkillStartupStorage(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "selectedSkillIds" | "manifestContents"> & { allSkills?: boolean }): PathOperation[] {
  const manifest = loadSkillManifest(options);
  const selected = selectedSkillManifestItems(manifest.items, options);
  return planSkillStartupStorageForItems(options, selected);
}

export function planSkillStartupStorageForItems(
  options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">,
  items: SkillManifestItem[],
): PathOperation[] {
  const operations: PathOperation[] = [];

  for (const item of items) {
    if (item.startDisabled !== true) {
      continue;
    }

    const activeDir = sharedSkillDirectory(options, item);
    const disabledDir = join(sharedSkillsRoot(options), ".disabled", item.id);
    if (!isDirectory(activeDir)) {
      operations.push({
        type: "skip",
        path: activeDir,
        reason: isDirectory(disabledDir) ? "already disabled" : "installed skill not found",
      });
      continue;
    }

    if (pathExists(disabledDir)) {
      operations.push({
        type: "skip",
        path: disabledDir,
        reason: "disabled destination already exists",
      });
      continue;
    }

    operations.push({
      type: "move",
      source: activeDir,
      target: disabledDir,
    });
  }

  return operations;
}

export function syncSkillStartupStorage(runtime: Runtime, options: CliOptions): void {
  const operations = planSkillStartupStorage(options);

  if (operations.length === 0) {
    return;
  }

  if (options.dryRun) {
    runtime.io.stdout("\nSkill startup storage plan");
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return;
  }

  const applied = operations.filter((operation) => operation.type !== "skip");
  for (const operation of applied) {
    applyOperation(operation);
  }

  if (applied.length > 0) {
    runtime.io.stdout(`\nSkill startup storage synced: ${summarizeOperations(applied)}.`);
  }
}

function skillDirectories(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, item: SkillManifestItem): string[] {
  const root = options.setupScope === "global" ? options.homeDir : options.cwd;
  return [
    join(root, ".agents", "skills", item.id),
    join(root, ".claude", "skills", item.id),
  ];
}

function selectedSkillManifestItems(
  items: SkillManifestItem[],
  options: Pick<CliOptions, "selectedSkillIds"> & { allSkills?: boolean },
): SkillManifestItem[] {
  return options.selectedSkillIds.length > 0
    ? items.filter((item) => options.selectedSkillIds.includes(item.id))
    : items.filter((item) => item.default || options.allSkills === true);
}

function sharedSkillsRoot(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">): string {
  const root = options.setupScope === "global" ? options.homeDir : options.cwd;
  return join(root, ".agents", "skills");
}

function sharedSkillDirectory(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, item: SkillManifestItem): string {
  return join(sharedSkillsRoot(options), item.id);
}

function planSkillInvocation(skillDir: string, plannedRealPaths: Set<string>, allowInvocation: boolean): PathOperation[] {
  const skillMd = join(skillDir, "SKILL.md");
  const openaiYaml = join(skillDir, "agents", "openai.yaml");
  const operations: PathOperation[] = [];

  if (!pathExists(skillMd)) {
    return operations;
  }

  const skillMdRealPath = realPathOrSelf(skillMd);
  if (!plannedRealPaths.has(skillMdRealPath)) {
    plannedRealPaths.add(skillMdRealPath);
    const nextSkillMd = upsertFrontmatterBoolean(readText(skillMd), "disable-model-invocation", !allowInvocation);
    if (nextSkillMd !== readText(skillMd)) {
      operations.push({ type: "write", path: skillMd, content: nextSkillMd });
    }
  }

  const openaiYamlRealPath = realPathOrSelf(openaiYaml);
  if (!plannedRealPaths.has(openaiYamlRealPath)) {
    plannedRealPaths.add(openaiYamlRealPath);
    const currentOpenAiYaml = pathExists(openaiYaml) ? readText(openaiYaml) : "";
    const nextOpenAiYaml = upsertOpenAiImplicitInvocation(currentOpenAiYaml, allowInvocation);
    if (nextOpenAiYaml !== currentOpenAiYaml) {
      operations.push({ type: "write", path: openaiYaml, content: nextOpenAiYaml });
    }
  }

  return operations;
}

export function upsertFrontmatterBoolean(markdown: string, key: string, value: boolean): string {
  const line = `${key}: ${value ? "true" : "false"}`;
  if (!markdown.startsWith("---\n")) {
    return `---\n${line}\n---\n\n${markdown}`;
  }

  const end = markdown.indexOf("\n---", 4);
  if (end === -1) {
    return `---\n${line}\n---\n\n${markdown.replace(/^---\n?/, "")}`;
  }

  const frontmatter = markdown.slice(4, end);
  const body = markdown.slice(end);
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(true|false)\\s*$`, "m");
  const nextFrontmatter = (pattern.test(frontmatter)
    ? frontmatter.replace(pattern, line)
    : `${frontmatter.trimEnd()}\n${line}`)
    .trimEnd();

  return `---\n${nextFrontmatter}${body}`;
}

export function upsertOpenAiImplicitInvocation(yaml: string, value: boolean): string {
  const line = `  allow_implicit_invocation: ${value ? "true" : "false"}`;
  if (!yaml.trim()) {
    return `policy:\n${line}\n`;
  }

  if (/^\s*allow_implicit_invocation:\s*(true|false)\s*$/m.test(yaml)) {
    return ensureTrailingNewline(yaml.replace(/^\s*allow_implicit_invocation:\s*(true|false)\s*$/m, line));
  }

  if (/^policy:\s*$/m.test(yaml)) {
    return ensureTrailingNewline(yaml.replace(/^policy:\s*$/m, `policy:\n${line}`));
  }

  return `${ensureTrailingNewline(yaml)}policy:\n${line}\n`;
}

function realPathOrSelf(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
