import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isMap, parseDocument } from "yaml";

export type InvocationMode = "Manual only" | "Automatic allowed" | "Unknown";

export interface SkillInvocation {
  claude: InvocationMode;
  codex: InvocationMode;
}

interface NativeMetadata {
  description: string;
  invocation: SkillInvocation;
}

export function unknownInvocation(): SkillInvocation {
  return { claude: "Unknown", codex: "Unknown" };
}

async function readMetadataFile(path: string): Promise<string | null | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? null : undefined;
  }
}

function yamlMapping(text: string) {
  try {
    const document = parseDocument(text);
    if (document.errors.length || (document.contents !== null && !isMap(document.contents))) return undefined;
    return document;
  } catch {
    return undefined;
  }
}

function claudeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase();
  if (["true", "yes", "on", "1"].includes(normalized)) return true;
  if (["false", "no", "off", "0"].includes(normalized)) return false;
  return undefined;
}

function parseNativeMetadata(skill: string | null | undefined, metadata: string | null | undefined): NativeMetadata {
  const match = typeof skill === "string" ? /^---\r?\n((?:[^\n]*\n)*?)---(?:\r?\n|$)/.exec(skill) : null;
  const hasUnclosedFrontmatter = typeof skill === "string" && /^---\r?\n/.test(skill) && !match;
  const frontmatter = typeof skill === "string" && !hasUnclosedFrontmatter ? yamlMapping(match?.[1] ?? "{}") : undefined;
  const description = frontmatter?.get("description");
  const disableModel = frontmatter?.has("disable-model-invocation")
    ? claudeBoolean(frontmatter.get("disable-model-invocation"))
    : false;
  const claude = !frontmatter || disableModel === undefined ? "Unknown" : disableModel ? "Manual only" : "Automatic allowed";

  const agent = metadata === undefined ? undefined : yamlMapping(metadata ?? "{}");
  const policy = agent?.get("policy", true);
  const hasValidPolicy = policy === undefined || isMap(policy);
  const allowsImplicit = agent?.hasIn(["policy", "allow_implicit_invocation"])
    ? agent.getIn(["policy", "allow_implicit_invocation"])
    : true;
  const codex = !agent || !hasValidPolicy || typeof allowsImplicit !== "boolean" ? "Unknown" : allowsImplicit ? "Automatic allowed" : "Manual only";

  return { description: typeof description === "string" ? description.trim() : "", invocation: { claude, codex } };
}

export async function readNativeMetadata(path: string): Promise<NativeMetadata> {
  const [skill, metadata] = await Promise.all([
    readMetadataFile(join(path, "SKILL.md")),
    readMetadataFile(join(path, "agents/openai.yaml")),
  ]);
  return parseNativeMetadata(skill, metadata);
}

export async function readOriginalInvocation(path: string, current: SkillInvocation): Promise<SkillInvocation> {
  const text = await readMetadataFile(join(path, ".afk-invocation-original.json"));
  if (text === null) return current;
  if (text === undefined) return unknownInvocation();
  try {
    const backup: unknown = JSON.parse(text);
    if (!backup || typeof backup !== "object" || !("skill" in backup) || !("metadata" in backup)) return unknownInvocation();
    if (typeof backup.skill !== "string" || (backup.metadata !== null && typeof backup.metadata !== "string")) return unknownInvocation();
    return parseNativeMetadata(backup.skill, backup.metadata).invocation;
  } catch {
    return unknownInvocation();
  }
}
