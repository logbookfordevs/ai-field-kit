import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { sectionTitle } from "./brand.js";
import { loadCustomAgentManifest, type CustomAgentManifestItem } from "./manifest.js";
import type { AgentId, CliOptions, Runtime } from "./types.js";

export type CustomAgentHarness = Extract<AgentId, "codex" | "claude" | "pi">;
export type PortableAgentAccess = "read-only" | "workspace-write";
export type PortableAgentCapability = "read" | "search" | "shell" | "write" | "web" | "subagents";

export type PortableAgent = {
  name: string;
  description: string;
  instructions: string;
  models: Partial<Record<CustomAgentHarness, string>>;
  effort: Partial<Record<CustomAgentHarness, string>>;
  nicknames: string[];
  access?: PortableAgentAccess;
  capabilities: {
    required: string[];
    optional: string[];
  };
};

type ProvisioningTarget = {
  harness: CustomAgentHarness;
  path: string;
  content: string;
  omittedCapabilities: string[];
  omittedMetadata: string[];
};

const customAgentHarnesses: CustomAgentHarness[] = ["codex", "claude", "pi"];
const supportedCapabilities: Record<CustomAgentHarness, Set<PortableAgentCapability>> = {
  codex: new Set(["read", "search", "shell", "write", "web", "subagents"]),
  claude: new Set(["read", "search", "shell", "write", "web", "subagents"]),
  pi: new Set(["read", "search", "shell", "write", "subagents"]),
};

export async function syncCustomAgents(runtime: Runtime, options: CliOptions): Promise<number> {
  const manifest = loadCustomAgentManifest(options);
  let selectedItems: CustomAgentManifestItem[];
  try {
    selectedItems = selectedCatalogItems(manifest.items, options.selectedCustomAgentIds ?? [], options.allCustomAgents ?? false);
  } catch (error) {
    runtime.io.stderr(errorMessage(error));
    return 1;
  }
  if (selectedItems.length === 0) {
    runtime.io.stdout("\nNo Custom Agents selected. No changes planned.");
    return 0;
  }

  const harnesses = uniqueHarnesses(options.agents);
  if (harnesses.length === 0) {
    runtime.io.stdout("\nNo supported Custom Agent harnesses selected. Use --agent codex, --agent claude, or --agent pi.");
    return 1;
  }

  const availableHarnesses = harnesses.filter((harness) => {
    if (harness !== "pi" || piSubagentsInstalled(options.homeDir)) {
      return true;
    }

    runtime.io.stdout("\nPi Custom Agents require the pi-subagents extension.");
    runtime.io.stdout("- Suggested command: pi install npm:pi-subagents");
    runtime.io.stdout("- AFK skipped Pi. Run afk setup agents again after installing the extension.");
    return false;
  });

  let failed = false;
  const targets: ProvisioningTarget[] = [];
  for (const item of selectedItems) {
    let portable: PortableAgent;
    try {
      portable = parsePortableAgentFile(await loadPortableAgentSource(item.source, options.cwd));
      if (portable.name !== item.id) {
        throw new Error(`catalog id ${item.id} does not match Portable Agent name ${portable.name}`);
      }
    } catch (error) {
      failed = true;
      runtime.io.stderr(`Could not load Custom Agent ${item.id}: ${errorMessage(error)}`);
      continue;
    }

    for (const harness of availableHarnesses) {
      const result = provisioningTarget(portable, harness, options);
      if (result.kind === "blocked") {
        failed = true;
        const reasons = [
          ...(result.missingCapabilities.length > 0 ? [`missing required capabilities: ${result.missingCapabilities.join(", ")}`] : []),
        ];
        runtime.io.stderr(`Skipped ${portable.name} for ${harness}: ${reasons.join("; ")}.`);
        continue;
      }
      targets.push(result.target);
    }
  }

  if (targets.length > 0) {
    runtime.io.stdout(`\n${sectionTitle("Custom Agents")}`);
  }
  for (const target of targets) {
    const action = options.dryRun ? "Would write" : "Wrote";
    if (!options.dryRun) {
      mkdirSync(dirname(target.path), { recursive: true });
      writeFileSync(target.path, target.content);
    }
    runtime.io.stdout(`- ${action} ${target.harness}: ${target.path}`);
    if (target.omittedCapabilities.length > 0) {
      runtime.io.stdout(`  Optional capabilities omitted: ${target.omittedCapabilities.join(", ")}`);
    }
    if (target.omittedMetadata.length > 0) {
      runtime.io.stdout(`  Unsupported metadata omitted: ${target.omittedMetadata.join(", ")}`);
    }
  }

  return failed ? 1 : 0;
}

export function parsePortableAgentFile(content: string): PortableAgent {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("expected YAML frontmatter followed by a Markdown instruction body");
  }

  const frontmatter: unknown = parseYaml(match[1] ?? "");
  if (!isRecord(frontmatter)) {
    throw new Error("frontmatter must be a YAML object");
  }

  const name = requiredString(frontmatter, "name");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) {
    throw new Error("name must use lowercase letters, numbers, hyphens, or underscores");
  }
  const description = requiredString(frontmatter, "description");
  const instructions = (match[2] ?? "").trim();
  if (!instructions) {
    throw new Error("instruction body cannot be empty");
  }

  const models = optionalHarnessStrings(frontmatter.models, "models");
  const effort = optionalHarnessStrings(frontmatter.effort, "effort");
  const nicknames = optionalNicknames(frontmatter.nicknames);
  const access = optionalAccess(frontmatter.access);
  const capabilities = optionalCapabilities(frontmatter.capabilities);
  if (access === "read-only" && capabilities.required.includes("write")) {
    throw new Error("read-only access cannot require the write capability");
  }

  return {
    name,
    description,
    instructions,
    models,
    effort,
    nicknames,
    ...(access ? { access } : {}),
    capabilities,
  };
}

export function renderCodexAgent(agent: PortableAgent): string {
  const lines = [
    `name = ${tomlString(agent.name)}`,
    `description = ${tomlString(agent.description)}`,
  ];
  if (agent.models.codex) {
    lines.push(`model = ${tomlString(agent.models.codex)}`);
  }
  if (agent.effort.codex) {
    lines.push(`model_reasoning_effort = ${tomlString(agent.effort.codex)}`);
  }
  if (agent.access) {
    lines.push(`sandbox_mode = ${tomlString(agent.access)}`);
  }
  lines.push(`developer_instructions = ${tomlString(agent.instructions)}`);
  if (agent.nicknames.length > 0) {
    lines.push(`nickname_candidates = [${agent.nicknames.map(tomlString).join(", ")}]`);
  }
  return `${lines.join("\n")}\n`;
}

export function renderClaudeAgent(agent: PortableAgent, capabilities: string[]): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name.replaceAll("_", "-"),
    description: agent.description,
  };
  if (agent.models.claude) {
    frontmatter.model = agent.models.claude;
  }
  if (agent.effort.claude) {
    frontmatter.effort = agent.effort.claude;
  }
  const tools = claudeTools(capabilities);
  if (tools.length > 0) {
    frontmatter.tools = tools.join(", ");
  }
  if (agent.access === "read-only") {
    frontmatter.disallowedTools = "Write, Edit";
    frontmatter.permissionMode = "plan";
  }
  return markdownAgent(frontmatter, agent.instructions);
}

export function renderPiAgent(agent: PortableAgent, capabilities: string[]): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  };
  if (agent.models.pi) {
    frontmatter.model = agent.models.pi;
  }
  if (agent.effort.pi) {
    frontmatter.thinking = agent.effort.pi;
  }
  const tools = piTools(capabilities, agent.access);
  if (tools.length > 0) {
    frontmatter.tools = tools.join(", ");
  }
  return markdownAgent(frontmatter, agent.instructions);
}

function selectedCatalogItems(items: CustomAgentManifestItem[], selectedIds: string[], all: boolean): CustomAgentManifestItem[] {
  if (all) {
    return items;
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  return selectedIds.map((id) => {
    const item = byId.get(id);
    if (!item) {
      throw new Error(`Unknown Custom Agent id: ${id}`);
    }
    return item;
  });
}

function uniqueHarnesses(agents: AgentId[]): CustomAgentHarness[] {
  return [...new Set(agents.filter((agent): agent is CustomAgentHarness => customAgentHarnesses.includes(agent as CustomAgentHarness)))];
}

function provisioningTarget(
  agent: PortableAgent,
  harness: CustomAgentHarness,
  options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">,
): { kind: "ready"; target: ProvisioningTarget } | { kind: "blocked"; missingCapabilities: string[] } {
  const declared = [...agent.capabilities.required, ...agent.capabilities.optional];
  const supported = supportedCapabilities[harness];
  const isAvailable = (capability: string) => supported.has(capability as PortableAgentCapability) &&
    !(harness === "pi" && agent.access === "read-only" && (capability === "shell" || capability === "write"));
  const missingRequired = agent.capabilities.required.filter((capability) => !isAvailable(capability));
  if (missingRequired.length > 0) {
    return { kind: "blocked", missingCapabilities: missingRequired };
  }

  const effectiveCapabilities = declared.filter(isAvailable);
  const omittedCapabilities = agent.capabilities.optional.filter((capability) => !isAvailable(capability));
  const omittedMetadata = harness === "codex" || agent.nicknames.length === 0 ? [] : ["nicknames"];
  const path = customAgentTargetPath(agent.name, harness, options);
  const content = harness === "codex"
    ? renderCodexAgent(agent)
    : harness === "claude"
      ? renderClaudeAgent(agent, effectiveCapabilities)
      : renderPiAgent(agent, effectiveCapabilities);
  return { kind: "ready", target: { harness, path, content, omittedCapabilities, omittedMetadata } };
}

function customAgentTargetPath(
  name: string,
  harness: CustomAgentHarness,
  options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope">,
): string {
  if (options.setupScope === "project") {
    if (harness === "codex") {
      return join(options.cwd, ".codex", "agents", `${name}.toml`);
    }
    if (harness === "claude") {
      return join(options.cwd, ".claude", "agents", `${name.replaceAll("_", "-")}.md`);
    }
    return join(options.cwd, ".pi", "agents", `${name}.md`);
  }

  if (harness === "codex") {
    const codexHome = process.env.CODEX_HOME || join(options.homeDir, ".codex");
    return join(codexHome, "agents", `${name}.toml`);
  }
  if (harness === "claude") {
    return join(options.homeDir, ".claude", "agents", `${name.replaceAll("_", "-")}.md`);
  }
  return join(piAgentDir(options.homeDir), "agents", `${name}.md`);
}

async function loadPortableAgentSource(source: string, cwd: string): Promise<string> {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`source returned HTTP ${response.status}`);
    }
    return response.text();
  }

  const path = isAbsolute(source) ? source : resolve(cwd, source);
  if (!existsSync(path)) {
    throw new Error(`source file does not exist: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function piSubagentsInstalled(homeDir: string): boolean {
  const root = piAgentDir(homeDir);
  if (existsSync(join(root, "extensions", "subagent", "package.json"))) {
    return true;
  }

  const settingsPath = join(root, "settings.json");
  if (!existsSync(settingsPath)) {
    return false;
  }
  try {
    const settings: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (!isRecord(settings) || !Array.isArray(settings.packages)) {
      return false;
    }
    return settings.packages.some((entry) => entry === "npm:pi-subagents" || (isRecord(entry) && entry.source === "npm:pi-subagents"));
  } catch {
    return false;
  }
}

function piAgentDir(homeDir: string): string {
  return process.env.PI_CODING_AGENT_DIR || join(homeDir, ".pi", "agent");
}

function optionalHarnessStrings(value: unknown, field: string): Partial<Record<CustomAgentHarness, string>> {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error(`${field} must be an object keyed by codex, claude, or pi`);
  }

  const result: Partial<Record<CustomAgentHarness, string>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!customAgentHarnesses.includes(key as CustomAgentHarness) || typeof entry !== "string" || !entry.trim()) {
      throw new Error(`${field}.${key} must be a non-empty value for a supported harness`);
    }
    result[key as CustomAgentHarness] = entry.trim();
  }
  return result;
}

function optionalAccess(value: unknown): PortableAgentAccess | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "read-only" && value !== "workspace-write") {
    throw new Error("access must be read-only or workspace-write");
  }
  return value;
}

function optionalCapabilities(value: unknown): PortableAgent["capabilities"] {
  if (value === undefined) {
    return { required: [], optional: [] };
  }
  if (!isRecord(value)) {
    throw new Error("capabilities must contain required and optional string lists");
  }
  return {
    required: optionalStringArray(value.required, "capabilities.required"),
    optional: optionalStringArray(value.optional, "capabilities.optional"),
  };
}

function optionalNicknames(value: unknown): string[] {
  const nicknames = optionalStringArray(value, "nicknames");
  for (const nickname of nicknames) {
    if (!/^[A-Za-z0-9 _-]+$/.test(nickname)) {
      throw new Error(`nickname must use ASCII letters, numbers, spaces, hyphens, or underscores: ${nickname}`);
    }
  }
  return nicknames;
}

function optionalStringArray(value: unknown, field: string): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error(`${field} must be a list of non-empty strings`);
  }
  return [...new Set(value.map((entry) => (entry as string).trim()))];
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function claudeTools(capabilities: string[]): string[] {
  const tools = new Set<string>();
  for (const capability of capabilities) {
    if (capability === "read") tools.add("Read");
    if (capability === "search") { tools.add("Glob"); tools.add("Grep"); }
    if (capability === "shell") tools.add("Bash");
    if (capability === "write") { tools.add("Edit"); tools.add("Write"); }
    if (capability === "web") { tools.add("WebFetch"); tools.add("WebSearch"); }
    if (capability === "subagents") tools.add("Agent");
  }
  return [...tools];
}

function piTools(capabilities: string[], access: PortableAgentAccess | undefined): string[] {
  const tools = new Set<string>(access === "read-only" ? ["read", "grep", "find", "ls"] : []);
  for (const capability of capabilities) {
    if (capability === "read") tools.add("read");
    if (capability === "search") { tools.add("grep"); tools.add("find"); tools.add("ls"); }
    if (capability === "shell" && access !== "read-only") tools.add("bash");
    if (capability === "write" && access !== "read-only") { tools.add("edit"); tools.add("write"); }
    if (capability === "subagents") tools.add("subagent");
  }
  return [...tools];
}

function markdownAgent(frontmatter: Record<string, unknown>, instructions: string): string {
  return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n\n${instructions.trim()}\n`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
