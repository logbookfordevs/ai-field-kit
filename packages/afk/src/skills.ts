import { realpathSync } from "node:fs";
import { join } from "node:path";
import { applyOperation, formatOperation, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { loadSkillManifest, type SkillManifestItem } from "./manifest.js";
import type { CliOptions, PathOperation, Runtime } from "./types.js";

export function planSkillInvocationPolicy(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "selectedSkillIds">): PathOperation[] {
  const manifest = loadSkillManifest(options);
  const selected = options.selectedSkillIds.length > 0
    ? manifest.items.filter((item) => options.selectedSkillIds.includes(item.id))
    : manifest.items.filter((item) => item.default);
  const manualSkills = selected.filter((item) => item.autoInvocation === false);
  const operations: PathOperation[] = [];
  const plannedRealPaths = new Set<string>();

  for (const item of manualSkills) {
    for (const skillDir of skillDirectories(options, item)) {
      operations.push(...planManualSkillInvocation(skillDir, plannedRealPaths));
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

function skillDirectories(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, item: SkillManifestItem): string[] {
  const root = options.setupScope === "global" ? options.homeDir : options.cwd;
  return [
    join(root, ".agents", "skills", item.id),
    join(root, ".claude", "skills", item.id),
  ];
}

function planManualSkillInvocation(skillDir: string, plannedRealPaths: Set<string>): PathOperation[] {
  const skillMd = join(skillDir, "SKILL.md");
  const openaiYaml = join(skillDir, "agents", "openai.yaml");
  const operations: PathOperation[] = [];

  if (!pathExists(skillMd)) {
    return operations;
  }

  const skillMdRealPath = realPathOrSelf(skillMd);
  if (!plannedRealPaths.has(skillMdRealPath)) {
    plannedRealPaths.add(skillMdRealPath);
    const nextSkillMd = upsertFrontmatterBoolean(readText(skillMd), "disable-model-invocation", true);
    if (nextSkillMd !== readText(skillMd)) {
      operations.push({ type: "write", path: skillMd, content: nextSkillMd });
    }
  }

  const openaiYamlRealPath = realPathOrSelf(openaiYaml);
  if (!plannedRealPaths.has(openaiYamlRealPath)) {
    plannedRealPaths.add(openaiYamlRealPath);
    const currentOpenAiYaml = pathExists(openaiYaml) ? readText(openaiYaml) : "";
    const nextOpenAiYaml = upsertOpenAiImplicitInvocation(currentOpenAiYaml, false);
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
