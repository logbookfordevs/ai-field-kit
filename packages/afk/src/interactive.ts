import { checkbox, input, select } from "@inquirer/prompts";
import { detectSetupTargets, type TargetSelectionSource } from "./agent-detection.js";
import { agentIds, hookAgentIds, skillAgentIds } from "./agents.js";
import { loadHookManifest, loadMcpManifest, loadSkillManifest, loadUtilityManifest } from "./manifest.js";
import { DEFAULT_CHECKED, afkCheckboxTheme, afkSelectTheme, defaultCheckedDetail, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import type { AgentId, Area, CliOptions, SetupScope, SkillAgentId } from "./types.js";

type Choice<Value extends string> = {
  name: string;
  value: Value;
  checked?: boolean;
  description?: string;
};

export type SetupSelection = {
  areas: Area[];
  agents: AgentId[];
  hookAgents: AgentId[];
  setupScope: SetupScope;
  skillIds: string[];
  skillAgents: SkillAgentId[];
  mcpIds: string[];
  utilIds: string[];
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
    name: "MCPs",
    value: "mcps",
    checked: DEFAULT_CHECKED,
    description: "Delegate recommended MCP installs to add-mcp.",
  },
  {
    name: "Utils",
    value: "utils",
    checked: DEFAULT_CHECKED,
    description: "Install optional developer utilities AFK recommends.",
  },
  {
    name: "Hooks",
    value: "hooks",
    checked: DEFAULT_CHECKED,
    description: "Merge AFK lifecycle hooks into supported agent hook configs.",
  },
];

export async function selectSetup(options: CliOptions): Promise<SetupSelection> {
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
      skillIds: loadSkillManifest(options).items.map((item) => item.id),
      skillAgents: skillAgentSelection.agents,
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
      utilIds: loadUtilityManifest(options).items.map((item) => item.id),
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
  const utilIds = areas.includes("utils") ? await selectUtils(options) : [];
  const needsAgents = areas.some((area) => area === "rules" || area === "mcps");
  const agentSelection = needsAgents
    ? await selectAgents(options.agents, detected.agents, agentPromptMessage(areas))
    : { agents: options.agents, source: options.agents.length > 0 ? "explicit" : "none" as TargetSelectionSource };
  const skillIds = areas.includes("skills") ? await selectSkills(options) : [];
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
    skillAgents: skillAgentSelection.agents,
    mcpIds,
    utilIds,
    hookIds,
    agentSource: agentSelection.source,
    hookAgentSource: hookAgentSelection.source,
    skillAgentSource: skillAgentSelection.source,
  });
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
      skillIds: loadSkillManifest(options).items.map((item) => item.id),
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

export async function selectUtilsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "utilIds">> {
  if (options.yes) {
    return {
      agents: options.agents,
      utilIds: loadUtilityManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  const utilIds = await selectUtils(options);
  return { agents: options.agents, utilIds };
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

      if (area === "mcps") {
        return selection.mcpIds.length > 0;
      }

      if (area === "utils") {
        return selection.utilIds.length > 0;
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

async function selectSkills(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
  const manifest = loadSkillManifest(options);
  return selectCheckbox(
    "Choose skills to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: DEFAULT_CHECKED,
      description: item.args.join(" "),
    })),
  );
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

async function selectMcps(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
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

async function selectUtils(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
  const manifest = loadUtilityManifest(options);
  return selectCheckbox(
    "Choose utilities to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: DEFAULT_CHECKED,
      description: item.description,
    })),
  );
}

async function selectHooks(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
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

async function selectCheckbox<Value extends string>(message: string, choices: Choice<Value>[]): Promise<Value[]> {
  console.log(renderPromptStep(message, defaultCheckedDetail));
  return checkbox<Value>({
    message,
    choices,
    required: false,
    pageSize: 12,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkCheckboxTheme,
  });
}
