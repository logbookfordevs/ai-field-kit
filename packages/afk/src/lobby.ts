import { input, select } from "@inquirer/prompts";
import { renderBanner, muted, sectionTitle } from "./brand.js";
import { afkPromptTheme, afkSelectTheme } from "./prompt-ui.js";
import { bold, paint, reset, terminalPalette } from "./terminal-theme.js";
import { selectMenu, type MenuChoice } from "./menu.js";
import type { Runtime } from "./types.js";

export type LobbyChoiceValue =
  | "setup"
  | "source"
  | "refresh"
  | "catalog"
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
  | "skills-get"
  | "skills-open"
  | "skills-add"
  | "skills-disable"
  | "skills-enable"
  | "skills-invocation"
  | "skills-delete"
  | "skills-upgrade"
  | "skills-categorize"
  | "skills-catalog-import"
  | "skills-profiles"
  | "skills-profile-status";

export type SkillProfilesLobbyChoiceValue =
  | "profiles-use"
  | "profiles-enable"
  | "profiles-disable"
  | "profiles-status"
  | "profiles-manage-definitions";

export type CatalogProfilesLobbyChoiceValue =
  | "profiles-set-mode"
  | "profiles-toggle-always-on"
  | "profiles-list"
  | "profiles-show"
  | "profiles-create"
  | "profiles-edit"
  | "profiles-delete";

export type CatalogSkillsLobbyChoiceValue =
  | "catalog-skills-add"
  | "catalog-skills-edit"
  | "catalog-skills-bulk-edit"
  | "catalog-skills-remove"
  | "catalog-skills-toggle-default"
  | "catalog-skills-toggle-auto"
  | "catalog-skills-import"
  | "catalog-skills-import-status";

type SkillAddMode = "normal" | "start-disabled" | "profile" | "profile-only";

type TtyState = {
  stdin: boolean;
  stdout: boolean;
};

export const compassLobbyChoices: MenuChoice<LobbyChoiceValue>[] = [
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
    name: "Edit local catalog",
    value: "catalog",
    description: "Route: afk catalog",
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
    description: "Route: afk catalog skills import",
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
    name: "Get skill instructions",
    value: "skills-get",
    description: "Route: afk skills get",
  },
  {
    name: "Open a skill file or folder",
    value: "skills-open",
    description: "Route: afk skills open",
  },
  {
    name: "Add a skill",
    value: "skills-add",
    description: "Route: afk skills add",
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
    name: "Change invocation policy",
    value: "skills-invocation",
    description: "Route: afk skills invocation",
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
    description: "Route: afk catalog skills import",
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

export const catalogSkillsLobbyChoices: MenuChoice<CatalogSkillsLobbyChoiceValue>[] = [
  {
    name: "Add a skill catalog item",
    value: "catalog-skills-add",
    description: "Route: afk catalog skills add",
  },
  {
    name: "Bulk edit skill policies",
    value: "catalog-skills-bulk-edit",
    description: "Route: afk catalog skills bulk-edit",
  },
  {
    name: "Edit a skill catalog item",
    value: "catalog-skills-edit",
    description: "Route: afk catalog skills edit",
  },
  {
    name: "Remove a skill catalog item",
    value: "catalog-skills-remove",
    description: "Route: afk catalog skills remove",
  },
  {
    name: "Toggle default skills",
    value: "catalog-skills-toggle-default",
    description: "Route: afk catalog skills toggle-default",
  },
  {
    name: "Toggle skill autoInvocation",
    value: "catalog-skills-toggle-auto",
    description: "Route: afk catalog skills toggle-auto",
  },
  {
    name: "Import installed skills",
    value: "catalog-skills-import",
    description: "Route: afk catalog skills import",
  },
  {
    name: "Check import status",
    value: "catalog-skills-import-status",
    description: "Route: afk catalog skills import-status",
  },
];

export const skillProfilesLobbyChoices: Array<{
  name: string;
  value: SkillProfilesLobbyChoiceValue;
  description: string;
}> = [
  {
    name: "Use a profile for this request",
    value: "profiles-use",
    description: "Route: afk skills profiles use",
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
  {
    name: "Manage profile definitions",
    value: "profiles-manage-definitions",
    description: "Route: afk catalog profiles",
  },
];

export const catalogProfilesLobbyChoices: Array<{
  name: string;
  value: CatalogProfilesLobbyChoiceValue;
  description: string;
}> = [
  {
    name: "Set profile mode",
    value: "profiles-set-mode",
    description: "Route: afk catalog profiles set-mode",
  },
  {
    name: "Toggle always-on skills",
    value: "profiles-toggle-always-on",
    description: "Route: afk catalog profiles toggle-always-on",
  },
  {
    name: "List profile definitions",
    value: "profiles-list",
    description: "Route: afk catalog profiles list",
  },
  {
    name: "Show a profile definition",
    value: "profiles-show",
    description: "Route: afk catalog profiles show",
  },
  {
    name: "Create a profile definition",
    value: "profiles-create",
    description: "Route: afk catalog profiles create",
  },
  {
    name: "Edit a profile definition",
    value: "profiles-edit",
    description: "Route: afk catalog profiles edit",
  },
  {
    name: "Delete a profile definition",
    value: "profiles-delete",
    description: "Route: afk catalog profiles delete",
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
  while (true) {
    runtime.io.stdout(renderCompassLobbyIntro());
    const selected = await selectMenu<LobbyChoiceValue>({
      message: "Pick an intent",
      choices: compassLobbyChoices,
      loop: false,
      theme: afkSelectTheme,
    });
    if (selected === "skill-management") {
      const route = await selectSkillsLobbyRoute(runtime, { canGoBack: true });
      if (!route) {
        continue;
      }

      runtime.io.stdout(renderRoutePreview(route));
      return route;
    }

    if (!selected) {
      continue;
    }

    const route = selected === "source"
      ? routeForLobbyChoice(selected, await promptDefaultSource())
      : routeForLobbyChoice(selected);
    runtime.io.stdout(renderRoutePreview(route));
    return route;
  }
}

export async function selectSkillsLobbyRoute(runtime: Runtime, options: { canGoBack?: boolean } = {}): Promise<string[] | null> {
  while (true) {
    runtime.io.stdout(renderSkillsLobbyIntro());
    const selected = await selectMenu<SkillsLobbyChoiceValue>({
      message: "Pick a skill action",
      choices: skillsLobbyChoices,
      loop: false,
      theme: afkSelectTheme,
      canGoBack: Boolean(options.canGoBack),
    });
    if (!selected) {
      return null;
    }

    if (selected === "skills-profiles") {
      const route = await selectSkillProfilesLobbyRoute(runtime, { canGoBack: true });
      if (!route) {
        continue;
      }

      return route;
    }

    const addOptions = selected === "skills-add" ? await promptSkillAddOptions() : undefined;
    return routeForSkillsLobbyChoice(selected, addOptions);
  }
}

export async function selectSkillProfilesLobbyRoute(runtime: Runtime, options: { canGoBack?: boolean } = {}): Promise<string[] | null> {
  runtime.io.stdout(renderSkillProfilesLobbyIntro());
  const selected = await selectMenu<SkillProfilesLobbyChoiceValue>({
    message: "Pick a profile action",
    choices: skillProfilesLobbyChoices,
    loop: false,
    theme: afkSelectTheme,
    canGoBack: Boolean(options.canGoBack),
  });
  if (!selected) {
    return null;
  }

  if (selected === "profiles-manage-definitions") {
    return selectCatalogProfilesLobbyRoute(runtime, { canGoBack: true });
  }

  return routeForSkillProfilesLobbyChoice(selected);
}

export async function selectCatalogProfilesLobbyRoute(runtime: Runtime, options: { canGoBack?: boolean } = {}): Promise<string[] | null> {
  runtime.io.stdout(renderCatalogProfilesLobbyIntro());
  const selected = await selectMenu<CatalogProfilesLobbyChoiceValue>({
    message: "Pick a profile definition action",
    choices: catalogProfilesLobbyChoices,
    loop: false,
    theme: afkSelectTheme,
    canGoBack: Boolean(options.canGoBack),
  });
  if (!selected) {
    return null;
  }

  return routeForCatalogProfilesLobbyChoice(selected);
}

export async function selectCatalogSkillsLobbyRoute(runtime: Runtime, options: { canGoBack?: boolean } = {}): Promise<string[] | null> {
  runtime.io.stdout(renderCatalogSkillsLobbyIntro());
  const selected = await selectMenu<CatalogSkillsLobbyChoiceValue>({
    message: "Pick a skills catalog action",
    choices: catalogSkillsLobbyChoices,
    loop: false,
    theme: afkSelectTheme,
    canGoBack: Boolean(options.canGoBack),
  });
  if (!selected) {
    return null;
  }

  return routeForCatalogSkillsLobbyChoice(selected);
}

export function routeForLobbyChoice(value: LobbyChoiceValue, defaultSource?: string): string[] {
  switch (value) {
    case "setup":
      return ["setup"];
    case "source":
      return defaultSource ? ["refresh", "--default-source", defaultSource] : ["refresh", "--default-source"];
    case "refresh":
      return ["refresh"];
    case "catalog":
      return ["catalog"];
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
      return ["catalog", "skills", "import"];
    case "help":
      return ["--help"];
  }
}

export function routeForSkillsLobbyChoice(value: SkillsLobbyChoiceValue, addOptions?: {
  source?: string;
  mode?: SkillAddMode;
  profileId?: string;
}): string[] {
  switch (value) {
    case "skills-list":
      return ["skills", "list"];
    case "skills-show":
      return ["skills", "show"];
    case "skills-get":
      return ["skills", "get"];
    case "skills-open":
      return ["skills", "open"];
    case "skills-add":
      return routeForSkillAdd(addOptions);
    case "skills-disable":
      return ["skills", "disable"];
    case "skills-enable":
      return ["skills", "enable"];
    case "skills-invocation":
      return ["skills", "invocation"];
    case "skills-delete":
      return ["skills", "delete"];
    case "skills-upgrade":
      return ["skills", "upgrade"];
    case "skills-categorize":
      return ["skills", "categorize"];
    case "skills-catalog-import":
      return ["catalog", "skills", "import"];
    case "skills-profiles":
      return ["skills", "profiles"];
    case "skills-profile-status":
      return ["skills", "profiles", "status"];
  }
}

export function routeForSkillProfilesLobbyChoice(value: SkillProfilesLobbyChoiceValue): string[] {
  switch (value) {
    case "profiles-use":
      return ["skills", "profiles", "use"];
    case "profiles-enable":
      return ["skills", "profiles", "enable"];
    case "profiles-disable":
      return ["skills", "profiles", "disable"];
    case "profiles-status":
      return ["skills", "profiles", "status"];
    case "profiles-manage-definitions":
      return ["catalog", "profiles"];
  }
}

export function routeForCatalogSkillsLobbyChoice(value: CatalogSkillsLobbyChoiceValue): string[] {
  switch (value) {
    case "catalog-skills-add":
      return ["catalog", "skills", "add"];
    case "catalog-skills-edit":
      return ["catalog", "skills", "edit"];
    case "catalog-skills-bulk-edit":
      return ["catalog", "skills", "bulk-edit"];
    case "catalog-skills-remove":
      return ["catalog", "skills", "remove"];
    case "catalog-skills-toggle-default":
      return ["catalog", "skills", "toggle-default"];
    case "catalog-skills-toggle-auto":
      return ["catalog", "skills", "toggle-auto"];
    case "catalog-skills-import":
      return ["catalog", "skills", "import"];
    case "catalog-skills-import-status":
      return ["catalog", "skills", "import-status"];
  }
}

export function routeForCatalogProfilesLobbyChoice(value: CatalogProfilesLobbyChoiceValue): string[] {
  switch (value) {
    case "profiles-set-mode":
      return ["catalog", "profiles", "set-mode"];
    case "profiles-toggle-always-on":
      return ["catalog", "profiles", "toggle-always-on"];
    case "profiles-list":
      return ["catalog", "profiles", "list"];
    case "profiles-show":
      return ["catalog", "profiles", "show"];
    case "profiles-create":
      return ["catalog", "profiles", "create"];
    case "profiles-edit":
      return ["catalog", "profiles", "edit"];
    case "profiles-delete":
      return ["catalog", "profiles", "delete"];
  }
}

function renderCatalogSkillsLobbyIntro(): string {
  return [
    "",
    sectionTitle("Skill catalog"),
    fieldLine("Mode", "Catalog skill management"),
    fieldLine("Next step", "Pick how to sync skills.json."),
    "",
    sectionTitle("What skills catalog action do you want?"),
  ].join("\n");
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
    fieldLine("Mode", "Runtime profile operations"),
    fieldLine("Next step", "Pick how to apply profile definitions."),
    "",
    sectionTitle("What do you want to do with active profiles?"),
  ].join("\n");
}

function renderCatalogProfilesLobbyIntro(): string {
  return [
    "",
    sectionTitle("Profile definitions"),
    fieldLine("Mode", "Catalog definition management"),
    fieldLine("Next step", "Pick how to edit profiles.json."),
    "",
    sectionTitle("What profile definition do you want to manage?"),
  ].join("\n");
}

async function promptDefaultSource(): Promise<string> {
  return input({
    message: "Default setup source",
    required: true,
    theme: afkPromptTheme,
  });
}

async function promptSkillSource(): Promise<string> {
  return input({
    message: "Skill source",
    required: true,
    theme: afkPromptTheme,
  });
}

async function promptSkillAddOptions(): Promise<{ source: string; mode: SkillAddMode; profileId?: string }> {
  const source = await promptSkillSource();
  const mode = await select<SkillAddMode>({
    message: "Add mode",
    choices: [
      {
        name: "Add normally",
        value: "normal",
        description: "Route: afk skills add <source>",
      },
      {
        name: "Start disabled",
        value: "start-disabled",
        description: "Route: afk skills add <source> --start-disabled",
      },
      {
        name: "Add to profile",
        value: "profile",
        description: "Route: afk skills add <source> --profile <profile>",
      },
      {
        name: "Add to profile only",
        value: "profile-only",
        description: "Route: afk skills add <source> --profile-only <profile>",
      },
    ],
    theme: afkSelectTheme,
  });
  const profileId = mode === "profile" || mode === "profile-only"
    ? await promptSkillProfileId()
    : undefined;
  return { source, mode, ...(profileId ? { profileId } : {}) };
}

async function promptSkillProfileId(): Promise<string> {
  return input({
    message: "Profile id",
    required: true,
    theme: afkPromptTheme,
  });
}

function routeForSkillAdd(addOptions?: {
  source?: string;
  mode?: SkillAddMode;
  profileId?: string;
}): string[] {
  const route = ["skills", "add"];
  if (!addOptions?.source) {
    return route;
  }

  route.push(addOptions.source);
  if (addOptions.mode === "start-disabled") {
    route.push("--start-disabled");
  }
  if (addOptions.mode === "profile" && addOptions.profileId) {
    route.push("--profile", addOptions.profileId);
  }
  if (addOptions.mode === "profile-only" && addOptions.profileId) {
    route.push("--profile-only", addOptions.profileId);
  }
  return route;
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
