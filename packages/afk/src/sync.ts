import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { basename, delimiter, join } from "node:path";
import { addMcpAgentNames } from "./agents.js";
import { detectSetupTargets } from "./agent-detection.js";
import { customAgentTargetPath, type CustomAgentHarness } from "./custom-agents.js";
import { buildToolCommands, buildToolUpdateCommands, runDelegateCommands } from "./delegates.js";
import { applyOperation } from "./fs-utils.js";
import { agentScriptPath } from "./hooks.js";
import { loadSkillProfileState, type SkillProfileCatalog } from "./skills/profiles.js";
import { loadSkillCatalog } from "./skills/catalog.js";
import { selectPresetId } from "./interactive.js";
import { ensureLocalManifests, expandComposedSkillIds, loadSkillManifest, isManifestValue, loadPresetsManifest, localManifestDir, type PresetManifestItem, type ToolManifestItem, type HookManifestItem } from "./manifest.js";
import { runArea } from "./setup.js";
import type { AgentId, Area, CliOptions, ManifestFilename, Runtime } from "./types.js";

const catalogNames: ManifestFilename[] = ["presets.json", "skills.json", "agents.json", "tools.json", "rules.json", "hooks.json", "mcps.json", "profiles.json"];
type CatalogItem = { id: string; default?: boolean; source?: string; args?: string[]; imported?: boolean; [key: string]: unknown };
type Catalog = { items?: CatalogItem[]; presets?: PresetManifestItem[]; [key: string]: unknown };
type Task = { label: string; run: () => Promise<number> };

export async function runSync(runtime: Runtime, options: CliOptions, path = process.env.PATH ?? ""): Promise<number> {
  if (options.manifestLocal || options.setupScope !== "global") {
    runtime.io.stderr("Preset sync currently supports the global environment. Remove --local or --scope project.");
    return 1;
  }
  if (options.yes && !options.presetId) {
    runtime.io.stderr("Unattended sync requires --preset <id>.");
    return 1;
  }
  if (options.empty || options.initOnly || options.allSkills || options.overrideRefresh) {
    runtime.io.stderr("Sync uses preset membership. --empty, --init-only, --all, and --override are not supported.");
    return 1;
  }
  const contents: Partial<Record<ManifestFilename, string>> = {};
  for (const name of catalogNames) {
    const file = join(localManifestDir(options.homeDir), name);
    if (existsSync(file)) contents[name] = readFileSync(file, "utf8");
  }
  const operations = await ensureLocalManifests({ ...options, refreshDefaults: true, overrideRefresh: false, selectedManifestCategories: [], rememberDefaultsSource: false });
  const preserved: string[] = [];
  for (const op of operations) {
    if (op.type !== "write") continue;
    const name = basename(op.path) as ManifestFilename;
    if (!catalogNames.includes(name)) continue;
    const incoming = JSON.parse(op.content) as Catalog;
    const previous = JSON.parse(contents[name] ?? "{}") as Catalog;
    const key = name === "presets.json" ? "presets" : "items";
    const oldItems = previous[key] ?? [];
    const newItems = incoming[key] ?? [];
    const missing = oldItems.filter((item) => !newItems.some((next) => next.id === item.id));
    if (missing.length) {
      if (name === "presets.json") incoming.presets = [...newItems, ...missing] as PresetManifestItem[];
      else incoming.items = [...newItems, ...missing] as CatalogItem[];
      preserved.push(...missing.map((item) => `${name}: ${item.id}`));
    }
    op.content = `${JSON.stringify(incoming, null, 2)}\n`;
    if (!isManifestValue(name, incoming)) throw new Error(`Invalid refreshed catalog: ${name}`);
    contents[name] = op.content;
  }
  for (const name of catalogNames) {
    if (contents[name] && !isManifestValue(name, JSON.parse(contents[name]))) throw new Error(`Invalid catalog: ${name}`);
  }
  const effective: CliOptions = { ...options, manifestContents: contents, setupManifestsPrepared: true, setupSourceExplicit: false, yes: true, allSkills: false, allCustomAgents: false };
  const presetId = options.presetId ?? await selectPresetId(effective);
  const preset = loadPresetsManifest(effective).presets.find((item) => item.id === presetId);
  if (!preset) {
    runtime.io.stderr(`Unknown preset: ${presetId}. No changes applied.`);
    return 1;
  }
  const profiles = JSON.parse(contents["profiles.json"] ?? '{"items":[]}') as SkillProfileCatalog;
  const enabledProfiles = loadSkillProfileState({ homeDir: options.homeDir, cwd: options.cwd, local: false }).activations.map((activation) => activation.profileId);
  const skillRecords = preset.areas.includes("skills") ? loadSkillCatalog({ homeDir: options.homeDir, cwd: options.cwd, scope: "global", agent: undefined }).records : [];
  const agents = options.agents.length ? options.agents : detectSetupTargets(options).agents;
  const tasks: Task[] = [];
  const failures: string[] = [];
  const skipped: string[] = [];
  const reportMissing = (label: string, installed: boolean): boolean => {
    if (installed || options.syncInstallMissing) return true;
    skipped.push(`${label}: not detected; use --install-missing to install`);
    return false;
  };
  const areaTask = (area: Area, item: CatalogItem, targets: AgentId[] = agents): void => {
    const targetSuffix = ["agents", "hooks", "mcps"].includes(area) ? ` (${targets.join(", ")})` : "";
    tasks.push({ label: `${area}: ${item.id}${targetSuffix}`, run: () => runArea(area, strictRuntime(runtime), {
      ...effective, agents: targets,
      selectedSkillIds: area === "skills" ? [item.id] : [],
      selectedCustomAgentIds: area === "agents" ? [item.id] : [],
      selectedMcpIds: area === "mcps" ? [item.id] : [],
      selectedHookIds: area === "hooks" ? [item.id] : [],
    }) });
  };
  for (const area of new Set(preset.areas)) {
    if (area === "profiles") {
      skipped.push("profiles: definitions refreshed; package installation remains deferred to profile enablement");
      continue;
    }
    if (area === "rules") {
      for (const agent of agents) {
        const file = rulesPath(options.homeDir, agent);
        if (!file) { skipped.push(`rules: ${agent}: global rules unsupported`); continue; }
        const managed = file && existsSync(file) && readFileSync(file, "utf8").includes("<!-- AFK:RULES:START -->");
        if (reportMissing(`rules: ${agent}`, Boolean(managed))) areaTask("rules", { id: agent }, [agent]);
      }
      if (!agents.length) failures.push("rules: no agent targets detected; supply --agent");
      continue;
    }
    if (!["skills", "tools", "agents", "mcps", "hooks"].includes(area)) {
      failures.push(`Unsupported preset area: ${area}`);
      continue;
    }
    const items = (JSON.parse(contents[`${area}.json` as ManifestFilename] ?? "{\"items\":[]}") as Catalog).items ?? [];
    const selectionKey = area === "agents" ? "customAgents" : area as "skills" | "tools" | "mcps" | "hooks";
    const ids = preset.selections?.[selectionKey];
    if (ids) failures.push(...ids.filter((id) => !items.some((item) => item.id === id)).map((id) => `${area}: unknown catalog entry ${id}`));
    let selectedIds = ids ?? items.filter((item) => preset.all || (area === "skills" ? item.default && !item.imported : area !== "agents")).map((item) => item.id);
    if (area === "skills") selectedIds = expandComposedSkillIds(loadSkillManifest(effective).items, selectedIds);
    const selected = items.filter((item) => selectedIds.includes(item.id));
    for (const item of selected) {
      if (area === "skills") {
        const records = skillRecords.filter((record) => record.folder === item.id || record.originalName === item.id || record.name === item.id);
        const active = records.some((record) => record.storage === "active");
        const disabled = records.some((record) => record.storage === "disabled");
        const skillArgIndex = item.args?.indexOf("--skill") ?? -1;
        const upstreamSkillId = skillArgIndex >= 0 ? item.args?.[skillArgIndex + 1] ?? item.id : item.id;
        const packageProfiles = profiles.items.filter((profile) => (profile.packages ?? []).some((pkg) => (
          pkg.source === item.source && (!pkg.skills || pkg.skills.includes(upstreamSkillId))
        )));
        if (item.imported && packageProfiles.length > 0 && !packageProfiles.some((profile) => enabledProfiles.includes(profile.id))) {
          skipped.push(`skills: ${item.id}: inactive package skill; left deferred`);
          continue;
        }
        if (!reportMissing(`skills: ${item.id}`, active || disabled)) continue;
        if (!item.args?.includes("--skill")) {
          failures.push(`skills: ${item.id}: whole-source entry cannot be updated selectively; declare --skill in its catalog args`);
          continue;
        }
        areaTask("skills", item);
      } else if (area === "tools") {
        const tool = item as unknown as ToolManifestItem;
        const command = tool.update?.command;
        const executable = tool.executable ?? (command && !["bash", "sh", "npm", "npx", "pnpm", "bun"].includes(command) ? command : tool.id);
        const installed = executableExists(executable, path);
        if (!reportMissing(`tools: ${tool.id}`, installed)) continue;
        if (installed && !tool.update) {
          skipped.push(`tools: ${tool.id}: no update command`);
          continue;
        }
        const commands = installed ? buildToolUpdateCommands(effective, [tool.id]) : buildToolCommands({ ...effective, selectedToolIds: [tool.id] });
        tasks.push({ label: `tools: ${tool.id}`, run: () => runDelegateCommands(strictRuntime(runtime), commands, effective) });
      } else {
        const targets = area === "agents" ? agents.filter((agent): agent is CustomAgentHarness => ["codex", "claude", "pi"].includes(agent)) : area === "hooks" ? agents.filter((agent) => (item as unknown as HookManifestItem).agents.includes(agent as HookManifestItem["agents"][number])) : agents.filter((agent) => Boolean(addMcpAgentNames[agent]));
        if (!targets.length) failures.push(`${area}: ${item.id}: no supported targets; supply --agent`);
        for (const agent of targets) {
          const installed = area === "agents" ? existsSync(customAgentTargetPath(item.id, agent as CustomAgentHarness, options))
            : area === "hooks" ? existsSync(agentScriptPath(agent as HookManifestItem["agents"][number], options, item as unknown as HookManifestItem))
              : mcpInstalled(options.homeDir, agent, item);
          if (reportMissing(`${area}: ${item.id} (${agent})`, installed)) areaTask(area as Area, item, [agent]);
        }
      }
    }
  }
  runtime.io.stdout(`\n${options.dryRun ? "Sync preview" : "Sync"}: ${presetId}`);
  runtime.io.stdout("Catalog refresh preserves local-only entries; sync never uninstalls removed entries.");
  for (const item of preserved) runtime.io.stdout(`Preserved: ${item}`);
  for (const item of skipped) runtime.io.stdout(`Skipped: ${item}`);
  if (failures.length) {
    for (const item of failures) runtime.io.stderr(item);
    runtime.io.stderr("Sync plan is incomplete. No changes applied.");
    return 1;
  }
  if (!options.dryRun) for (const op of operations) applyOperation(op);
  let completed = 0;
  for (const task of tasks) {
    runtime.io.stdout(`\n${options.dryRun ? "Would update" : "Updating"}: ${task.label}`);
    try {
      const code = await task.run();
      if (code !== 0) failures.push(`${task.label}: exit ${code}`);
      else completed += 1;
    } catch (error) {
      failures.push(`${task.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  runtime.io.stdout(`\nSync ${options.dryRun ? "preview" : "finished"}: ${completed} ${options.dryRun ? "planned" : "succeeded"}, ${skipped.length} skipped, ${failures.length} failed.`);
  for (const item of failures) runtime.io.stderr(item);
  return failures.length ? 1 : 0;
}

function strictRuntime(runtime: Runtime): Runtime {
  return { ...runtime, spawn: async (...args) => {
    const result = await runtime.spawn(...args);
    if (result.code !== 0) throw new Error(`${args[0]} exited with code ${result.code}`);
    return result;
  } };
}

function executableExists(command: string, path: string): boolean {
  return (command.includes("/") ? [command] : path.split(delimiter).filter(Boolean).map((dir) => join(dir, command))).some((file) => {
    try { accessSync(file, constants.X_OK); return true; } catch { return false; }
  });
}

function rulesPath(home: string, agent: AgentId): string | undefined {
  const paths: Partial<Record<AgentId, string>> = { codex: ".codex/AGENTS.md", claude: ".claude/CLAUDE.md", antigravity: ".gemini/GEMINI.md", opencode: ".config/opencode/AGENTS.md", pi: ".pi/agent/AGENTS.md" };
  return paths[agent] ? join(home, paths[agent]) : undefined;
}

function mcpInstalled(home: string, agent: AgentId, item: CatalogItem): boolean {
  const nameIndex = item.args?.indexOf("--name") ?? -1;
  const name = nameIndex >= 0 ? item.args?.[nameIndex + 1] ?? item.id : item.id;
  if (agent === "codex") {
    const file = join(home, ".codex", "config.toml");
    if (!existsSync(file)) return false;
    return readFileSync(file, "utf8").split("\n").some((line) => [ `[mcp_servers.${name}]`, `[mcp_servers."${name}"]`, `[mcp_servers.'${name}']` ].includes(line.trim()));
  }
  const files: Partial<Record<AgentId, string>> = { claude: ".claude.json", "cursor-local": ".cursor/mcp.json", antigravity: ".gemini/config/mcp_config.json", opencode: ".config/opencode/opencode.json" };
  const jsonc = ".config/opencode/opencode.jsonc";
  const file = agent === "opencode" && existsSync(join(home, jsonc)) ? jsonc : files[agent];
  if (!file || !existsSync(join(home, file))) return false;
  const raw = readFileSync(join(home, file), "utf8");
  const config = JSON.parse(agent === "opencode" ? stripJsonComments(raw) : raw) as { mcpServers?: Record<string, unknown>; mcp?: Record<string, unknown> & { servers?: Record<string, unknown> } };
  return Object.hasOwn(config.mcpServers ?? {}, name) || Object.hasOwn(config.mcp?.servers ?? {}, name) || Object.hasOwn(config.mcp ?? {}, name);
}


function stripJsonComments(content: string): string {
  const withoutComments = content.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, (match, quoted: string | undefined) => quoted ?? " ");
  return withoutComments.replace(/("(?:[^"\\]|\\.)*")|,\s*(?=[}\]])/g, (match, quoted: string | undefined) => quoted ?? "");
}
