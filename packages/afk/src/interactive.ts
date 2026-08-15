import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { detectSetupTargets, type TargetSelectionSource } from "./agent-detection.js";
import { agentIds, hookAgentIds, skillAgentIds } from "./agents.js";
import { expandComposedSkillIds, loadCustomAgentManifest, loadHookManifest, loadMcpManifest, loadPresetsManifest, loadSkillManifest, loadPluginManifest, type PresetManifestItem, type SkillManifestItem } from "./manifest.js";
import { loadSetupSkillProfileCatalog } from "./skills/profiles.js";
import { DEFAULT_CHECKED, afkCheckboxTheme, afkPromptTheme, afkSearchableCheckboxTheme, afkSelectTheme, defaultCheckedDetail, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import { searchableCheckbox } from "./searchable-checkbox.js";
import type { AgentId, Area, CliOptions, SetupScope, SkillAgentId } from "./types.js";

type Choice<Value extends string> = {
  name: string;
  value: Value;
  checked?: boolean;
  description?: string;
  searchAliases?: string[];
};

export type SetupSelection = {
  areas: Area[];
  agents: AgentId[];
  hookAgents: AgentId[];
  setupScope: SetupScope;
  skillIds: string[];
  profileIds?: string[];
  customAgentIds?: string[];
  skillAgents: SkillAgentId[];
  mcpIds: string[];
  pluginIds: string[];
  hookIds: string[];
  agentSource?: TargetSelectionSource;
  hookAgentSource?: TargetSelectionSource;
  skillAgentSource?: TargetSelectionSource;
};

const setupAreaChoices: Choice<Area>[] = [
  {
    name: "Rules",
    value: "rules",
    checked: DEFAULT_CHECKED,
    description: "Sync AFK global rules into supported rule hosts.",
  },
  {
    name: "Skills",
    value: "skills",
    checked: DEFAULT_CHECKED,
    description: "Delegate AFK and recommended skill installs to the skills CLI.",
  },
  {
    name: "Skills Profiles",
    value: "profiles",
    checked: DEFAULT_CHECKED,
    description: "Install the skills selected by AFK focus profiles from profiles.json.",
  },
  {
    name: "Custom Agents",
    value: "agents",
    checked: DEFAULT_CHECKED,
    description: "Provision portable Custom Agents into supported harnesses.",
  },
  {
    name: "MCPs",
    value: "mcps",
    checked: DEFAULT_CHECKED,
    description: "Delegate recommended MCP installs to add-mcp.",
  },
  {
    name: "Plugins",
    value: "plugins",
    checked: DEFAULT_CHECKED,
    description: "Install optional developer plugins AFK recommends.",
  },
  {
    name: "Hooks",
    value: "hooks",
    checked: DEFAULT_CHECKED,
    description: "Merge AFK lifecycle hooks into supported agent hook configs.",
  },
];

export async function selectSetup(options: CliOptions): Promise<SetupSelection> {
  if (options.presetId) {
    return selectPresetSetup(options, options.presetId);
  }

  if (options.yes) {
    const detected = detectSetupTargets(options);
    const agentSelection = resolveNonInteractiveAgentSelection(options.agents, detected.agents);
    const hookAgentSelection = resolveNonInteractiveAgentSelection(options.agents, detected.hookAgents);
    const skillAgentSelection = options.selectedSkillAgentIds.length > 0
      ? { agents: options.selectedSkillAgentIds, source: "explicit" as TargetSelectionSource }
      : { agents: detected.skillAgents, source: detected.skillAgents.length > 0 ? "detected" : "none" as TargetSelectionSource };

    return normalizeSetupSelection({
      areas: setupAreaChoices.map((choice) => choice.value),
      agents: agentSelection.agents,
      hookAgents: hookAgentSelection.agents,
      setupScope: options.setupScope,
      skillIds: nonInteractiveSkillIds(options),
      profileIds: loadSetupSkillProfileCatalog(options).items.map((profile) => profile.id),
      customAgentIds: nonInteractiveCustomAgentIds(options),
      skillAgents: skillAgentSelection.agents,
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
      pluginIds: loadPluginManifest(options).items.map((item) => item.id),
      hookIds: loadHookManifest(options).items.map((item) => item.id),
      agentSource: agentSelection.agentSource,
      hookAgentSource: hookAgentSelection.agentSource,
      skillAgentSource: skillAgentSelection.source,
    });
  }

  resetPromptSteps();
  const setupScope = options.scopeExplicit ? options.setupScope : await selectSetupScope(options.cwd);
  const detected = detectSetupTargets({ ...options, setupScope });
  const areas = await selectCheckbox("Choose what AFK should prepare", setupAreaChoices);
  const pluginIds = areas.includes("plugins") ? await selectPlugins(options) : [];
  const needsAgents = areas.some((area) => area === "rules" || area === "mcps" || area === "agents");
  const agentSelection = needsAgents
    ? await selectSetupAgents(options.agents, detected.agents, areas)
    : { agents: options.agents, source: options.agents.length > 0 ? "explicit" : "none" as TargetSelectionSource };
  const skillIds = areas.includes("skills") ? await selectSkills(options) : [];
  const profileIds = areas.includes("profiles") ? await selectSkillProfiles(options) : [];
  const customAgentIds = areas.includes("agents") ? await selectCustomAgents(options) : [];
  const skillAgentSelection = skillIds.length > 0
    ? selectSkillAgents(options, detected.skillAgents)
    : { agents: [], source: "none" as TargetSelectionSource };
  const mcpIds = areas.includes("mcps") ? await selectMcps(options) : [];
  const hookIds = areas.includes("hooks") ? await selectHooks(options) : [];
  const hookAgentSelection = hookIds.length > 0
    ? await selectHookAgents(options.agents, detected.hookAgents)
    : { agents: options.agents, source: options.agents.length > 0 ? "explicit" : "none" as TargetSelectionSource };

  return normalizeSetupSelection({
    areas,
    agents: agentSelection.agents,
    hookAgents: hookAgentSelection.agents,
    setupScope,
    skillIds,
    profileIds,
    customAgentIds,
    skillAgents: skillAgentSelection.agents,
    mcpIds,
    pluginIds,
    hookIds,
    agentSource: agentSelection.source,
    hookAgentSource: hookAgentSelection.source,
    skillAgentSource: skillAgentSelection.source,
  });
}

async function selectPresetSetup(options: CliOptions, presetId: string): Promise<SetupSelection> {
  const preset = loadPresetsManifest(options).presets.find((candidate) => candidate.id === presetId);
  if (!preset) {
    throw new Error(`Unknown AFK preset: ${presetId}`);
  }

  const areas = presetAreas(preset);
  const setupScope = options.scopeExplicit || options.yes ? options.setupScope : await selectSetupScope(options.cwd);
  const detected = detectSetupTargets({ ...options, setupScope });
  const skillIds = areas.includes("skills")
    ? presetIds("skill", preset.selections?.skills, loadSkillManifest(options).items.map((item) => item.id), nonInteractiveSkillIds(options))
    : [];
  const customAgentIds = areas.includes("agents")
    ? presetIds("Custom Agent", preset.selections?.customAgents, loadCustomAgentManifest(options).items.map((item) => item.id), [])
    : [];
  const mcpIds = areas.includes("mcps")
    ? presetIds("MCP", preset.selections?.mcps, loadMcpManifest(options).items.map((item) => item.id), loadMcpManifest(options).items.map((item) => item.id))
    : [];
  const pluginIds = areas.includes("plugins")
    ? presetIds("plugin", preset.selections?.plugins, loadPluginManifest(options).items.map((item) => item.id), loadPluginManifest(options).items.map((item) => item.id))
    : [];
  const hookIds = areas.includes("hooks")
    ? presetIds("hook", preset.selections?.hooks, loadHookManifest(options).items.map((item) => item.id), loadHookManifest(options).items.map((item) => item.id))
    : [];

  const needsGeneralAgents = areas.some((area) => area === "rules" || area === "mcps");
  const needsCustomAgentHarness = customAgentIds.length > 0 && !needsGeneralAgents;
  let agentSelection: { agents: AgentId[]; source: TargetSelectionSource };
  if (needsGeneralAgents) {
    agentSelection = options.yes
      ? presetAgentSelection(options.agents, detected.agents)
      : await selectSetupAgents(options.agents, detected.agents, areas);
  } else if (needsCustomAgentHarness) {
    agentSelection = options.yes
      ? presetAgentSelection(options.agents.filter(isCustomAgentHarness), detected.agents.filter(isCustomAgentHarness))
      : await selectAgentChoices("Choose harnesses for Custom Agents", ["codex", "claude", "pi"], options.agents, detected.agents);
  } else {
    agentSelection = { agents: [], source: "none" };
  }

  const skillAgentSelection = skillIds.length > 0
    ? selectSkillAgents(options, detected.skillAgents)
    : { agents: [], source: "none" as TargetSelectionSource };
  const hookAgentSelection = hookIds.length > 0
    ? options.yes
      ? presetAgentSelection(options.agents, detected.hookAgents)
      : await selectHookAgents(options.agents, detected.hookAgents)
    : { agents: [], source: "none" as TargetSelectionSource };

  return normalizeSetupSelection({
    areas,
    agents: agentSelection.agents,
    hookAgents: hookAgentSelection.agents,
    setupScope,
    skillIds,
    customAgentIds,
    skillAgents: skillAgentSelection.agents,
    mcpIds,
    pluginIds,
    hookIds,
    agentSource: agentSelection.source,
    hookAgentSource: hookAgentSelection.source,
    skillAgentSource: skillAgentSelection.source,
  });
}

function presetAgentSelection(preselected: AgentId[], detected: AgentId[]): { agents: AgentId[]; source: TargetSelectionSource } {
  const selection = resolveNonInteractiveAgentSelection(preselected, detected);
  return { agents: selection.agents, source: selection.agentSource };
}

function presetAreas(preset: PresetManifestItem): Area[] {
  const supportedAreas = new Set<Area>(setupAreaChoices.map((choice) => choice.value));
  const invalidArea = preset.areas.find((area) => !supportedAreas.has(area as Area));
  if (invalidArea) {
    throw new Error(`Preset ${preset.id} contains an unsupported setup area: ${invalidArea}`);
  }
  return uniqueStrings(preset.areas) as Area[];
}

function presetIds(label: string, selected: string[] | undefined, available: string[], fallback: string[]): string[] {
  if (selected === undefined) {
    return uniqueStrings(fallback);
  }
  const ids = uniqueStrings(selected);
  const unknown = ids.find((id) => !available.includes(id));
  if (unknown) {
    throw new Error(`Unknown ${label} id in preset: ${unknown}`);
  }
  return ids;
}

export async function selectDefaultsSource(rememberedSource: string): Promise<string> {
  console.log(renderPromptStep("Source", "Choose which AFK defaults source to use for this setup run."));
  return input({
    message: "Which AFK setup source should be used?",
    ...(rememberedSource ? { default: rememberedSource } : {}),
    required: true,
    validate: (value) => value.trim().length > 0 || "Enter a setup source to continue.",
    theme: afkSelectTheme,
  });
}

export async function selectRulesSync(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "agentSource">> {
  if (options.yes) {
    const detected = detectSetupTargets(options);
    return resolveNonInteractiveAgentSelection(options.agents, detected.agents);
  }

  resetPromptSteps();
  const detected = detectSetupTargets(options);
  const selection = await selectAgents(options.agents, detected.agents, agentPromptMessage(["rules"]));
  return { agents: selection.agents, agentSource: selection.source };
}

export async function selectSkillsInstall(options: CliOptions): Promise<Pick<SetupSelection, "skillIds" | "skillAgents">> {
  if (options.yes) {
    const detected = detectSetupTargets(options);
    return {
      skillIds: nonInteractiveSkillIds(options),
      skillAgents: options.selectedSkillAgentIds.length > 0 ? options.selectedSkillAgentIds : detected.skillAgents,
    };
  }

  resetPromptSteps();
  const detected = detectSetupTargets(options);
  const skillIds = await selectSkills(options);
  return {
    skillIds,
    skillAgents: skillIds.length > 0 ? selectSkillAgents(options, detected.skillAgents).agents : [],
  };
}

export async function selectSkillProfilesInstall(options: CliOptions): Promise<Pick<SetupSelection, "profileIds" | "skillAgents">> {
  const profileIds = options.selectedSkillProfileIds?.length
    ? uniqueStrings(options.selectedSkillProfileIds)
    : options.yes
      ? loadSetupSkillProfileCatalog(options).items.map((profile) => profile.id)
      : await selectSkillProfiles(options);
  const detected = detectSetupTargets(options);
  return {
    profileIds,
    skillAgents: profileIds.length > 0 ? selectSkillAgents(options, detected.skillAgents).agents : [],
  };
}

export async function confirmSkillProfileInstall(): Promise<boolean> {
  return confirm({
    message: "Install available profile skills?",
    default: false,
    theme: afkPromptTheme,
  });
}

export async function selectRecoverableProfileSkills(
  skills: Array<{ id: string; label: string; source: string }>,
): Promise<string[]> {
  console.log(renderPromptStep(
    "Recover missing profile skills",
    "Lock-backed matches start selected. Unselect anything you do not want to restore.",
  ));
  return checkbox({
    message: "Choose skills to recover",
    choices: skills.map((skill) => ({
      name: skill.label,
      value: skill.id,
      checked: true,
      description: `Restore from ${skill.source}`,
    })),
    theme: afkCheckboxTheme,
  });
}

export async function selectCustomAgentsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "customAgentIds">> {
  if (options.yes) {
    const detected = detectSetupTargets(options).agents.filter(isCustomAgentHarness);
    return {
      agents: options.agents.length > 0 ? options.agents.filter(isCustomAgentHarness) : detected,
      customAgentIds: nonInteractiveCustomAgentIds(options),
    };
  }

  resetPromptSteps();
  const customAgentIds = await selectCustomAgents(options);
  if (customAgentIds.length === 0) {
    return { agents: [], customAgentIds: [] };
  }
  const detected = detectSetupTargets(options).agents.filter(isCustomAgentHarness);
  const selection = await selectAgentChoices("Choose harnesses for Custom Agents", ["codex", "claude", "pi"], options.agents, detected);
  return { agents: selection.agents, customAgentIds };
}

export async function selectMcpsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "mcpIds" | "agentSource">> {
  if (options.yes) {
    const detected = detectSetupTargets(options);
    const selection = resolveNonInteractiveAgentSelection(options.agents, detected.agents);
    return {
      agents: selection.agents,
      agentSource: selection.agentSource,
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  const detected = detectSetupTargets(options);
  const selection = await selectAgents(options.agents, detected.agents, agentPromptMessage(["mcps"]));
  return {
    agents: selection.agents,
    agentSource: selection.source,
    mcpIds: await selectMcps(options),
  };
}

export async function selectPluginsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "pluginIds">> {
  if (options.yes) {
    return {
      agents: options.agents,
      pluginIds: loadPluginManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  const pluginIds = await selectPlugins(options);
  return { agents: options.agents, pluginIds };
}

export async function selectHooksInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "hookIds">> {
  if (options.yes) {
    const detected = detectSetupTargets(options);
    const selection = resolveNonInteractiveAgentSelection(options.agents, detected.hookAgents);
    return {
      agents: selection.agents.filter((agent) => hookAgentIds.includes(agent)),
      hookIds: loadHookManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  const detected = detectSetupTargets(options);
  const selection = await selectHookAgents(options.agents, detected.hookAgents);
  return {
    agents: selection.agents,
    hookIds: await selectHooks(options),
  };
}

export function normalizeSetupSelection(selection: SetupSelection): SetupSelection {
  return {
    ...selection,
    hookAgents: selection.hookAgents.filter((agent) => hookAgentIds.includes(agent)),
    skillAgents: selection.skillAgents.filter((agent) => skillAgentIds.includes(agent)),
    areas: selection.areas.filter((area) => {
      if (area === "skills") {
        return selection.skillIds.length > 0;
      }

      if (area === "agents") {
        return (selection.customAgentIds?.length ?? 0) > 0 && selection.agents.some(isCustomAgentHarness);
      }

      if (area === "mcps") {
        return selection.mcpIds.length > 0;
      }

      if (area === "plugins") {
        return selection.pluginIds.length > 0;
      }

      if (area === "hooks") {
        return selection.hookIds.length > 0 && selection.hookAgents.length > 0;
      }

      return true;
    }),
  };
}

async function selectSetupScope(cwd: string): Promise<SetupScope> {
  console.log(renderPromptStep("Scope", "Choose whether AFK writes global config or project-local files."));
  return select<SetupScope>({
    message: "Where should AFK set things up?",
    choices: [
      {
        name: "Global field kit",
        value: "global",
        description: "Use across all projects on this machine.",
      },
      {
        name: "This project only",
        value: "project",
        description: `Write config into ${cwd} and keep it repo-scoped.`,
      },
    ],
    default: "global",
    instructions: {
      navigation: "Use arrow keys to move.",
      pager: "Use arrow keys to reveal more choices.",
    },
    theme: afkSelectTheme,
  });
}

function agentPromptMessage(areas: Area[]): string {
  const hasRules = areas.includes("rules");
  const hasMcps = areas.includes("mcps");

  if (hasRules && hasMcps) {
    return "Choose agents for rules and MCPs";
  }

  if (hasRules) {
    return "Choose agents for rules";
  }

  if (hasMcps) {
    return "Choose agents for MCPs";
  }

  return "Choose agents";
}

async function selectAgents(preselected: AgentId[], detected: AgentId[], message: string): Promise<{ agents: AgentId[]; source: TargetSelectionSource }> {
  return selectAgentChoices(message, agentIds, preselected, detected);
}

async function selectSetupAgents(preselected: AgentId[], detected: AgentId[], areas: Area[]): Promise<{ agents: AgentId[]; source: TargetSelectionSource }> {
  if (areas.length === 1 && areas[0] === "agents") {
    return selectAgentChoices("Choose harnesses for Custom Agents", ["codex", "claude", "pi"], preselected, detected);
  }
  return selectAgents(preselected, detected, agentPromptMessage(areas));
}

async function selectHookAgents(preselected: AgentId[], detected: AgentId[]): Promise<{ agents: AgentId[]; source: TargetSelectionSource }> {
  return selectAgentChoices("Choose agents for hooks", hookAgentIds, preselected, detected);
}

async function selectAgentChoices(
  message: string,
  choices: AgentId[],
  preselected: AgentId[],
  detected: AgentId[],
): Promise<{ agents: AgentId[]; source: TargetSelectionSource }> {
  const supportedPreselected = preselected.filter((agent) => choices.includes(agent));
  if (supportedPreselected.length > 0) {
    return { agents: supportedPreselected, source: "explicit" };
  }

  const supportedDetected = detected.filter((agent) => choices.includes(agent));
  if (supportedDetected.length > 0) {
    return { agents: supportedDetected, source: "detected" };
  }

  const agents = await selectCheckbox(
    message,
    choices.map((agent) => {
      return {
        name: agent,
        value: agent,
        checked: DEFAULT_CHECKED,
      };
    }),
  );
  return { agents, source: agents.length > 0 ? "manual" : "none" };
}

async function selectSkills(options: Pick<CliOptions, "homeDir" | "allSkills" | "manifestContents">): Promise<string[]> {
  const manifest = loadSkillManifest(options);
  const items = setupSkillItems(manifest.items, options.allSkills);

  const selected = uniqueStrings(await selectSearchableCheckbox(
    "Choose skills to install",
    skillChoices(items),
  ));
  const expanded = expandComposedSkillIds(items, selected);
  if (expanded.length === selected.length) {
    return selected;
  }

  const composed = expanded.filter((id) => !selected.includes(id));
  const composedSelection = await selectSearchableCheckbox(
    "Choose composed skills to include",
    composed.map((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return {
        name: item?.label ?? id,
        value: id,
        checked: true,
        description: composedSkillDescription(items, id),
      };
    }),
  );

  return uniqueStrings([...selected, ...composedSelection]);
}

async function selectSkillProfiles(options: Pick<CliOptions, "homeDir" | "cwd" | "setupScope" | "manifestLocal" | "manifestContents">): Promise<string[]> {
  const catalog = loadSetupSkillProfileCatalog(options);
  return selectCheckbox(
    "Choose skill profiles to install",
    catalog.items.map((profile) => ({
      name: profile.name,
      value: profile.id,
      checked: false,
      description: profile.skills.length > 0 ? profile.skills.join(", ") : "No skills assigned.",
    })),
    "Skill profiles",
  );
}

function nonInteractiveSkillIds(options: Pick<CliOptions, "homeDir" | "allSkills" | "manifestContents">): string[] {
  const manifest = loadSkillManifest(options);
  const items = setupSkillItems(manifest.items, options.allSkills);
  const selected = items
    .filter((item) => item.default || options.allSkills)
    .map((item) => item.id);
  return options.allSkills ? selected : expandComposedSkillIds(items, selected);
}

function nonInteractiveCustomAgentIds(options: Pick<CliOptions, "homeDir" | "allCustomAgents" | "selectedCustomAgentIds" | "manifestContents">): string[] {
  if ((options.selectedCustomAgentIds?.length ?? 0) > 0) {
    return [...new Set(options.selectedCustomAgentIds ?? [])];
  }
  return options.allCustomAgents ? loadCustomAgentManifest(options).items.map((item) => item.id) : [];
}

async function selectCustomAgents(options: Pick<CliOptions, "homeDir" | "manifestContents">): Promise<string[]> {
  const manifest = loadCustomAgentManifest(options);
  return selectCheckbox(
    "Choose Custom Agents to provision",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: false,
      description: item.source,
    })),
  );
}

function isCustomAgentHarness(agent: AgentId): boolean {
  return agent === "codex" || agent === "claude" || agent === "pi";
}

function setupSkillItems(items: SkillManifestItem[], includeImported: boolean): SkillManifestItem[] {
  if (includeImported) {
    return items;
  }

  return items.filter((item) => item.imported !== true);
}

function skillChoices(items: SkillManifestItem[]): Choice<string>[] {
  return items.map((item) => ({
    name: item.label,
    value: item.id,
    checked: DEFAULT_CHECKED,
    description: skillChoiceDetail(item),
    searchAliases: [item.id, item.source, item.role ?? "primitive", ...item.args],
  }));
}

function skillChoiceDetail(item: SkillManifestItem): string {
  const role = item.role ?? "primitive";
  const autoInvocation = item.autoInvocation === false ? "off" : "on";
  const storage = item.startDisabled === true ? "starts disabled" : "starts active";
  const composes = item.composes && item.composes.length > 0 ? ` · composes ${item.composes.join(", ")}` : "";
  return `role: ${role} · auto-invocation: ${autoInvocation} · ${storage}${composes} · ${item.args.join(" ")}`;
}

function composedSkillDescription(items: SkillManifestItem[], id: string): string {
  const parents = items.filter((item) => item.composes?.includes(id)).map((item) => `${item.label} (${item.role ?? "primitive"})`);
  const parentDetail = parents.length > 0 ? `Composed by ${parents.join(", ")}. ` : "";
  const item = items.find((candidate) => candidate.id === id);
  return `${parentDetail}${item ? skillChoiceDetail(item) : "Composed skill"}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function selectSkillAgents(
  options: Pick<CliOptions, "selectedSkillAgentIds">,
  detected: SkillAgentId[],
): { agents: SkillAgentId[]; source: TargetSelectionSource } {
  if (options.selectedSkillAgentIds.length > 0) {
    return { agents: options.selectedSkillAgentIds, source: "explicit" };
  }

  if (detected.length > 0) {
    return { agents: detected, source: "detected" };
  }

  return { agents: [], source: "none" };
}

function resolveNonInteractiveAgentSelection(
  preselected: AgentId[],
  detected: AgentId[],
): { agents: AgentId[]; agentSource: TargetSelectionSource } {
  if (preselected.length > 0) {
    return { agents: preselected, agentSource: "explicit" };
  }

  if (detected.length > 0) {
    return { agents: detected, agentSource: "detected" };
  }

  return { agents: [], agentSource: "none" };
}

async function selectMcps(options: Pick<CliOptions, "homeDir" | "manifestContents">): Promise<string[]> {
  const manifest = loadMcpManifest(options);
  return selectCheckbox(
    "Choose MCPs to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: DEFAULT_CHECKED,
      description: item.source,
    })),
  );
}

async function selectPlugins(options: Pick<CliOptions, "homeDir" | "manifestContents">): Promise<string[]> {
  const manifest = loadPluginManifest(options);
  return selectCheckbox(
    "Choose plugins to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: DEFAULT_CHECKED,
      description: item.description,
    })),
  );
}

async function selectHooks(options: Pick<CliOptions, "homeDir" | "manifestContents">): Promise<string[]> {
  const manifest = loadHookManifest(options);
  return selectCheckbox(
    "Choose hooks to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: DEFAULT_CHECKED,
      description: item.description,
    })),
  );
}

async function selectCheckbox<Value extends string>(message: string, choices: Choice<Value>[], stepTitle = message): Promise<Value[]> {
  console.log(renderPromptStep(stepTitle, defaultCheckedDetail));
  if (choices.length === 0) {
    console.log("No choices available in the current catalog.");
    return [];
  }

  return checkbox<Value>({
    message,
    choices,
    required: false,
    pageSize: 12,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkCheckboxTheme,
  });
}

async function selectSearchableCheckbox<Value extends string>(message: string, choices: Choice<Value>[]): Promise<Value[]> {
  console.log(renderPromptStep(message, "Type to filter, use space to select one or more skills, then enter to continue."));
  if (choices.length === 0) {
    console.log("No choices available in the current catalog.");
    return [];
  }

  return searchableCheckbox<Value>({
    message,
    choices,
    required: false,
    pageSize: 12,
    instructions: "Type to filter, use space to toggle, enter to continue.",
    theme: afkSearchableCheckboxTheme,
  });
}
