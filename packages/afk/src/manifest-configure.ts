import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { checkbox, confirm, input } from "@inquirer/prompts";
import {
  isHookManifest,
  loadDefaultManifestContent,
  localManifestDir,
  type HookManifest,
  type McpManifest,
  type RulesManifest,
  type SkillManifest,
  type UtilityManifest,
} from "./manifest.js";
import { DEFAULT_CHECKED, afkCheckboxTheme, afkPromptTheme, defaultCheckedDetail, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import type { Area, CliOptions, Runtime } from "./types.js";

type ManifestArea = Area;

type ManifestDrafts = Partial<Record<`${ManifestArea}.json`, string>>;

type ExistingManifest = {
  skills?: SkillManifest;
  mcps?: McpManifest;
  rules?: RulesManifest;
  utils?: UtilityManifest;
  hooks?: HookManifest;
};

const manifestAreaChoices: Array<{ name: string; value: ManifestArea; checked: boolean; description: string }> = [
  { name: "Rules", value: "rules", checked: DEFAULT_CHECKED, description: "Point rules sync at one AGENTS.md source." },
  { name: "Skills", value: "skills", checked: DEFAULT_CHECKED, description: "List skills delegated to the skills CLI." },
  { name: "MCPs", value: "mcps", checked: DEFAULT_CHECKED, description: "List MCPs delegated to add-mcp." },
  { name: "Utils", value: "utils", checked: DEFAULT_CHECKED, description: "List utility install scripts." },
  { name: "Hooks", value: "hooks", checked: DEFAULT_CHECKED, description: "List lifecycle hooks AFK can merge into agent configs." },
];

export async function runManifestConfigure(runtime: Runtime, options: CliOptions): Promise<number> {
  const outputDir = options.manifestConfigureLocal ? join(options.cwd, "afk", "manifests") : localManifestDir(options.homeDir);
  const existing = options.manifestConfigureFromCurrent ? readExistingManifests(outputDir) : {};

  resetPromptSteps();
  runtime.io.stdout("\nAFK manifests configure");
  runtime.io.stdout(`Writing to: ${outputDir}`);
  runtime.io.stdout(renderPromptStep("Manifest files", defaultCheckedDetail));

  const areas = await checkbox<ManifestArea>({
    message: "Choose manifests to configure",
    choices: manifestAreaChoices,
    required: false,
    pageSize: 8,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkCheckboxTheme,
  });

  if (areas.length === 0) {
    runtime.io.stdout("\nNothing selected. No manifests changed.");
    return 0;
  }

  const drafts: ManifestDrafts = {};
  for (const area of areas) {
    runtime.io.stdout(renderPromptStep(areaTitle(area), areaDescription(area)));
    drafts[`${area}.json`] = await configureArea(area, existing, options);
  }

  runtime.io.stdout("\nManifest preview");
  for (const [filename, content] of Object.entries(drafts)) {
    runtime.io.stdout(`\n--- ${filename} ---\n${content.trimEnd()}`);
  }

  if (options.dryRun) {
    runtime.io.stdout("\nDry run complete. No manifests written.");
    return 0;
  }

  runtime.io.stdout(renderPromptStep("Write manifests", "Review the preview above, then confirm whether AFK should write the files."));
  const shouldWrite = await askConfirm(`Write ${areas.length} manifest file(s)?`, true);
  if (!shouldWrite) {
    runtime.io.stdout("\nCancelled. No manifests written.");
    return 0;
  }

  mkdirSync(outputDir, { recursive: true });
  for (const [filename, content] of Object.entries(drafts)) {
    writeFileSync(join(outputDir, filename), content);
  }

  runtime.io.stdout(`\nWrote ${areas.length} manifest file(s) to ${outputDir}.`);
  return 0;
}

async function configureArea(area: ManifestArea, existing: ExistingManifest, options: CliOptions): Promise<string> {
  switch (area) {
    case "rules":
      return configureRules(existing.rules);
    case "skills":
      return configureSkills(existing.skills);
    case "mcps":
      return configureMcps(existing.mcps);
    case "utils":
      return configureUtils(existing.utils);
    case "hooks":
      return configureHooks(existing.hooks, options);
  }
}

async function configureRules(existing?: RulesManifest): Promise<string> {
  const url = await askInput({
    message: "Rules raw URL or local path",
    default: existing?.url || "",
    required: true,
  });

  return json({
    version: 1,
    source: inferSource(url),
    url,
  });
}

async function configureSkills(existing?: SkillManifest): Promise<string> {
  const items = [...(existing?.items ?? [])];
  let defaultSource = existing?.defaultSource ?? "";

  while (true) {
    const source = await askInput({ message: "Skill source repo URL (blank to finish)" });
    if (!source.trim()) {
      break;
    }

    defaultSource ||= source;
    const skill = await askInput({ message: "Specific skill id/name (optional; blank installs the whole source)" });
    const idSeed = skill.trim() ? skill : source;

    const id = uniqueId(inferId(idSeed), items.map((item) => item.id));
    const label = await askInput({ message: "Skill label", default: inferLabel(id) });
    const isDefault = await askConfirm("Selected by default?", true);
    const autoInvocation = await askConfirm("Allow automatic model invocation?", true);
    items.push({
      id,
      label,
      source,
      args: skill.trim() ? ["--skill", skill.trim()] : [],
      default: isDefault,
      autoInvocation,
    });
  }

  return json({
    version: 1,
    defaultSource,
    items,
  });
}

async function configureMcps(existing?: McpManifest): Promise<string> {
  const items = [...(existing?.items ?? [])];

  while (true) {
    const source = await askInput({ message: "MCP source or command (blank to finish)" });
    if (!source.trim()) {
      break;
    }

    const id = uniqueId(inferId(source), items.map((item) => item.id));
    const label = await askInput({ message: "MCP label", default: inferLabel(id) });
    const name = await askInput({ message: "add-mcp --name value", default: id });
    const extraArgs = await askInput({ message: "Extra add-mcp args (optional)" });
    const isDefault = await askConfirm("Selected by default?", true);
    items.push({
      id,
      label,
      source,
      args: [...(name ? ["--name", name] : []), ...splitArgs(extraArgs)],
      default: isDefault,
    });
  }

  return json({ version: 1, items });
}

async function configureUtils(existing?: UtilityManifest): Promise<string> {
  const items = [...(existing?.items ?? [])];

  while (true) {
    const installLine = await askInput({ message: "Utility install command (blank to finish)" });
    if (!installLine.trim()) {
      break;
    }

    const id = uniqueId(inferId(installLine), items.map((item) => item.id));
    const label = await askInput({ message: "Utility label", default: inferLabel(id) });
    const description = await askInput({ message: "Utility description", default: `${label} install script.` });
    const postInstallLine = await askInput({ message: "Post-install command (optional)" });
    const isDefault = await askConfirm("Selected by default?", true);
    items.push({
      id,
      label,
      description,
      install: { command: "sh", args: ["-c", installLine] },
      ...(postInstallLine.trim()
        ? { postInstall: { command: "sh", args: ["-c", postInstallLine.trim()] } }
        : {}),
      default: isDefault,
    });
  }

  return json({ version: 1, items });
}

async function configureHooks(existing: HookManifest | undefined, options: CliOptions): Promise<string> {
  const items = [...(existing?.items ?? [])];
  const shouldAddDefault = items.length === 0
    ? await askConfirm("Add default AFK hooks?", true)
    : false;

  if (shouldAddDefault) {
    const defaultHooks = await loadDefaultHooks(options);
    items.push(...defaultHooks.items);
  }

  return json({ version: 1, items });
}

async function loadDefaultHooks(options: CliOptions): Promise<HookManifest> {
  const content = await loadDefaultManifestContent("hooks.json", options);
  if (!content) {
    throw new Error("Could not load default hooks manifest from the configured defaults source.");
  }

  const parsed: unknown = JSON.parse(content);
  if (!isHookManifest(parsed)) {
    throw new Error("Default hooks manifest from the configured defaults source is invalid.");
  }

  return parsed;
}

type InputConfig = {
  message: string;
  default?: string;
  required?: boolean;
};

async function askInput(config: InputConfig): Promise<string> {
  return input({
    ...config,
    theme: afkPromptTheme,
  });
}

async function askConfirm(message: string, defaultValue: boolean): Promise<boolean> {
  return confirm({
    message,
    default: defaultValue,
    theme: afkPromptTheme,
  });
}

function areaTitle(area: ManifestArea): string {
  switch (area) {
    case "rules":
      return "Rules manifest";
    case "skills":
      return "Skills manifest";
    case "mcps":
      return "MCP manifest";
    case "utils":
      return "Utils manifest";
    case "hooks":
      return "Hooks manifest";
  }
}

function areaDescription(area: ManifestArea): string {
  switch (area) {
    case "rules":
      return "Point rules sync at a raw AGENTS.md source.";
    case "skills":
      return "List skills delegated to the official skills CLI.";
    case "mcps":
      return "List MCPs delegated to add-mcp.";
    case "utils":
      return "List utility install scripts and optional post-install commands.";
    case "hooks":
      return "List lifecycle hooks AFK can merge into agent hook configs.";
  }
}

export function inferId(value: string): string {
  const candidate = filenameStem(value) || value;
  const withoutGit = candidate.replace(/\.git$/i, "");
  const normalized = withoutGit
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "item";
}

export function inferLabel(value: string): string {
  const titled = value
    .replace(/\.(md|json|toml|yaml|yml)$/i, "")
    .replace(/^afk-/, "AFK / ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

  return titled.replace(/\b(Api|Mcp|Url|Afk|Cli|Rtk|Pr)\b/g, (match) => match.toUpperCase());
}

function filenameStem(value: string): string {
  try {
    const parsed = new URL(value);
    const last = basename(parsed.pathname);
    return last.replace(/\.[^.]+$/, "");
  } catch {
    const last = basename(value.trim());
    return last.replace(/\.[^.]+$/, "");
  }
}

function inferSource(value: string): "github" | "local" {
  return /^https:\/\/(raw\.githubusercontent\.com|github\.com)\//.test(value) ? "github" : "local";
}

function uniqueId(id: string, existingIds: string[]): string {
  if (!existingIds.includes(id)) {
    return id;
  }

  let index = 2;
  while (existingIds.includes(`${id}-${index}`)) {
    index += 1;
  }

  return `${id}-${index}`;
}

function splitArgs(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function readExistingManifests(outputDir: string): ExistingManifest {
  const existing: ExistingManifest = {};
  const skills = readJsonIfExists<SkillManifest>(join(outputDir, "skills.json"));
  const mcps = readJsonIfExists<McpManifest>(join(outputDir, "mcps.json"));
  const rules = readJsonIfExists<RulesManifest>(join(outputDir, "rules.json"));
  const utils = readJsonIfExists<UtilityManifest>(join(outputDir, "utils.json"));
  const hooks = readJsonIfExists<HookManifest>(join(outputDir, "hooks.json"));

  if (skills) {
    existing.skills = skills;
  }
  if (mcps) {
    existing.mcps = mcps;
  }
  if (rules) {
    existing.rules = rules;
  }
  if (utils) {
    existing.utils = utils;
  }
  if (hooks) {
    existing.hooks = hooks;
  }

  return existing;
}

function readJsonIfExists<T>(path: string): T | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
