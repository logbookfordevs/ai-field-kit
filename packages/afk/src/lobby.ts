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
  | "mcps"
  | "plugins"
  | "hooks"
  | "inspect"
  | "skills-react"
  | "skills-visualize"
  | "catalog-import"
  | "help";

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
    name: "Add or update skills",
    value: "skills",
    description: "Route: afk setup skills",
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
  const route = selected === "source"
    ? routeForLobbyChoice(selected, await promptDefaultSource())
    : routeForLobbyChoice(selected);
  runtime.io.stdout(renderRoutePreview(route));
  return route;
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
