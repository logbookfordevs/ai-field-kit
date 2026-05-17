import { basename, dirname, join } from "node:path";
import { readdirSync } from "node:fs";
import { applyOperation, formatOperation, isDirectory, isSymlink, managedMarker, pathExists, readText, summarizeOperations } from "./fs-utils.js";
import { filterAgents } from "./agents.js";
import type { AgentId, CliOptions, PathOperation, Runtime } from "./types.js";

const namespace = "afk";
const supportedWorkflowAgents: AgentId[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
];

export async function syncWorkflows(runtime: Runtime, options: CliOptions): Promise<number> {
  const operations = planWorkflowSync(options);

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

export function planWorkflowSync(options: Pick<CliOptions, "agents" | "homeDir" | "repoDir" | "cwd" | "setupScope">): PathOperation[] {
  const sourceDir = join(options.repoDir, "workflows");
  const workflowFiles = listWorkflowFiles(sourceDir);
  const operations: PathOperation[] = [];

  if (workflowFiles.length === 0) {
    operations.push({ type: "skip", path: sourceDir, reason: "no workflow markdown files found" });
    return operations;
  }

  const rootDir = options.setupScope === "global" ? options.homeDir : options.cwd;
  const canonicalRoot = join(rootDir, ".agents", "commands");
  operations.push(...clearLegacyRoot(canonicalRoot));
  operations.push(...syncSymlinkedMarkdownDir(join(canonicalRoot, namespace), workflowFiles));

  const selectedAgents = filterAgents(options.agents, supportedWorkflowAgents);
  for (const agent of selectedAgents) {
    operations.push(...planAgentWorkflowSync(options, agent, workflowFiles));
  }

  return operations;
}

function planAgentWorkflowSync(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">, agent: AgentId, workflowFiles: string[]): PathOperation[] {
  const rootDir = options.setupScope === "global" ? options.homeDir : options.cwd;

  switch (agent) {
    case "opencode":
      return syncSymlinkedMarkdownDir(options.setupScope === "global"
        ? join(options.homeDir, ".config", "opencode", "commands", namespace)
        : join(options.cwd, ".opencode", "commands", namespace), workflowFiles);
    case "claude":
      return syncSymlinkedMarkdownDir(join(rootDir, ".claude", "commands", namespace), workflowFiles);
    case "codex":
      return syncCodexSkills(options.setupScope === "global"
        ? join(options.homeDir, ".codex", "skills", namespace)
        : join(options.cwd, ".agents", "skills", namespace), workflowFiles);
    case "gemini":
      return syncGeminiCommands(join(rootDir, ".gemini", "commands", namespace), workflowFiles);
  }
}

function listWorkflowFiles(sourceDir: string): string[] {
  if (!isDirectory(sourceDir)) {
    return [];
  }

  return readdirSync(sourceDir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => join(sourceDir, file));
}

function syncSymlinkedMarkdownDir(destination: string, workflowFiles: string[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const target = join(destination, basename(source));
    if (pathExists(target) && !isSymlink(target)) {
      operations.push({ type: "skip", path: target, reason: "existing unmanaged file" });
      continue;
    }

    if (pathExists(target) || isSymlink(target)) {
      operations.push({ type: "remove", path: target });
    }

    operations.push({ type: "symlink", source, target });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => basename(file)).join("\n") + "\n" });
  return operations;
}

function syncCodexSkills(destination: string, workflowFiles: string[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const stem = basename(source, ".md");
    const title = toTitleCase(stem.replace(/^afk-/, ""));
    const skillDir = join(destination, stem);
    const description = extractDescription(readText(source)) || `Workflow skill generated from /${stem}.`;
    const skillMd = `---\nname: ${stem}\ndescription: ${description}\n---\n\n# AFK ${title}\n\nThis skill is generated from the AI Field Kit workflow \`/${stem}\`.\n\nUse it when the user wants this exact named operating procedure executed with the same checkpoints, guardrails, and output expectations defined below.\n\n${readText(source)}`;
    const openaiYaml = `display_name: AFK ${title}\nshort_description: ${description}\ndefault_prompt: Follow the AI Field Kit /${stem} workflow for this project.\n`;

    operations.push({ type: "mkdir", path: join(skillDir, "agents") });
    operations.push({ type: "write", path: join(skillDir, "SKILL.md"), content: skillMd });
    operations.push({ type: "write", path: join(skillDir, "agents", "openai.yaml"), content: openaiYaml });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => basename(file, ".md")).join("\n") + "\n" });
  return operations;
}

function syncGeminiCommands(destination: string, workflowFiles: string[]): PathOperation[] {
  const operations = clearManagedFiles(destination);
  operations.push({ type: "mkdir", path: destination });

  for (const source of workflowFiles) {
    const stem = basename(source, ".md");
    const description = extractDescription(readText(source)) || stem;
    const content = `description = "${escapeDoubleQuotes(description)}"\nprompt = """\n${escapeTomlMultiline(readText(source))}\n"""\n`;
    operations.push({ type: "write", path: join(destination, `${stem}.toml`), content });
  }

  operations.push({ type: "write", path: join(destination, managedMarker), content: workflowFiles.map((file) => `${basename(file, ".md")}.toml`).join("\n") + "\n" });
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
