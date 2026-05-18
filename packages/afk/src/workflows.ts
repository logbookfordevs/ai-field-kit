import { basename, join } from "node:path";
import { applyOperation, formatOperation, isSymlink, managedMarker, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { filterAgents } from "./agents.js";
import { loadWorkflowManifest } from "./manifest.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

const namespace = "afk";
const supportedWorkflowAgents: AgentId[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
];

export async function syncWorkflows(runtime: Runtime, options: CliOptions): Promise<number> {
  const workflowFiles = await loadWorkflowFiles(options);
  const operations = planWorkflowSync(options, workflowFiles);

  if (options.dryRun) {
    runtime.io.stdout("\nWorkflow sync plan");
    for (const operation of operations) {
      runtime.io.stdout(`- ${formatOperation(operation)}`);
    }
    return 0;
  }

  for (const operation of operations) {
    applyOperation(operation);
  }

  runtime.io.stdout(`\nWorkflows synced: ${summarizeOperations(operations)}.`);
  return 0;
}

export type WorkflowFile = {
  filename: string;
  content: string;
};

export function planWorkflowSync(options: Pick<CliOptions, "agents" | "homeDir" | "cwd" | "setupScope">, workflowFiles: WorkflowFile[]): PathOperation[] {
  const operations: PathOperation[] = [];

  if (workflowFiles.length === 0) {
    operations.push({ type: "skip", path: "workflows.json", reason: "no default workflow items found" });
    return operations;
  }

  const rootDir = options.setupScope === "global" ? options.homeDir : options.cwd;
  const canonicalRoot = join(rootDir, ".agents", "commands");
  operations.push(...clearLegacyRoot(canonicalRoot));
  operations.push(...syncCopiedMarkdownDir(join(canonicalRoot, namespace), workflowFiles));

  const selectedAgents = filterAgents(options.agents, supportedWorkflowAgents);
  for (const agent of selectedAgents) {
    operations.push(...planAgentWorkflowSync(options, agent, workflowFiles));
  }

  return operations;
}

async function loadWorkflowFiles(options: Pick<CliOptions, "homeDir" | "repoDir" | "rulesSource">): Promise<WorkflowFile[]> {
  const manifest = loadWorkflowManifest(options);
  const source = options.rulesSource === "manifest" ? manifest.source : options.rulesSource;
  const selected = manifest.items.filter((item) => item.default);

  return Promise.all(selected.map(async (item) => ({
    filename: `${item.id}.md`,
    content: source === "local"
      ? await readLocalWorkflow(options.repoDir, localWorkflowPath(item.url))
      : await fetchWorkflow(item.url),
  })));
}

async function readLocalWorkflow(repoDir: string, file: string): Promise<string> {
  return readText(join(repoDir, file));
}

async function fetchWorkflow(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function localWorkflowPath(url: string): string {
  try {
    const parsed = new URL(url);
    const rawGithubMatch = parsed.hostname === "raw.githubusercontent.com" ? parsed.pathname.match(/^\/[^/]+\/[^/]+\/[^/]+\/(.+)$/) : null;
    if (rawGithubMatch?.[1]) {
      return rawGithubMatch[1];
    }
  } catch {
    return url;
  }

  return url.replace(/^\/+/, "");
}

function planAgentWorkflowSync(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, agent: AgentId, workflowFiles: WorkflowFile[]): PathOperation[] {
  const rootDir = options.setupScope === "global" ? options.homeDir : options.cwd;

  switch (agent) {
    case "opencode":
      return syncCopiedMarkdownDir(options.setupScope === "global"
        ? join(options.homeDir, ".config", "opencode", "commands", namespace)
        : join(options.cwd, ".opencode", "commands", namespace), workflowFiles);
    case "claude":
      return syncCopiedMarkdownDir(join(rootDir, ".claude", "commands", namespace), workflowFiles);
    case "codex":
      return syncCodexSkills(options.setupScope === "global"
        ? join(options.homeDir, ".codex", "skills", namespace)
        : join(options.cwd, ".agents", "skills", namespace), workflowFiles);
    case "gemini":
      return syncGeminiCommands(join(rootDir, ".gemini", "commands", namespace), workflowFiles);
  }
}

function syncCopiedMarkdownDir(destination: string, workflowFiles: WorkflowFile[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const target = join(destination, source.filename);
    if (pathExists(target) && !isSymlink(target)) {
      operations.push({ type: "skip", path: target, reason: "existing unmanaged file" });
      continue;
    }

    if (pathExists(target) || isSymlink(target)) {
      operations.push({ type: "remove", path: target });
    }

    operations.push({ type: "write", path: target, content: source.content });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => file.filename).join("\n") + "\n" });
  return operations;
}

function syncCodexSkills(destination: string, workflowFiles: WorkflowFile[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const stem = basename(source.filename, ".md");
    const title = toTitleCase(stem.replace(/^afk-/, ""));
    const skillDir = join(destination, stem);
    const description = extractDescription(source.content) || `Workflow skill generated from /${stem}.`;
    const skillMd = `---\nname: ${stem}\ndescription: ${description}\n---\n\n# AFK ${title}\n\nThis skill is generated from the AI Field Kit workflow \`/${stem}\`.\n\nUse it when the user wants this exact named operating procedure executed with the same checkpoints, guardrails, and output expectations defined below.\n\n${source.content}`;
    const openaiYaml = `display_name: AFK ${title}\nshort_description: ${description}\ndefault_prompt: Follow the AI Field Kit /${stem} workflow for this project.\n`;

    operations.push({ type: "mkdir", path: join(skillDir, "agents") });
    operations.push({ type: "write", path: join(skillDir, "SKILL.md"), content: skillMd });
    operations.push({ type: "write", path: join(skillDir, "agents", "openai.yaml"), content: openaiYaml });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => basename(file.filename, ".md")).join("\n") + "\n" });
  return operations;
}

function syncGeminiCommands(destination: string, workflowFiles: WorkflowFile[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const stem = basename(source.filename, ".md");
    const description = extractDescription(source.content) || stem;
    const content = `description = "${escapeDoubleQuotes(description)}"\nprompt = """\n${escapeTomlMultiline(source.content)}\n"""\n`;
    operations.push({ type: "write", path: join(destination, `${stem}.toml`), content });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => `${basename(file.filename, ".md")}.toml`).join("\n") + "\n" });
  return operations;
}

function clearManagedFiles(destination: string): PathOperation[] {
  const marker = join(destination, managedMarker);
  const operations: PathOperation[] = [];

  if (pathExists(marker)) {
    for (const entry of readText(marker).split("\n").filter(Boolean)) {
      operations.push({ type: "remove", path: join(destination, entry) });
    }
    operations.push({ type: "remove", path: marker });
  }

  if (isSymlink(destination)) {
    operations.push({ type: "remove", path: destination });
  }

  return operations;
}

function clearLegacyRoot(root: string): PathOperation[] {
  const marker = join(root, managedMarker);
  const operations: PathOperation[] = [];

  if (pathExists(marker)) {
    for (const entry of readText(marker).split("\n").filter(Boolean)) {
      operations.push({ type: "remove", path: join(root, entry) });
    }
    operations.push({ type: "remove", path: marker });
  }

  return operations;
}

export function extractDescription(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let seenHeading = false;
  let collecting = false;
  const parts: string[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      seenHeading = true;
      continue;
    }

    if (!seenHeading || line.startsWith("```")) {
      continue;
    }

    if (line.startsWith("## ")) {
      break;
    }

    if (!collecting && line.trim() === "") {
      continue;
    }

    if (line.trim() === "") {
      break;
    }

    collecting = true;
    parts.push(line.trim());
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function escapeDoubleQuotes(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeTomlMultiline(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
