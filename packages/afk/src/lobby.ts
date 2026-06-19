import { input, select } from "@inquirer/prompts";
import { renderBanner, muted, sectionTitle } from "./brand.js";
import { afkPromptTheme, afkSelectTheme } from "./prompt-ui.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import type { Runtime } from "./types.js";

export type LobbyChoiceValue =
  | "setup"
  | "source"
  | "refresh"
  | "skills"
  | "skill-management"
  | "mcps"
  | "plugins"
  | "hooks"
  | "inspect"
  | "skills-react"
  | "skills-visualize"
  | "catalog-import"
  | "help";

export type SkillsLobbyChoiceValue =
  | "skills-list"
  | "skills-show"
  | "skills-open"
  | "skills-disable"
  | "skills-enable"
  | "skills-delete"
  | "skills-upgrade"
  | "skills-categorize"
  | "skills-catalog-import"
  | "skills-profiles"
  | "skills-profile-status";

export type SkillProfilesLobbyChoiceValue =
  | "profiles-list"
  | "profiles-show"
  | "profiles-create"
  | "profiles-edit"
  | "profiles-delete"
  | "profiles-enable"
  | "profiles-disable"
  | "profiles-status";

type TtyState = {
  stdin: boolean;
  stdout: boolean;
};

type LobbyChoice = {
  name: string;
  value: LobbyChoiceValue;
  description: string;
};

export const compassLobbyChoices: LobbyChoice[] = [
  {
    name: "Prepare this machine for agent work",
    value: "setup",
    description: "Route: afk setup",
  },
  {
    name: "Change default catalog source",
    value: "source",
    description: "Route: afk refresh --default-source <source>",
  },
  {
    name: "Refresh the local catalog",
    value: "refresh",
    description: "Route: afk refresh",
  },
  {
    name: "Install skills",
    value: "skills",
    description: "Route: afk setup skills",
  },
  {
    name: "Manage installed skills",
    value: "skill-management",
    description: "Open skill list, moves, upgrades, catalog import, and profiles",
  },
  {
    name: "Add MCP tools",
    value: "mcps",
    description: "Route: afk setup mcps",
  },
  {
    name: "Install optional plugins",
    value: "plugins",
    description: "Route: afk setup plugins",
  },
  {
    name: "Add lifecycle hooks",
    value: "hooks",
    description: "Route: afk setup hooks",
  },
  {
    name: "Inspect what AFK knows",
    value: "inspect",
    description: "Route: afk show",
  },
  {
    name: "View skills as React composition",
    value: "skills-react",
    description: "Route: afk show skills --react",
  },
  {
    name: "Open the skills visual map",
    value: "skills-visualize",
    description: "Route: afk show skills --visualize",
  },
  {
    name: "Import installed skills into a catalog",
    value: "catalog-import",
    description: "Route: afk catalog import",
  },
  {
    name: "Show command help",
    value: "help",
    description: "Route: afk --help",
  },
];

export const skillsLobbyChoices: Array<{
  name: string;
  value: SkillsLobbyChoiceValue;
  description: string;
}> = [
  {
    name: "List installed skills",
    value: "skills-list",
    description: "Route: afk skills list",
  },
  {
    name: "Show skill details",
    value: "skills-show",
    description: "Route: afk skills show",
  },
  {
    name: "Open a skill file or folder",
    value: "skills-open",
    description: "Route: afk skills open",
  },
  {
    name: "Disable a skill",
    value: "skills-disable",
    description: "Route: afk skills disable",
  },
  {
    name: "Enable a disabled skill",
    value: "skills-enable",
    description: "Route: afk skills enable",
  },
  {
    name: "Delete skills",
    value: "skills-delete",
    description: "Route: afk skills delete",
  },
  {
    name: "Upgrade tracked skills",
    value: "skills-upgrade",
    description: "Route: afk skills upgrade",
  },
  {
    name: "Categorize skills",
    value: "skills-categorize",
    description: "Route: afk skills categorize",
  },
  {
    name: "Import installed skills into the catalog",
    value: "skills-catalog-import",
    description: "Route: afk catalog import",
  },
  {
    name: "Manage skill profiles",
    value: "skills-profiles",
    description: "Open profile list, create, edit, enable, disable, and status",
  },
  {
    name: "Show profile status",
    value: "skills-profile-status",
    description: "Route: afk skills profiles status",
  },
];

export const skillProfilesLobbyChoices: Array<{
  name: string;
  value: SkillProfilesLobbyChoiceValue;
  description: string;
}> = [
  {
    name: "List profiles",
    value: "profiles-list",
    description: "Route: afk skills profiles list",
  },
  {
    name: "Show a profile",
    value: "profiles-show",
    description: "Route: afk skills profiles show",
  },
  {
    name: "Create a profile",
    value: "profiles-create",
    description: "Route: afk skills profiles create",
  },
  {
    name: "Edit a profile",
    value: "profiles-edit",
    description: "Route: afk skills profiles edit",
  },
  {
    name: "Delete a profile definition",
    value: "profiles-delete",
    description: "Route: afk skills profiles delete",
  },
  {
    name: "Enable a profile",
    value: "profiles-enable",
    description: "Route: afk skills profiles enable",
  },
  {
    name: "Disable a profile",
    value: "profiles-disable",
    description: "Route: afk skills profiles disable",
  },
  {
    name: "Show profile status",
    value: "profiles-status",
    description: "Route: afk skills profiles status",
  },
];

export function shouldOpenCompassLobby(argv: string[], env: NodeJS.ProcessEnv, tty: TtyState = currentTtyState()): boolean {
  return argv.length === 0 && tty.stdin && tty.stdout && env.CI !== "true" && env.AFK_NO_LOBBY !== "1";
}

export function renderCompassLobbyIntro(): string {
  return [
    renderBanner(),
    sectionTitle("Field check"),
    fieldLine("Mode", "Compass lobby"),
    fieldLine("Route preview", "on"),
    fieldLine("Next step", "Pick an intent; AFK will show the command before it runs."),
    "",
    sectionTitle("Where are we headed?"),
  ].join("\n");
}

export async function selectCompassLobbyRoute(runtime: Runtime): Promise<string[]> {
  runtime.io.stdout(renderCompassLobbyIntro());
  const selected = await select<LobbyChoiceValue>({
    message: "Pick an intent",
    choices: compassLobbyChoices,
    pageSize: compassLobbyChoices.length,
    loop: false,
    theme: afkSelectTheme,
  });
  if (selected === "skill-management") {
    const route = await selectSkillsLobbyRoute(runtime);
    runtime.io.stdout(renderRoutePreview(route));
    return route;
  }

  const route = selected === "source"
    ? routeForLobbyChoice(selected, await promptDefaultSource())
    : routeForLobbyChoice(selected);
  runtime.io.stdout(renderRoutePreview(route));
  return route;
}

export async function selectSkillsLobbyRoute(runtime: Runtime): Promise<string[]> {
  runtime.io.stdout(renderSkillsLobbyIntro());
  const selected = await select<SkillsLobbyChoiceValue>({
    message: "Pick a skill action",
    choices: skillsLobbyChoices,
    pageSize: skillsLobbyChoices.length,
    loop: false,
    theme: afkSelectTheme,
  });
  if (selected === "skills-profiles") {
    return selectSkillProfilesLobbyRoute(runtime);
  }

  return routeForSkillsLobbyChoice(selected);
}

export async function selectSkillProfilesLobbyRoute(runtime: Runtime): Promise<string[]> {
  runtime.io.stdout(renderSkillProfilesLobbyIntro());
  const selected = await select<SkillProfilesLobbyChoiceValue>({
    message: "Pick a profile action",
    choices: skillProfilesLobbyChoices,
    pageSize: skillProfilesLobbyChoices.length,
    loop: false,
    theme: afkSelectTheme,
  });
  return routeForSkillProfilesLobbyChoice(selected);
}

export function routeForLobbyChoice(value: LobbyChoiceValue, defaultSource?: string): string[] {
  switch (value) {
    case "setup":
      return ["setup"];
    case "source":
      return defaultSource ? ["refresh", "--default-source", defaultSource] : ["refresh", "--default-source"];
    case "refresh":
      return ["refresh"];
    case "skills":
      return ["setup", "skills"];
    case "skill-management":
      return ["skills"];
    case "mcps":
      return ["setup", "mcps"];
    case "plugins":
      return ["setup", "plugins"];
    case "hooks":
      return ["setup", "hooks"];
    case "inspect":
      return ["show"];
    case "skills-react":
      return ["show", "skills", "--react"];
    case "skills-visualize":
      return ["show", "skills", "--visualize"];
    case "catalog-import":
      return ["catalog", "import"];
    case "help":
      return ["--help"];
  }
}

export function routeForSkillsLobbyChoice(value: SkillsLobbyChoiceValue): string[] {
  switch (value) {
    case "skills-list":
      return ["skills", "list"];
    case "skills-show":
      return ["skills", "show"];
    case "skills-open":
      return ["skills", "open"];
    case "skills-disable":
      return ["skills", "disable"];
    case "skills-enable":
      return ["skills", "enable"];
    case "skills-delete":
      return ["skills", "delete"];
    case "skills-upgrade":
      return ["skills", "upgrade"];
    case "skills-categorize":
      return ["skills", "categorize"];
    case "skills-catalog-import":
      return ["catalog", "import"];
    case "skills-profiles":
      return ["skills", "profiles"];
    case "skills-profile-status":
      return ["skills", "profiles", "status"];
  }
}

export function routeForSkillProfilesLobbyChoice(value: SkillProfilesLobbyChoiceValue): string[] {
  switch (value) {
    case "profiles-list":
      return ["skills", "profiles", "list"];
    case "profiles-show":
      return ["skills", "profiles", "show"];
    case "profiles-create":
      return ["skills", "profiles", "create"];
    case "profiles-edit":
      return ["skills", "profiles", "edit"];
    case "profiles-delete":
      return ["skills", "profiles", "delete"];
    case "profiles-enable":
      return ["skills", "profiles", "enable"];
    case "profiles-disable":
      return ["skills", "profiles", "disable"];
    case "profiles-status":
      return ["skills", "profiles", "status"];
  }
}

function renderSkillsLobbyIntro(): string {
  return [
    "",
    sectionTitle("Skill management"),
    fieldLine("Mode", "Focused skill operations"),
    fieldLine("Next step", "Pick a skill action; AFK will route you there."),
    "",
    sectionTitle("What do you want to do with skills?"),
  ].join("\n");
}

function renderSkillProfilesLobbyIntro(): string {
  return [
    "",
    sectionTitle("Skill profiles"),
    fieldLine("Mode", "Profile management"),
    fieldLine("Next step", "Pick a profile action; AFK will route you there."),
    "",
    sectionTitle("What do you want to do with profiles?"),
  ].join("\n");
}

async function promptDefaultSource(): Promise<string> {
  return input({
    message: "Default setup source",
    required: true,
    theme: afkPromptTheme,
  });
}

function renderRoutePreview(route: string[]): string {
  return [
    "",
    `${paint(terminalPalette.harbor, "Route")} ${bold}afk ${route.join(" ")}${reset}`,
    muted("Handing off now."),
  ].join("\n");
}

function fieldLine(label: string, value: string): string {
  return `  ${paint(terminalPalette.driftwood, label.padEnd(14))} ${paint(terminalPalette.lantern, value)}`;
}

function currentTtyState(): TtyState {
  return {
    stdin: Boolean(process.stdin.isTTY),
    stdout: Boolean(process.stdout.isTTY),
  };
}
