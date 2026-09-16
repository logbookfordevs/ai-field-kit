import { accessSync, constants, existsSync, readFileSync } from "node:fs";
import { basename, delimiter, join } from "node:path";
import { addMcpAgentNames } from "./agents.js";
import { detectSetupTargets } from "./agent-detection.js";
import type { CustomAgentHarness } from "./custom-agents.js";
import { buildSkillInstallPlans, buildToolCommands, buildToolUpdateCommands, runDelegateCommands } from "./delegates.js";
import { applyOperation } from "./fs-utils.js";
import { selectPresetId } from "./interactive.js";
import { ensureLocalManifests, isManifestValue, loadPresetsManifest, localManifestDir, type PresetManifestItem, type ToolManifestItem, type HookManifestItem } from "./manifest.js";
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
  const agents = options.agents.length ? options.agents : detectSetupTargets(options).agents;
  const tasks: Task[] = [];
  const failures: string[] = [];
  const skipped: string[] = [];
  const areaTask = (area: Area, items: CatalogItem[], targets: AgentId[] = agents): void => {
    if (!items.length) return;
    const detail = area === "skills"
      ? `${items[0]?.source} (${items.length} skills)`
      : `${items.map((item) => item.id).join(", ")} (${targets.join(", ")})`;
    tasks.push({ label: `${area}: ${detail}`, run: () => runArea(area, strictRuntime(runtime), {
      ...effective, agents: targets,
      selectedSkillIds: area === "skills" ? items.map((item) => item.id) : [],
      selectedCustomAgentIds: area === "agents" ? items.map((item) => item.id) : [],
      selectedMcpIds: area === "mcps" ? items.map((item) => item.id) : [],
      selectedHookIds: area === "hooks" ? items.map((item) => item.id) : [],
    }) });
  };
  for (const area of new Set(preset.areas)) {
    if (area === "profiles") {
      skipped.push("profiles: definitions refreshed; package installation remains deferred to profile enablement");
      continue;
    }
    if (area === "rules") {
      const targets = agents.filter((agent) => agent !== "cursor-local");
      if (targets.length) areaTask("rules", [{ id: "rules" }], targets);
      else failures.push("rules: no supported agent targets detected; supply --agent");
      continue;
    }
    if (!["skills", "tools", "agents", "mcps", "hooks"].includes(area)) {
      failures.push(`Unsupported preset area: ${area}`);
      continue;
    }
    const items = (JSON.parse(contents[`${area}.json` as ManifestFilename] ?? "{\"items\":[]}") as Catalog).items ?? [];
    if (area === "skills") {
      const skillOptions = { ...effective, allSkills: true, selectedSkillIds: [], excludeImportedSkills: !options.syncIncludeExtraSkills };
      for (const plan of buildSkillInstallPlans(skillOptions)) {
        areaTask("skills", plan.items);
      }
      continue;
    }
    const selectionKey = area === "agents" ? "customAgents" : area as "tools" | "mcps" | "hooks";
    const ids = preset.selections?.[selectionKey];
    if (ids) failures.push(...ids.filter((id) => !items.some((item) => item.id === id)).map((id) => `${area}: unknown catalog entry ${id}`));
    const selectedIds = ids ?? items.filter(() => preset.all || area !== "agents").map((item) => item.id);
    const selected = items.filter((item) => selectedIds.includes(item.id));
    for (const item of selected) {
      if (area === "tools") {
        const tool = item as unknown as ToolManifestItem;
        const command = tool.update?.command;
        const executable = tool.executable ?? (command && !["bash", "sh", "npm", "npx", "pnpm", "bun"].includes(command) ? command : tool.id);
        const installed = executableExists(executable, path);
        if (installed && !tool.update) {
          skipped.push(`tools: ${tool.id}: no update command`);
          continue;
        }
        const commands = installed ? buildToolUpdateCommands(effective, [tool.id]) : buildToolCommands({ ...effective, selectedToolIds: [tool.id] });
        tasks.push({ label: `tools: ${tool.id}`, run: () => runDelegateCommands(strictRuntime(runtime), commands, effective) });
      } else {
        const targets = area === "agents" ? agents.filter((agent): agent is CustomAgentHarness => ["codex", "claude", "pi"].includes(agent)) : area === "hooks" ? agents.filter((agent) => (item as unknown as HookManifestItem).agents.includes(agent as HookManifestItem["agents"][number])) : agents.filter((agent) => Boolean(addMcpAgentNames[agent]));
        if (!targets.length) failures.push(`${area}: ${item.id}: no supported targets; supply --agent`);
        areaTask(area as Area, [item], targets);
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
