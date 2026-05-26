import { checkbox, select } from "@inquirer/prompts";
import { agentIds, hookAgentIds } from "./agents.js";
import { loadHookManifest, loadMcpManifest, loadSkillManifest, loadUtilityManifest } from "./manifest.js";
import { afkCheckboxTheme, afkSelectTheme, renderPromptStep, resetPromptSteps } from "./prompt-ui.js";
import type { AgentId, Area, CliOptions, SetupScope } from "./types.js";

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
  mcpIds: string[];
  utilIds: string[];
  hookIds: string[];
};

const setupAreaChoices: Choice<Area>[] = [
  {
    name: "Rules",
    value: "rules",
    checked: true,
    description: "Sync AFK global rules into supported rule hosts.",
  },
  {
    name: "Skills",
    value: "skills",
    checked: true,
    description: "Delegate AFK and recommended skill installs to the skills CLI.",
  },
  {
    name: "MCPs",
    value: "mcps",
    checked: true,
    description: "Delegate recommended MCP installs to add-mcp.",
  },
  {
    name: "Utils",
    value: "utils",
    checked: true,
    description: "Install optional developer utilities AFK recommends.",
  },
  {
    name: "Hooks",
    value: "hooks",
    checked: true,
    description: "Merge AFK lifecycle hooks into supported agent hook configs.",
  },
];

export async function selectSetup(options: CliOptions): Promise<SetupSelection> {
  if (options.yes) {
    return normalizeSetupSelection({
      areas: setupAreaChoices.map((choice) => choice.value),
      agents: options.agents,
      hookAgents: options.agents,
      setupScope: options.setupScope,
      skillIds: loadSkillManifest(options).items.map((item) => item.id),
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
      utilIds: loadUtilityManifest(options).items.map((item) => item.id),
      hookIds: loadHookManifest(options).items.map((item) => item.id),
    });
  }

  resetPromptSteps();
  const setupScope = options.scopeExplicit ? options.setupScope : await selectSetupScope(options.cwd);
  const areas = await selectCheckbox("Choose what AFK should prepare", setupAreaChoices);
  const utilIds = areas.includes("utils") ? await selectUtils(options) : [];
  const needsAgents = areas.some((area) => area === "rules" || area === "mcps") || utilIds.includes("rtk");
  const agents = needsAgents ? await selectAgents(options.agents) : options.agents;
  const skillIds = areas.includes("skills") ? await selectSkills(options) : [];
  const mcpIds = areas.includes("mcps") ? await selectMcps(options) : [];
  const hookIds = areas.includes("hooks") ? await selectHooks(options) : [];
  const hookAgents = hookIds.length > 0 ? await selectHookAgents(options.agents) : options.agents;

  return normalizeSetupSelection({
    areas,
    agents,
    hookAgents,
    setupScope,
    skillIds,
    mcpIds,
    utilIds,
    hookIds,
  });
}

export async function selectRulesSync(options: CliOptions): Promise<Pick<SetupSelection, "agents">> {
  if (options.yes) {
    return { agents: options.agents };
  }

  resetPromptSteps();
  return { agents: await selectAgents(options.agents) };
}

export async function selectSkillsInstall(options: CliOptions): Promise<Pick<SetupSelection, "skillIds">> {
  if (options.yes) {
    return { skillIds: loadSkillManifest(options).items.map((item) => item.id) };
  }

  resetPromptSteps();
  return { skillIds: await selectSkills(options) };
}

export async function selectMcpsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "mcpIds">> {
  if (options.yes) {
    return {
      agents: options.agents,
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  return {
    agents: await selectAgents(options.agents),
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
  const agents = utilIds.includes("rtk") ? await selectAgents(options.agents) : options.agents;
  return { agents, utilIds };
}

export async function selectHooksInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "hookIds">> {
  if (options.yes) {
    return {
      agents: options.agents.filter((agent) => hookAgentIds.includes(agent)),
      hookIds: loadHookManifest(options).items.map((item) => item.id),
    };
  }

  resetPromptSteps();
  return {
    agents: await selectHookAgents(options.agents),
    hookIds: await selectHooks(options),
  };
}

export function normalizeSetupSelection(selection: SetupSelection): SetupSelection {
  return {
    ...selection,
    hookAgents: selection.hookAgents.filter((agent) => hookAgentIds.includes(agent)),
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
        return selection.hookIds.length > 0;
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

async function selectAgents(preselected: AgentId[]): Promise<AgentId[]> {
  return selectAgentChoices("Choose agent targets", agentIds, preselected);
}

async function selectHookAgents(preselected: AgentId[]): Promise<AgentId[]> {
  return selectAgentChoices("Choose hook targets", hookAgentIds, preselected);
}

async function selectAgentChoices(message: string, choices: AgentId[], preselected: AgentId[]): Promise<AgentId[]> {
  const supportedPreselected = preselected.filter((agent) => choices.includes(agent));
  if (supportedPreselected.length > 0) {
    return supportedPreselected;
  }

  return selectCheckbox(
    message,
    choices.map((agent) => {
      return {
        name: agent,
        value: agent,
        checked: true,
      };
    }),
  );
}

async function selectSkills(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
  const manifest = loadSkillManifest(options);
  return selectCheckbox(
    "Choose skills to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: true,
      description: item.args.join(" "),
    })),
  );
}

async function selectMcps(options: Pick<CliOptions, "homeDir">): Promise<string[]> {
  const manifest = loadMcpManifest(options);
  return selectCheckbox(
    "Choose MCPs to install",
    manifest.items.map((item) => ({
      name: item.label,
      value: item.id,
      checked: true,
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
      checked: true,
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
      checked: true,
      description: item.description,
    })),
  );
}

async function selectCheckbox<Value extends string>(message: string, choices: Choice<Value>[]): Promise<Value[]> {
  console.log(renderPromptStep(message, "Everything starts selected. Use space to unselect anything you want to skip."));
  return checkbox<Value>({
    message,
    choices,
    required: false,
    pageSize: 12,
    instructions: "Use space to toggle, enter to continue.",
    theme: afkCheckboxTheme,
  });
}
