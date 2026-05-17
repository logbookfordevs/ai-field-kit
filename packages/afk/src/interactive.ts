import { checkbox, select } from "@inquirer/prompts";
import { agentIds } from "./agents.js";
import { loadMcpManifest, loadSkillManifest, loadUtilityManifest } from "./manifest.js";
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
  setupScope: SetupScope;
  skillIds: string[];
  mcpIds: string[];
  utilIds: string[];
};

const setupAreaChoices: Choice<Area>[] = [
  {
    name: "Rules",
    value: "rules",
    checked: true,
    description: "Sync AFK global rules into supported rule hosts.",
  },
  {
    name: "Workflows",
    value: "workflows",
    checked: true,
    description: "Sync slash commands and generated Codex workflow skills.",
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
];

export async function selectSetup(options: CliOptions): Promise<SetupSelection> {
  if (options.yes) {
    return normalizeSetupSelection({
      areas: setupAreaChoices.map((choice) => choice.value),
      agents: options.agents,
      setupScope: options.setupScope,
      skillIds: loadSkillManifest(options).items.map((item) => item.id),
      mcpIds: loadMcpManifest(options).items.map((item) => item.id),
      utilIds: loadUtilityManifest(options).items.map((item) => item.id),
    });
  }

  const setupScope = options.scopeExplicit ? options.setupScope : await selectSetupScope(options.cwd);
  const areas = await selectCheckbox("Choose what AFK should prepare", setupAreaChoices);
  const utilIds = areas.includes("utils") ? await selectUtils(options) : [];
  const needsAgents = areas.some((area) => area === "rules" || area === "workflows" || area === "mcps") || utilIds.includes("rtk");
  const agents = needsAgents ? await selectAgents(options.agents) : options.agents;
  const skillIds = areas.includes("skills") ? await selectSkills(options) : [];
  const mcpIds = areas.includes("mcps") ? await selectMcps(options) : [];

  return normalizeSetupSelection({
    areas,
    agents,
    setupScope,
    skillIds,
    mcpIds,
    utilIds,
  });
}

export async function selectUtilsInstall(options: CliOptions): Promise<Pick<SetupSelection, "agents" | "utilIds">> {
  if (options.yes) {
    return {
      agents: options.agents,
      utilIds: loadUtilityManifest(options).items.map((item) => item.id),
    };
  }

  const utilIds = await selectUtils(options);
  const agents = utilIds.includes("rtk") ? await selectAgents(options.agents) : options.agents;
  return { agents, utilIds };
}

export function normalizeSetupSelection(selection: SetupSelection): SetupSelection {
  return {
    ...selection,
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

      return true;
    }),
  };
}

async function selectSetupScope(cwd: string): Promise<SetupScope> {
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
  });
}

async function selectAgents(preselected: AgentId[]): Promise<AgentId[]> {
  if (preselected.length > 0) {
    return preselected;
  }

  return selectCheckbox(
    "Choose agent targets",
    agentIds.map((agent) => {
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

async function selectCheckbox<Value extends string>(message: string, choices: Choice<Value>[]): Promise<Value[]> {
  return checkbox<Value>({
    message,
    choices,
    required: false,
    pageSize: 12,
    instructions: "Use space to toggle, enter to continue.",
  });
}
